import { expect } from 'chai';
import { CodeActionKind, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { formatDocument } from '../../formatting';
import { Linter, sourceFixAllKind } from '../../linter/linter';
import { globalTokenCache } from '../../linter/parser/tokenCache';
import { ruleRegistry } from '../../linter/rules/rules';
import { defaultSettings, type RulesSettings } from '../../settings';

describe('Pipe structure and convention rules', () => {
  const uri = 'file:///pipe-structure.bqsql';
  const active = ['ST01', 'ST02', 'ST04', 'ST07', 'ST08', 'ST09', 'CV03', 'CV06', 'CV08', 'CV12'];
  const settings = (codes: string[], rules: RulesSettings = {}) => ({
    ...defaultSettings,
    rules: {
      ...rules,
      exclude: ruleRegistry.map((Rule) => new Rule(defaultSettings, 0).code).filter((code) => !codes.includes(code)),
      ...Object.fromEntries(codes.map((code) => [code, { ...rules[code as keyof RulesSettings], enabled: true }])),
    },
  });
  const check = async (text: string, codes: string[], rules: RulesSettings = {}) => {
    const linter = new Linter(settings(codes, rules));
    const diagnostics = await linter.verify({ uri, text, version: 1, languageId: 'googlesql' });
    return { linter, diagnostics, names: diagnostics.map(({ range }) => globalTokenCache.get(uri)!.getText(range)) };
  };
  afterEach(() => globalTokenCache.delete(uri));

  const cases: [string, string, string[]][] = [
    ['ST01', 'FROM input |> EXTEND CASE WHEN a THEN 1 ELSE NULL END AS x;', [' ELSE NULL']],
    ['ST02', 'FROM input |> WHERE CASE WHEN a THEN TRUE ELSE FALSE END;', ['CASE WHEN a THEN TRUE ELSE FALSE END']],
    [
      'ST04',
      'FROM input |> SELECT CASE WHEN a THEN 1 ELSE CASE WHEN b THEN 2 ELSE 3 END END;',
      ['CASE WHEN a THEN 1 ELSE CASE WHEN b THEN 2 ELSE 3 END END'],
    ],
    ['ST07', 'FROM input t |> JOIN other o USING (id);', ['USING']],
    ['ST07', 'FROM input t |> JOIN (SELECT id FROM other) o USING (id);', ['USING']],
    ['ST08', 'FROM input |> SELECT DISTINCT(a);', ['DISTINCT(a)']],
    ['ST09', 'FROM input t |> JOIN other o ON o.id <= t.id;', ['o.id <= t.id']],
    ['ST09', 'FROM input t |> JOIN other o ON t.id = o.id |> JOIN third p ON p.id > o.id;', ['p.id > o.id']],
    [
      'CV03',
      'FROM input |> SELECT a, |> EXTEND a + 1 AS x, |> AGGREGATE SUM(x) AS total, GROUP BY a;',
      [',', ',', ','],
    ],
    ['CV03', 'FROM input |> SELECT a,;', [',']],
    ['CV06', 'FROM input |> SELECT a', ['']],
    ['CV08', 'FROM input t |> RIGHT JOIN other o ON t.id = o.id;', ['RIGHT JOIN']],
    ['CV08', 'FROM input t |> RIGHT OUTER JOIN other o ON t.id = o.id;', ['RIGHT OUTER JOIN']],
    ['CV12', 'FROM input |> INTERSECT (SELECT 1) |> EXCEPT ALL (SELECT 1);', ['INTERSECT', 'EXCEPT']],
  ];
  for (const [rule, text, names] of cases) {
    it(`checks ${rule} with exact ranges: ${text}`, async () => {
      expect((await check(text, [rule])).names).to.deep.equal(names);
    });
  }

  for (const text of [
    'FROM input t |> JOIN other o ON t.id = o.id |> SELECT DISTINCT a;',
    'FROM input |> EXTEND CASE WHEN a THEN 1 ELSE 2 END AS x;',
    'FROM input |> AGGREGATE SUM(a) AS total GROUP BY b;',
    'FROM input |> INTERSECT /* keep */ DISTINCT (SELECT 1) |> EXCEPT DISTINCT (SELECT 1);',
    'FROM input |> UNION ALL (SELECT 1) |> UNION DISTINCT (SELECT 1);',
    'FROM input |> SELECT "ELSE NULL RIGHT JOIN INTERSECT", `DISTINCT(a)`; -- ELSE NULL',
  ]) {
    it(`accepts compliant SQL and shields literals/comments: ${text}`, async () => {
      expect((await check(`${text}\n`, active)).diagnostics).to.deep.equal([]);
    });
  }

  it('leaves UNION modifier policy to AM02, and unrelated stages are not applicable', async () => {
    expect((await check('FROM input |> UNION (SELECT 1);', ['CV12'])).diagnostics).to.deep.equal([]);
    expect((await check('FROM input |> WHERE a > 0 |> LIMIT 1;\n', active)).diagnostics).to.deep.equal([]);
    expect(
      (await check('FROM input |> SELECT * EXCEPT (secret) |> EXTEND STRUCT(1 AS a, 2 AS b) AS x;\n', ['CV03', 'CV12']))
        .diagnostics,
    ).to.deep.equal([]);
  });

  for (const [operator, mirrored] of [
    ['=', '='],
    ['!=', '!='],
    ['<>', '<>'],
    ['<', '>'],
    ['>', '<'],
    ['<=', '>='],
    ['>=', '<='],
    ['IS DISTINCT FROM', 'IS DISTINCT FROM'],
    ['IS NOT DISTINCT FROM', 'IS NOT DISTINCT FROM'],
  ]) {
    it(`swaps complete operands and mirrors ${operator} in pipe joins`, async () => {
      const text = `FROM input t |> JOIN other o ON LOWER(o.id) ${operator} t.id;\n`;
      const expected = `FROM input t |> JOIN other o ON t.id ${mirrored} LOWER(o.id);\n`;
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      expect(TextDocument.applyEdits(document, await formatDocument(document, settings(['ST09'])))).to.equal(expected);
      expect((await check(expected, ['ST09'])).diagnostics).to.deep.equal([]);
    });
  }

  it('keeps commented comparisons diagnostic-only and does not recheck earlier stages', async () => {
    const { linter, diagnostics } = await check(
      'FROM input t |> JOIN other o ON o.id /* keep */ = t.id |> JOIN third p ON p.id = t.id;',
      ['ST09'],
    );
    expect(diagnostics).to.have.length(2);
    expect(
      await linter.createCodeActions({
        textDocument: { uri },
        range: diagnostics[0].range,
        context: { diagnostics: [diagnostics[0]], only: [CodeActionKind.QuickFix] },
      }),
    ).to.deep.equal([]);
  });

  it('uses stage-local join sources and honors the later-source option', async () => {
    const rules: RulesSettings = { ST09: { options: { preferred_first_table_in_join_clause: 'later' } } };
    expect((await check('FROM input t |> JOIN other o ON t.id = o.id;', ['ST09'], rules)).names).to.deep.equal([
      't.id = o.id',
    ]);
    for (const text of [
      'FROM input t |> SELECT t.id |> JOIN other o ON o.id = t.id;',
      'FROM input t |> CALL ds.fn() |> JOIN other o ON o.id = t.id;',
      'FROM input t |> JOIN other o ON o.id = future.id |> JOIN third future ON TRUE;',
      'FROM input t |> JOIN other o ON id = o.id;',
      'FROM input t |> JOIN other o ON o.id = o.parent;',
    ])
      expect((await check(text, ['ST09'])).diagnostics, text).to.deep.equal([]);
    expect(
      (await check('FROM input |> SELECT id |> AS q |> JOIN other o ON o.id = q.id;', ['ST09'])).names,
    ).to.deep.equal(['o.id = q.id']);
  });

  it('does not offer a semantics-changing RIGHT-to-LEFT pipe fix', async () => {
    const text = 'FROM input t |> RIGHT JOIN other o ON t.id = o.id;\n';
    const { linter, diagnostics } = await check(text, ['CV08']);
    expect(diagnostics).to.have.length(1);
    expect(
      await linter.createCodeActions({
        textDocument: { uri },
        range: Range.create(0, 0, 1, 0),
        context: { diagnostics, only: [CodeActionKind.QuickFix] },
      }),
    ).to.deep.equal([]);
    const document = TextDocument.create(uri, 'googlesql', 1, text);
    expect(await formatDocument(document, settings(['CV08']))).to.deep.equal([]);
    expect(
      (await check('FROM input t |> RIGHT /* keep */ OUTER JOIN other o USING (id);', ['CV08'])).names,
    ).to.deep.equal(['RIGHT']);
  });

  for (const eol of ['\n', '\r\n', '\r']) {
    it(`fixes CASE, commas, join operands and terminators idempotently (${JSON.stringify(eol)})`, async () => {
      const text = `FROM input t${eol}|> JOIN other o ON o.id <= t.id${eol}|> EXTEND CASE WHEN t.a IS NOT NULL THEN t.a ELSE NULL END AS x,${eol}|> SELECT CASE WHEN x THEN 1 ELSE CASE WHEN t.b THEN 2 ELSE 3 END END AS y, -- keep${eol}`;
      const codes = ['ST01', 'ST02', 'ST04', 'ST09', 'CV03', 'CV06'];
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const { linter, diagnostics } = await check(text, codes);
      const actions = await linter.createCodeActions({
        textDocument: { uri },
        range: Range.create(0, 0, document.lineCount, 0),
        context: { diagnostics, only: [sourceFixAllKind] },
      });
      expect(actions).to.have.length(1);
      const fixed = TextDocument.applyEdits(document, actions[0].edit!.changes![uri]);
      expect(fixed).to.include('t.id >= o.id');
      expect(fixed).to.include('-- keep');
      expect((await check(fixed, codes)).diagnostics).to.deep.equal([]);
      const formatted = TextDocument.applyEdits(document, await formatDocument(document, settings(codes)));
      expect(formatted.replaceAll(eol, '')).not.to.match(/[\r\n]/);
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, formatted), settings(codes))).to.deep.equal(
        [],
      );
      const defaults = TextDocument.applyEdits(document, await formatDocument(document, defaultSettings));
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, defaults), defaultSettings)).to.deep.equal(
        [],
      );
    });
  }

  it('honors noqa and rule settings on pipe stages', async () => {
    for (const directive of ['-- noqa', '-- noqa: ST07', '-- noqa: disable=ST07']) {
      expect((await check(`FROM input |> JOIN other USING (id) ${directive}\n`, ['ST07'])).diagnostics).to.deep.equal(
        [],
      );
    }
    expect(
      (
        await check(
          '-- noqa: disable=ST07\nFROM input |> JOIN other USING (id)\n-- noqa: enable=ST07\n|> JOIN third USING (id);',
          ['ST07'],
        )
      ).names,
    ).to.deep.equal(['USING']);
    const linter = new Linter({ ...defaultSettings, rules: { exclude: active } });
    expect(
      (
        await linter.verify({ uri, text: 'FROM input |> JOIN other USING (id);', version: 1, languageId: 'googlesql' })
      ).some((entry) => String(entry.code).startsWith('ST07:')),
    ).to.equal(false);
  });

  it('checks nested pipe queries but protects unsupported blocks', async () => {
    expect(
      (await check('WITH c AS (FROM input |> SELECT DISTINCT(a)) SELECT * FROM c;', ['ST08'])).names,
    ).to.deep.equal(['DISTINCT(a)']);
    const body = 'FROM input |> FUTURE_OPERATOR x |> JOIN other USING (id) |> SELECT DISTINCT(a),';
    const text = `WITH c AS (${body}) SELECT DISTINCT(b) FROM c;\n`;
    expect((await check(text, ['ST07', 'ST08', 'CV03'])).names).to.deep.equal(['DISTINCT(b)']);
    const document = TextDocument.create(uri, 'googlesql', 1, text);
    expect(TextDocument.applyEdits(document, await formatDocument(document, settings(active)))).to.include(body);
    for (const partial of [
      'FROM input |>',
      'FROM input |> JOIN',
      'FROM input |> SELECT CASE WHEN',
      'FROM input |> SELECT a,',
    ]) {
      await check(partial, active);
    }
  });
});
