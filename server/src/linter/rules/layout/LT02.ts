/**
 * @fileoverview Rules to enforce trailing comma checks
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */


import { ServerSettings } from "../../../settings";
import { RuleType } from '../enums';
import {
  CodeAction,
  CodeActionKind,
  Diagnostic,
  DiagnosticSeverity,
  DocumentUri,
  Range,
  TextDocumentIdentifier,
  TextEdit,
} from 'vscode-languageserver/node';
import { Rule } from '../base';
import { FileMap } from '../../parser';
import { findToken } from '../../parser/utils';
import { excludeTokensWithMatchingScopes, includeTokensWithMatchingScopes } from '../../parser/token';
import { ComparisonAST, ComparisonGroupAST } from '../../parser/ast';

type RangeCache = Map<string, number>
const documentCache: Map<DocumentUri, RangeCache> = new Map<DocumentUri, RangeCache>();

/**
 * The IndentSelect rule
 * @class IndentSelect
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Indent extends Rule<FileMap> {
  readonly name: string = "indent";
  readonly code: string = "LT02";
  readonly type: RuleType = RuleType.PARSER;
  readonly message: string = "Incorrect Indentation.";
  readonly relatedInformation: string = "For improved readability and maintainability, all SQL statements should be indented consistently.";
  readonly ruleGroup: string = 'layout';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Update Indentation';
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;

  /**
   * Creates an instance of IndentSelect.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof IndentSelect
   */
  constructor(settings: ServerSettings, problems: number) {
    super(settings, problems);
  }

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
    let cache = documentCache.get(documentUri!);
    if (!cache) {
      cache = new Map<string, number>();
    }

    for (const i in ast) {
      const offset = (ast[i].startIndex??0) + 7;
      const columns = ast[i].columns;
      const aliasRanges: Range[] = [];
      const columnEndIndexes: number[] = [];
      const from = ast[i].from;
      const joins = ast[i].joins;
      const where = ast[i].where;

      columns.map((column) => {

        // add alias and index details for later processing
        if (column.alias) {
          const aliasToken = findToken(column.tokens, 'entity.name.tag');
          if (aliasToken) {
            aliasRanges.push(
              {
                start: {
                  line: aliasToken.lineNumber??0,
                  character: aliasToken.startIndex
                },
                end: {
                  line: aliasToken.lineNumber??0,
                  character: aliasToken.endIndex
                }
              }
            );
          }
        }

        const columnTokens = excludeTokensWithMatchingScopes(
          column.tokens,
          [
            'entity.name.tag',
            'punctuation.whitespace.leading.sql',
            'punctuation.whitespace.trailing.sql',
            'punctuation.whitespace.sql',
            'punctuation.separator.comma.sql',
            'comment.line.double-dash.sql'
          ]
        );
        if (columnTokens.length > 0) {
          columnEndIndexes.push(columnTokens[columnTokens.length - 1].endIndex);
        } else {
          console.log(column);
        }

        // process leading indentation
        this.checkIndentationError(column.startLine??0, column.startIndex??0, offset, errors, cache!, documentUri);
      });

      const aliasIndex = Math.max(...columnEndIndexes) + 2;

      aliasRanges.map((aliasRange) => this.checkIndentationError(aliasRange.start.line, aliasRange.start.character, aliasIndex, errors, cache!, documentUri));

      if (from) {

        // identify the source keyword
        const fromToken = findToken(from.tokens, 'keyword.from.sql');
        const keywordLength = (fromToken?.value.length??0) + 1;
        const keywordOffset = offset - keywordLength;

        this.checkIndentationError(from.startLine??0, from.startIndex??0, keywordOffset, errors, cache!, documentUri);
      }

      joins.map((join) => {
        // find join type
        const joinParts = join.join?.split(' ');
        let joinOffset = joinParts != null && joinParts.length > 1 && joinParts[0] === 'left' ? 2 : 1;
        joinOffset = offset - (offset - joinOffset);

        this.checkIndentationError(join.startLine??0, join.startIndex??0, joinOffset, errors, cache!, documentUri);

        if (join.on) {
          const onOffset = offset - 3;
          this.checkIndentationError(join.on.startLine??0, join.on.startIndex??0, onOffset, errors, cache!, documentUri);

          // process comparison groups
          const comparisonResults = this.processComparisons(join.on.comparisons, offset);
          this.processComparisonResults(comparisonResults, errors, cache!, documentUri);
        }
      });

      if (where) {
        const whereToken = findToken(where.tokens, 'keyword.where.sql');
        const whereOffset = offset - (offset - 1);

        this.checkIndentationError(where.startLine??0, where.startIndex??0, whereOffset, errors, cache!, documentUri);

        // process comparison groups
        const comparisonResults = this.processComparisons(where.comparisons, offset);
        this.processComparisonResults(comparisonResults, errors, cache!, documentUri);
      }
    }

    documentCache.set(documentUri!, cache);

    return errors.length > 0 ? errors : null;
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
    documentUri: string | null
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

      const [additionalIndentNumber, newRange] = this.createIndentErrorOutputs(
        errorOffset,
        errorRange
      );

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
    documentUri: string | null
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
    comparisons.map((comparison) => {
      let comparisonOffset = offset;

      if (comparison instanceof ComparisonAST) {
        const operator = comparison.logicalOperator;
        if (operator) {
          // adjust offset based on operator
          const operatorAdjustment = operator.toLowerCase() === 'and' ? 4 : 3;
          comparisonOffset = offset - operatorAdjustment;
        }
        
        if (comparison.startIndex !== comparisonOffset) {

          const errorOffset = comparisonOffset - (comparison.startIndex??0);
          const errorRange = {
            start: {
              line: comparison.startLine??0,
              character: comparison.startIndex??0
            },
            end: {
              line: comparison.startLine??0,
              character: comparison.startIndex??0
            }
          }

          const [additionalIdentNumber, newRange] = this.createIndentErrorOutputs(
            errorOffset,
            errorRange
          );

          results.push([additionalIdentNumber, newRange]);
        }
      } else if (comparison instanceof ComparisonGroupAST) {
        comparisonOffset = comparisonOffset + 5;
        results.push(...this.processComparisons(comparison.comparisons, comparisonOffset));
      }
    });
    return results;
  }

  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): CodeAction[] {
    const cachedDocument = documentCache.get(textDocument.uri);
    let text = '';
    if (!cachedDocument) {
      return [];
    }

    const additionalIdentNumber = cachedDocument.get(this.createCacheKey(diagnostic.range));
    if (additionalIdentNumber == null) {
      return [];
    }

    text = ' '.repeat(additionalIdentNumber) + text;
  
    const edit = {
        changes: {
            [textDocument.uri]: [
                TextEdit.replace(diagnostic.range, text)
            ]
        }
    };
    const actions: CodeAction[] = [];
    
    this.codeActionKind.map((kind) => {
      const fix = CodeAction.create(
        this.codeActionTitle,
        edit,
        kind
      );
      fix.diagnostics = [diagnostic];
      actions.push(fix);
    });

    return actions;
  }
}