import { expect } from 'chai';
import { Linter } from '../../linter/linter';
import { defaultSettings } from '../../settings';
import { globalTokenCache } from '../../linter/parser/tokenCache';

describe('Regex rule token scopes', () => {
  const uri = 'regex-scopes.sql';
  afterEach(() => globalTokenCache.delete(uri));

  it('ignores literals in quoted table references while preserving following USING diagnostics', async () => {
    const linter = new Linter(defaultSettings);
    linter.parserRules = [];
    linter.regexRules = linter.regexRules.filter((rule) => ['CP04', 'ST07'].includes(rule.code));
    const diagnostics = await linter.verify({
      uri,
      version: 1,
      languageId: 'googlesql',
      text: 'select t.id from `TRUE.dataset.table` t join `dataset.NULL` u using (id);\n',
    });
    expect(diagnostics.map((diagnostic) => String(diagnostic.code).split(':')[0])).to.deep.equal(['ST07']);
  });

  const cases = [
    ['CV01', 'a <> b'],
    ['CV02', 'ifnull(a, b)'],
    ['CV04', 'count(*)'],
    ['CV05', 'a != null'],
    ['CV08', 'a right join b'],
    ['CP04', 'TRUE FALSE NULL'],
    ['ST01', 'case when a then b else null'],
    ['ST07', 'join dataset.table using (id)'],
    ['ST08', 'select distinct(col)'],
    ['LT10', 'select\n distinct col'],
  ];

  for (const [code, sql] of cases) {
    for (const [kind, text] of [
      ['single-quoted string', `select '${sql.replace(/\n/g, ' ')}' as txt;\n`],
      ['double-quoted string', `select "${sql.replace(/\n/g, ' ')}" as txt;\n`],
      ['triple-quoted string', `select '''${sql}''' as txt;\n`],
      ['quoted identifier', `select \`${sql}\`;\n`],
      ['block comment', `/* ${sql} */\nselect 1;\n`],
      ['line comment', `-- ${sql.replace(/\n/g, '\n-- ')}\nselect 1;\n`],
      ['hash comment', `# ${sql.replace(/\n/g, '\n# ')}\nselect 1;\n`],
    ]) {
      it(`ignores ${code} patterns inside a ${kind}`, async () => {
        const linter = new Linter(defaultSettings);
        linter.parserRules = [];
        linter.regexRules = linter.regexRules.filter((rule) => rule.code === code);
        expect(linter.regexRules).to.have.length(1);
        expect(await linter.verify({ uri, text, languageId: 'googlesql', version: 1 })).to.deep.equal([]);
      });
    }
    it(`still reports ${code} in executable SQL after a string`, async () => {
      const linter = new Linter(defaultSettings);
      linter.parserRules = [];
      linter.regexRules = linter.regexRules.filter((rule) => rule.code === code);
      const text = `select '''${sql}''' as txt;\n${sql};\n`;
      const diagnostics = await linter.verify({ uri, text, languageId: 'googlesql', version: 1 });
      expect(diagnostics).not.to.be.empty;
      expect(diagnostics.every((d) => d.range.start.line >= sql.split('\n').length)).to.equal(true);
      expect(
        await linter.verifyChanges({
          textDocument: { uri, version: 2 },
          contentChanges: [{ text: `/* ${text} */` }],
        }),
      ).to.deep.equal([]);
    });
  }

  it('preserves whitespace layout checks and code action offsets after literals', async () => {
    const linter = new Linter(defaultSettings);
    linter.parserRules = [];
    const diagnostics = await linter.verify({
      uri,
      text: "select 'a <> b', col != null  \n",
      languageId: 'googlesql',
      version: 1,
    });
    expect(diagnostics.some((d) => String(d.code).startsWith('CV01:'))).to.equal(false);
    const comparison = diagnostics.find((d) => String(d.code).startsWith('CV05:'))!;
    expect(comparison.range).to.deep.equal({ start: { line: 0, character: 21 }, end: { line: 0, character: 23 } });
    expect(diagnostics.some((d) => String(d.code).startsWith('LT01:'))).to.equal(true);
  });
});
