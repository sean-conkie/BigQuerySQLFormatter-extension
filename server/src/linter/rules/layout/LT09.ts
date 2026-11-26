import { type Diagnostic, TextEdit } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { SourceFixRule, type SourceToken, keyword } from '../source';
import { projectionLists } from './pipe';
import { QueryScopeResolver } from '../../scope';

export class SelectTargets extends SourceFixRule {
  readonly name = 'select_targets';
  readonly code = 'LT09';
  readonly message = 'Select targets should be on separate lines.';
  readonly relatedInformation =
    'For better readability, each target in the `SELECT` clause should be written on a separate line.';
  readonly ruleGroup = 'layout';
  protected readonly fixTitle = 'Put select targets on separate lines';

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const resolver = new QueryScopeResolver(tokens);
    for (const items of projectionLists(tokens)) {
      const first = items[0]?.tokens[0];
      if (!first) continue;
      const leading = items.some((item) => {
        const last = item.tokens.at(-1)!;
        const comma = tokens[tokens.indexOf(last) + 1];
        return keyword(comma, ',') && comma.range.start.line > last.range.end.line;
      });
      let clauseAttached = false;
      for (let i = 1; i < items.length; i++) {
        const previous = items[i - 1].tokens;
        const current = items[i].tokens;
        const last = previous.at(-1)!;
        const next = current[0];
        if (last.range.end.line !== next.range.start.line) continue;
        const range = { start: previous[0].range.start, end: current.at(-1)!.range.end };
        const comma = tokens[tokens.indexOf(last) + 1];
        const gap = { start: last.range.end, end: next.range.start };
        if (!keyword(comma, ',') || !/^\s*,\s*$/.test(cache.getText(gap))) {
          diagnostics.push(this.createDiagnostic(range, uri));
          continue;
        }
        const replacement = leading
          ? `${cache.eol}${' '.repeat(Math.max(0, first.range.start.character - 2))}, `
          : `,${cache.eol}${' '.repeat(first.range.start.character)}`;
        const edits = [TextEdit.replace(gap, replacement)];
        const final = items.at(-1)!.tokens.at(-1)!;
        const clause = tokens[tokens.indexOf(final) + 1];
        if (
          !clauseAttached &&
          !resolver.scopeAt(tokens.indexOf(first))?.pipe &&
          ['FROM', 'WHERE', 'GROUP', 'HAVING', 'QUALIFY', 'WINDOW', 'ORDER', 'LIMIT'].some((word) =>
            keyword(clause, word),
          ) &&
          final.range.end.line === clause.range.start.line
        ) {
          const clauseGap = { start: final.range.end, end: clause.range.start };
          if (/^\s*$/.test(cache.getText(clauseGap))) {
            const select = tokens
              .slice(0, tokens.indexOf(first))
              .reverse()
              .find((token) => keyword(token, 'SELECT'));
            if (select)
              edits.push(TextEdit.replace(clauseGap, `${cache.eol}${' '.repeat(select.range.start.character)}`));
            clauseAttached = true;
          }
        }
        diagnostics.push(this.diagnosticWithFix(range, uri, edits));
      }
    }
    return diagnostics;
  }
}
