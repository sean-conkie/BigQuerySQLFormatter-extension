import { expect } from 'chai';
import { INITIAL } from 'vscode-textmate';
import { DocumentCache, globalTokenCache } from '../../../linter/parser/tokenCache';
import { LineToken } from '../../../linter/parser/token';
import { closingBracket, keyword, sourceTokens } from '../../../linter/rules/source';
import { UnionModifier } from '../../../linter/rules/ambiguous/AM02';
import { defaultSettings } from '../../../settings';

describe('Structural source navigation', () => {
  const uri = 'source-navigation.bqsql';
  afterEach(() => globalTokenCache.delete(uri));

  function cache(text: string): DocumentCache {
    const result = new DocumentCache();
    for (const [line, value] of text.split('\n').entries()) {
      result.set(line, new LineToken([], 0, value.length, value, line, [], INITIAL));
    }
    return result;
  }

  it('shields every literal form even when highlighting scopes are unavailable', () => {
    const tokens = sourceTokens(
      cache(
        "SELECT rb'UNION', B\"JOIN\", '''a,\nb''', \"\"\"c,\nd\"\"\", `GROUP BY`, 'it\\'s UNION' -- JOIN\n/* UNION */ # SELECT",
      ),
    );
    expect(tokens.filter((token) => !token.literal).map((token) => token.value)).to.deep.equal([
      'SELECT',
      ',',
      ',',
      ',',
      ',',
      ',',
    ]);
    expect(keyword(undefined, 'SELECT')).to.equal(false);
    expect(keyword(tokens[0], 'SELECT')).to.equal(true);
    expect(keyword(tokens[1], tokens[1].value.toUpperCase())).to.equal(false);
  });

  it('matches nested parentheses and arrays without interpreting literal brackets', () => {
    const tokens = sourceTokens(cache("(f(')'), (a + b), [1, [2]])"));
    expect(closingBracket(tokens, 0)).to.equal(tokens.length - 1);
    const array = tokens.findIndex((token) => keyword(token, '['));
    expect(tokens[closingBracket(tokens, array)].value).to.equal(']');
    expect(closingBracket(sourceTokens(cache('(a')), 0)).to.equal(-1);
  });

  it('uses normalized UTF-16 positions for diagnostics and supports disabled rules', () => {
    globalTokenCache.set(uri, cache("SELECT '\u{1F600}'\nUNION SELECT a"));
    const rule = new UnionModifier(defaultSettings, 0);
    expect(rule.evaluate({}, uri)![0].range).to.deep.equal({
      start: { line: 1, character: 0 },
      end: { line: 1, character: 5 },
    });
    expect(rule.evaluate({})).to.equal(null);
    rule.enabled = false;
    expect(rule.evaluate({}, uri)).to.equal(null);
  });
});
