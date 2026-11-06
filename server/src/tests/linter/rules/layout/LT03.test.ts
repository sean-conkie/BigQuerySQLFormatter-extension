import { expect } from 'chai';
import { CodeActionKind, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { ruleRegistry } from '../../../../linter/rules/rules';
import { tokenizeSource } from '../../../../linter/rules/source';
import { defaultSettings, parseSettings, type RulesSettings } from '../../../../settings';

describe('LT03 operator line placement', () => {
  const uri = 'file:///operators.sql';
  const settings = (position = 'leading', codes = ['LT03'], rules: RulesSettings = {}) => ({
    ...defaultSettings,
    rules: {
      exclude: ruleRegistry.map((Rule) => new Rule(defaultSettings, 0).code).filter((code) => !codes.includes(code)),
      LT03: { options: { line_position: position } },
      ...rules,
    },
  });
  afterEach(() => globalTokenCache.delete(uri));

  async function check(text: string, rules: RulesSettings = {}) {
    const linter = new Linter(settings('leading', ['LT03'], rules));
    const diagnostics = await linter.verify({ uri, languageId: 'googlesql', version: 1, text });
    return { linter, diagnostics };
  }

  async function format(text: string, position = 'leading', codes = ['LT03']) {
    const document = TextDocument.create(uri, 'googlesql', 1, text);
    const warnings: string[] = [];
    const edits = await formatDocument(document, settings(position, codes), undefined, undefined, (message) =>
      warnings.push(message),
    );
    expect(warnings).to.deep.equal([]);
    return TextDocument.applyEdits(document, edits);
  }

  it('is enabled by default and reports the exact operator range with a quick fix', async () => {
    const text = 'select a +\n  b from ds.t;';
    const { linter, diagnostics } = await check(text);
    expect(diagnostics).to.have.length(1);
    expect(diagnostics[0].code).to.equal('LT03: operators');
    expect(diagnostics[0].range).to.deep.equal(Range.create(0, 9, 0, 10));
    expect(diagnostics[0].severity).to.equal(DiagnosticSeverity.Warning);
    const actions = await linter.createCodeActions({
      textDocument: { uri },
      range: diagnostics[0].range,
      context: { diagnostics, only: [CodeActionKind.QuickFix] },
    });
    expect(
      TextDocument.applyEdits(TextDocument.create(uri, 'googlesql', 1, text), actions[0].edit!.changes![uri]),
    ).to.equal('select a\n  + b from ds.t;');
    const defaults = await new Linter(defaultSettings).verify({ uri, languageId: 'googlesql', version: 1, text });
    expect(defaults.some(({ code }) => String(code).startsWith('LT03:'))).to.equal(true);
  });

  for (const operator of ['+', '-', '*', '/', '||', '=', '!=', '<>', '<', '>', '<=', '>=', 'AND', 'OR']) {
    for (const position of ['leading', 'trailing']) {
      it(`positions ${operator} ${position} and leaves inline operators alone`, async () => {
        const prefix = ['AND', 'OR'].includes(operator) ? 'select a from ds.t where a=1' : 'select a';
        const suffix = ['AND', 'OR'].includes(operator) ? 'b=2;' : 'b from ds.t;';
        const trailing = `${prefix} ${operator}\n  ${suffix}`;
        const leading = `${prefix}\n  ${operator} ${suffix}`;
        const expected = position === 'leading' ? leading : trailing;
        const fixed = await format(position === 'leading' ? trailing : leading, position);
        expect(fixed).to.equal(expected);
        expect(await format(fixed, position)).to.equal(fixed);
        const inline = `${prefix} ${operator} ${suffix}`;
        expect(await format(inline, position)).to.equal(inline);
      });
    }
  }

  for (const [before, after] of [
    ['select a +\n b *\n c from ds.t;', 'select a\n + b\n * c from ds.t;'],
    ['select a + -- keep\n b from ds.t;', 'select a -- keep\n + b from ds.t;'],
    ['select a /* before */ + /* after */\n b from ds.t;', 'select a /* before */ /* after */\n + b from ds.t;'],
    ['select a +\n -- keep\n /* operand */ b from ds.t;', 'select a\n -- keep\n /* operand */ + b from ds.t;'],
    ['select a +\n -b from ds.t;', 'select a\n + -b from ds.t;'],
    ['select t.offset +\n @select from ds.t;', 'select t.offset\n + @select from ds.t;'],
    ['select @select +\n 1 from ds.t;', 'select @select\n + 1 from ds.t;'],
    ['select a\n +\n b from ds.t;', 'select a\n +\n b from ds.t;'],
    [
      'with c as (select a +\n b as x from ds.t) select x from c where x =\n (select max(x) from c);',
      'with c as (select a\n + b as x from ds.t) select x from c where x\n = (select max(x) from c);',
    ],
    [
      'select a from ds.t join ds.u on t.x=1 and\n u.x=2 having count(*)>1 or\n count(*)<0 qualify a=1 and\n b=2;',
      'select a from ds.t join ds.u on t.x=1\n and u.x=2 having count(*)>1\n or count(*)<0 qualify a=1\n and b=2;',
    ],
    ['from ds.t |> where x=1 and\n y=2 |> select a +\n b;', 'from ds.t |> where x=1\n and y=2 |> select a\n + b;'],
    [
      'from (select a +\n b as x from ds.t) |> where x >\n 0;',
      'from (select a\n + b as x from ds.t) |> where x\n > 0;',
    ],
  ]) {
    it(`preserves tokens and comments in ${JSON.stringify(before)}`, async () => {
      const fixed = await format(before);
      expect(fixed).to.equal(after);
      expect(tokenizeSource(fixed).map((token) => token.value)).to.deep.equal(
        tokenizeSource(before).map((token) => token.value),
      );
      expect(await format(fixed)).to.equal(fixed);
    });
  }

  it('preserves comments when moving operators to the preceding line', async () => {
    const text = 'select a -- keep\n /* next */ + b from ds.t where x=1\n -- condition\n and y=2;';
    expect(await format(text, 'trailing')).to.equal(
      'select a + -- keep\n /* next */ b from ds.t where x=1 and\n -- condition\n y=2;',
    );
  });

  it('reports the full compound operator range', async () => {
    const { diagnostics } = await check('select a !=\n b from ds.t;');
    expect(diagnostics).to.have.length(1);
    expect(diagnostics[0].range).to.deep.equal(Range.create(0, 9, 0, 11));
  });

  it('leaves unsupported query blocks unchanged', async () => {
    const text = 'select * from ds.t match_recognize (pattern(a) define a as x +\n y > 0);';
    expect((await check(text)).diagnostics).to.deep.equal([]);
    expect(await format(text)).to.equal(text);
  });

  for (const text of [
    'select -\n a, +\n b, * from ds.t;',
    'select count(\n *\n), t.\n * from ds.t;',
    "select 'a + b', '''x AND\ny''', `a + b` from ds.t; -- x +\n/* x OR\n y */",
    'select a +',
    'select\n + a;',
    'select a\n from ds.t;',
    'from ds.t\n|> select a;',
    'select array<int64>\n[1, 2] from ds.t;',
    'select struct<a array<int64>, b range<date>>\n([1], null) from ds.t;',
    'select f(x =>\n 1) from ds.t;',
  ]) {
    it(`ignores non-binary operators, protected text and incomplete SQL: ${JSON.stringify(text)}`, async () => {
      expect((await check(text)).diagnostics).to.deep.equal([]);
    });
  }

  it('honours suppression, severity, group and project settings', async () => {
    const text = 'select a +\n b from ds.t;';
    for (const suppressed of [
      'select a + -- noqa\n b from ds.t;',
      'select a + -- noqa: LT03\n b from ds.t;',
      '-- noqa: disable=LT03\nselect a +\n b from ds.t;\n-- noqa: enable=LT03',
      '-- noqa: disable=all\nselect a +\n b from ds.t;\n-- noqa: enable=all',
    ])
      expect((await check(suppressed)).diagnostics).to.deep.equal([]);
    for (const rules of [
      { LT03: { enabled: false } },
      { LT03: { severity: 'off' } },
      { groups: { layout: false } },
      { exclude: ['LT03'] },
    ] satisfies RulesSettings[])
      expect(
        (await check(text, rules)).diagnostics.filter(({ code }) => String(code).startsWith('LT03:')),
      ).to.deep.equal([]);
    expect((await check(text, { LT03: { severity: 'error' } })).diagnostics[0].severity).to.equal(
      DiagnosticSeverity.Error,
    );
    const config = parseSettings({ rules: { LT03: { options: { line_position: 'trailing' } } } });
    expect((await check(text, config.rules)).diagnostics).to.deep.equal([]);
    expect(() => parseSettings({ rules: { LT03: { options: { line_position: 'invalid' } } } })).to.throw(
      'Invalid rules.LT03.options',
    );
    expect(
      (await check('-- noqa: disable=LT03\nselect a +\n b;\n-- noqa: enable=LT03\nselect c +\n d;')).diagnostics,
    ).to.have.length(1);
  });

  for (const eol of ['\n', '\r\n', '\r']) {
    for (const position of ['leading', 'trailing']) {
      it(`converges with LT02, LT15 and LT90 for ${position} and ${JSON.stringify(eol)}`, async () => {
        const text = [
          'select a.id',
          'from ds.alpha a',
          'join ds.beta b on a.id=b.id and -- keep',
          'a.x=b.x',
          'where a.id=1',
          'and a.x=2;',
        ].join(eol);
        const config = settings(position, ['LT03', 'LT02', 'LT15', 'LT90'], { LT90: { enabled: true } });
        const document = TextDocument.create(uri, 'googlesql', 1, text);
        const warnings: string[] = [];
        const fixed = TextDocument.applyEdits(
          document,
          await formatDocument(document, config, undefined, undefined, (message) => warnings.push(message)),
        );
        expect(warnings).to.deep.equal([]);
        expect(fixed).to.include('-- keep');
        expect(fixed.split(eol)).to.have.length(text.split(eol).length);
        expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, fixed), config)).to.deep.equal([]);
        const actions = await createDocumentCodeActions(document, config, {
          textDocument: { uri },
          range: Range.create(0, 0, 100, 0),
          context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
        });
        expect(TextDocument.applyEdits(document, actions[0].edit!.changes![uri])).to.equal(fixed);
      });
    }
  }
});
