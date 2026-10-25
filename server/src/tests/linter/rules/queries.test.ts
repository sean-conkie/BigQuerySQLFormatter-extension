import { expect } from 'chai';
import { INITIAL } from 'vscode-textmate';
import { LineToken } from '../../../linter/parser/token';
import { DocumentCache } from '../../../linter/parser/tokenCache';
import { readCtes } from '../../../linter/rules/queries';
import { sourceTokens } from '../../../linter/rules/source';

describe('Common table expression navigation', () => {
  function tokens(text: string) {
    const cache = new DocumentCache();
    cache.set(0, new LineToken([], 0, text.length, text, 0, [], INITIAL));
    return sourceTokens(cache);
  }

  it('reads recursive definitions, explicit column lists, and nested query brackets', () => {
    const source = tokens('WITH RECURSIVE First (a, b) AS (SELECT f(a, b)), `Next` AS (SELECT * FROM First) SELECT 1');
    const ctes = readCtes(source, 0);
    expect(ctes.map(({ name, columns }) => ({ name, columns }))).to.deep.equal([
      { name: 'first', columns: 2 },
      { name: '`next`', columns: undefined },
    ]);
    for (const cte of ctes) {
      expect(source[cte.start].value.toLowerCase()).to.equal(cte.name);
      expect(source[cte.open].value).to.equal('(');
      expect(source[cte.close].value).to.equal(')');
    }
  });

  it('supports a nonzero query start and a single named column', () => {
    const source = tokens('(WITH cte (a) AS (SELECT 1) SELECT * FROM cte)');
    expect(readCtes(source, 1)).to.deep.equal([{ name: 'cte', start: 2, open: 7, close: 10, columns: 1 }]);
  });

  for (const text of [
    'SELECT 1',
    'WITH',
    'WITH AS (SELECT 1)',
    'WITH cte',
    'WITH cte AS SELECT 1',
    'WITH cte (a, b',
    'WITH cte AS (SELECT 1',
  ]) {
    it(`ignores incomplete definitions in ${JSON.stringify(text)}`, () => {
      expect(readCtes(tokens(text), 0)).to.deep.equal([]);
    });
  }

  it('retains completed definitions before an incomplete following definition', () => {
    const ctes = readCtes(tokens('WITH first AS (SELECT 1), second AS'), 0);
    expect(ctes).to.have.length(1);
    expect(ctes[0].name).to.equal('first');
  });
});
