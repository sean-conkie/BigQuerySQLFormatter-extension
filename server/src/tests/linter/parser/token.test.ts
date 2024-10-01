import { expect } from 'chai';
import { Token, LineToken, joinTokenValues, excludeTokensWithMatchingScopes, includeTokensWithMatchingScopes } from '../../../linter/parser/token';
import { GrammarToken, RuleStack } from '../../../linter/grammarLoader';
import { INITIAL } from 'vscode-textmate';

describe('Token Class', () => {
    it('should create a Token instance correctly', () => {
        const token = new Token(['scope1'], 0, 5, 'value', 1);
        expect(token.scopes).to.deep.equal(['scope1']);
        expect(token.startIndex).to.equal(0);
        expect(token.endIndex).to.equal(5);
        expect(token.value).to.equal('value');
        expect(token.lineNumber).to.equal(1);
    });

    it('should create a Token from a GrammarToken', () => {
        const grammarToken = new GrammarToken(['scope1'], 0, 5);
        const token = Token.fromGrammarToken(grammarToken, 'sourceLine', 1);
        expect(token.scopes).to.deep.equal(['scope1']);
        expect(token.startIndex).to.equal(0);
        expect(token.endIndex).to.equal(5);
        expect(token.value).to.equal('sourc');
        expect(token.lineNumber).to.equal(1);
    });
});

describe('LineToken Class', () => {
    it('should create a LineToken instance correctly', () => {
        const ruleStack = INITIAL;
        const lineToken = new LineToken(['scope1'], 0, 5, 'value', 1, [], ruleStack);
        expect(lineToken.scopes).to.deep.equal(['scope1']);
        expect(lineToken.startIndex).to.equal(0);
        expect(lineToken.endIndex).to.equal(5);
        expect(lineToken.value).to.equal('value');
        expect(lineToken.lineNumber).to.equal(1);
        expect(lineToken.tokens).to.deep.equal([]);
        expect(lineToken.ruleStack).to.equal(ruleStack);
    });

    it('should create a LineToken from GrammarTokens', () => {
        const grammarTokens = [
            new GrammarToken(['scope1'], 0, 5),
            new GrammarToken(['scope2'], 5, 10)
        ];
        const ruleStack = INITIAL;
        const lineToken = LineToken.fromGrammarTokens(grammarTokens, 'sourceLine', 1, ruleStack);
        expect(lineToken.scopes).to.deep.equal(['scope1', 'scope2']);
        expect(lineToken.startIndex).to.equal(0);
        expect(lineToken.endIndex).to.equal(10);
        expect(lineToken.value).to.equal('sourceLine');
        expect(lineToken.lineNumber).to.equal(1);
        expect(lineToken.tokens.length).to.equal(2);
        expect(lineToken.ruleStack).to.equal(ruleStack);
    });
});

describe('joinTokenValues Function', () => {
    it('should join token values with default separator', () => {
        const tokens = [
            new Token(['scope1'], 0, 5, 'value1'),
            new Token(['scope2'], 5, 10, 'value2')
        ];
        const result = joinTokenValues(tokens);
        expect(result).to.equal('value1value2');
    });

    it('should join token values with specified separator', () => {
        const tokens = [
            new Token(['scope1'], 0, 5, 'value1'),
            new Token(['scope2'], 5, 10, 'value2')
        ];
        const result = joinTokenValues(tokens, '-');
        expect(result).to.equal('value1-value2');
    });
});

describe('filterTokens Function', () => {
    it('should filter tokens that include the specified scopes', () => {
        const tokens = [
            new Token(['scope1'], 0, 5, 'value1'),
            new Token(['scope2'], 5, 10, 'value2'),
            new Token(['scope1', 'scope3'], 10, 15, 'value3')
        ];
        const scopes = ['scope1'];
        const result = includeTokensWithMatchingScopes(tokens, scopes);
        expect(result).to.deep.equal([
            new Token(['scope1'], 0, 5, 'value1'),
            new Token(['scope1', 'scope3'], 10, 15, 'value3')
        ]);
    });

    it('should return an empty array if no tokens include the specified scopes', () => {
        const tokens = [
            new Token(['scope2'], 0, 5, 'value1'),
            new Token(['scope3'], 5, 10, 'value2')
        ];
        const scopes = ['scope1'];
        const result = includeTokensWithMatchingScopes(tokens, scopes);
        expect(result).to.deep.equal([]);
    });

    it('should return an empty array if the tokens array is empty', () => {
        const tokens: Token[] = [];
        const scopes = ['scope1'];
        const result = includeTokensWithMatchingScopes(tokens, scopes);
        expect(result).to.deep.equal([]);
    });
});

describe('filterOutTokens Function', () => {
    it('should filter out tokens that include the specified scopes', () => {
        const tokens = [
            new Token(['scope1'], 0, 5, 'value1'),
            new Token(['scope2'], 5, 10, 'value2'),
            new Token(['scope1', 'scope3'], 10, 15, 'value3')
        ];
        const scopes = ['scope1'];
        const result = excludeTokensWithMatchingScopes(tokens, scopes);
        expect(result).to.deep.equal([
            new Token(['scope2'], 5, 10, 'value2')
        ]);
    });

    it('should return the same array if no tokens include the specified scopes', () => {
        const tokens = [
            new Token(['scope2'], 0, 5, 'value1'),
            new Token(['scope3'], 5, 10, 'value2')
        ];
        const scopes = ['scope1'];
        const result = excludeTokensWithMatchingScopes(tokens, scopes);
        expect(result).to.deep.equal(tokens);
    });

    it('should return an empty array if the tokens array is empty', () => {
        const tokens: Token[] = [];
        const scopes = ['scope1'];
        const result = excludeTokensWithMatchingScopes(tokens, scopes);
        expect(result).to.deep.equal([]);
    });
});