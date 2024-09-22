import { expect } from 'chai';
import { GrammarLoader, Grammar } from '../../linter/grammarLoader';

describe('GrammarLoader', () => {
    let grammarLoader: GrammarLoader;

    beforeEach(() => {
        grammarLoader = new GrammarLoader();
    });

    it('should initialize GrammarLoader correctly', () => {
        expect(grammarLoader).to.be.instanceOf(GrammarLoader);
    });

    it('should tokenize line correctly', async () => {
        const grammar = await grammarLoader.loadGrammar('source.googlesql');
        const line = 'SELECT * FROM table';
        const result = grammarLoader.tokenizeLine(grammar as Grammar, line);

        expect(result).to.have.property('tokens');
        expect(result).to.have.property('ruleStack');
    });
});