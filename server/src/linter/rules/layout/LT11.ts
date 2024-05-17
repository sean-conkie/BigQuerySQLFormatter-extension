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
export class UnionCheck extends Rule<string>{
  readonly name: string = "union_checks";
  readonly code: string = "LT11";
  readonly message: string = "Union operators should be surrounded by newlines.";
  readonly pattern: RegExp =/(?<!\n)\bunion( (all|distinct)|(?!( (all|distinct))))|\bunion( (all|distinct)|(?!( (all|distinct))))(?!\n)/gi;

  /**
   * Creates an instance of UnionCheck.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof UnionCheck
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

  evaluateAst(): Diagnostic[] | null {
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