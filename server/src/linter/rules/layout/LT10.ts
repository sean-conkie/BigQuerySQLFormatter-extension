/**
 * @fileoverview Rules to enforce select modifier rule
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import type { ServerSettings } from '../../../settings';
import type { Diagnostic } from 'vscode-languageserver/node';
import { RegexRule } from '../base';

/**
 * The SelectModifiers rule
 * @class SelectModifiers
 * @extends Rule
 * @memberof Linter.Rules
 */
export class SelectModifiers extends RegexRule {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = 'select_modifiers_check';
  readonly code: string = 'LT10';
  readonly message: string = 'SELECT modifiers (e.g. DISTINCT) must be on the same line as SELECT';
  readonly pattern: RegExp = /\bselect(?:\s*\n\s*(?<target>distinct|all|with|as)\b)/gi;
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
