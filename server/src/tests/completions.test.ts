import { expect } from 'chai';
import { CompletionItemKind, type CompletionItem } from 'vscode-languageserver/node';
import { INITIAL } from 'vscode-textmate';
import { CompletionBuilder } from '../completions';
import { LineToken } from '../linter/parser/token';
import { DocumentCache, globalTokenCache } from '../linter/parser/tokenCache';

describe('CompletionBuilder', () => {
  const uri = 'file:///completions.sql';
  const symbols: CompletionItem[] = [
    {
      label: 'ABS',
      detail: 'Absolute value',
      documentation: { kind: 'markdown', value: 'Returns an absolute value.' },
    },
    { label: 'AVG', documentation: 'Returns the average.' },
    { label: 'UNDOCUMENTED' },
  ];

  afterEach(() => {
    globalTokenCache.delete(uri);
  });

  function builder(text?: string): CompletionBuilder {
    if (text !== undefined) {
      const cache = new DocumentCache();
      text.split('\n').forEach((line, index) => {
        cache.set(index, new LineToken([], 0, line.length, line, index, [], INITIAL));
      });
      globalTokenCache.set(uri, cache);
    }
    const completionBuilder = new CompletionBuilder(uri);
    completionBuilder.functionSymbols = symbols;
    return completionBuilder;
  }

  function params(line: number, character: number) {
    return { textDocument: { uri }, position: { line, character } };
  }

  it('returns no completions or hover information for an uncached document', () => {
    const completionBuilder = builder();
    expect(completionBuilder.getCompletions(params(0, 0))).to.deep.equal([]);
    expect(completionBuilder.getHover(params(0, 0))).to.equal(null);
  });

  it('filters the prefix on the requested line and preserves completion metadata', () => {
    const completionBuilder = builder('SELECT AVG(value)\nSELECT AB');
    expect(completionBuilder.getCompletions(params(1, 9))).to.deep.equal([
      {
        label: 'ABS',
        kind: CompletionItemKind.Function,
        detail: symbols[0].detail,
        documentation: symbols[0].documentation,
        insertText: 'ABS',
      },
    ]);
  });

  it('offers all functions when there is no word prefix', () => {
    expect(
      builder('SELECT ')
        .getCompletions(params(0, 7))
        .map((item) => item.label),
    ).to.deep.equal(symbols.map((symbol) => symbol.label));
  });

  it('returns no completions when no function matches the prefix', () => {
    expect(builder('SELECT UNKNOWN').getCompletions(params(0, 14))).to.deep.equal([]);
  });

  it('returns markdown documentation and the requested hover range', () => {
    expect(builder('SELECT ABS(value)').getHover(params(0, 8))).to.deep.equal({
      contents: symbols[0].documentation,
      range: { start: { line: 0, character: 8 }, end: { line: 0, character: 9 } },
    });
  });

  it('returns plain-text documentation', () => {
    expect(builder('AVG(value)').getHover(params(0, 1))?.contents).to.equal(symbols[1].documentation);
  });

  for (const word of ['UNKNOWN', 'UNDOCUMENTED']) {
    it(`returns no hover information for ${word}`, () => {
      expect(builder(word).getHover(params(0, 1))).to.equal(null);
    });
  }
});
