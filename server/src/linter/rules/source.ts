import type { Diagnostic, Range } from 'vscode-languageserver/node';
import type { FileMap } from '../parser';
import { type DocumentCache, globalTokenCache } from '../parser/tokenCache';
import { ParserRule } from './base';

export interface SourceToken {
  value: string;
  range: Range;
  literal: boolean;
}

export function keyword(token: SourceToken | undefined, value: string): boolean {
  return token !== undefined && !token.literal && token.value.toUpperCase() === value;
}

export function sourceTokens(cache: DocumentCache): SourceToken[] {
  const result: SourceToken[] = [];
  for (const line of [...cache.keys].sort((a, b) => a - b)) {
    let quoted = false;
    for (const token of cache.get(line)!.tokens) {
      if (token.scopes.some((scope) => scope.startsWith('comment.'))) continue;
      if (token.value === '`' && token.scopes.includes('punctuation.definition.string.begin.sql')) quoted = true;
      const literal =
        quoted || token.scopes.some((scope) => scope.startsWith('string.') || scope === 'meta.identifier.quoted.sql');
      if (literal) {
        result.push({
          value: token.value,
          range: {
            start: { line, character: token.startIndex },
            end: { line, character: token.endIndex },
          },
          literal: true,
        });
      } else {
        for (const match of token.value.matchAll(/[a-z_][\w$]*|\d+(?:\.\d+)?|[^\s]/gi)) {
          const character = token.startIndex + match.index;
          result.push({
            value: match[0],
            range: { start: { line, character }, end: { line, character: character + match[0].length } },
            literal: false,
          });
        }
      }
      if (token.value === '`' && token.scopes.includes('punctuation.definition.string.end.sql')) quoted = false;
    }
  }
  return result;
}

export function closingBracket(tokens: SourceToken[], start: number): number {
  const close = keyword(tokens[start], '(') ? ')' : ']';
  let depth = 0;
  for (let i = start; i < tokens.length; i++) {
    if (keyword(tokens[i], tokens[start].value)) depth++;
    if (keyword(tokens[i], close) && --depth === 0) return i;
  }
  return -1;
}

export abstract class SourceRule extends ParserRule {
  evaluate(_ast: FileMap, documentUri: string | null = null): Diagnostic[] | null {
    if (!this.enabled || documentUri === null) return null;
    const cache = globalTokenCache.get(documentUri)!;
    const diagnostics = this.evaluateSource(sourceTokens(cache), cache, documentUri);
    return diagnostics.length ? diagnostics : null;
  }

  protected abstract evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[];
}
