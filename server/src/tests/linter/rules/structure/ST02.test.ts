import { expect } from 'chai';
import { CodeActionKind, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { defaultSettings, type RulesSettings } from '../../../../settings';

describe('ST02 simple CASE', () => {
  const uri = 'file:///st02.sql';
  const settings = (rules: RulesSettings = {}) => ({
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
      ST01: { enabled: false },
      ...rules,
    },
  });
  afterEach(() => globalTokenCache.delete(uri));
  async function check(text: string, rules: RulesSettings = {}) {
    const linter = new Linter(settings(rules));
    const diagnostics = (await linter.verify({ uri, languageId: 'googlesql', version: 1, text })).filter(({ code }) =>
      String(code).startsWith('ST02:'),
    );
    return { linter, diagnostics };
  }
  for (const [expression, expected, meaning] of [
    ['case when a > 0 then true else false end', 'coalesce(a > 0, false)', 'NULL condition returns false'],
    ['case when a > 0 then false else true end', 'not coalesce(a > 0, false)', 'NULL condition returns true'],
    ['case when a is null then 0 else A end', 'coalesce(a, 0)', 'NULL is filled'],
    ['case when a is not null then A else 0 end', 'coalesce(a, 0)', 'non-NULL is preserved'],
    ['case when a is null then null else a end', 'a', 'NULL remains NULL'],
    ['case when a is not null then a else null end', 'a', 'implicit NULL remains NULL'],
    ['case when a then TRUE else FALSE end', 'coalesce(a, false)', 'boolean case is insensitive'],
    [
      'case when a is null then case when b then 1 else 2 end else a end',
      'coalesce(a, case when b then 1 else 2 end)',
      'nested result retained',
    ],
    [
      'case when a is not null then a else case when b then 1 else 2 end end',
      'coalesce(a, case when b then 1 else 2 end)',
      'nested ELSE retained',
    ],
  ]) {
    it(`simplifies ${expression}: ${meaning}`, async () => {
      const text = `select ${expression} as label;`;
      const { linter, diagnostics } = await check(text);
      expect(diagnostics).to.have.length(1);
      const actions = await linter.createCodeActions({
        textDocument: { uri },
        range: diagnostics[0].range,
        context: { diagnostics, only: [CodeActionKind.QuickFix] },
      });
      expect(
        TextDocument.applyEdits(TextDocument.create(uri, 'googlesql', 1, text), actions[0].edit!.changes![uri]),
      ).to.equal(`select ${expected} as label;`);
    });
  }
  for (const expression of [
    'case when a is null then 0 else b end',
    'case a when 1 then true else false end',
    'case when a then true when b then false else false end',
    'case when a then true end',
    'case when rand() > 0 then true else false end',
    'case when generate_uuid() is null then "" else generate_uuid() end',
    'case when current_date is null then null else current_date end',
    'case when session_user() is null then "" else session_user() end',
    'case when `A` is null then 0 else `a` end',
  ])
    it(`skips ${expression}`, async () => expect((await check(`select ${expression};`)).diagnostics).to.deep.equal([]));
  it('reports comments but never drops them', async () => {
    const { linter, diagnostics } = await check('select case when a /*keep*/ then true else false end;');
    expect(diagnostics).to.have.length(1);
    expect(
      await linter.createCodeActions({
        textDocument: { uri },
        range: diagnostics[0].range,
        context: { diagnostics, only: [CodeActionKind.QuickFix] },
      }),
    ).to.deep.equal([]);
  });
  it('preserves precedence when replacing atomic CASE expressions', async () => {
    for (const [source, expected] of [
      ['select 2 * case when a + b is null then null else a + b end;', 'select 2 * (a + b);'],
      ['select case when a then false else true end is null;', 'select (not coalesce(a, false)) is null;'],
    ]) {
      const document = TextDocument.create(uri, 'googlesql', 1, source);
      expect(TextDocument.applyEdits(document, await formatDocument(document, settings()))).to.equal(expected);
    }
  });
  it('respects noqa, severity and group settings', async () => {
    const text = 'select case when a then true else false end;';
    expect((await check(`${text} -- noqa: ST02`)).diagnostics).to.deep.equal([]);
    for (const rules of [
      { ST02: { enabled: false } },
      { ST02: { severity: 'off' } },
      { groups: { structure: false } },
      { exclude: ['ST02'] },
    ] satisfies RulesSettings[])
      expect((await check(text, rules)).diagnostics).to.deep.equal([]);
    expect((await check(text, { ST02: { severity: 'error' } })).diagnostics[0].severity).to.equal(
      DiagnosticSeverity.Error,
    );
  });
  for (const eol of ['\n', '\r\n'])
    it(`is idempotent with casing/CV02 and ${JSON.stringify(eol)}`, async () => {
      const config = settings({
        groups: { capitalisation: true },
        CP01: { options: { capitalisation_policy: 'upper' } },
        CP03: { options: { capitalisation_policy: 'upper' } },
        CV02: { enabled: true },
      });
      const source = `SELECT CASE WHEN a > 0${eol}THEN TRUE ELSE FALSE END AS label;${eol}`;
      const document = TextDocument.create(uri, 'googlesql', 1, source);
      const fixed = TextDocument.applyEdits(document, await formatDocument(document, config));
      expect(fixed).to.equal(`SELECT COALESCE(a > 0, false) AS label;${eol}`);
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, fixed), config)).to.deep.equal([]);
      const actions = await createDocumentCodeActions(document, config, {
        textDocument: { uri },
        range: Range.create(0, 0, 100, 0),
        context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
      });
      expect(TextDocument.applyEdits(document, actions[0].edit!.changes![uri])).to.equal(fixed);
    });
});
