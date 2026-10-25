import {
  type CompletionItem,
  CompletionItemKind,
  type Hover,
  type HoverParams,
  type TextDocumentPositionParams,
} from 'vscode-languageserver/node';
import { type DocumentCache, globalTokenCache } from '../linter/parser/tokenCache';
import { getWordAt } from '../utils';
import type { DocumentUri } from 'vscode-languageserver-textdocument';
import functions from './functions.json';

const functionSymbols: CompletionItem[] = functions.map(({ name, signature, description, url }) => ({
  label: name,
  detail: signature,
  documentation: {
    kind: 'markdown',
    value: `\`\`\`sql\n${signature}\n\`\`\`\n\n${description}\n\n[BigQuery reference](${url})`,
  },
}));

export class CompletionBuilder {
  uri: DocumentUri;
  cachedDocument: DocumentCache | undefined = undefined;
  functionSymbols: CompletionItem[] = functionSymbols;

  constructor(uri: DocumentUri) {
    this.uri = uri;
    this.cachedDocument = globalTokenCache.get(uri);
  }

  getCompletions(params: TextDocumentPositionParams): CompletionItem[] {
    if (!this.cachedDocument) {
      return [];
    }

    const position = params.position;

    const text = this.cachedDocument.getText({
      start: { line: position.line, character: 0 },
      end: position,
    });

    const match = text.match(/[\w$]+(?:\.[\w$]*)*$/);
    const prefix = match ? match[0] : '';

    const filteredSymbols = this.functionSymbols.filter((symbol) =>
      symbol.label.toUpperCase().startsWith(prefix.toUpperCase()),
    );

    // Map to CompletionItems
    const completionItems: CompletionItem[] = filteredSymbols.map((symbol) => ({
      label: symbol.label,
      kind: CompletionItemKind.Function,
      detail: symbol.detail,
      documentation: symbol.documentation,
      insertText: symbol.label,
      ...(prefix.includes('.')
        ? {
            textEdit: {
              range: { start: { line: position.line, character: position.character - prefix.length }, end: position },
              newText: symbol.label,
            },
          }
        : {}),
    }));

    return completionItems;
  }

  getHover(params: HoverParams): Hover | null {
    if (!this.cachedDocument) {
      return null;
    }

    // Analyze the document and position to provide hover information
    const range = {
      start: params.position,
      end: {
        line: params.position.line,
        character: params.position.character + 1,
      },
    };

    const word = getWordAt(
      this.cachedDocument.getText({
        start: { line: params.position.line, character: 0 },
        end: { line: params.position.line + 1, character: 0 },
      }),
      params.position.character,
      true,
    );

    const filteredSymbols = this.functionSymbols.filter((symbol) => symbol.label.toUpperCase() === word?.toUpperCase());

    if (filteredSymbols.length === 0 || filteredSymbols[0].documentation == null) {
      return null;
    }

    return {
      contents: filteredSymbols[0].documentation!,
      range: range,
    };
  }
}
