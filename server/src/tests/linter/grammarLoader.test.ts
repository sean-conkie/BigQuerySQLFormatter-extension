import { expect } from 'chai';
import { GrammarLoader, type Grammar } from '../../linter/grammarLoader';

describe('GrammarLoader', () => {
  let grammarLoader: GrammarLoader;

  beforeEach(() => {
    grammarLoader = new GrammarLoader();
  });

  it('should initialize GrammarLoader correctly', () => {
    expect(grammarLoader).to.be.instanceOf(GrammarLoader);
  });

  it('loads grammars concurrently across loader instances', async () => {
    const grammars = await Promise.all(
      Array.from({ length: 3 }, () => new GrammarLoader().loadGrammar('source.googlesql')),
    );
    expect(grammars[1]).to.equal(grammars[0]);
    expect(grammars[2]).to.equal(grammars[0]);
    for (const grammar of grammars) {
      expect(grammar).not.to.equal(null);
      if (!grammar) throw new Error('GoogleSQL grammar was not loaded');
      const { tokens } = grammarLoader.tokenizeLine(grammar, "SELECT 'hello' -- comment");
      expect(tokens.some((token) => token.scopes.some((scope) => scope.startsWith('string.')))).to.equal(true);
      expect(tokens.some((token) => token.scopes.some((scope) => scope.startsWith('comment.')))).to.equal(true);
    }
  });

  it('should tokenize line correctly', async () => {
    const grammar = await grammarLoader.loadGrammar('source.googlesql');
    const line = 'SELECT * FROM table';
    const result = grammarLoader.tokenizeLine(grammar as Grammar, line);

    expect(result).to.have.property('tokens');
    expect(result).to.have.property('ruleStack');
  });
});
