import { expect } from 'chai';
import { StringAST } from '../../../linter/parser/ast';
import { Token } from '../../../linter/parser/token';

describe('StringAST Class', () => {
    it('should create a StringAST instance correctly', () => {
        const tokens: Token[] = [
            new Token(['scope1'], 0, 5, 'value1', 1),
            new Token(['scope2'], 5, 10, 'value2', 1)
        ];
        const stringAST = new StringAST(tokens);
        expect(stringAST.tokens).to.deep.equal(tokens);
        expect(stringAST.value).to.equal('value1value2');
        expect(stringAST.alias).to.be.null;
        expect(stringAST.startLine).to.equal(1);
        expect(stringAST.startIndex).to.equal(0);
        expect(stringAST.endIndex).to.equal(10);
    });

    it('should handle empty tokens array', () => {
        const tokens: Token[] = [];
        const stringAST = new StringAST(tokens);
        expect(stringAST.tokens).to.deep.equal(tokens);
        expect(stringAST.value).to.be.null;
        expect(stringAST.alias).to.be.null;
        expect(stringAST.startLine).to.be.null;
        expect(stringAST.startIndex).to.be.null;
        expect(stringAST.endIndex).to.be.null;
    });

    it('should handle tokens with different scopes', () => {
        const tokens: Token[] = [
            new Token(['scope1'], 0, 5, 'value1', 1),
            new Token(['scope2'], 5, 10, 'value2', 1),
            new Token(['scope3'], 10, 15, 'value3', 1)
        ];
        const stringAST = new StringAST(tokens);
        expect(stringAST.tokens).to.deep.equal(tokens);
        expect(stringAST.value).to.equal('value1value2value3');
        expect(stringAST.alias).to.be.null;
        expect(stringAST.startLine).to.equal(1);
        expect(stringAST.startIndex).to.equal(0);
        expect(stringAST.endIndex).to.equal(15);
    });
});