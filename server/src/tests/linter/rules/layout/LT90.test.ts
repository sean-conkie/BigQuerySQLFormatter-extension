import { expect } from 'chai';
import { CodeActionKind, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { defaultSettings, parseSettings, type RulesSettings } from '../../../../settings';

describe('LT90 JOIN condition parentheses', () => {
  const uri = 'file:///lt90.sql';
  const settings = (policy = 'multiple', rules: RulesSettings = {}) => ({
    ...defaultSettings,
    rules: {
      groups: {
        aliasing: false,
        ambiguous: false,
        capitalisation: false,
        convention: false,
        structure: false,
        references: false,
      },
      exclude: ['LT01', 'LT02', 'LT04', 'LT06', 'LT07', 'LT08', 'LT09', 'LT10', 'LT11', 'LT12', 'LT13', 'LT15'],
      LT90: { enabled: true, options: { condition_policy: policy } },
      ...rules,
    },
  });
  afterEach(() => globalTokenCache.delete(uri));
  async function check(text: string, policy = 'multiple', rules: RulesSettings = {}) {
    const linter = new Linter(settings(policy, rules));
    const diagnostics = (await linter.verify({ uri, languageId: 'googlesql', version: 1, text })).filter(({ code }) =>
      String(code).startsWith('LT90:'),
    );
    return { linter, diagnostics };
  }
  for (const condition of [
    'a.id=b.id and a.x=b.x',
    'a.id=b.id or a.x=b.x',
    'a.id=b.id and a.x=b.x and a.y=b.y',
    'a.id=b.id and a.x=b.x or a.y=b.y',
    '(a.id=b.id) and (a.x=b.x)',
  ])
    it(`wraps ${condition}`, async () => {
      const text = `select a.id from a join b on ${condition};`;
      const { linter, diagnostics } = await check(text);
      expect(diagnostics).to.have.length(1);
      const actions = await linter.createCodeActions({
        textDocument: { uri },
        range: diagnostics[0].range,
        context: { diagnostics, only: [CodeActionKind.QuickFix] },
      });
      expect(
        TextDocument.applyEdits(TextDocument.create(uri, 'googlesql', 1, text), actions[0].edit!.changes![uri]),
      ).to.equal(`select a.id from a join b on (${condition});`);
    });
  for (const condition of [
    'a.id=b.id',
    '(a.id=b.id and a.x=b.x)',
    '((a.id=b.id and a.x=b.x))',
    'a.id between b.lo and b.hi',
  ])
    it(`accepts ${condition}`, async () =>
      expect((await check(`select a.id from a join b on ${condition};`)).diagnostics).to.deep.equal([]));
  it('only reports top-level AND/OR mixtures under mixed policy', async () => {
    for (const condition of ['a.id=b.id and a.x=b.x', 'a.id=b.id or a.x=b.x', '(a.id=b.id and a.x=b.x) or a.y=b.y'])
      expect((await check(`select a.id from a join b on ${condition};`, 'mixed')).diagnostics).to.deep.equal([]);
    expect(
      (await check('select a.id from a join b on a.id=b.id and a.x=b.x or a.y=b.y;', 'mixed')).diagnostics,
    ).to.have.length(1);
  });
  it('skips USING, WHERE and pipe-stage JOIN', async () => {
    for (const text of [
      'select a.id from a join b using(id) where a.x=b.x and a.y=b.y;',
      'select a.id from a, b where a.id=b.id and a.x=b.x;',
      'from a |> join b on a.id=b.id and a.x=b.x;',
    ])
      expect((await check(text)).diagnostics).to.deep.equal([]);
  });
  it('checks nested joins in subqueries and CTEs', async () => {
    const text =
      'with c as (select a.id from a join b on a.id=b.id and a.x=b.x) select c.id from c join (select x.id from x join y on x.id=y.id or x.z=y.z) q on c.id=q.id and c.id>0;';
    expect((await check(text)).diagnostics).to.have.length(3);
  });
  it('is off by default and respects project options, noqa, severity and group settings', async () => {
    const text = 'select a.id from a join b on a.id=b.id and a.x=b.x;';
    expect(
      (await new Linter(defaultSettings).verify({ uri, languageId: 'googlesql', version: 1, text })).filter(
        ({ code }) => String(code).startsWith('LT90:'),
      ),
    ).to.deep.equal([]);
    expect((await check(`${text} -- noqa: LT90`)).diagnostics).to.deep.equal([]);
    for (const rules of [
      { LT90: { enabled: false } },
      { LT90: { enabled: true, severity: 'off' } },
      { groups: { layout: false } },
      { exclude: ['LT90'] },
    ] satisfies RulesSettings[])
      expect((await check(text, 'multiple', rules)).diagnostics).to.deep.equal([]);
    expect(
      (await check(text, 'multiple', { LT90: { enabled: true, severity: 'error' } })).diagnostics[0].severity,
    ).to.equal(DiagnosticSeverity.Error);
    const rules = parseSettings({ rules: { LT90: { enabled: true, options: { condition_policy: 'mixed' } } } }).rules;
    expect((await check(text, 'multiple', rules)).diagnostics).to.deep.equal([]);
    expect(() => parseSettings({ rules: { LT90: { options: { condition_policy: 'invalid' } } } })).to.throw(
      'Invalid rules.LT90.options',
    );
  });
  for (const eol of ['\n', '\r\n'])
    it(`preserves comments and is idempotent with LT02/ST09 for ${JSON.stringify(eol)}`, async () => {
      const text = `select a.id${eol}  from ds.alpha a${eol} inner join ds.beta b${eol}    on b.id=a.id -- keep${eol}   and b.x<a.x;${eol}`;
      const config = settings('multiple', {
        groups: { ...settings().rules.groups, structure: true },
        exclude: ['LT01', 'LT04', 'LT06', 'LT07', 'LT08', 'LT09', 'LT10', 'LT11', 'LT12', 'LT13', 'LT15'],
      });
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const fixed = TextDocument.applyEdits(document, await formatDocument(document, config));
      expect(fixed).to.include('(a.id=b.id -- keep');
      expect(fixed).to.include('a.x>b.x)');
      expect(fixed.split(eol)).to.have.length(text.split(eol).length);
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, fixed), config)).to.deep.equal([]);
      const actions = await createDocumentCodeActions(document, config, {
        textDocument: { uri },
        range: Range.create(0, 0, 100, 0),
        context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
      });
      expect(TextDocument.applyEdits(document, actions[0].edit!.changes![uri])).to.equal(fixed);
    });
});
