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
        if (column.startIndex !== offset) {

          const errorOffset = offset - (column.startIndex??0);
          const errorRange = {
            start: {
              line: column.startLine??0,
              character: column.startIndex??0
            },
            end: {
              line: column.startLine??0,
              character: column.startIndex??0
            }
          }

          const [additionalIdentNumber, newRange] = this.createIndentErrorOutputs(
            offset,
            errorOffset,
            errorRange
          );

          errors.push(this.createDiagnostic(
            newRange,
            documentUri
          ));
          cache.set(this.createCacheKey(newRange), additionalIdentNumber);
        }
      });

      const aliasIndex = Math.max(...columnEndIndexes) + 2;

      aliasRanges.map((aliasRange) => {
        if (aliasRange.start.character !== aliasIndex) {

          const errorOffset = aliasIndex - aliasRange.start.character;
          const errorRange = {
            start: {
              line: aliasRange.start.line,
              character: aliasRange.start.character
            },
            end: {
              line: aliasRange.start.line,
              character: aliasRange.start.character
            }
          }

          const [additionalIdentNumber, newRange] = this.createIndentErrorOutputs(
            aliasIndex,
            errorOffset,
            errorRange
          );

          errors.push(this.createDiagnostic(
            newRange,
            documentUri
          ));
          cache.set(this.createCacheKey(newRange), additionalIdentNumber);
        }
      });

      if (from) {

        // identify the source keyword
        const fromToken = findToken(from.tokens, 'keyword.from.sql');
        const keywordLength = (fromToken?.value.length??0) + 1;
        const keywordOffset = offset - keywordLength;

        if (from.startIndex !== keywordOffset) {

          const errorOffset = keywordOffset - (from.startIndex??0);
          const errorRange = {
            start: {
              line: from.startLine??0,
              character: from.startIndex??0
            },
            end: {
              line: from.startLine??0,
              character: from.startIndex??0
            }
          }

          const [additionalIdentNumber, newRange] = this.createIndentErrorOutputs(
            keywordOffset,
            errorOffset,
            errorRange
          );

          errors.push(this.createDiagnostic(
            newRange,
            documentUri
          ));
          cache.set(this.createCacheKey(newRange), additionalIdentNumber);
        }
      }

      joins.map((join) => {
        // find join type
        const joinParts = join.join?.split(' ');
        let joinOffset = joinParts != null && joinParts.length > 1 && joinParts[0] === 'left' ? 2 : 1;
        joinOffset = offset - (offset - joinOffset);

        if (join.startIndex != joinOffset) {

          const errorOffset = joinOffset - (join.startIndex??0);
          const errorRange = {
            start: {
              line: join.startLine??0,
              character: join.startIndex??0
            },
            end: {
              line: join.startLine??0,
              character: join.startIndex??0
            }
          }

          const [additionalIdentNumber, newRange] = this.createIndentErrorOutputs(
            joinOffset,
            errorOffset,
            errorRange
          );

          errors.push(this.createDiagnostic(
            newRange,
            documentUri
          ));
          cache.set(this.createCacheKey(newRange), additionalIdentNumber);

        }

        if (join.on) {
          const onOffset = offset - 3;
          if (join.on.startIndex !== onOffset) {

            const errorOffset = onOffset - (join.on.startIndex??0);
            const errorRange = {
              start: {
                line: join.on.startLine??0,
                character: join.on.startIndex??0
              },
              end: {
                line: join.on.startLine??0,
                character: join.on.startIndex??0
              }
            }

            const [additionalIdentNumber, newRange] = this.createIndentErrorOutputs(
              onOffset,
              errorOffset,
              errorRange
            );

            errors.push(this.createDiagnostic(
              newRange,
              documentUri
            ));
            cache.set(this.createCacheKey(newRange), additionalIdentNumber);
          }

          // process comparison groups
          const comparisonResults = this.processComparisons(join.on.comparisons, offset);
          comparisonResults.map((result) => {
            const [additionalIdentNumber, newRange] = result;
            errors.push(this.createDiagnostic(
              newRange,
              documentUri
            ));
            cache.set(this.createCacheKey(newRange), additionalIdentNumber);
          });
        }
      });

      if (where) {
        const whereToken = findToken(where.tokens, 'keyword.where.sql');
        const whereOffset = offset - (offset - 1);

        if (where.startIndex !== whereOffset) {

          const errorOffset = whereOffset - (where.startIndex??0);
          const errorRange = {
            start: {
              line: whereToken?.lineNumber??0,
              character: whereToken?.startIndex??0
            },
            end: {
              line: whereToken?.lineNumber??0,
              character: whereToken?.startIndex??0
            }
          }

          const [additionalIdentNumber, newRange] = this.createIndentErrorOutputs(
            whereOffset,
            errorOffset,
            errorRange
          );

          errors.push(this.createDiagnostic(
            newRange,
            documentUri
          ));
          cache.set(this.createCacheKey(newRange), additionalIdentNumber);
        }

        // process comparison groups
        const comparisonResults = this.processComparisons(where.comparisons, offset);
        comparisonResults.map((result) => {
          const [additionalIdentNumber, newRange] = result;
          errors.push(this.createDiagnostic(
            newRange,
            documentUri
          ));
          cache.set(this.createCacheKey(newRange), additionalIdentNumber);
        });
      }
    }

    documentCache.set(documentUri!, cache);

    return errors.length > 0 ? errors : null;
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
            comparisonOffset,
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