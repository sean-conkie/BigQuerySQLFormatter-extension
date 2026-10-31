import { expect } from 'chai';
import { INITIAL } from 'vscode-textmate';
import { LineToken, Token } from '../../../linter/parser/token';
import { findToken, sortTokens } from '../../../linter/parser/utils';

describe('Parser token utilities', () => {
  const target = new Token(['target'], 2, 3, 'x', 1);
  const other = new Token(['other'], 0, 1, 'y', 0);
  const lines = [
    new LineToken([], 0, 1, 'y', 0, [other], INITIAL),
    new LineToken([], 0, 3, '  x', 1, [target], INITIAL),
  ];

  it('finds the first matching token in a flat array or a later line', () => {
    expect(findToken([other, target], 'target')).to.equal(target);
    expect(findToken(lines, 'target')).to.equal(target);
  });

  it('returns null for empty inputs and absent scopes in either token representation', () => {
    expect(findToken([], 'missing')).to.equal(null);
    expect(findToken([target], 'missing')).to.equal(null);
    expect(findToken(lines, 'missing')).to.equal(null);
  });

  it('sorts by line and start offset, treating an unknown line as line zero', () => {
    const unknownLine = new Token([], 3, 4, 'a');
    const first = new Token([], 1, 2, 'b', 1);
    const second = new Token([], 4, 5, 'c', 1);
    const last = new Token([], 0, 1, 'd', 2);
    expect(sortTokens([last, second, unknownLine, first])).to.deep.equal([unknownLine, first, second, last]);
    expect(sortTokens([first, unknownLine])).to.deep.equal([unknownLine, first]);
  });
});
