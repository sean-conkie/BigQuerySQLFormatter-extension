
import { ServerSettings } from "../../../settings";
import { RuleType } from '../enums';
import {
  Diagnostic,
} from 'vscode-languageserver/node';
import { Rule } from '../base';
import { FileMap } from '../../parser';


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

  /**
   * Evaluates the given Abstract Syntax Tree (AST) to identify and report diagnostics related to layout issues.
   * Specifically, it checks for misplaced commas in SQL statements.
   *
   * @param ast - The Abstract Syntax Tree (AST) representing the SQL file structure.
   * @param documentUri - The URI of the document being evaluated. Defaults to null.
   * @returns An array of Diagnostic objects if any issues are found, otherwise null.
   */
  evaluate(ast: FileMap, documentUri: string | null = null): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }

    const errors: Diagnostic[] = [];
    for (const i in ast) {
      for (const column of ast[i].columns) {
        const filteredTokens = column.tokens.filter((token) => !token.scopes.includes("punctuation.whitespace.leading.sql"));
        if ((filteredTokens[0].value ?? '') === ',') {
          errors.push(this.createDiagnostic({
            start: { line: filteredTokens[0].lineNumber ?? 0, character: filteredTokens[0].startIndex ?? 0 },
            end: { line: filteredTokens[0].lineNumber ?? 0, character: filteredTokens[0].endIndex ?? 0 }
          }, documentUri));
        } else if ((filteredTokens.find((token) => token.value === ',')?.lineNumber ?? 0) > (filteredTokens[0].lineNumber ?? 0)) {
          const commaToken = filteredTokens.find((token) => token.value === ',');
          errors.push(this.createDiagnostic({
            start: { line: commaToken?.lineNumber ?? 0, character: commaToken?.startIndex ?? 0 },
            end: { line: commaToken?.lineNumber ?? 0, character: commaToken?.endIndex ?? 0 }
          }, documentUri));
        }
      }
    }

    return errors.length > 0 ? errors : null;
  }
}