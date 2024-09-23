/**
 * @fileoverview Rules to enforce union checks
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
 * The UnionCheck rule
 * @class UnionCheck
 * @extends Rule
 * @memberof Linter.Rules
 */
export class UnionCheck extends Rule<string> {
  readonly name: string = "union_checks";
  readonly code: string = "LT11";
  readonly message: string = "Union operators should be surrounded by newlines.";
  readonly pattern: RegExp = /(?<!\n)\bunion( (all|distinct)|(?!( (all|distinct))))|\bunion( (all|distinct)|(?!( (all|distinct))))(?!\n)/gi;

  /**
   * Creates an instance of UnionCheck.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof UnionCheck
   */
  constructor(settings: ServerSettings, problems: number) {
    super(settings, problems);
  }

  /**
   * Evaluates the given test string against a pattern and returns diagnostics if the pattern matches.
   *
   * @param test - The string to be tested against the pattern.
   * @param documentUri - The URI of the document being evaluated, or null if not applicable.
   * @returns An array of `Diagnostic` objects if the pattern matches, or null otherwise.
   */
  evaluate(test: string, documentUri: string | null = null): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }

    if (this.pattern.test(test)) {
      return this.evaluateMultiRegexTest(test, documentUri);
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