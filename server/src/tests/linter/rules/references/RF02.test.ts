import { expect } from 'chai';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { defaultSettings, parseSettings, type RulesSettings } from '../../../../settings';

describe('RF02 multi-source qualification', () => {
  const uri = 'file:///rf02.sql';
  afterEach(() => globalTokenCache.delete(uri));

  async function check(text: string, rules: RulesSettings = {}) {
    const linter = new Linter({ ...defaultSettings, rules });
    const diagnostics = (await linter.verify({ uri, languageId: 'googlesql', version: 1, text })).filter(({ code }) =>
      String(code).startsWith('RF02:'),
    );
    return { linter, diagnostics, names: diagnostics.map(({ range }) => globalTokenCache.get(uri)!.getText(range)) };
  }

  for (const from of [
    'foo f join bar b on f.id = b.id',
    'foo f, bar b',
    'foo f, unnest(f.items) x',
    'foo f, unnest(f.items) x with offset as pos',
    '(select id from foo) f join ds.fn(1) b on true',
  ]) {
    it(`flags unqualified and STRUCT columns with ${from}`, async () => {
      expect((await check(`select id, address.city, f.id from ${from};`)).names).to.deep.equal(['id', 'address.city']);
    });
  }

  for (const sql of [
    'select id, address.city from foo;',
    'select id;',
    'select f.*, b.* from foo f, bar b;',
    'select f.id from foo f join bar b using (id);',
    'select f.id as label, count(*) as total from foo f, bar b group by label having total > 1 order by label;',
    'select f.id as label from foo f, bar b qualify label > 1;',
    'select x, pos from foo f, unnest(f.items) as x with offset as pos;',
    'select current_date, current_timestamp, @param.field, @@error.message from foo f, bar b;',
    'select bad from foo f, bar b |> select other;',
    'select id from foo f, bar b; -- noqa: RF02',
  ]) {
    it(`accepts excluded references: ${sql}`, async () => {
      expect((await check(sql)).names).to.deep.equal([]);
    });
  }

  it('only treats select aliases as visible in the allowed clauses', async () => {
    expect((await check('select id as label from foo f, bar b where label > 1 order by label;')).names).to.deep.equal([
      'id',
      'label',
    ]);
  });

  it('counts external sources by default, optionally ignoring them', async () => {
    const sql = 'select (select id from inner_table i where i.id = o.id) from orders o;';
    expect((await check(sql)).names).to.deep.equal(['id']);
    expect(
      (await check(sql, { RF02: { options: { subqueries_ignore_external_references: true } } })).names,
    ).to.deep.equal([]);
    expect(
      (await check('select (select id from inner_table i where i.id = i.other) from orders o;')).names,
    ).to.deep.equal([]);
  });

  it('parses project options and supports case-insensitive ignored names', async () => {
    const rules = parseSettings({ rules: { RF02: { options: { ignore_words: ['ID'] } } } }).rules;
    expect((await check('select id, other from foo f, bar b;', rules)).names).to.deep.equal(['other']);
  });

  it('supports disabling, groups, exclusions, severity and no fixes', async () => {
    for (const rules of [
      { RF02: { enabled: false } },
      { RF02: { severity: 'off' } },
      { groups: { references: false } },
      { exclude: ['RF02'] },
    ] satisfies RulesSettings[]) {
      expect((await check('select id from foo f, bar b;', rules)).names).to.deep.equal([]);
    }
    const { linter, diagnostics } = await check('select id from foo f, bar b;', { RF02: { severity: 'error' } });
    expect(diagnostics[0].severity).to.equal(DiagnosticSeverity.Error);
    expect(
      await linter.createCodeActions({ textDocument: { uri }, range: diagnostics[0].range, context: { diagnostics } }),
    ).to.deep.equal([]);
  });
});
