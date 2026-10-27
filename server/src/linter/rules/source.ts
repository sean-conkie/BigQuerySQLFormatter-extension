import {
  CodeActionKind,
  type Diagnostic,
  type Range,
  type TextDocumentIdentifier,
  type TextEdit,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { FileMap } from '../parser';
import { type DocumentCache, globalTokenCache } from '../parser/tokenCache';
import { ParserRule } from './base';
import { comparePositions, queryBlocks, queryRange } from '../parser/queryBlocks';

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
  protected readonly queryScoped: boolean = true;

  evaluate(ast: FileMap, documentUri: string | null = null): Diagnostic[] | null {
    if (!this.enabled || documentUri === null) return null;
    const cache = globalTokenCache.get(documentUri)!;
    const tokens = sourceTokens(cache);
    if (!this.queryScoped || !queryBlocks(ast).some((block) => block.hasExtendedQuerySyntax)) {
      const diagnostics = this.evaluateSource(tokens, cache, documentUri);
      return diagnostics.length ? diagnostics : null;
    }

    const diagnostics: Diagnostic[] = [];
    for (const block of Object.values(ast)) {
      if (!block.hasExtendedQuerySyntax && block.tokens.length) {
        const range = queryRange(block);
        const hidden = queryBlocks({ 0: block })
          .filter((child) => child.hasExtendedQuerySyntax)
          .map(queryRange);
        const visible: SourceToken[] = [];
        for (const token of tokens) {
          if (comparePositions(token.range.start, range.start) < 0 || comparePositions(token.range.end, range.end) > 0)
            continue;
          const skipped = hidden.find(
            (part) =>
              comparePositions(token.range.start, part.start) >= 0 && comparePositions(token.range.end, part.end) <= 0,
          );
          if (!skipped) visible.push(token);
          else if (visible[visible.length - 1]?.range !== skipped) {
            // An unsupported query has an unknown projection, not an empty SELECT list.
            visible.push({ value: '', range: skipped, literal: true });
          }
        }
        diagnostics.push(...this.evaluateSource(visible, cache, documentUri));
      }
    }
    return diagnostics.length ? diagnostics : null;
  }

  protected abstract evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[];
}

export abstract class SourceFixRule extends SourceRule {
  protected abstract readonly fixTitle: string;
  private readonly fixes = new Map<string, Map<string, TextEdit[]>>();

  evaluate(ast: FileMap, uri: string | null = null): Diagnostic[] | null {
    if (uri !== null) this.fixes.set(uri, new Map());
    return super.evaluate(ast, uri);
  }

  protected diagnosticWithFix(range: Range, uri: string, edits: TextEdit[]): Diagnostic {
    this.fixes.get(uri)!.set(this.createCacheKey(range), edits);
    return this.createDiagnostic(range, uri);
  }

  createCodeAction(document: TextDocumentIdentifier, diagnostic: Diagnostic) {
    const edits = this.fixes.get(document.uri)?.get(this.createCacheKey(diagnostic.range));
    if (!edits) return [];
    return this.createFixActions(
      { changes: { [document.uri]: structuredClone(edits) } },
      diagnostic,
      [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll],
      this.fixTitle,
    );
  }

  closeDocument(uri: string): void {
    this.fixes.delete(uri);
  }
}
