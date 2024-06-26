/**
 * @fileoverview Rules to enforce select modifier rule
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
 * The SelectModifiers rule
 * @class SelectModifiers
 * @extends Rule
 * @memberof Linter.Rules
 */
export class SelectModifiers extends Rule<string>{
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

  evaluate(test: string): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }
    
    if (this.pattern.test(test)) {
      return this.evaluateMultiRegexTest(test);
    }

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