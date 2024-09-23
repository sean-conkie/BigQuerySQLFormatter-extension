
import { ServerSettings } from "../../../settings";
import { RuleType } from '../enums';
import {
  Diagnostic,
} from 'vscode-languageserver/node';
import { Rule } from '../base';
import { FileMap, ColumnFunctionAST, Token } from '../../parser';


/**
 * The Functions rule
 * @class Functions
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Functions extends Rule<FileMap> {
  readonly name: string = "functions";
  readonly code: string = "LT06";
  readonly type: RuleType = RuleType.PARSER;
  readonly message: string = "Function name not immediately followed by parenthesis.";
  readonly relatedInformation: string = "Function name not immediately followed by parenthesis.";

  /**
   * Creates an instance of Functions.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof Functions
   */
  constructor(settings: ServerSettings, problems: number) {
    super(settings, problems);
  }

  evaluate(ast: FileMap, documentUri: string | null = null): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }

    const errors: Diagnostic[] = [];
    for (const i in ast) {
      // check the columns for functions
      for(const column of ast[i].columns) {
        if (column instanceof ColumnFunctionAST) {
          for (let i = 0; i < column.tokens.length; i++) {
            if (column.function === column.tokens[i].value) {
              // found function, check if it is followed by parenthesis
              if (column.tokens[i + 1].value !== '(') {
                const range = {
                  start: { line: column.tokens[i + 1].lineNumber??0, character: column.tokens[i + 1].startIndex??0 },
                  end: { line: column.tokens[i + 1].lineNumber??0, character: column.tokens[i + 1].endIndex??0 }
                };
                errors.push(this.createDiagnostic(range, documentUri));
              }
            }
          }
        }
      }
    }

    return errors.length > 0 ? errors : null;
  }
}