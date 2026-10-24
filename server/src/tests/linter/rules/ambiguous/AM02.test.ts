import { expect } from 'chai';
import { Linter } from '../../../../linter/linter';
import { defaultSettings } from '../../../../settings';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';

describe('AM02 UNION modifiers', () => {
  const uri = 'am02.bqsql';
  afterEach(() => globalTokenCache.delete(uri));

  for (const [text, count] of [
    ['SELECT a UNION SELECT b', 1],
    ['SELECT a union', 1],
    ['SELECT a UNION /* choice */ ALL SELECT b', 0],
    ['SELECT a UNION -- choice\n DISTINCT SELECT b', 0],
    ['SELECT a UNION all_values SELECT b', 1],
    ["SELECT 'UNION', `UNION` -- UNION\n/* UNION */", 0],
    ["SELECT [1, 2], 'UNION', r'UNION', \"UNION\", '''UNION\nUNION'''", 0],
    ["SELECT 'it\\'s UNION', `UNION` # UNION", 0],
    ['SELECT a UNION ALL SELECT b UNION SELECT c', 1],
  ] as const) {
    it(`checks ${JSON.stringify(text)}`, async () => {
      const diagnostics = await new Linter(defaultSettings).verify({ uri, text, languageId: 'googlesql', version: 1 });
      const matches = diagnostics.filter((diagnostic) => String(diagnostic.code).startsWith('AM02:'));
      expect(matches).to.have.length(count);
      expect(diagnostics.some((diagnostic) => String(diagnostic.code).startsWith('CV12:'))).to.equal(false);
    });
  }

  it('honors settings and directives', async () => {
    const text = 'SELECT a UNION SELECT b; -- noqa: AM02';
    const linter = new Linter(defaultSettings);
    expect(
      (await linter.verify({ uri, text, languageId: 'googlesql', version: 1 })).some((d) =>
        String(d.code).startsWith('AM02:'),
      ),
    ).to.equal(false);
    linter.settings = { ...defaultSettings, rules: { AM02: { enabled: false } } };
    expect(
      (await linter.verify({ uri, text: 'SELECT a UNION SELECT b', languageId: 'googlesql', version: 2 })).some((d) =>
        String(d.code).startsWith('AM02:'),
      ),
    ).to.equal(false);
  });
});
