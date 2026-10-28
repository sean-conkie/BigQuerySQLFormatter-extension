import { expect } from 'chai';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { columnReferences } from '../../../../linter/rules/references/columns';
import { sourceTokens } from '../../../../linter/rules/source';
import { QueryScopeResolver } from '../../../../linter/scope';
import { defaultSettings, type RulesSettings } from '../../../../settings';

describe('RF01 known source qualifiers', () => {
  const uri = 'file:///rf01.sql';
  afterEach(() => globalTokenCache.delete(uri));

  async function check(text: string, rules: RulesSettings = { RF01: { enabled: true } }) {
    const linter = new Linter({ ...defaultSettings, rules });
    const diagnostics = (await linter.verify({ uri, languageId: 'googlesql', version: 1, text })).filter(({ code }) =>
      String(code).startsWith('RF01:'),
    );
    return { linter, diagnostics, names: diagnostics.map(({ range }) => globalTokenCache.get(uri)!.getText(range)) };
  }

  it('flags unknown qualifiers including the documented STRUCT false positive', async () => {
    expect((await check('select vee.a, address.city from foo;')).names).to.deep.equal(['vee.a', 'address.city']);
  });

  for (const sql of [
    'select f.a, f.* from foo f;',
    'select foo.a from foo;',
    'select tbl.a from proj.ds.tbl;',
    'select tbl.a from `proj.ds.tbl`;',
    'with c as (select foo.a from foo) select c.a from c;',
    'select q.a from (select f.a from foo f) q;',
    'select x.a, pos.a from unnest([struct(1 as a)]) x with offset as pos;',
    'select f.a from ds.fn(1) f;',
    'select (select o.a from inner_table i where i.a = o.a) from orders o;',
    'update orders o set a = s.a from source s where o.id = s.id;',
    'merge orders o using source s on o.id = s.id when matched then update set a = s.a;',
    'delete orders o where o.a = 1;',
    'select @p.field, @@error.message, INFORMATION_SCHEMA.TABLES;',
    'select bad.a from foo |> WITH c AS (SELECT 1) |> select bad.b;',
    'select bad.a from foo; -- noqa: RF01',
  ]) {
    it(`accepts visible or excluded references: ${sql}`, async () => {
      expect((await check(sql)).names).to.deep.equal([]);
    });
  }

  it('does not expose CTE-body or sibling-query sources', async () => {
    expect((await check('with c as (select o.a from input) select i.a from orders o;')).names).to.deep.equal([
      'o.a',
      'i.a',
    ]);
  });

  it('extracts expressions, not STRUCT/REPLACE aliases, wildcard exclusions or window names', async () => {
    await check(
      'select struct(a as field), t.* except(hidden) replace(b as replaced), sum(c) over win from foo t window win as (partition by d);',
    );
    const cache = globalTokenCache.get(uri)!;
    const tokens = sourceTokens(cache);
    expect(
      columnReferences(tokens, cache, new QueryScopeResolver(tokens)).map(({ range }) => cache.getText(range)),
    ).to.deep.equal(['a', 't.*', 'b', 'c', 'd']);
  });

  it('excludes case-insensitive select aliases only in GROUP BY and ORDER BY', async () => {
    const text =
      'select f.address as `Address` from foo f where missing.city = 1 group by address.city order by ADDRESS.city, other.city;';
    expect((await check(text)).names).to.deep.equal(['missing.city', 'other.city']);
    const cache = globalTokenCache.get(uri)!;
    const tokens = sourceTokens(cache);
    expect(
      columnReferences(tokens, cache, new QueryScopeResolver(tokens)).map(({ range }) => cache.getText(range)),
    ).to.deep.equal(['f.address', 'missing.city', 'other.city']);
  });

  it('extracts join expressions without treating USING column declarations as references', async () => {
    await check('select f.id, b.name from foo f join bar b using (`id`, name) order by b.name;');
    const cache = globalTokenCache.get(uri)!;
    const tokens = sourceTokens(cache);
    expect(
      columnReferences(tokens, cache, new QueryScopeResolver(tokens)).map(({ range }) => cache.getText(range)),
    ).to.deep.equal(['f.id', 'b.name', 'b.name']);
  });

  it('respects opt-in, severity, exclusions and group settings', async () => {
    for (const rules of [
      {},
      { RF01: { severity: 'error' } },
      { RF01: { enabled: true, severity: 'off' } },
      { RF01: { enabled: true }, groups: { references: false } },
      { RF01: { enabled: true }, exclude: ['RF01'] },
    ] satisfies RulesSettings[]) {
      expect((await check('select bad.a from foo;', rules)).names).to.deep.equal([]);
    }
    const { linter, diagnostics } = await check('select bad.a from foo;', {
      RF01: { enabled: true, severity: 'error' },
    });
    expect(diagnostics[0].severity).to.equal(DiagnosticSeverity.Error);
    expect(
      await linter.createCodeActions({ textDocument: { uri }, range: diagnostics[0].range, context: { diagnostics } }),
    ).to.deep.equal([]);
  });
});
