import { type Diagnostic, TextEdit } from 'vscode-languageserver/node';
import { SourceFixRule, closingBracket, keyword, type SourceToken } from '../source';
import { topLevel } from '../../parser/pipe';
import type { DocumentCache } from '../../parser/tokenCache';
import keywords from '../../keywords.json';

const reserved = new Set(keywords.reserved);

function distinctExpressions(tokens: SourceToken[]) {
  return tokens.flatMap((token, i) => {
    if (!keyword(token, 'DISTINCT') || !keyword(tokens[i - 1], 'SELECT') || !keyword(tokens[i + 1], '(')) return [];
    const close = closingBracket(tokens, i + 1);
    return close > i + 2 ? [{ start: i, open: i + 1, close }] : [];
  });
}

export class Distinct extends SourceFixRule {
  readonly name = 'distinct';
  readonly code = 'ST08';
  readonly message = 'DISTINCT used with parentheses.';
  readonly relatedInformation = 'Remove parentheses to be clear that the DISTINCT applies to all columns.';
  readonly ruleGroup = 'structure';
  protected readonly fixTitle = 'Remove redundant DISTINCT parentheses';

  protected evaluateSource(tokens: SourceToken[], _cache: DocumentCache, uri: string): Diagnostic[] {
    return distinctExpressions(tokens).map(({ start, open, close }) => {
      const range = { start: tokens[start].range.start, end: tokens[close].range.end };
      if (
        ['SELECT', 'WITH', 'FROM'].some((word) => keyword(tokens[open + 1], word)) ||
        topLevel(tokens, open + 1, close).some((i) => keyword(tokens[i], ','))
      )
        return this.createDiagnostic(range, uri);
      const next = tokens[close + 1];
      if (
        next &&
        ![
          ',',
          'FROM',
          'WHERE',
          'GROUP',
          'HAVING',
          'QUALIFY',
          'WINDOW',
          'ORDER',
          'LIMIT',
          'UNION',
          'INTERSECT',
          'EXCEPT',
          'AS',
          ';',
          ')',
          '|',
        ].some((word) => keyword(next, word)) &&
        !(next.literal
          ? next.value.startsWith('`')
          : /^[a-z_][\w$]*$/i.test(next.value) && !reserved.has(next.value.toLowerCase()) && !keyword(next, 'COLLATE'))
      )
        return this.createDiagnostic(range, uri);
      const adjacent =
        tokens[start].range.end.character === tokens[open].range.start.character &&
        tokens[start].range.end.line === tokens[open].range.start.line;
      const joinedAlias =
        next &&
        tokens[close].range.end.line === next.range.start.line &&
        tokens[close].range.end.character === next.range.start.character &&
        (next.literal || /^[a-z_]/i.test(next.value));
      return this.diagnosticWithFix(range, uri, [
        TextEdit.replace(tokens[open].range, adjacent ? ' ' : ''),
        TextEdit.replace(tokens[close].range, joinedAlias ? ' ' : ''),
      ]);
    });
  }
}
