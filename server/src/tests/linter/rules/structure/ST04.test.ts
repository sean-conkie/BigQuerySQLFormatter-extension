import { expect } from 'chai';
import { CodeActionKind, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { defaultSettings, type RulesSettings } from '../../../../settings';

describe('ST04 nested CASE', () => {
  const uri = 'file:///st04.sql';
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
      ST02: { enabled: false },
      ...rules,
    },
  });
  afterEach(() => globalTokenCache.delete(uri));
  async function check(text: string, rules: RulesSettings = {}) {
    const linter = new Linter(settings(rules));
    const diagnostics = (await linter.verify({ uri, languageId: 'googlesql', version: 1, text })).filter(({ code }) =>
      String(code).startsWith('ST04:'),
    );
    return { linter, diagnostics };
  }
  for (const [source, expected] of [
    ['case when a then 1 else case when b then 2 else 3 end end', 'case when a then 1 when b then 2 else 3 end'],
    ['case x when 1 then 1 else case X when 2 then 2 else 3 end end', 'case x when 1 then 1 when 2 then 2 else 3 end'],
    ['case when a then 1 else ((case when b then 2 end)) end', 'case when a then 1 when b then 2 end'],
  ])
    it(`flattens ${source}`, async () => {
      const text = `select ${source} as result;`;
      const { linter, diagnostics } = await check(text);
      expect(diagnostics).to.have.length(1);
      const actions = await linter.createCodeActions({
        textDocument: { uri },
        range: diagnostics[0].range,
        context: { diagnostics, only: [CodeActionKind.QuickFix] },
      });
      expect(
        TextDocument.applyEdits(TextDocument.create(uri, 'googlesql', 1, text), actions[0].edit!.changes![uri]),
      ).to.equal(`select ${expected} as result;`);
    });
  for (const source of [
    'case when a then case when b then 2 end else 3 end',
    'case x when 1 then 1 else case y when 2 then 2 end end',
    'case when a then 1 else case x when 2 then 2 end end',
    'case x when 1 then 1 else case when b then 2 end end',
    'case rand() when 1 then 1 else case rand() when 2 then 2 end end',
    'case generate_uuid() when "a" then 1 else case generate_uuid() when "b" then 2 end end',
    'case current_date() when date "2026-01-01" then 1 else case current_date() when date "2026-02-01" then 2 end end',
    'case when a then 1 else (case when b then 2 end) + 1 end',
  ])
    it(`skips ${source}`, async () => expect((await check(`select ${source};`)).diagnostics).to.deep.equal([]));
  for (const source of [
    'case /*keep outer*/ when a then 1 else case when b then 2 end end',
    'case when a then 1 else case /*keep inner*/ when b then 2 end end',
  ])
    it('reports but does not remove comments', async () => {
      const { linter, diagnostics } = await check(`select ${source};`);
      expect(diagnostics).to.have.length(1);
      expect(
        await linter.createCodeActions({
          textDocument: { uri },
          range: diagnostics[0].range,
          context: { diagnostics, only: [CodeActionKind.QuickFix] },
        }),
      ).to.deep.equal([]);
    });
  it('respects noqa, severity and group settings', async () => {
    const text = 'select case when a then 1 else case when b then 2 end end;';
    expect((await check(`${text} -- noqa: ST04`)).diagnostics).to.deep.equal([]);
    for (const rules of [
      { ST04: { enabled: false } },
      { ST04: { severity: 'off' } },
      { groups: { structure: false } },
      { exclude: ['ST04'] },
    ] satisfies RulesSettings[])
      expect((await check(text, rules)).diagnostics).to.deep.equal([]);
    expect((await check(text, { ST04: { severity: 'error' } })).diagnostics[0].severity).to.equal(
      DiagnosticSeverity.Error,
    );
  });
  for (const eol of ['\n', '\r\n'])
    it(`flattens three levels with LT02 and ${JSON.stringify(eol)}`, async () => {
      const source = [
        'select',
        '       case',
        '    when a then 1',
        '    else',
        '      case',
        '        when b then 2',
        '        else',
        '          case',
        '            when c then 3',
        '            else 4',
        '          end',
        '      end',
        '  end as result;',
      ].join(eol);
      const expected = [
        'select',
        '       case',
        '    when a then 1',
        '    when b then 2',
        '    when c then 3',
        '    else 4',
        '  end as result;',
      ].join(eol);
      const config = settings({ LT02: { enabled: true } });
      config.rules.groups.layout = true;
      config.rules.exclude = ['LT01', 'LT04', 'LT06', 'LT07', 'LT08', 'LT09', 'LT10', 'LT11', 'LT12', 'LT13', 'LT15'];
      const document = TextDocument.create(uri, 'googlesql', 1, source);
      const fixed = TextDocument.applyEdits(document, await formatDocument(document, config));
      expect(fixed).to.equal(expected);
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, fixed), config)).to.deep.equal([]);
      const actions = await createDocumentCodeActions(document, config, {
        textDocument: { uri },
        range: Range.create(0, 0, 100, 0),
        context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
      });
      expect(TextDocument.applyEdits(document, actions[0].edit!.changes![uri])).to.equal(expected);
    });
});
