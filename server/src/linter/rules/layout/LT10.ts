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
export class SelectModifiers extends Rule<string> {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = "select_modifiers_check";
  readonly code: string = "LT10";
  readonly message: string = "SELECT modifiers (e.g. DISTINCT) must be on the same line as SELECT";
  readonly pattern: RegExp = /\bselect(?:\s*\n\s*(distinct|all|with|as)\b)/gi;
  readonly ruleGroup: string = 'layout';

  /**
   * Creates an instance of SelectModifiers.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof SelectModifiers
   */
  constructor(settings: ServerSettings, problems: number) {
    super(settings, problems);
  }

  /**
   * Evaluates the given test string against a pattern and returns diagnostics if applicable.
   *
   * @param test - The string to be tested against the pattern.
   * @param documentUri - The URI of the document being evaluated, or null if not applicable.
   * @returns An array of `Diagnostic` objects if the pattern matches the test string, otherwise null.
   */
  evaluate(test: string, documentUri: string | null = null): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }

    if (this.pattern.test(test)) {
      return this.evaluateRegexPatterns(test, documentUri);
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