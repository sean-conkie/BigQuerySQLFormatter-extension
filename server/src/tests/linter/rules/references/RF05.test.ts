import { expect } from 'chai';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { defaultSettings, parseSettings, type RulesSettings } from '../../../../settings';

describe('RF05 special characters', () => {
  const uri = 'file:///rf05.sql';
  afterEach(() => globalTokenCache.delete(uri));

  async function check(
    text: string,
    options: Record<string, string | boolean | string[]> = {},
    rules: RulesSettings = {},
  ) {
    const linter = new Linter({ ...defaultSettings, rules: { RF05: { options }, ...rules } });
    const diagnostics = (await linter.verify({ uri, languageId: 'googlesql', version: 1, text })).filter((diagnostic) =>
      String(diagnostic.code).startsWith('RF05:'),
    );
    return { linter, diagnostics, names: diagnostics.map(({ range }) => globalTokenCache.get(uri)!.getText(range)) };
  }

  it('checks columns, aliases and DDL column definitions', async () => {
    expect(
      (await check('create table ds.column_names (`internal space` int64, `greater>than` int64, `number#` int64);'))
        .names,
    ).to.deep.equal(['`internal space`', '`greater>than`', '`number#`']);
    expect((await check('select `order total` as `total (gbp)` from ds.orders;')).names).to.deep.equal([
      '`order total`',
      '`total (gbp)`',
    ]);
  });

  it('checks path components, not separator dots', async () => {
    expect((await check('select `a.b_c`, `a.bad#` from `ds.tbl`;')).names).to.deep.equal(['`a.bad#`']);
  });

  it('allows dashed project IDs but not dashed datasets, tables or columns', async () => {
    expect(
      (
        await check(
          'select `my-project` from `my-project.ds.tbl`, `my-project`.`ds`.`tbl`, `my-project.bad-ds.tbl`, `ds.bad-table`;',
        )
      ).names,
    ).to.deep.equal(['`my-project`', '`my-project.bad-ds.tbl`', '`ds.bad-table`']);
  });

  it('allows region qualifiers only in INFORMATION_SCHEMA table paths', async () => {
    expect(
      (
        await check(
          'select `region-us` from `region-us.INFORMATION_SCHEMA.TABLES`, `my-project.region-europe-west1.INFORMATION_SCHEMA.JOBS`, `region-us`.`INFORMATION_SCHEMA`.`TABLES`, `region-us.other.table`;',
        )
      ).names,
    ).to.deep.equal(['`region-us`']);
    expect((await check('select x from `ds.region-us`;')).names).to.deep.equal(['`ds.region-us`']);
  });

  for (const [policy, names] of [
    ['none', []],
    ['column_aliases', ['`column alias`']],
    ['table_aliases', ['`table alias`']],
    ['aliases', ['`column alias`', '`table alias`']],
    ['all', ['`column name`', '`column alias`', '`table alias`']],
  ] as const) {
    it(`applies ${policy} policy`, async () => {
      expect(
        (
          await check('select `column name` as `column alias` from ds.orders as `table alias`;', {
            quoted_identifiers_policy: policy,
          })
        ).names,
      ).to.deep.equal(names);
    });
  }

  it('supports spaces, literal additional characters and ignored words', async () => {
    expect(
      (
        await check('select `a b`, `a#`, `a]`, `a-`, `a^`, `a&` from ds.orders;', {
          allow_space_in_identifier: true,
          additional_allowed_characters: ['#', ']-^'],
        })
      ).names,
    ).to.deep.equal(['`a&`']);
    expect(
      (await check('select `Ignore#`, `a.Ignore#` from ds.orders;', { ignore_words: ['ignore#'] })).names,
    ).to.deep.equal([]);
  });

  it('does not inspect strings or comments and supports noqa', async () => {
    expect((await check('select \'`bad name`\', "`bad#`"; -- `bad name`')).names).to.deep.equal([]);
    expect((await check('select `bad name`; -- noqa: RF05')).names).to.deep.equal([]);
  });

  it('supports project options and disabling, without rename actions', async () => {
    const rules = parseSettings({ rules: { RF05: { options: { allow_space_in_identifier: true } } } }).rules;
    expect((await check('select `bad name`;', {}, rules)).names).to.deep.equal([]);
    for (const rules of [
      { RF05: { enabled: false } },
      { groups: { references: false } },
      { exclude: ['RF05'] },
    ] satisfies RulesSettings[]) {
      expect((await check('select `bad name`;', {}, rules)).names).to.deep.equal([]);
    }
    const { linter, diagnostics } = await check('select `bad name`;');
    expect(
      await linter.createCodeActions({
        textDocument: { uri },
        range: diagnostics[0].range,
        context: { diagnostics },
      }),
    ).to.deep.equal([]);
  });
});
