
import { ServerSettings } from "../../../settings";
import { RuleType } from '../enums';
import {
  Diagnostic,
} from 'vscode-languageserver/node';
import { Rule } from '../base';
import { FileMap } from '../../parser';
import { ColumnAST } from '../../parser/ast';


/**
 * The SelectTargets rule
 * @class SelectTargets
 * @extends Rule
 * @memberof Linter.Rules
 */
export class SelectTargets extends Rule<FileMap> {
  readonly name: string = "select_targets";
  readonly code: string = "LT09";
  readonly type: RuleType = RuleType.PARSER;
  readonly message: string = "Select targets should be on separate lines.";
  readonly relatedInformation: string = "For better readability, each target in the `SELECT` clause should be written on a separate line.";
  readonly ruleGroup: string = 'layout';

  /**
   * Creates an instance of SelectTargets.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof SelectTargets
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

      const columns = ast[i].columns;
      if (!columns) {
        continue;
      }

      if (columns.length < 2) {
        continue;
      }

      for (let j = 0; j < columns.length - 1; j ++) {
        let current = columns[j];

        // check if any of the current.tokens has scope `punctuation.separator.comma.sql`
        if (!current.tokens.some(token => token.scopes.includes('punctuation.separator.comma.sql'))) {
          
          // if there is no comma, then loop through the next columns until we find a comma
          let k = j + 1;
          while (k < columns.length && !columns[k].tokens.some(token => token.scopes.includes('punctuation.separator.comma.sql'))) {
            if (k === columns.length - 1) {
              k = -1;
              break;
            }
            k++;
          }

          if (k === -1) {
            continue;
          }

          // update current to the column we found the comma in
          current = columns[k];
          j = k;

        }

        const next = columns[j + 1];

        if (!next) {
          continue;
        }

        if (current.lineNumber === next.lineNumber) {
          errors.push(this.createDiagnostic({
            start: {
              line: current.lineNumber??0,
              character: current.startIndex??0
            },
            end: {
              line: next.lineNumber??0,
              character: next.endIndex??0
            }
          }, documentUri));
        }
      }
    }

    return errors.length > 0 ? errors : null;
  }
}