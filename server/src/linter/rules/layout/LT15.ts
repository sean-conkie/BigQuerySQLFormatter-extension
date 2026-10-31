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
