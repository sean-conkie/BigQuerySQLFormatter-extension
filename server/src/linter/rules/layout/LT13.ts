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
export class StartOfFile extends Rule<string>{
  readonly name: string = "start_of_file";
  readonly code: string = "LT13";
  readonly message: string = "Files must not begin with newlines or whitespace.";
  readonly pattern: RegExp = /^[\s]/;


  /**
   * Creates an instance of StartOfFile.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof StartOfFile
   */
  constructor(settings: ServerSettings, problems: number) {
      super(settings, problems);
  }

  evaluate(test: string): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }

    if (this.pattern.test(test.substring(0, 1))) {
      return [{
        code: this.code,
        message: this.message,
        severity: this.severity,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 }
        },
        source: this.source()
      }];
    }

    return null;

  }

  evaluateAst(): Diagnostic[] | null {
    return null;
  }
}