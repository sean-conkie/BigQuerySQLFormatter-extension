
import { ServerSettings } from "../../../settings";
import { RuleType } from '../enums';
import {
  Diagnostic,
} from 'vscode-languageserver/node';
import { Rule } from '../base';
import { ColumnAST, FileMap } from '../../parser';


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

      for (let j = 0; j < columns.length - 1; j ++) {
        const current = columns[j];
        const next = columns[j + 1]; 
        if (current.lineNumber === next.lineNumber  && current instanceof ColumnAST && next instanceof ColumnAST) {
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