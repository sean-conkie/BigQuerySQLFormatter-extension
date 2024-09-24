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
  Diagnostic,
} from 'vscode-languageserver/node';
import { Rule } from '../base';
import { FileMap } from '../../parser';


/**
 * The TrailingComma rule
 * @class TrailingComma
 * @extends Rule
 * @memberof Linter.Rules
 */
export class TrailingComma extends Rule<FileMap> {
  readonly name: string = "trailing_commas";
  readonly code: string = "LT04";
  readonly type: RuleType = RuleType.PARSER;
  readonly message: string = "Commas should be at the end of the line.";

  /**
   * Creates an instance of TrailingComma.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof TrailingComma
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

      for (const column of columns) {
        const filteredTokens = column.tokens.filter((token) => !token.scopes.includes("punctuation.whitespace.leading.sql"));

        // sort the tokens by linenumber then start index
        filteredTokens.sort((a, b) => {
          if (a.lineNumber === b.lineNumber) {
            return a.startIndex - b.startIndex;
          }
          return a.lineNumber! - b.lineNumber!;
        });

        const firstToken = filteredTokens[0];
        const lastToken = filteredTokens[filteredTokens.length - 1];
        
        if ((firstToken.value ?? '') === ',' && lastToken.lineNumber! === firstToken.lineNumber!) {
          errors.push(this.createDiagnostic({
            start: { line: firstToken.lineNumber ?? 0, character: firstToken.startIndex ?? 0 },
            end: { line: firstToken.lineNumber ?? 0, character: firstToken.endIndex ?? 0 }
          }, documentUri));
        } else if (lastToken.value === ',' && lastToken.lineNumber! !== firstToken.lineNumber!) {
          errors.push(this.createDiagnostic({
            start: { line: lastToken.lineNumber ?? 0, character: lastToken.startIndex ?? 0 },
            end: { line: lastToken.lineNumber ?? 0, character: lastToken.endIndex ?? 0 }
          }, documentUri));
        }
      }
    }

    return errors.length > 0 ? errors : null;
  }
}