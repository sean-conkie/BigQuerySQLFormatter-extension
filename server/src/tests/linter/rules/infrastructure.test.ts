import { expect } from 'chai';
import { INITIAL } from 'vscode-textmate';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { defaultSettings } from '../../../settings';
import { DocumentCache } from '../../../linter/parser/tokenCache';
import { LineToken } from '../../../linter/parser/token';
import { getRegexMatchRanges } from '../../../linter/rules/regex';
import { NotEqual } from '../../../linter/rules/convention/CV01';
import { initialiseRules, ruleRegistry } from '../../../linter/rules/rules';

describe('Rule infrastructure', () => {
  it('uses numeric line order regardless of cache insertion order', () => {
    const cache = new DocumentCache();
    for (const line of [2, 0, 1]) {
      cache.set(line, new LineToken([], 0, 1, String(line), line, [], INITIAL));
    }
    expect(cache.getText()).to.equal('0\n1\n2');
  });

  it('uses exact named group indices, including repeated and nested text', () => {
    expect(getRegexMatchRanges(/(foo) (?<target>foo)/, 'foo foo')).to.deep.equal([
      { start: { line: 0, character: 4 }, end: { line: 0, character: 7 } },
    ]);
    expect(getRegexMatchRanges(/(?<target>a(b))/, 'ab')).to.deep.equal([
      { start: { line: 0, character: 0 }, end: { line: 0, character: 2 } },
    ]);
    expect(getRegexMatchRanges(/(foo)/, 'foo')).to.deep.equal([
      { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
    ]);
    expect(getRegexMatchRanges(/(?=a)/, 'aa')).to.have.length(2);
  });

  it('reuses regex rules without leaking state between documents or disabled evaluations', () => {
    const rule = new NotEqual(defaultSettings, 0);
    expect(rule.evaluate('<>')).to.have.length(1);
    expect(rule.evaluate('<>')).to.have.length(1);
    expect(rule.evaluate('=')).to.equal(null);
    rule.enabled = false;
    expect(rule.evaluate('<>')).to.equal(null);
  });

  it('instantiates each registered rule once with Warning severity', () => {
    const rules = initialiseRules(defaultSettings, 0);
    expect(rules).to.have.length(ruleRegistry.length);
    expect(new Set(rules.map((rule) => rule.code)).size).to.equal(rules.length);
    expect(rules.every((rule) => rule.severity === DiagnosticSeverity.Warning)).to.equal(true);
  });
});
