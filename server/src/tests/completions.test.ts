import { expect } from 'chai';
import { CompletionItemKind, type CompletionItem } from 'vscode-languageserver/node';
import { INITIAL } from 'vscode-textmate';
import { CompletionBuilder } from '../completions';
import { LineToken } from '../linter/parser/token';
import { DocumentCache, globalTokenCache } from '../linter/parser/tokenCache';
import functions from '../completions/functions.json';
import { GrammarLoader } from '../linter/grammarLoader';

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

  for (const name of [
    'ai.generate',
    'ai.generate_bool',
    'ai.forecast',
    'ml.generate_embedding',
    'ml.predict',
    'array_first',
    'json_keys',
    'vector_search',
  ]) {
    it(`completes and hovers ${name} case-insensitively with reference documentation`, () => {
      const text = `SELECT ${name.toUpperCase()}`;
      builder(text);
      const completionBuilder = new CompletionBuilder(uri);
      const completions = completionBuilder.getCompletions(params(0, text.length));
      const completion = completions.find((item) => item.label === name);
      expect(completion, name).not.to.equal(undefined);
      const entry = functions.find((item) => item.name === name)!;
      expect(completion?.detail).to.equal(entry.signature);
      const documentation = {
        kind: 'markdown',
        value: `\`\`\`sql\n${entry.signature}\n\`\`\`\n\n${entry.description}\n\n[BigQuery reference](${entry.url})`,
      };
      expect(completion?.documentation).to.deep.equal(documentation);
      for (let character = 7; character < text.length; character++) {
        expect(completionBuilder.getHover(params(0, character))?.contents).to.deep.equal(documentation);
      }
    });
  }

  it('replaces the entire qualified prefix rather than duplicating the namespace', () => {
    builder('SELECT Ai.GeN');
    const completions = new CompletionBuilder(uri).getCompletions(params(0, 13));
    expect(completions.length).to.be.greaterThan(0);
    for (const completion of completions) {
      expect(completion.label).to.match(/^ai\.gen/);
      expect(completion.textEdit).to.deep.equal({
        range: { start: { line: 0, character: 7 }, end: { line: 0, character: 13 } },
        newText: completion.label,
      });
    }
  });

  it('offers only the requested namespace after a dot', () => {
    builder('SELECT ML.');
    const completions = new CompletionBuilder(uri).getCompletions(params(0, 10));
    expect(completions.length).to.be.greaterThan(0);
    expect(completions.every((item) => item.label.startsWith('ml.'))).to.equal(true);
  });

  it('scopes every generated function as a function in the real TextMate grammar', async () => {
    const loader = new GrammarLoader();
    const grammar = await loader.loadGrammar('source.googlesql');
    if (!grammar) throw new Error('GoogleSQL grammar was not loaded');
    for (const { name } of functions) {
      const { tokens } = loader.tokenizeLine(grammar, `SELECT ${name}(value)`);
      const functionToken = tokens.find((token) => token.startIndex === 7);
      expect(
        functionToken?.scopes.some((scope) => scope.startsWith('support.function.')),
        name,
      ).to.equal(true);
      expect(functionToken?.endIndex, name).to.equal(7 + name.length);
    }
  });

  it('keeps function-like text in comments, strings and quoted identifiers out of function scopes', async () => {
    const loader = new GrammarLoader();
    const grammar = await loader.loadGrammar('source.googlesql');
    if (!grammar) throw new Error('GoogleSQL grammar was not loaded');
    for (const text of [
      "SELECT 'AI.GENERATE(value)'",
      'SELECT `AI.GENERATE(value)`',
      '-- AI.GENERATE(value)',
      '/* AI.GENERATE(value) */',
    ]) {
      const { tokens } = loader.tokenizeLine(grammar, text);
      expect(
        tokens.some((token) => token.scopes.some((scope) => scope.startsWith('support.function.'))),
        text,
      ).to.equal(false);
    }
  });
});
