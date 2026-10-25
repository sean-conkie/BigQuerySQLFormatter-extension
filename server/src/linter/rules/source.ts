import type { Diagnostic, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
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
  const text = cache.getText();
  const document = TextDocument.create('', 'googlesql', 0, text);
  // Highlighting can lose string scopes after incomplete or unsupported SQL.
  // Shield literals independently before interpreting structural punctuation.
  const pattern =
    /(?<comment>--[^\n]*|#[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(?<literal>(?:rb|br|r|b)?(?:'''(?:\\[\s\S]|(?!''')[\s\S])*?(?:'''|$)|"""(?:\\[\s\S]|(?!""")[\s\S])*?(?:"""|$)|'(?:\\[\s\S]|''|[^'\\])*?(?:'|$)|"(?:\\[\s\S]|""|[^"\\])*?(?:"|$))|`(?:\\[\s\S]|``|[^`\\])*?(?:`|$))|[a-z_][\w$]*|\d+(?:\.\d+)?|[^\s]/gi;
  for (const match of text.matchAll(pattern)) {
    if (match.groups?.comment !== undefined) continue;
    result.push({
      value: match[0],
      range: { start: document.positionAt(match.index), end: document.positionAt(match.index + match[0].length) },
      literal: match.groups?.literal !== undefined,
    });
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
