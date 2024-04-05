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
 * The SelectModifiers rule
 * @class SelectModifiers
 * @extends Rule
 * @memberof Linter.Rules
 */
export class SelectModifiers extends Rule{
  readonly name: string = "select_modifiers_check";
  readonly code: string = "LT10";
  readonly message: string = "SELECT modifiers (e.g. DISTINCT) must be on the same line as SELECT";
  readonly pattern: RegExp =/\bselect(?:\s*\n\s*(distinct|all|with|as)\b)/gi;

  /**
   * Creates an instance of SelectModifiers.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof SelectModifiers
   */
  constructor(settings: ServerSettings, problems: number) {
      super(settings, problems);
  }

  evaluate(test: string): Diagnostic | null {

    if (this.enabled === false) {
      return null;
    }

    if (this.pattern.test(test)) {
      return {
        message: this.message,
        severity: this.severity,
        range: {
          start: { line: 0, character: 0 },
          end: { line:1000, character: 1000 }
        },
        source: this.name
      };
    }

    return null;

  }

  evaluateAst(): Diagnostic | null {
    return null;
  }

  matches(test: string): number {

    let noOfMatches: number = 0;
    const matches = test.matchAll(this.pattern);
		for (const match of matches) {
      noOfMatches++;
		}
    return noOfMatches;
		
	}
}