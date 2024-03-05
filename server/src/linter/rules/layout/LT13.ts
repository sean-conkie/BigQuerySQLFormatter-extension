/**
 * @fileoverview Rules to enforce layout formats
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */


import { RuleType } from "../enums";
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
export class StartOfFile extends Rule{
  readonly is_fix_compatible: boolean = true;
  readonly name: string = "start_of_file";
  readonly code: string = "LT13";
  readonly type: RuleType = RuleType.REGEX;
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

  evaluate(test: string): Diagnostic | null {

    if (this.enabled === false) {
      return null;
    }

    if (this.pattern.test(test.substring(0, 1))) {
      return {
        message: this.message,
        severity: this.severity,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 }
        },
        source: this.name
      };
    }

    return null;

  }
}