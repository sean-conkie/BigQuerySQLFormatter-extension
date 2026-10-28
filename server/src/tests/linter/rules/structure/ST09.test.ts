import { expect } from 'chai';
import { CodeActionKind, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { defaultSettings, parseSettings, type RulesSettings } from '../../../../settings';

describe('ST09 JOIN condition order', () => {
  const uri = 'file:///st09.sql';
  const settings = (policy = 'earlier', rules: RulesSettings = {}) => ({
    ...defaultSettings,
    rules: {
      groups: {
        aliasing: false,
        ambiguous: false,
        capitalisation: false,
        convention: false,
        layout: false,
        references: false,
      },
      ST09: { options: { preferred_first_table_in_join_clause: policy } },
      ...rules,
    },
  });
  afterEach(() => globalTokenCache.delete(uri));
  async function check(text: string, policy = 'earlier', rules: RulesSettings = {}) {
    const linter = new Linter(settings(policy, rules));
    const diagnostics = (await linter.verify({ uri, languageId: 'googlesql', version: 1, text })).filter(({ code }) =>
      String(code).startsWith('ST09:'),
    );
    return { linter, diagnostics };
  }
  for (const [operator, mirrored] of [
    ['=', '='],
    ['!=', '!='],
    ['<>', '<>'],
    ['<', '>'],
    ['>', '<'],
    ['<=', '>='],
    ['>=', '<='],
    ['is distinct from', 'is distinct from'],
    ['is not distinct from', 'is not distinct from'],
  ])
    for (const policy of ['earlier', 'later'])
      it(`orders ${operator} with ${policy} policy`, async () => {
        const source = policy === 'earlier' ? `b.id  ${operator}   a.id` : `a.id  ${operator}   b.id`;
        const expected = policy === 'earlier' ? `a.id  ${mirrored}   b.id` : `b.id  ${mirrored}   a.id`;
        const text = `select a.id from a join b on ${source};`;
        const { linter, diagnostics } = await check(text, policy);
        expect(diagnostics).to.have.length(1);
        const actions = await linter.createCodeActions({
          textDocument: { uri },
          range: diagnostics[0].range,
          context: { diagnostics, only: [CodeActionKind.QuickFix] },
        });
        expect(
          TextDocument.applyEdits(TextDocument.create(uri, 'googlesql', 1, text), actions[0].edit!.changes![uri]),
        ).to.equal(`select a.id from a join b on ${expected};`);
      });
  for (const [text, expected] of [
    [
      'select foo.id from ds.foo join ds.bar on bar.id = foo.id;',
      'select foo.id from ds.foo join ds.bar on foo.id = bar.id;',
    ],
    [
      'select a.id from a as a join b as b on lower(b.id) = a.id;',
      'select a.id from a as a join b as b on a.id = lower(b.id);',
    ],
    [
      'select a.id from a join b on b.id=a.id join c on c.id=b.id and c.x>a.x;',
      'select a.id from a join b on a.id=b.id join c on b.id=c.id and a.x<c.x;',
    ],
    [
      'with a as (select 1 as id) select a.id from a join (select 1 as id) b on b.id=a.id;',
      'with a as (select 1 as id) select a.id from a join (select 1 as id) b on a.id=b.id;',
    ],
    [
      'select a.id from a join unnest(a.items) b on b.id=a.id;',
      'select a.id from a join unnest(a.items) b on a.id=b.id;',
    ],
    ['select a.id from a join ds.fn(1) b on b.id=a.id;', 'select a.id from a join ds.fn(1) b on a.id=b.id;'],
    [
      'select a.id from a join b on (b.id=a.id or (b.x<a.x and b.y>a.y));',
      'select a.id from a join b on (a.id=b.id or (a.x>b.x and a.y<b.y));',
    ],
  ])
    it(`supports source and expression forms: ${text}`, async () => {
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      expect(TextDocument.applyEdits(document, await formatDocument(document, settings()))).to.equal(expected);
    });
  for (const text of [
    'select a.id from a join b on b.id = id;',
    'select a.id from a join b on address.city = a.id;',
    'select a.id from a join b on b.id = b.other;',
    'select a.id from a join b using(id);',
    'select a.id from a, b where b.id=a.id;',
    'select a.id from a join b on b.id like a.id;',
    'select a.id from a join b on b.id in (a.id);',
    'select a.id from a join b on b.id between a.lo and a.hi;',
    'select (select b.id from b join c on c.id = a.id) from a;',
    'select a.id from a join b on b.id = (select a.id);',
    'select a.id from a join b on b.id + a.id = a.id;',
    'select a.id from a join b on not b.id = a.id;',
    'from a |> join b on b.id=a.id;',
  ])
    it(`skips unsafe/non-comparison conditions: ${text}`, async () =>
      expect((await check(text)).diagnostics).to.deep.equal([]));
  it('reports but does not drop comments', async () => {
    const { linter, diagnostics } = await check('select a.id from a join b on b.id /*keep*/ = a.id;');
    expect(diagnostics).to.have.length(1);
    expect(
      await linter.createCodeActions({
        textDocument: { uri },
        range: diagnostics[0].range,
        context: { diagnostics, only: [CodeActionKind.QuickFix] },
      }),
    ).to.deep.equal([]);
  });
  it('retains lexical source references across commented DISTINCT FROM operators', async () => {
    const { diagnostics } = await check('select a.id from a join b on b.id is distinct /*keep*/ from a.id;');
    expect(diagnostics).to.have.length(1);
  });
  it('supports project options, noqa, severity and group settings', async () => {
    const text = 'select a.id from a join b on b.id=a.id;';
    expect((await check(`${text} -- noqa: ST09`)).diagnostics).to.deep.equal([]);
    for (const rules of [
      { ST09: { enabled: false } },
      { ST09: { severity: 'off' } },
      { groups: { structure: false } },
      { exclude: ['ST09'] },
    ] satisfies RulesSettings[])
      expect((await check(text, 'earlier', rules)).diagnostics).to.deep.equal([]);
    expect((await check(text, 'earlier', { ST09: { severity: 'error' } })).diagnostics[0].severity).to.equal(
      DiagnosticSeverity.Error,
    );
    const rules = parseSettings({
      rules: { ST09: { options: { preferred_first_table_in_join_clause: 'later' } } },
    }).rules;
    expect((await check(text, 'earlier', rules)).diagnostics).to.deep.equal([]);
    expect(() =>
      parseSettings({ rules: { ST09: { options: { preferred_first_table_in_join_clause: 'invalid' } } } }),
    ).to.throw('Invalid rules.ST09.options');
  });
  for (const eol of ['\n', '\r\n'])
    it(`makes Fix All and formatting idempotent for ${JSON.stringify(eol)}`, async () => {
      const text = `select a.id from a${eol}join b on b.id = a.id${eol}and b.x < a.x;${eol}`;
      const expected = text.replace('b.id = a.id', 'a.id = b.id').replace('b.x < a.x', 'a.x > b.x');
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      expect(TextDocument.applyEdits(document, await formatDocument(document, settings()))).to.equal(expected);
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, expected), settings())).to.deep.equal([]);
      const actions = await createDocumentCodeActions(document, settings(), {
        textDocument: { uri },
        range: Range.create(0, 0, 100, 0),
        context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
      });
      expect(TextDocument.applyEdits(document, actions[0].edit!.changes![uri])).to.equal(expected);
    });
});
