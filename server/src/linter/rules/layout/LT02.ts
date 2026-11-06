/**
 * @fileoverview Rules to enforce trailing comma checks
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import type { ServerSettings } from '../../../settings';
import {
  type CodeAction,
  CodeActionKind,
  type Diagnostic,
  DiagnosticSeverity,
  type DocumentUri,
  type Range,
  type TextDocumentIdentifier,
} from 'vscode-languageserver/node';
import { ParserRule } from '../base';
import type { FileMap } from '../../parser';
import { findToken } from '../../parser/utils';
import { excludeTokensWithMatchingScopes, includeTokensWithMatchingScopes } from '../../parser/token';
import { ComparisonAST, ComparisonGroupAST } from '../../parser/ast';
import { globalTokenCache } from '../../parser/tokenCache';
import { comparePositions, isCode, queryRange } from '../../parser/queryBlocks';
import { closingBracket, keyword, sourceTokens, type SourceToken } from '../source';
import { QueryScopeResolver } from '../../scope';
import { topLevel } from '../../parser/pipe';
import type { DocumentCache } from '../../parser/tokenCache';
import { pipeLayouts } from './pipe';

type RangeCache = Map<string, number>;
const documentCache: Map<DocumentUri, RangeCache> = new Map<DocumentUri, RangeCache>();

/**
 * The IndentSelect rule
 * @class IndentSelect
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Indent extends ParserRule {
  readonly name: string = 'indent';
  readonly code: string = 'LT02';
  readonly message: string = 'Incorrect Indentation.';
  readonly relatedInformation: string =
    'For improved readability and maintainability, all SQL statements should be indented consistently.';
  readonly ruleGroup: string = 'layout';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Update Indentation';
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;

  /**
   * Evaluates the provided Abstract Syntax Tree (AST) to identify and return diagnostics for layout issues.
   * Specifically, it checks for misplaced commas in the SQL code represented by the AST.
   *
   * @param ast - The Abstract Syntax Tree (AST) representing the SQL code to be evaluated.
   * @param documentUri - The URI of the document being evaluated. This parameter is optional and defaults to null.
   * @returns An array of `Diagnostic` objects representing the layout issues found, or null if no issues are found or the rule is disabled.
   */
  evaluate(ast: FileMap, documentUri: string | null = null): Diagnostic[] | null {
    if (this.enabled === false) {
      return null;
    }

    const errors: Diagnostic[] = [];
    const cache = new Map<string, number>();
    const document = documentUri === null ? undefined : globalTokenCache.get(documentUri);
    const tokens = document ? sourceTokens(document) : [];
    const checkedJoins = new Set<string>();

    for (const i in ast) {
      if (!ast[i].tokens.length) continue;
      const range = queryRange(ast[i]);
      const statementTokens = tokens.filter(
        (token) =>
          comparePositions(token.range.start, range.start) >= 0 && comparePositions(token.range.end, range.end) <= 0,
      );
      if (document) {
        this.checkPipes(statementTokens, document, errors, cache, documentUri, checkedJoins);
        this.checkJoins(statementTokens, document, errors, cache, documentUri, checkedJoins);
      }
      const first = ast[i].tokens.find(isCode);
      // The legacy AST also represents procedural and DDL tokens as SELECT columns.
      if (
        ast[i].hasExtendedQuerySyntax ||
        !first ||
        !/^(select|with)$/i.test(first.value) ||
        !first.scopes.includes('keyword.select.sql')
      )
        continue;
      const offset = (ast[i].startIndex ?? 0) + 7;
      const fromIndex = topLevel(statementTokens, 0, statementTokens.length).find((index) =>
        keyword(statementTokens[index], 'FROM'),
      );
      const selectEnd = fromIndex === undefined ? undefined : statementTokens[fromIndex].range.start;
      // TextMate can classify plain JOIN bodies as SELECT expressions.
      const columns = ast[i].columns.filter(
        (column) =>
          !selectEnd ||
          comparePositions({ line: column.startLine ?? 0, character: column.startIndex ?? 0 }, selectEnd) < 0,
      );
      const aliasRanges: Range[] = [];
      const columnEndIndexes: number[] = [];
      const columnLines = columns.map((column) => column.startLine);
      const alignAliases = new Set(columnLines).size === columnLines.length;
      const from = ast[i].from;
      const where = ast[i].where;

      columns.forEach((column) => {
        const columnTokens = excludeTokensWithMatchingScopes(column.tokens, [
          'entity.name.tag',
          'punctuation.whitespace.leading.sql',
          'punctuation.whitespace.trailing.sql',
          'punctuation.whitespace.sql',
          'punctuation.separator.comma.sql',
          'comment.line.double-dash.sql',
        ]);
        if (columnTokens.length === 0 || column.startLine === null || column.startIndex === null) return;
        columnEndIndexes.push(columnTokens[columnTokens.length - 1].endIndex);

        // add alias and index details for later processing
        if (alignAliases && column.alias) {
          const aliasToken = findToken(column.tokens, 'entity.name.tag');
          if (aliasToken) {
            aliasRanges.push({
              start: {
                line: aliasToken.lineNumber ?? 0,
                character: aliasToken.startIndex,
              },
              end: {
                line: aliasToken.lineNumber ?? 0,
                character: aliasToken.endIndex,
              },
            });
          }
        }

        // process leading indentation
        this.checkIndentationError(column.startLine ?? 0, column.startIndex ?? 0, offset, errors, cache!, documentUri);
      });

      const aliasIndex = Math.max(...columnEndIndexes) + 1;

      aliasRanges.map((aliasRange) =>
        this.checkIndentationError(
          aliasRange.start.line,
          aliasRange.start.character,
          aliasIndex,
          errors,
          cache!,
          documentUri,
        ),
      );

      if (from) {
        // identify the source keyword
        const fromToken = findToken(from.tokens, 'keyword.from.sql');
        const keywordLength = (fromToken?.value.length ?? 0) + 1;
        const keywordOffset = offset - keywordLength;

        this.checkIndentationError(
          from.startLine ?? 0,
          from.startIndex ?? 0,
          keywordOffset,
          errors,
          cache!,
          documentUri,
        );
      }

      if (where) {
        const whereToken = findToken(where.tokens, 'keyword.where.sql');
        const whereOffset = offset - (offset - 1);

        this.checkIndentationError(
          where.startLine ?? 0,
          where.startIndex ?? 0,
          whereOffset,
          errors,
          cache!,
          documentUri,
        );

        // process comparison groups
        const comparisonResults = this.processComparisons(where.comparisons, offset);
        this.processComparisonResults(comparisonResults, errors, cache!, documentUri);
      }
    }

    documentCache.set(documentUri!, cache);

    const literals = tokens.filter((token) => token.literal);
    const safeErrors = errors.filter(({ range }) => {
      const line = document?.get(range.start.line)?.value;
      if (
        cache.get(this.createCacheKey(range)) === 0 &&
        /\S/.test(line?.[range.start.character - 1] ?? '') &&
        /\S/.test(line?.[range.end.character] ?? '')
      )
        return false;
      return !literals.some(
        ({ range: literal }) =>
          comparePositions(range.start, literal.end) < 0 && comparePositions(range.end, literal.start) > 0,
      );
    });
    return safeErrors.length > 0 ? safeErrors : null;
  }

  private checkPipes(
    tokens: SourceToken[],
    document: DocumentCache,
    errors: Diagnostic[],
    cache: RangeCache,
    uri: string | null,
    checked: Set<string>,
  ): void {
    for (const { stages } of pipeLayouts(tokens)) {
      for (const stage of stages) {
        if (stage.kind === 'source' && stage.operator.endsWith('JOIN')) continue;
        const offset = tokens[stage.start].range.start.character;
        const aligned = new Map<SourceToken, number>();
        if (stage.kind === 'projection') {
          const first = stage.items[0]?.tokens[0];
          const firstIndex = first ? tokens.indexOf(first) : stage.body;
          const expressionOffset =
            offset +
            3 +
            tokens.slice(stage.start + 2, firstIndex).reduce((width, token) => width + token.value.length + 1, 0);
          for (const item of stage.items) aligned.set(item.tokens[0], expressionOffset);
          if (first && first.range.start.line === tokens[firstIndex - 1].range.end.line) {
            const gap = document.getText({ start: tokens[firstIndex - 1].range.end, end: first.range.start });
            if (/^[ \t]+$/.test(gap))
              this.checkIndentationError(
                first.range.start.line,
                first.range.start.character,
                tokens[firstIndex - 1].range.end.character + 1,
                errors,
                cache,
                uri,
              );
          }
          if (stage.groupStart !== undefined) aligned.set(tokens[stage.groupStart], offset + 3);
          if (stage.groupStart !== undefined && stage.groupExpressionStart !== undefined) {
            const groupOffset =
              offset +
              3 +
              tokens
                .slice(stage.groupStart, stage.groupExpressionStart)
                .reduce((width, token) => width + token.value.length + 1, 0);
            for (const item of stage.groupBy) aligned.set(item.tokens[0], groupOffset);
          }
          if (new Set(stage.items.map((item) => item.tokens[0].range.start.line)).size === stage.items.length) {
            const ends = stage.items.map((item) => item.expression.at(-1)?.range.end.character ?? 0);
            const aliasOffset = Math.max(...ends) + 1;
            for (const item of stage.items) {
              const alias = item.as ?? item.alias;
              const end = item.expression.at(-1)?.range.end;
              if (
                alias &&
                end &&
                end.line === alias.range.start.line &&
                /^[ \t]+$/.test(document.getText({ start: end, end: alias.range.start }))
              ) {
                this.checkIndentationError(
                  alias.range.start.line,
                  alias.range.start.character,
                  aliasOffset,
                  errors,
                  cache,
                  uri,
                );
              }
            }
          }
        }
        if (stage.kind === 'order' || stage.kind === 'columns') {
          for (const item of stage.items) aligned.set(item.tokens[0], offset + 3 + stage.operator.length + 1);
        }
        let depth = 0;
        for (let i = stage.start + 2; i < stage.end; i++) {
          const token = tokens[i];
          if (keyword(token, ')') || keyword(token, ']')) depth = Math.max(0, depth - 1);
          let desired = aligned.get(token) ?? offset + 3 + depth * 2;
          if (stage.kind === 'filter' && (keyword(token, 'AND') || keyword(token, 'OR')))
            desired = offset + 9 - token.value.length - 1 + depth * 2;
          this.checkLineIndent(token, desired, document, errors, cache, uri, checked);
          if (keyword(token, '(') || keyword(token, '[')) {
            const close = closingBracket(tokens, i);
            if (['SELECT', 'WITH', 'FROM'].some((word) => keyword(tokens[i + 1], word))) {
              this.checkLineIndent(tokens[i + 1], offset + 3 + depth * 2, document, errors, cache, uri, checked);
              if (close < 0) break;
              i = close - 1;
            } else depth++;
          }
        }
      }
    }
  }

  private checkJoins(
    tokens: SourceToken[],
    document: DocumentCache,
    errors: Diagnostic[],
    cache: RangeCache,
    uri: string | null,
    checked: Set<string>,
  ): void {
    const resolver = new QueryScopeResolver(tokens);
    for (const scope of resolver.scopes) {
      if (scope.kind !== 'query') continue;
      const stage = scope.pipe;
      if (stage) {
        if (stage.kind !== 'source' || !stage.operator.endsWith('JOIN')) continue;
        const offset = tokens[stage.start].range.start.character;
        this.checkJoinBody(tokens.slice(stage.start + 2, stage.end), offset, document, errors, cache, uri, checked);
        continue;
      }
      const indices = topLevel(tokens, scope.start, scope.end);
      const select = indices.find((index) => keyword(tokens[index], 'SELECT'));
      if (select === undefined) continue;
      const from = scope.sources.find((source) => keyword(tokens[source.start - 1], 'FROM'));
      const fromPosition = from ? tokens[from.start - 1].range.start : undefined;
      const offset =
        fromPosition && /^[ \t]*$/.test(document.get(fromPosition.line)!.value.slice(0, fromPosition.character))
          ? fromPosition.character + 2
          : tokens[select].range.start.character + 4;
      const joins = indices.filter((index) => keyword(tokens[index], 'JOIN'));
      for (const index of joins) {
        let start = index;
        while (start > scope.start && /^(INNER|LEFT|RIGHT|FULL|CROSS|OUTER|NATURAL)$/i.test(tokens[start - 1].value))
          start--;
        const end =
          indices.find(
            (next) =>
              next > index &&
              !tokens[next].literal &&
              /^(JOIN|INNER|LEFT|RIGHT|FULL|CROSS|NATURAL|WHERE|GROUP|HAVING|QUALIFY|WINDOW|ORDER|LIMIT|;)$/.test(
                tokens[next].value.toUpperCase(),
              ),
          ) ?? scope.end;
        this.checkJoinBody(tokens.slice(start, end), offset, document, errors, cache, uri, checked);
      }
    }
  }

  private checkJoinBody(
    tokens: SourceToken[],
    offset: number,
    document: DocumentCache,
    errors: Diagnostic[],
    cache: RangeCache,
    uri: string | null,
    checked: Set<string>,
  ): void {
    let condition = false;
    let depth = 0;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const clause = keyword(token, 'ON') || keyword(token, 'USING');
      if (clause) condition = true;
      if (keyword(token, ')') || keyword(token, ']')) depth = Math.max(0, depth - 1);
      const desired = i === 0 ? offset : offset + (clause || !condition ? 2 : 4) + depth * 2;
      this.checkLineIndent(token, desired, document, errors, cache, uri, checked);
      if (keyword(token, '(') || keyword(token, '[')) {
        const close = closingBracket(tokens, i);
        // Nested queries have their own FROM/JOIN offsets.
        if (['SELECT', 'WITH', 'FROM'].some((word) => keyword(tokens[i + 1], word))) {
          if (close < 0) break;
          i = close;
        } else depth++;
      }
    }
  }

  private checkLineIndent(
    token: SourceToken,
    desired: number,
    document: DocumentCache,
    errors: Diagnostic[],
    cache: RangeCache,
    uri: string | null,
    checked: Set<string>,
  ): void {
    const { line, character } = token.range.start;
    const key = `${line}:${character}`;
    if (checked.has(key) || !/^[ \t]*$/.test(document.get(line)!.value.slice(0, character))) return;
    this.checkIndentationError(line, character, desired, errors, cache, uri);
    checked.add(key);
  }

  /**
   * Checks for indentation errors in the given line and character position.
   * If an error is found, it creates a diagnostic error and updates the cache.
   *
   * @param startLine - The line number where the check starts.
   * @param startCharacter - The character position where the check starts.
   * @param desiredOffset - The desired indentation offset.
   * @param errors - An array to store diagnostic errors.
   * @param cache - A cache to store indentation error information.
   * @param documentUri - The URI of the document being checked.
   */
  private checkIndentationError(
    startLine: number,
    startCharacter: number,
    desiredOffset: number,
    errors: Diagnostic[],
    cache: Map<string, number>,
    documentUri: string | null,
  ): void {
    if (startCharacter !== desiredOffset) {
      const errorOffset = desiredOffset - startCharacter;

      const errorRange = {
        start: {
          line: startLine,
          character: startCharacter,
        },
        end: {
          line: startLine,
          character: startCharacter,
        },
      };

      const [additionalIndentNumber, newRange] = this.createIndentErrorOutputs(errorOffset, errorRange);

      errors.push(this.createDiagnostic(newRange, documentUri));
      cache.set(this.createCacheKey(newRange), additionalIndentNumber);
    }
  }

  /**
   * Processes the comparison results by creating diagnostics and updating the cache.
   *
   * @param comparisonResults - An array of tuples where each tuple contains an additional indent number and a range.
   * @param errors - An array to which diagnostics will be added.
   * @param cache - A map used to cache the additional indent numbers associated with specific ranges.
   * @param documentUri - The URI of the document being processed, or null if not applicable.
   * @returns void
   */
  private processComparisonResults(
    comparisonResults: [number, Range][],
    errors: Diagnostic[],
    cache: Map<string, number>,
    documentUri: string | null,
  ): void {
    comparisonResults.forEach(([additionalIndentNumber, newRange]) => {
      errors.push(this.createDiagnostic(newRange, documentUri));
      cache.set(this.createCacheKey(newRange), additionalIndentNumber);
    });
  }

  /**
   * Processes an array of comparisons and returns an array of tuples containing
   * an additional indent number and a range for each comparison that does not
   * match the expected offset.
   *
   * @param comparisons - An array of ComparisonAST or ComparisonGroupAST objects to process.
   * @param offset - The initial offset to use for comparison.
   * @returns An array of tuples where each tuple contains:
   *   - A number representing the additional indent required.
   *   - A Range object indicating the start and end positions of the error.
   */
  private processComparisons(comparisons: (ComparisonAST | ComparisonGroupAST)[], offset: number): [number, Range][] {
    const results: [number, Range][] = [];
    comparisons.forEach((comparison) => {
      let comparisonOffset = offset;

      if (comparison instanceof ComparisonAST) {
        if (comparison.startLine == null || comparison.startIndex == null) {
          return;
        }
        const operator = comparison.logicalOperator;
        if (operator) {
          // adjust offset based on operator
          const operatorAdjustment = operator.toLowerCase() === 'and' ? 4 : 3;
          comparisonOffset = offset - operatorAdjustment;
        }

        if (comparison.startIndex !== comparisonOffset) {
          const errorOffset = comparisonOffset - (comparison.startIndex ?? 0);
          const errorRange = {
            start: {
              line: comparison.startLine ?? 0,
              character: comparison.startIndex ?? 0,
            },
            end: {
              line: comparison.startLine ?? 0,
              character: comparison.startIndex ?? 0,
            },
          };

          const [additionalIdentNumber, newRange] = this.createIndentErrorOutputs(errorOffset, errorRange);

          results.push([additionalIdentNumber, newRange]);
        }
      } else if (comparison instanceof ComparisonGroupAST) {
        comparisonOffset = comparisonOffset + 5;
        results.push(...this.processComparisons(comparison.comparisons, comparisonOffset));
      }
    });
    return results;
  }

  closeDocument(uri: string): void {
    documentCache.delete(uri);
  }

  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): CodeAction[] {
    return this.createIndentCodeActions(
      textDocument,
      diagnostic,
      documentCache.get(textDocument.uri)?.get(this.createCacheKey(diagnostic.range)),
      this.codeActionKind,
      this.codeActionTitle,
    );
  }
}
