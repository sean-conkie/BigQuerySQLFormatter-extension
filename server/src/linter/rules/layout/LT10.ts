/**
 * @fileoverview Rules to enforce select modifier rule
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import type { ServerSettings } from '../../../settings';
import { CodeActionKind, type Diagnostic, type TextDocumentIdentifier, TextEdit } from 'vscode-languageserver/node';
import { RegexRule } from '../base';
import { keyword, tokenizeSource } from '../source';
import { globalTokenCache } from '../../parser/tokenCache';

/**
 * The SelectModifiers rule
 * @class SelectModifiers
 * @extends Rule
 * @memberof Linter.Rules
 */
export class SelectModifiers extends RegexRule {
  readonly name: string = 'select_modifiers_check';
  readonly code: string = 'LT10';
  readonly message: string = 'SELECT modifiers (e.g. DISTINCT) must be on the same line as SELECT';
  readonly pattern: RegExp = /\bselect(?:\s*\n\s*(?<target>distinct|all|with|as)\b)/gi;
  readonly ruleGroup: string = 'layout';

  evaluate(text: string, documentUri: string | null = null): Diagnostic[] | null {
    if (!this.enabled) return null;
    const tokens = tokenizeSource(text);
    const diagnostics: Diagnostic[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (!keyword(tokens[i], 'SELECT')) continue;
      const modifier = tokens[i + 1];
      if (
        ['DISTINCT', 'ALL', 'AS', 'WITH'].some((word) => keyword(modifier, word)) &&
        tokens[i].range.start.line !== modifier.range.start.line
      ) {
        diagnostics.push(this.createDiagnostic(modifier.range, documentUri));
      }
    }
    return diagnostics.length ? diagnostics : null;
  }

  createCodeAction(document: TextDocumentIdentifier, diagnostic: Diagnostic) {
    const cache = globalTokenCache.get(document.uri)!;
    const tokens = tokenizeSource(cache.getText());
    const index = tokens.findIndex(
      (token) => this.createCacheKey(token.range) === this.createCacheKey(diagnostic.range),
    );
    const select = tokens[index - 1];
    if (!keyword(select, 'SELECT')) return [];
    let end = index;
    if (keyword(tokens[end], 'DISTINCT') || keyword(tokens[end], 'ALL')) end++;
    if (keyword(tokens[end], 'AS') && ['STRUCT', 'VALUE'].some((word) => keyword(tokens[end + 1], word))) end += 2;
    if (end === index) return [];
    for (let i = index; i < end; i++) {
      if (!/^\s*$/.test(cache.getText({ start: tokens[i - 1].range.end, end: tokens[i].range.start }))) return [];
    }
    const last = tokens[end - 1];
    const tail = cache
      .get(last.range.end.line)!
      .value.slice(last.range.end.character)
      .match(/^[ \t]*/)![0];
    const edits = [
      TextEdit.insert(
        select.range.end,
        ` ${tokens
          .slice(index, end)
          .map((token) => token.value)
          .join(' ')}`,
      ),
      TextEdit.del({
        start: tokens[index].range.start,
        end: { line: last.range.end.line, character: last.range.end.character + tail.length },
      }),
    ];
    return this.createFixActions(
      { changes: { [document.uri]: edits } },
      diagnostic,
      [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll],
      'Move SELECT modifier onto the SELECT line',
    );
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
