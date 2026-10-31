/**
 * @fileoverview Rules to enforce union checks
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import type { ServerSettings } from '../../../settings';
import type { Diagnostic } from 'vscode-languageserver/node';
import { RegexRule } from '../base';

/**
 * The UnionCheck rule
 * @class UnionCheck
 * @extends Rule
 * @memberof Linter.Rules
 */
export class UnionCheck extends RegexRule {
  readonly rangeGroups = ['target', 'continuation'];
  readonly is_fix_compatible: boolean = false;
  readonly name: string = 'union_checks';
  readonly code: string = 'LT11';
  readonly message: string = 'Union operators should be surrounded by newlines.';
  readonly pattern: RegExp =
    /\S(?<target> *union +(?:all|distinct)) *|\n(?<continuation> *union (?:all|distinct) +)\S/gim;
  readonly relatedInformation: string =
    'The `UNION` operator should be placed on a separate line, surrounded by newlines before and after.';
  readonly ruleGroup: string = 'layout';

  matches(test: string): number {
    let noOfMatches: number = 0;
    const matches = test.matchAll(this.pattern);
    for (const match of matches) {
      noOfMatches++;
    }
    return noOfMatches;
  }
}
