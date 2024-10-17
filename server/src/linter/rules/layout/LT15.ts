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
  Diagnostic, DocumentUri, Range,
  TextDocumentIdentifier,
  TextEdit
} from 'vscode-languageserver/node';
import { Rule } from '../base';
import { FileMap } from '../../parser';
import { ComparisonAST, ComparisonGroupAST } from '../../parser/ast';
import { Token } from '../../parser/token';

type RangeCache = Map<string, number>
const documentCache: Map<DocumentUri, RangeCache> = new Map<DocumentUri, RangeCache>();

/**
 * The ComparisonOperators rule
 * @class ComparisonOperators
 * @extends Rule
 * @memberof Linter.Rules
 */
export class ComparisonOperators extends Rule<FileMap> {
  readonly name: string = "comparison_operators";
  readonly code: string = "LT15";
  readonly type: RuleType = RuleType.PARSER;
  readonly message: string = "Align equal sign in comparison blocks.";
  readonly relatedInformation: string = "When the equal (`=`) signs in a `WHERE` clause or join conditions are misaligned across multiple rows, it reduces the readability and consistency of the query.";
  readonly ruleGroup: string = 'layout';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Format comparison operators';

  /**
   * Creates an instance of ComparisonOperators.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof ComparisonOperators
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
    for (const i in ast) {

      const where = ast[i].where;

      if (where instanceof ComparisonGroupAST && where.comparisons.length > 1) {
        errors.push(...this.processComparisonGroup(where, documentUri));
      }

      const joins = ast[i].joins;
      if (!joins) {
        continue;
      }

      joins.map((join) => {
        if (join.on instanceof ComparisonGroupAST) {
          errors.push(...this.processComparisonGroup(join.on, documentUri));
        }
      });

    }

    return errors.length > 0 ? errors : null;
  }

  private processComparisonGroup(comparison: ComparisonGroupAST, documentUri: string | null = null): Diagnostic[] {
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
          operatorIndexes.push(comp.left.endIndex??0);
        }
        operators.push(operatorToken);
      }
    }

    let cache = documentCache.get(documentUri!);
    if (!cache) {
      cache = new Map<string, number>();
    }

    const requiredIndex = Math.max(...operatorIndexes) + 2;
    operators.map((operator) => {
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
            character: operator.startIndex
          },
          end: {
            line: operator.lineNumber!,
            character: operator.startIndex
          }
        }
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