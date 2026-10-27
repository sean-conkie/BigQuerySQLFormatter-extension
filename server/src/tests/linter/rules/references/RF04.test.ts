import { expect } from 'chai';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { defaultSettings, parseSettings, type RulesSettings } from '../../../../settings';

describe('RF04 keyword identifiers', () => {
  const uri = 'file:///rf04.sql';
  afterEach(() => globalTokenCache.delete(uri));

  async function check(text: string, options: Record<string, string | string[]> = {}, rules: RulesSettings = {}) {
    const linter = new Linter({
      ...defaultSettings,
      rules: { RF04: { options }, ...rules },
    });
    const diagnostics = (await linter.verify({ uri, languageId: 'googlesql', version: 1, text })).filter((diagnostic) =>
      String(diagnostic.code).startsWith('RF04:'),
    );
    return { linter, diagnostics, names: diagnostics.map(({ range }) => globalTokenCache.get(uri)!.getText(range)) };
  }

  it('checks explicit and implicit column and table aliases by default', async () => {
    expect((await check('select created_at as timestamp, event_day date from ds.events as json;')).names).to.deep.equal(
      ['timestamp', 'date', 'json'],
    );
    expect((await check('select created_at as created_ts from ds.events e;')).names).to.deep.equal([]);
  });

  for (const [policy, names] of [
    ['aliases', ['timestamp', 'json']],
    ['column_aliases', ['timestamp']],
    ['table_aliases', ['json']],
    ['all', ['timestamp', 'json']],
  ] as const) {
    it(`applies unquoted ${policy}`, async () => {
      expect(
        (
          await check('select created_at as timestamp from ds.events as json;', {
            unquoted_identifiers_policy: policy,
          })
        ).names,
      ).to.deep.equal(names);
    });
  }

  for (const [policy, names] of [
    ['none', []],
    ['aliases', ['`select`', '`from`']],
    ['column_aliases', ['`select`']],
    ['table_aliases', ['`from`']],
    ['all', ['`date`', '`select`', '`ds.order`', '`from`']],
  ] as const) {
    it(`applies quoted ${policy} without flagging SQL syntax or types`, async () => {
      expect(
        (
          await check('select `date` as `select` from `ds.order` as `from`;', {
            quoted_identifiers_policy: policy,
          })
        ).names,
      ).to.deep.equal(names);
    });
  }

  it('checks table names only with all, and never flags functions, types, strings or comments', async () => {
    expect(
      (await check("select cast(x as timestamp), date(x), 'as timestamp' from ds.date; -- as json")).names,
    ).to.deep.equal([]);
    expect((await check('select x from ds.date;', { unquoted_identifiers_policy: 'all' })).names).to.deep.equal([
      'date',
    ]);
    expect(
      (
        await check('select date, timestamp, t.json from ds.events t;', {
          unquoted_identifiers_policy: 'all',
        })
      ).names,
    ).to.deep.equal(['date', 'timestamp', 'json']);
  });

  it('checks CTE names as table aliases', async () => {
    expect((await check('with date as (select x from ds.events) select x from date;')).names).to.include('date');
  });

  it('supports case-insensitive ignored words and noqa', async () => {
    expect(
      (
        await check('select x as TIMESTAMP, y as date from ds.events as json;', {
          ignore_words: ['Timestamp', 'JSON'],
        })
      ).names,
    ).to.deep.equal(['date']);
    expect((await check('select x as timestamp; -- noqa: RF04')).names).to.deep.equal([]);
  });

  it('respects disabled rules, exclusions and groups', async () => {
    for (const rules of [
      { RF04: { enabled: false } },
      { exclude: ['RF04'] },
      { groups: { references: false } },
      { RF04: { severity: 'off' } },
    ] satisfies RulesSettings[]) {
      expect((await check('select x as timestamp;', {}, rules)).names).to.deep.equal([]);
    }
  });

  it('parses options from project settings and provides no rename actions', async () => {
    const rules = parseSettings({ rules: { RF04: { options: { ignore_words: ['date'] } } } }).rules;
    expect((await check('select x as date;', {}, rules)).names).to.deep.equal([]);
    const { linter, diagnostics } = await check('select x as timestamp;');
    expect(
      await linter.createCodeActions({
        textDocument: { uri },
        range: diagnostics[0].range,
        context: { diagnostics },
      }),
    ).to.deep.equal([]);
  });
});
