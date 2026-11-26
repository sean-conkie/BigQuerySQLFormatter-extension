import { CodeActionKind, type Diagnostic, type TextDocumentIdentifier, TextEdit } from 'vscode-languageserver/node';
import { RegexRule } from '../base';
import { keyword, tokenizeSource, type SourceToken } from '../source';
import { globalTokenCache } from '../../parser/tokenCache';
import { QueryScopeResolver } from '../../scope';
import { topLevel } from '../../parser/pipe';
import { projectionLists } from './pipe';

function setOperators(tokens: SourceToken[]) {
  return tokens.flatMap((token, i) =>
    ['UNION', 'INTERSECT', 'EXCEPT'].some((word) => keyword(token, word)) &&
    ['ALL', 'DISTINCT'].some((word) => keyword(tokens[i + 1], word)) &&
    !(keyword(tokens[i - 1], '>') && keyword(tokens[i - 2], '|')) &&
    tokens[i - 1] &&
    tokens[i + 2]
      ? [{ index: i, first: token, last: tokens[i + 1], previous: tokens[i - 1], next: tokens[i + 2] }]
      : [],
  );
}

export class UnionCheck extends RegexRule {
  readonly name = 'union_checks';
  readonly code = 'LT11';
  readonly message = 'Union operators should be surrounded by newlines.';
  readonly relatedInformation =
    'Set operators should be placed on a separate line, surrounded by newlines before and after.';
  readonly ruleGroup = 'layout';

  evaluate(text: string, uri: string | null = null): Diagnostic[] | null {
    if (!this.enabled) return null;
    const diagnostics = setOperators(tokenizeSource(text))
      .filter(
        ({ first, last, previous, next }) =>
          previous.range.end.line === first.range.start.line ||
          first.range.start.line !== last.range.end.line ||
          last.range.end.line === next.range.start.line,
      )
      .map(({ first, last }) => this.createDiagnostic({ start: first.range.start, end: last.range.end }, uri));
    return diagnostics.length ? diagnostics : null;
  }

  createCodeAction(document: TextDocumentIdentifier, diagnostic: Diagnostic) {
    const cache = globalTokenCache.get(document.uri)!;
    const tokens = tokenizeSource(cache.getText());
    const operator = setOperators(tokens).find(
      ({ first, last }) =>
        this.createCacheKey({ start: first.range.start, end: last.range.end }) ===
        this.createCacheKey(diagnostic.range),
    );
    if (!operator) return [];
    const { index, first, last, previous, next } = operator;
    const resolver = new QueryScopeResolver(tokens);
    const scope = resolver.scopes.find((scope) => scope.end === index);
    let firstBranch = scope;
    while (firstBranch) {
      const start = firstBranch.start;
      const preceding = resolver.scopes.find(
        (candidate) =>
          candidate.parent === scope?.parent &&
          candidate.end + 2 === start &&
          ['UNION', 'INTERSECT', 'EXCEPT'].some((word) => keyword(tokens[candidate.end], word)),
      );
      if (!preceding) break;
      firstBranch = preceding;
    }
    const indent = tokens[firstBranch?.start ?? scope?.start ?? 0].range.start.character;
    const newline = `${cache.eol}${' '.repeat(indent)}`;
    const edits: TextEdit[] = [];
    for (const [left, right] of [
      [previous, first],
      [last, next],
    ]) {
      if (left.range.end.line !== right.range.start.line) continue;
      const gap = { start: left.range.end, end: right.range.start };
      const text = cache.getText(gap);
      if (left === last) {
        const tail = {
          start: right.range.start,
          end: { line: right.range.start.line, character: cache.get(right.range.start.line)!.value.length },
        };
        // Move the branch atomically so concurrent list fixes use its new alignment anchor next pass.
        edits.push(
          TextEdit.replace(
            { start: /^\s*$/.test(text) ? left.range.end : right.range.start, end: tail.end },
            `${newline}${cache.getText(tail)}`,
          ),
        );
      } else if (/^\s*$/.test(text)) edits.push(TextEdit.replace(gap, newline));
      else edits.push(TextEdit.insert(right.range.start, newline));
    }
    if (last.range.end.line === next.range.start.line && keyword(next, 'SELECT')) {
      const branch = resolver.scopeAt(index + 2);
      const shift = next.range.start.character - indent;
      const projection = projectionLists(tokens).find((items) => {
        const first = items[0]?.tokens[0];
        const position = first ? tokens.indexOf(first) : -1;
        return position > index + 2 && position < (branch?.end ?? index + 2);
      });
      const firstTarget = projection?.[0]?.tokens[0];
      const targetIndent =
        firstTarget?.range.start.line === next.range.start.line
          ? firstTarget.range.start.character - shift
          : indent + 7;
      const targets = new Set(projection?.map((item) => item.tokens[0]));
      const shifted = new Set<number>();
      for (const i of topLevel(tokens, index + 3, branch?.end ?? index + 3)) {
        const token = tokens[i];
        const { line, character } = token.range.start;
        if (line === next.range.start.line || shifted.has(line)) continue;
        const leading = { start: { line, character: 0 }, end: token.range.start };
        if (!/^[ \t]*$/.test(cache.getText(leading))) continue;
        // Moving an inline branch also moves the alignment anchor of its wrapped list.
        const desired = targets.has(token)
          ? targetIndent
          : ['FROM', 'WHERE', 'GROUP', 'HAVING', 'QUALIFY', 'WINDOW', 'ORDER', 'LIMIT'].some((word) =>
                keyword(token, word),
              )
            ? indent
            : Math.max(0, character - shift);
        edits.push(TextEdit.replace(leading, ' '.repeat(desired)));
        shifted.add(line);
      }
    }
    const modifierGap = { start: first.range.end, end: last.range.start };
    if (first.range.end.line !== last.range.start.line && /^\s*$/.test(cache.getText(modifierGap))) {
      edits.push(TextEdit.replace(modifierGap, ' '));
    }
    if (!edits.length) return [];
    return this.createFixActions(
      { changes: { [document.uri]: edits } },
      diagnostic,
      [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll],
      'Put set operator on its own line',
    );
  }

  matches(text: string): number {
    return this.evaluate(text)?.length ?? 0;
  }
}
