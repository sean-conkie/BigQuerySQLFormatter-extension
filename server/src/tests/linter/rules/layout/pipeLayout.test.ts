import { expect } from 'chai';
import { CodeActionKind, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { Linter } from '../../../../linter/linter';
import { pipeQueryRules } from '../../../../linter/parser/queryBlocks';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { ruleRegistry } from '../../../../linter/rules/rules';
import { tokenizeSource } from '../../../../linter/rules/source';
import { defaultSettings, type RulesSettings } from '../../../../settings';

describe('Remaining pipe layout rules', () => {
  const uri = 'file:///pipe-layout-corpus.sql';
  const codes = ['LT03', 'LT04', 'LT06', 'LT07', 'LT08', 'LT09', 'LT10', 'LT11', 'LT15', 'LT90'];
  const settings = (selected: string[], rules: RulesSettings = {}) => ({
    ...defaultSettings,
    rules: {
      exclude: ruleRegistry.map((Rule) => new Rule(defaultSettings, 0).code).filter((code) => !selected.includes(code)),
      LT90: { enabled: true },
      ...rules,
    },
  });
  async function check(text: string, selected: string[], rules: RulesSettings = {}) {
    const linter = new Linter(settings(selected, rules));
    const diagnostics = await linter.verify({ uri, text, version: 1, languageId: 'googlesql' });
    return { linter, diagnostics };
  }
  afterEach(() => globalTokenCache.delete(uri));

  it('opts every applicable rule into pipe queries', () => {
    expect(codes.filter((code) => !pipeQueryRules.has(code))).to.deep.equal([]);
  });

  for (const operator of ['SELECT', 'EXTEND', 'AGGREGATE']) {
    it(`checks comma placement and separate targets in ${operator}`, async () => {
      const text = `FROM input\n|> ${operator} a\n, b, c`;
      expect((await check(text, ['LT04'])).diagnostics.map(({ range }) => range)).to.deep.equal([
        Range.create(2, 0, 2, 1),
      ]);
      const { diagnostics } = await check(text, ['LT09']);
      expect(diagnostics).to.have.length(1);
      expect(diagnostics[0].range).to.deep.equal(Range.create(2, 2, 2, 6));
      expect((await check(`FROM input\n|> ${operator} a,\n   b,\n   c`, ['LT04', 'LT09'])).diagnostics).to.deep.equal(
        [],
      );
    });
  }
  it('checks aggregate grouping lists without splitting function arguments or literals', async () => {
    const text = "FROM input\n|> AGGREGATE IF(a, 1, 0) AS n GROUP BY b\n, c, 'd,e'";
    expect((await check(text, ['LT04'])).diagnostics.map(({ range }) => range)).to.deep.equal([
      Range.create(2, 0, 2, 1),
    ]);
    expect((await check(text, ['LT09'])).diagnostics).to.have.length(1);
    expect(
      (await check("FROM input |> SELECT IF(a, 1, 0) AS n |> EXTEND 'a,b' AS s", ['LT04', 'LT09'])).diagnostics,
    ).to.deep.equal([]);
  });

  it('checks functions in every stage, including nested and qualified calls', async () => {
    const text = 'FROM input |> EXTEND ABS (COALESCE (a, 0)) AS x |> WHERE ds.fn (x) > 0 |> ORDER BY ABS (x)';
    const { diagnostics } = await check(text, ['LT06']);
    expect(diagnostics).to.have.length(4);
    const document = TextDocument.create(uri, 'googlesql', 1, text);
    expect(diagnostics.map(({ range }) => document.getText(range))).to.deep.equal([' ', ' ', ' ', ' ']);
    expect((await check('FROM input |> WHERE x IN (1, 2) |> SELECT AS STRUCT x', ['LT06'])).diagnostics).to.deep.equal(
      [],
    );
    expect((await check('FROM input |> SELECT ABS /* keep */ (x)', ['LT06'])).diagnostics).to.deep.equal([]);
  });

  it('checks modifiers after pipe SELECT, but not standalone DISTINCT stages', async () => {
    expect(
      (await check('FROM input\n|> SELECT\n DISTINCT a', ['LT10'])).diagnostics.map(({ range }) => range),
    ).to.deep.equal([Range.create(2, 1, 2, 9)]);
    expect((await check('FROM input |> SELECT DISTINCT a |> DISTINCT', ['LT10'])).diagnostics).to.deep.equal([]);
    expect((await check('FROM input |> SELECT /* keep */\n DISTINCT a', ['LT10'])).diagnostics).to.have.length(1);
  });

  for (const operator of ['UNION ALL', 'INTERSECT DISTINCT', 'EXCEPT DISTINCT']) {
    it(`leaves pipe ${operator} placement to LT91, while checking traditional operands`, async () => {
      expect((await check(`FROM input |> ${operator} (FROM other)`, ['LT11'])).diagnostics).to.deep.equal([]);
      expect(
        (await check(`FROM input\n|> ${operator} (SELECT a UNION ALL SELECT b)`, ['LT11'])).diagnostics,
      ).to.have.length(1);
    });
  }

  it('checks pipe CTE closing brackets and spacing before FROM', async () => {
    const text = 'WITH c AS (\nFROM input\n|> SELECT a)\nFROM c |> SELECT a';
    const { diagnostics } = await check(text, ['LT07', 'LT08']);
    expect(diagnostics.map(({ code }) => String(code).split(':')[0])).to.deep.equal(['LT07', 'LT08']);
    expect(
      (await check('WITH c AS (\nFROM input\n|> SELECT a\n)\n\nFROM c |> SELECT a', ['LT07', 'LT08'])).diagnostics,
    ).to.deep.equal([]);
  });

  it('aligns comparisons in WHERE and JOIN stages without crossing stage boundaries', async () => {
    for (const stage of ['WHERE a = 1\n AND longer = 2', 'JOIN other b ON a.id = b.id\n AND a.longer = b.longer']) {
      expect((await check(`FROM input a\n|> ${stage}\n|> SELECT a.id`, ['LT15'])).diagnostics.length).to.be.greaterThan(
        0,
      );
    }
    expect((await check('FROM input |> WHERE a=1 AND longer=2', ['LT15'])).diagnostics).to.deep.equal([]);
    expect((await check('FROM input |> WHERE a=1 |> WHERE longer=2', ['LT15'])).diagnostics).to.deep.equal([]);
  });

  it('leaves shared-line, BETWEEN and CASE groups safe while aligning nested comparison groups', async () => {
    for (const condition of [
      'a=1 AND b=2\n OR longer=3',
      'a BETWEEN 1 AND 2',
      "CASE WHEN a=1 AND b=2 THEN 'a=b' ELSE 'x=y' END = 'a=b'",
      'a IN (SELECT x FROM other)',
    ])
      expect((await check(`FROM input |> WHERE ${condition}`, ['LT15'])).diagnostics).to.deep.equal([]);
    expect((await check('FROM input |> WHERE (a=1\n AND longer=2)', ['LT15'])).diagnostics).to.have.length(2);
  });

  it('wraps pipe JOIN ON conditions but not USING, WHERE, or already grouped predicates', async () => {
    const text = 'FROM input a |> JOIN other b ON a.id=b.id AND a.x=b.x |> SELECT a.id';
    const { linter, diagnostics } = await check(text, ['LT90']);
    expect(diagnostics).to.have.length(1);
    const actions = await linter.createCodeActions({
      textDocument: { uri },
      range: diagnostics[0].range,
      context: { diagnostics, only: [CodeActionKind.QuickFix] },
    });
    expect(
      TextDocument.applyEdits(TextDocument.create(uri, 'googlesql', 1, text), actions[0].edit!.changes![uri]),
    ).to.equal('FROM input a |> JOIN other b ON (a.id=b.id AND a.x=b.x) |> SELECT a.id');
    for (const stage of ['JOIN other b USING (id)', 'WHERE a=1 AND b=2', 'JOIN other b ON (a.id=b.id AND a.x=b.x)'])
      expect((await check(`FROM input a |> ${stage}`, ['LT90'])).diagnostics).to.deep.equal([]);
  });

  for (const [code, text] of [
    ['LT03', 'FROM input |> EXTEND a +\n b AS x'],
    ['LT04', 'FROM input |> SELECT a\n, b'],
    ['LT06', 'FROM input |> SELECT ABS (a)'],
    ['LT07', 'WITH c AS (\nFROM input |> SELECT a) FROM c'],
    ['LT08', 'WITH c AS (FROM input |> SELECT a) FROM c'],
    ['LT09', 'FROM input |> SELECT a, b'],
    ['LT10', 'FROM input |> SELECT\n DISTINCT a'],
    ['LT15', 'FROM input |> WHERE a=1\n AND longer=2'],
    ['LT90', 'FROM input a |> JOIN other b ON a.id=b.id AND a.x=b.x'],
  ]) {
    it(`honours suppression and settings for pipe ${code}`, async () => {
      const { diagnostics } = await check(text, [code]);
      expect(diagnostics.length).to.be.greaterThan(0);
      const lines = text.split('\n');
      for (const { range } of diagnostics) lines[range.start.line] += ` -- noqa: ${code}`;
      expect((await check(lines.join('\n'), [code])).diagnostics).to.deep.equal([]);
      expect((await check(`-- noqa: disable=${code}\n${text}`, [code])).diagnostics).to.deep.equal([]);
      expect(
        (await check(`-- noqa: disable=${code}\n${text};\n-- noqa: enable=${code}\n${text};`, [code])).diagnostics
          .length,
      ).to.equal(diagnostics.length);
      expect((await check(text, [code], { [code]: { enabled: false } })).diagnostics).to.deep.equal([]);
    });
  }

  it('protects literals, comments and unsupported blocks', async () => {
    expect(
      (
        await check("FROM input |> SELECT 'ABS (a), UNION ALL SELECT DISTINCT', `a,b` -- ABS (a)\n", [
          'LT06',
          'LT10',
          'LT11',
        ])
      ).diagnostics,
    ).to.deep.equal([]);
    expect((await check('FROM input |> FUTURE_OPERATOR ABS (a), b', codes)).diagnostics).to.deep.equal([]);
    expect((await check('FROM input |> SELECT', codes)).diagnostics).to.deep.equal([]);
  });

  for (const eol of ['\n', '\r\n', '\r']) {
    it(`applies each pipe quick fix without changing comments or line endings / ${JSON.stringify(eol)}`, async () => {
      for (const [code, before, after] of [
        ['LT06', 'FROM input |> SELECT ABS\n (a) -- keep', 'FROM input |> SELECT ABS(a) -- keep'],
        ['LT07', 'WITH c AS (\nFROM input |> SELECT a) FROM c', 'WITH c AS (\nFROM input |> SELECT a\n) FROM c'],
        ['LT08', 'WITH c AS (FROM input |> SELECT a) FROM c\n', 'WITH c AS (FROM input |> SELECT a)\n\nFROM c\n'],
        ['LT15', 'FROM input |> WHERE a=1\n AND longer=2', 'FROM input |> WHERE a  =1\n AND longer=2'],
        [
          'LT90',
          'FROM input a |> JOIN b ON a.id=b.id -- keep\n AND a.x=b.x',
          'FROM input a |> JOIN b ON (a.id=b.id -- keep\n AND a.x=b.x)',
        ],
      ]) {
        const text = before.replace(/\n/g, eol);
        const { linter, diagnostics } = await check(text, [code]);
        expect(diagnostics.length).to.be.greaterThan(0);
        const actions = await linter.createCodeActions({
          textDocument: { uri },
          range: diagnostics[0].range,
          context: { diagnostics: [diagnostics[0]], only: [CodeActionKind.QuickFix] },
        });
        const fixed = TextDocument.applyEdits(
          TextDocument.create(uri, 'googlesql', 1, text),
          actions[0].edit!.changes![uri],
        );
        expect(fixed).to.equal(after.replace(/\n/g, eol));
      }
    });
    it(`fixes exact comparison alignment and function gaps / ${JSON.stringify(eol)}`, async () => {
      for (const [before, after] of [
        ['FROM input\n|> WHERE a=1\n AND longer=2', 'FROM input\n|> WHERE a       =1\n     AND longer  =2'],
        [
          'FROM input a\n|> JOIN other b ON a.id=b.id AND\n a.longer=b.longer',
          'FROM input a\n|> JOIN other b ON (a.id  =b.id\n      AND a.longer        =b.longer)',
        ],
        ['FROM input |> SELECT ABS\n (a)', 'FROM input\n|> SELECT ABS(a)'],
      ]) {
        const document = TextDocument.create(uri, 'googlesql', 1, before.replace(/\n/g, eol));
        const config = settings(['LT02', 'LT03', 'LT06', 'LT15', 'LT90', 'LT91']);
        const fixed = TextDocument.applyEdits(document, await formatDocument(document, config));
        expect(fixed).to.equal(after.replace(/\n/g, eol));
        expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, fixed), config)).to.deep.equal([]);
      }
    });
    it(`converges with LT03/LT15/LT90, CTEs and nested set operands / ${JSON.stringify(eol)}`, async () => {
      const text =
        'WITH c AS (\nFROM input a |> JOIN other b ON a.id=b.id AND\n a.longer=b.longer |> EXTEND ABS (a.x) AS x)\nFROM c |> WHERE x=1\n AND longer=2 |> SELECT x,\nlonger |> UNION ALL (FROM other |> SELECT x,\nlonger);\n'.replace(
          /\n/g,
          eol,
        );
      const config = { ...defaultSettings, rules: { LT90: { enabled: true } } };
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const warnings: string[] = [];
      const fixed = TextDocument.applyEdits(
        document,
        await formatDocument(document, config, undefined, undefined, (message) => warnings.push(message)),
      );
      expect(warnings).to.deep.equal([]);
      expect(fixed).to.include('abs(');
      expect(fixed).to.include('on (');
      const significant = (sql: string) =>
        tokenizeSource(sql)
          .map(({ value }) => value.toUpperCase())
          .filter((value) => !['(', ')', 'AS', 'INNER'].includes(value));
      expect(significant(fixed)).to.deep.equal(significant(text));
      expect(fixed.replaceAll(eol, '')).not.to.match(/[\r\n]/);
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, fixed), config)).to.deep.equal([]);
      const actions = await createDocumentCodeActions(document, config, {
        textDocument: { uri },
        range: Range.create(0, 0, document.lineCount, 0),
        context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
      });
      expect(TextDocument.applyEdits(document, actions[0].edit!.changes![uri])).to.equal(fixed);
      expect((await check(fixed, [...codes, 'LT02', 'LT91'])).diagnostics).to.deep.equal([]);
    });
    it(`keeps LT09 diagnostic-only while LT91 lays out stages / ${JSON.stringify(eol)}`, async () => {
      const text = `FROM input |> SELECT a, b${eol}`;
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const config = settings(['LT09', 'LT91']);
      const fixed = TextDocument.applyEdits(document, await formatDocument(document, config));
      expect(fixed).to.equal(`FROM input${eol}|> SELECT a, b${eol}`);
      expect((await check(fixed, ['LT09'])).diagnostics).to.have.length(1);
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, fixed), config)).to.deep.equal([]);
    });
  }
});
