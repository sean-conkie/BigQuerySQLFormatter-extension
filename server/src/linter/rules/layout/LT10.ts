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
import { pipeLayouts } from './pipe';
import { keyword, tokenizeSource } from '../source';
import { rangesOverlap } from '../../parser/queryBlocks';

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

  evaluate(text: string, documentUri: string | null = null): Diagnostic[] | null {
    if (!this.enabled) return null;
    const tokens = tokenizeSource(text);
    const modifiers = pipeLayouts(tokens).flatMap(({ stages }) =>
      stages.flatMap((stage) =>
        stage.kind === 'projection' &&
        stage.operator === 'SELECT' &&
        ['DISTINCT', 'ALL', 'AS'].some((word) => keyword(tokens[stage.body], word))
          ? [{ select: tokens[stage.start + 2], modifier: tokens[stage.body] }]
          : [],
      ),
    );
    const diagnostics = (super.evaluate(text, documentUri) ?? []).filter(
      ({ range }) => !modifiers.some(({ modifier }) => rangesOverlap(range, modifier.range)),
    );
    for (const { select, modifier } of modifiers) {
      if (select.range.start.line !== modifier.range.start.line) {
        diagnostics.push(this.createDiagnostic(modifier.range, documentUri));
      }
    }
    return diagnostics.length ? diagnostics : null;
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
