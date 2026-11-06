import { expect } from 'chai';
import { CodeActionKind, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { ruleRegistry } from '../../../../linter/rules/rules';
import { tokenizeSource } from '../../../../linter/rules/source';
import { defaultSettings, type RulesSettings } from '../../../../settings';

describe('LT91 pipe layout', () => {
  const uri = 'file:///pipe-layout.sql';
  const settings = (codes = ['LT91'], rules: RulesSettings = {}) => ({
    ...defaultSettings,
    rules: {
      exclude: ruleRegistry.map((Rule) => new Rule(defaultSettings, 0).code).filter((code) => !codes.includes(code)),
      ...rules,
    },
  });
  afterEach(() => globalTokenCache.delete(uri));
  async function check(text: string, rules: RulesSettings = {}) {
    const linter = new Linter(settings(['LT91'], rules));
    const diagnostics = await linter.verify({ uri, languageId: 'googlesql', version: 1, text });
    return { linter, diagnostics };
  }
  async function format(text: string, codes = ['LT91', 'LT02']) {
    const document = TextDocument.create(uri, 'googlesql', 1, text);
    const warnings: string[] = [];
    const edits = await formatDocument(document, settings(codes), undefined, undefined, (message) =>
      warnings.push(message),
    );
    expect(warnings).to.deep.equal([]);
    return TextDocument.applyEdits(document, edits);
  }

  it('reports the exact pipe operator range and provides a quick fix', async () => {
    const text = 'from ds.orders |> select region;';
    const { linter, diagnostics } = await check(text);
    expect(diagnostics).to.have.length(1);
    expect(diagnostics[0].code).to.equal('LT91: pipe_stages');
    expect(diagnostics[0].range).to.deep.equal(Range.create(0, 15, 0, 17));
    const actions = await linter.createCodeActions({
      textDocument: { uri },
      range: diagnostics[0].range,
      context: { diagnostics, only: [CodeActionKind.QuickFix] },
    });
    expect(
      TextDocument.applyEdits(TextDocument.create(uri, 'googlesql', 1, text), actions[0].edit!.changes![uri]),
    ).to.equal('from ds.orders\n|> select region;');
  });

  for (const [before, after] of [
    ['from ds.orders |> where status=1 |> select region;', 'from ds.orders\n|> where status=1\n|> select region;'],
    ['  from ds.orders\n |> select region;', '  from ds.orders\n  |> select region;'],
    ['select region from ds.orders |> select region;', 'select region from ds.orders\n|> select region;'],
    [
      'from (from ds.orders |> select region) q |> select region;',
      'from (from ds.orders\n      |> select region) q\n|> select region;',
    ],
    [
      'with c as (from ds.orders |> select region)\nfrom c |> select region;',
      'with c as (from ds.orders\n           |> select region)\nfrom c\n|> select region;',
    ],
    ['from ds.orders /* next stage */ |> select region;', 'from ds.orders\n/* next stage */\n|> select region;'],
    ['from ds.orders /* next stage */\n|> select region;', 'from ds.orders\n/* next stage */\n|> select region;'],
    ['from ds.orders -- next stage\n  |> select region;', 'from ds.orders -- next stage\n|> select region;'],
    ['from ds.orders\n-- next stage\n   |> select region;', 'from ds.orders\n-- next stage\n|> select region;'],
    ['from ds.orders |> /* stage body */ select region;', 'from ds.orders\n|> /* stage body */ select region;'],
    ['from ds.orders;', 'from ds.orders;'],
    ['from ds.orders\n|> select region;', 'from ds.orders\n|> select region;'],
    [
      "from ds.orders |> select '|> from literal', `|> quoted`;",
      "from ds.orders\n|> select '|> from literal', `|> quoted`;",
    ],
  ]) {
    it(`lays out ${JSON.stringify(before)}`, async () => {
      const fixed = await format(before, ['LT91']);
      expect(fixed).to.equal(after);
      expect(await format(fixed, ['LT91'])).to.equal(fixed);
      expect(tokenizeSource(fixed).map((token) => token.value)).to.deep.equal(
        tokenizeSource(before).map((token) => token.value),
      );
    });
  }

  it('indents projection lists, grouping and filters relative to their stage', async () => {
    const text =
      'from ds.orders\n|> select region,\nstatus\n|> aggregate count(*) as n\ngroup by region,\nstatus\n|> where status=1\nand region is not null;';
    expect(await format(text)).to.equal(
      'from ds.orders\n|> select region,\n          status\n|> aggregate count(*) as n\n   group by region,\n            status\n|> where status=1\n     and region is not null;',
    );
  });

  it('indents nested pipe inputs and their stages without touching literals', async () => {
    const text =
      "from ds.orders\n|> where exists (\nfrom ds.other\n|> select '''keep\nliteral'''\n)\n|> select region;";
    const fixed = await format(text);
    expect(fixed).to.equal(
      "from ds.orders\n|> where exists (\n   from ds.other\n   |> select '''keep\nliteral'''\n   )\n|> select region;",
    );
    expect(await format(fixed)).to.equal(fixed);
  });

  it('indents operators separated from their pipe by comments', async () => {
    const text = 'from ds.orders |> /* keep */\n-- keep too\nselect region;';
    expect(await format(text)).to.equal('from ds.orders\n|> /* keep */\n-- keep too\n   select region;');
  });

  it('formats only the selected pipeline', async () => {
    const text = 'from ds.first |> select region;\nfrom ds.second |> select region;\nfrom ds.third |> select region;\n';
    const document = TextDocument.create(uri, 'googlesql', 1, text);
    const fixed = TextDocument.applyEdits(
      document,
      await formatDocument(document, settings(), Range.create(1, 0, 2, 0)),
    );
    expect(fixed).to.equal(
      'from ds.first |> select region;\nfrom ds.second\n|> select region;\nfrom ds.third |> select region;\n',
    );
  });

  it('is enabled by default and respects noqa, severity and groups', async () => {
    const text = 'from ds.orders |> select region;';
    expect(
      (await new Linter(defaultSettings).verify({ uri, languageId: 'googlesql', version: 1, text })).some(({ code }) =>
        String(code).startsWith('LT91:'),
      ),
    ).to.equal(true);
    for (const suffix of [' -- noqa', ' -- noqa: LT91'])
      expect((await check(text + suffix)).diagnostics).to.deep.equal([]);
    expect((await check(`-- noqa: disable=LT91\n${text}\n-- noqa: enable=LT91\n${text}`)).diagnostics).to.have.length(
      1,
    );
    for (const rules of [
      { LT91: { enabled: false } },
      { LT91: { severity: 'off' } },
      { groups: { layout: false } },
      { exclude: ['LT91'] },
    ] satisfies RulesSettings[]) {
      expect(
        (await check(text, rules)).diagnostics.filter(({ code }) => String(code).startsWith('LT91:')),
      ).to.deep.equal([]);
    }
    expect((await check(text, { LT91: { severity: 'error' } })).diagnostics[0].severity).to.equal(
      DiagnosticSeverity.Error,
    );
  });

  for (const eol of ['\n', '\r\n', '\r']) {
    it(`formats and fixes all idempotently with ${JSON.stringify(eol)}`, async () => {
      const text = `from ds.orders o |> where status=1 |> select   region,count(*)  as n;${eol}`;
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const warnings: string[] = [];
      const fixed = TextDocument.applyEdits(
        document,
        await formatDocument(document, defaultSettings, undefined, undefined, (message) => warnings.push(message)),
      );
      expect(fixed).to.equal(`from ds.orders o${eol}|> where status=1${eol}|> select region,count(1)  n;${eol}`);
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, fixed), defaultSettings)).to.deep.equal([]);
      const actions = await createDocumentCodeActions(
        document,
        defaultSettings,
        {
          textDocument: { uri },
          range: Range.create(0, 0, document.lineCount, 0),
          context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
        },
        undefined,
        (message) => warnings.push(message),
      );
      expect(TextDocument.applyEdits(document, actions[0].edit!.changes![uri])).to.equal(fixed);
      expect(warnings).to.deep.equal([]);
    });
  }

  it('protects unsupported blocks and tolerates incomplete SQL', async () => {
    for (const body of [
      'from ds.orders |> MATCH_RECOGNIZE (PATTERN (a)) |> select x',
      'from GRAPH_TABLE(g MATCH (n) COLUMNS(n.id)) |> select x',
      'from ds.orders |> WITH c AS (from ds.other |> select x) |> select x',
      'from ds.orders |>',
    ]) {
      const text = `with c as (${body}) from ds.other |> select x;`;
      const fixed = await format(text);
      expect(fixed).to.include(body);
      expect(fixed).to.include('from ds.other\n');
    }
  });
});
