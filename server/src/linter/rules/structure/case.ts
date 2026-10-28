import type { Range } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import type { SourceToken } from '../source';
import { capitalisationOptions, resolveOption } from '../../../ruleOptions';
import { isRuleEnabled, type ServerSettings } from '../../../settings';

export function caseWord(word: string, code: 'CP01' | 'CP03', cache: DocumentCache, settings: ServerSettings): string {
  if (!isRuleEnabled(settings, code, 'capitalisation')) return word;
  const policy = resolveOption(
    capitalisationOptions.capitalisation_policy,
    settings.rules?.[code]?.options?.capitalisation_policy,
  );
  if (policy !== 'consistent') return policy === 'upper' ? word.toUpperCase() : word.toLowerCase();
  for (const entry of cache.tokens) {
    for (const token of entry.tokens) {
      if (
        /[a-z]/i.test(token.value) &&
        token.scopes.some((scope) =>
          code === 'CP01'
            ? scope.startsWith('keyword.')
            : scope.startsWith('support.function') || scope === 'meta.function.sql',
        )
      ) {
        return token.value === token.value.toUpperCase() ? word.toUpperCase() : word.toLowerCase();
      }
    }
  }
  return word;
}

export function sameExpression(left: SourceToken[], right: SourceToken[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (token, i) =>
        token.literal === right[i].literal &&
        (token.literal ? token.value === right[i].value : token.value.toLowerCase() === right[i].value.toLowerCase()),
    )
  );
}

export function volatileExpression(tokens: SourceToken[]): boolean {
  return tokens.some((token) => !token.literal && /^(rand|generate_uuid|current_\w+|session_user)$/i.test(token.value));
}

export function expressionRange(tokens: SourceToken[]): Range {
  return { start: tokens[0].range.start, end: tokens[tokens.length - 1].range.end };
}

export function expressionText(cache: DocumentCache, tokens: SourceToken[]): string {
  return cache.getText(expressionRange(tokens)).replace(/\n/g, cache.eol);
}

export function hasComments(cache: DocumentCache, range: Range): boolean {
  for (let line = range.start.line; line <= range.end.line; line++) {
    if (
      cache
        .get(line)
        ?.tokens.some(
          (token) =>
            token.scopes.some((scope) => scope.startsWith('comment.')) &&
            token.endIndex > (line === range.start.line ? range.start.character : 0) &&
            token.startIndex < (line === range.end.line ? range.end.character : Infinity),
        )
    )
      return true;
  }
  return false;
}
