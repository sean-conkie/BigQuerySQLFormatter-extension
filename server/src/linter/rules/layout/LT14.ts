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
  Diagnostic, Range
} from 'vscode-languageserver/node';
import { Rule } from '../base';
import { FileMap } from '../../parser';
import { ComparisonAST, ComparisonGroupAST } from '../../parser/ast';


/**
 * The Parenthesis rule
 * @class Parenthesis
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Parenthesis extends Rule<FileMap> {
  readonly name: string = "parenthesis";
  readonly code: string = "LT14";
  readonly type: RuleType = RuleType.PARSER;
  readonly message: string = "Multiple ON conditions should be in parenthesis.";
  readonly relatedInformation: string = "'On' conditions should be in parenthesis.";

  /**
   * Creates an instance of Parenthesis.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof Parenthesis
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

      const joins = ast[i].joins;

      joins.map((join) => {
        if (join.on instanceof ComparisonGroupAST) {
          errors.push(...this.processComparisonGroup(join.on));
        }
      });

    }

    return errors.length > 0 ? errors : null;
  }

  private processComparisonGroup(comparison: ComparisonGroupAST, documentUri: string | null = null): Diagnostic[] {
    const errors: Diagnostic[] = [];

    const operators: Range[] = [];
    let operatorIndex: number | null = null;
    let indexError = false;
    
    for (const comp of comparison.comparisons) {
      if (comp instanceof ComparisonGroupAST && comp.comparisons.length > 1) {
        errors.push(...this.processComparisonGroup(comp));
      } else if (comp instanceof ComparisonAST) {

        if (comp.operator == null) {
          continue;
        }
        // find all the operators
        const operator = comp.operator!;
        const offset = operator.indexOf('=');
        if (offset > -1) {
          const operatorToken = comp.tokens.filter((token) => token.value === operator)[0];
          if (operatorIndex == null) {
            operatorIndex = operatorToken.startIndex + offset;
          } else if (operatorIndex !== operatorToken.startIndex + offset) {
            indexError = true;
          }
          operators.push({
            start: {
              line: operatorToken.lineNumber!,
              character: operatorToken.startIndex + offset
            },
            end: {
              line: operatorToken.lineNumber!,
              character: operatorToken.endIndex
            }
          });
        }
      }
    }

    if (indexError) {
      operators.map((operator) => errors.push(this.createDiagnostic(operator, documentUri)));
    }

    return errors;

  }
}