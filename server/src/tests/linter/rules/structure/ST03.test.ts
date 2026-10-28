import { expect } from 'chai';
import { DiagnosticSeverity, DiagnosticTag, CodeActionKind } from 'vscode-languageserver/node';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { defaultSettings, type RulesSettings } from '../../../../settings';

describe('ST03 unused CTEs', () => {
  const uri = 'file:///st03.sql';
  afterEach(() => globalTokenCache.delete(uri));
  async function check(text: string, rules: RulesSettings = {}) {
    const linter = new Linter({ ...defaultSettings, rules });
    const diagnostics = (await linter.verify({ uri, languageId: 'googlesql', version: 1, text })).filter(({ code }) =>
      String(code).startsWith('ST03:'),
    );
    return { linter, diagnostics, names: diagnostics.map(({ range }) => globalTokenCache.get(uri)!.getText(range)) };
  }
  it('fades unused definitions without offering destructive fixes', async () => {
    const { linter, diagnostics, names } = await check('with unused as (select 1) select 2;');
    expect(names).to.deep.equal(['unused']);
    expect(diagnostics[0].tags).to.deep.equal([DiagnosticTag.Unnecessary]);
    expect(diagnostics[0].severity).to.equal(DiagnosticSeverity.Warning);
    expect(
      await linter.createCodeActions({
        textDocument: { uri },
        range: diagnostics[0].range,
        context: { diagnostics, only: [CodeActionKind.QuickFix] },
      }),
    ).to.deep.equal([]);
  });
  for (const body of [
    'select * from c',
    'select (select id from c)',
    'select 1 where 1 in (select id from c)',
    'select 1 where exists (select 1 from c)',
    'insert into target select * from c',
    'merge target t using c on t.id = c.id when matched then delete',
    'update target set id = c.id from c where true',
    'delete from target where exists (select 1 from c)',
    'create table target as select * from c',
    'create view target as select * from c',
    'from c |> where id > 0',
    'select * from c for system_time as of current_timestamp()',
    'select * from c match_recognize (order by id pattern (a) define a as true)',
    'select * from graph_table(g match (n) columns ((select id from c) as id))',
    'select * from `C`',
  ]) {
    it(`counts visible references in ${body}`, async () => {
      expect((await check(`with c as (select 1 as id) ${body};`)).names).to.deep.equal([]);
    });
  }
  it('reports only the end of an unused chain', async () => {
    expect((await check('with a as (select 1), b as (select * from a) select 2;')).names).to.deep.equal(['b']);
  });
  it('respects nested WITH shadowing', async () => {
    expect(
      (await check('with c as (select 1) select * from (with c as (select 2) select * from c);')).names,
    ).to.deep.equal(['c']);
  });
  it('does not count recursive self-references', async () => {
    expect((await check('with recursive c as (select 1 union all select * from c) select 2;')).names).to.deep.equal([
      'c',
    ]);
  });
  it('keeps statements independent', async () => {
    expect((await check('with c as (select 1) select 2; select * from c;')).names).to.deep.equal(['c']);
  });
  it('respects noqa, severity, exclusions and group settings', async () => {
    const text = 'with c as (select 1) select 2;';
    expect((await check(`${text} -- noqa: ST03`)).names).to.deep.equal([]);
    for (const rules of [
      { ST03: { enabled: false } },
      { ST03: { severity: 'off' } },
      { groups: { structure: false } },
      { exclude: ['ST03'] },
    ] satisfies RulesSettings[])
      expect((await check(text, rules)).names).to.deep.equal([]);
    expect((await check(text, { ST03: { severity: 'error' } })).diagnostics[0].severity).to.equal(
      DiagnosticSeverity.Error,
    );
  });
});
