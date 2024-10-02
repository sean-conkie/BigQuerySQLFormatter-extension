/**
 * @fileoverview Rules to enforce start of file checks
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */


import { ServerSettings } from "../../../settings";
import {
  Diagnostic,
} from 'vscode-languageserver/node';
import { Rule } from '../base';

/**
 * The StartOfFile rule
 * @class StartOfFile
 * @extends Rule
 * @memberof Linter.Rules
 */
export class StartOfFile extends Rule<string> {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = "start_of_file";
  readonly code: string = "LT13";
  readonly message: string = "Files must not begin with newlines or whitespace.";
  readonly relatedInformation: string = "Ensuring files do not begin with newlines or whitespace promotes clean and predictable code formatting.";
  readonly pattern: RegExp = /^[\s]/;
  readonly ruleGroup: string = 'layout';


  /**
   * Creates an instance of StartOfFile.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof StartOfFile
   */
  constructor(settings: ServerSettings, problems: number) {
    super(settings, problems);
  }

  /**
   * Evaluates the given test string against a specific pattern and returns diagnostics if the pattern matches.
   *
   * @param test - The string to be evaluated.
   * @param documentUri - The URI of the document being evaluated. Defaults to null.
   * @returns An array of `Diagnostic` objects if the pattern matches, otherwise null.
   */
  evaluate(test: string, documentUri: string | null = null): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }

    if (this.pattern.test(test.substring(0, 1))) {
      return [this.createDiagnostic({
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 }
      }, documentUri)];
    }

    return null;

  }
}