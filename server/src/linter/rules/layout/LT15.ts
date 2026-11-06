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
  type DocumentUri,
  Range,
  type TextDocumentIdentifier,
} from 'vscode-languageserver/node';
import { ParserRule } from '../base';
import type { FileMap } from '../../parser';
import { ComparisonAST, ComparisonGroupAST } from '../../parser/ast';
import type { Token } from '../../parser/token';
import { parseCondition, type JoinExpression } from '../../joins';
import { keyword, type SourceToken } from '../source';
import { topLevel } from '../../parser/pipe';

type RangeCache = Map<string, number>;
const documentCache: Map<DocumentUri, RangeCache> = new Map<DocumentUri, RangeCache>();

/**
 * The ComparisonOperators rule
 * @class ComparisonOperators
 * @extends Rule
 * @memberof Linter.Rules
 */
export class ComparisonOperators extends ParserRule {
  readonly name: string = 'comparison_operators';
  readonly code: string = 'LT15';
  readonly message: string = 'Align equal sign in comparison blocks.';
  readonly relatedInformation: string =
    'When the equal (`=`) signs in a `WHERE` clause or join conditions are misaligned across multiple rows, it reduces the readability and consistency of the query.';
  readonly ruleGroup: string = 'layout';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Format comparison operators';

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

    documentCache.delete(documentUri!);
    const errors: Diagnostic[] = [];
    for (const i in ast) {
      if (ast[i].hasExtendedQuerySyntax) {
        const tokens = ast[i].sourceTokens;
        for (const stage of ast[i].pipeClauses) {
          let start: number | undefined;
          if (stage.kind === 'filter') start = stage.body;
          if (stage.kind === 'source' && stage.condition.length) start = tokens.indexOf(stage.condition[0]);
          if (start !== undefined && start < stage.end) {
            errors.push(
              ...this.processPipeGroup(parseCondition(tokens, start, stage.end).expression, tokens, documentUri),
            );
          }
        }
        if (ast[i].pipeClauses.length) continue;
      }
      const where = ast[i].where;

      if (where instanceof ComparisonGroupAST && where.comparisons.length > 1) {
        errors.push(...this.processComparisonGroup(where, documentUri));
      }

      const joins = ast[i].joins;
      if (!joins) {
        continue;
      }

      joins.forEach((join) => {
        if (join.on instanceof ComparisonGroupAST) {
          errors.push(...this.processComparisonGroup(join.on, documentUri));
        }
      });
    }

    return errors.length > 0 ? errors : null;
  }

  private processPipeGroup(group: JoinExpression, tokens: SourceToken[], uri: string | null): Diagnostic[] {
    if (group.kind === 'group') return this.processPipeGroup(group.expression, tokens, uri);
    if (group.kind !== 'boolean') return [];
    const lines = group.children.map((child) => tokens[child.start].range.start.line);
    if (new Set(lines).size !== lines.length) return [];
    const errors = group.children.flatMap((child) =>
      child.kind === 'predicate' ? [] : this.processPipeGroup(child, tokens, uri),
    );
    const comparisons = group.children.flatMap((child) =>
      child.kind === 'predicate' && child.comparison && /^[=!<>]+$/.test(child.comparison.operator)
        ? [child.comparison]
        : [],
    );
    if (comparisons.length < 2) return errors;
    if (
      comparisons.some(
        (comparison) =>
          comparison.left.range.end.line !== tokens[comparison.operatorStart].range.start.line ||
          topLevel(tokens, comparison.left.start, comparison.left.end).some((i) => keyword(tokens[i], 'SELECT')),
      )
    )
      return errors;
    const required = Math.max(...comparisons.map((comparison) => comparison.left.range.end.character)) + 2;
    const cache = documentCache.get(uri!) ?? new Map<string, number>();
    for (const comparison of comparisons) {
      const operator = tokens[comparison.operatorStart];
      const adjustment = comparison.operator.length > 1 || !comparison.operator.includes('=') ? 1 : 0;
      const offset = required - operator.range.start.character - adjustment;
      if (!offset) continue;
      const [indentation, range] = this.createIndentErrorOutputs(offset, {
        start: { ...operator.range.start },
        end: { ...operator.range.start },
      });
      errors.push(this.createDiagnostic(range, uri));
      cache.set(this.createCacheKey(range), indentation);
    }
    documentCache.set(uri!, cache);
    return errors;
  }

  private processComparisonGroup(comparison: ComparisonGroupAST, documentUri: string | null = null): Diagnostic[] {
    const lines = comparison.comparisons.map((comp) => comp.startLine);
    if (new Set(lines).size !== lines.length) {
      return [];
    }

    const errors: Diagnostic[] = [];
    const operators: Token[] = [];
    const operatorIndexes: number[] = [];

    for (const comp of comparison.comparisons) {
      if (comp instanceof ComparisonGroupAST && comp.comparisons.length > 1) {
        errors.push(...this.processComparisonGroup(comp, documentUri));
      } else if (comp instanceof ComparisonAST) {
        const operator = comp.operator;
        if (operator == null) {
          continue;
        }
        // find all the operators
        const operatorToken = comp.tokens.filter((token) => token.value === operator)[0];
        if (comp.left != null) {
          operatorIndexes.push(comp.left.endIndex ?? 0);
        }
        operators.push(operatorToken);
      }
    }

    let cache = documentCache.get(documentUri!);
    if (!cache) {
      cache = new Map<string, number>();
    }

    const requiredIndex = Math.max(...operatorIndexes) + 2;
    operators.forEach((operator) => {
      // adjust the startIndex to account for gte & lte & neq
      // we want the '=' to line up so add 1 to the index
      let operatorStartIndex = operator.startIndex;
      if (operator.value.trim().length > 1 || operator.value.indexOf('=') === -1) {
        operatorStartIndex++;
      }
      if (operatorStartIndex !== requiredIndex) {
        const errorOffset = requiredIndex - operatorStartIndex;
        const errorRange = {
          start: {
            line: operator.lineNumber!,
            character: operator.startIndex,
          },
          end: {
            line: operator.lineNumber!,
            character: operator.startIndex,
          },
        };
        const [additionalIdentNumber, newRange] = this.createIndentErrorOutputs(errorOffset, errorRange);
        errors.push(this.createDiagnostic(newRange, documentUri));
        cache!.set(this.createCacheKey(newRange), additionalIdentNumber);
      }
    });

    documentCache.set(documentUri!, cache);

    return errors;
  }

  /**
   * Creates a set of code actions to fix diagnostics.
   *
   * @param textDocument - The identifier of the text document where the diagnostic was reported.
   * @param diagnostic - The diagnostic information about the issue to be fixed.
   * @returns An array of code actions that can be applied to fix the issue.
   */
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
