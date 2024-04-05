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
 * The UnionCheck rule
 * @class UnionCheck
 * @extends Rule
 * @memberof Linter.Rules
 */
export class UnionCheck extends Rule{
  readonly is_fix_compatible: boolean = true;
  readonly name: string = "union_checks";
  readonly code: string = "LT11";
  readonly type: RuleType = RuleType.REGEX;
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