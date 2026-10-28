import { expect } from 'chai';
import { Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { formatDocument } from '../../formatting';
import { Linter, sourceFixAllKind } from '../../linter/linter';
import { Parser } from '../../linter/parser';
import { pipeClauses, pipeItems } from '../../linter/parser/pipe';
import { implicitAliasEdit } from '../../linter/rules/aliasing/pipe';
import { globalTokenCache } from '../../linter/parser/tokenCache';
import { tokenizeSource } from '../../linter/rules/source';
import { ruleRegistry } from '../../linter/rules/rules';
import { QueryScopeResolver } from '../../linter/scope';
import { defaultSettings, type RulesSettings } from '../../settings';

describe('Pipe query models and rules', () => {
  const uri = 'file:///pipe.bqsql';
  const item = (text: string) => ({ uri, text, version: 1, languageId: 'googlesql' });
  const resolve = (text: string) => new QueryScopeResolver(tokenizeSource(text));
  const code = (diagnostic: { code?: string | number }) => String(diagnostic.code).split(':')[0];
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
    const diagnostics = await linter.verify(item(text));
    return { linter, diagnostics, names: diagnostics.map(({ range }) => globalTokenCache.get(uri)!.getText(range)) };
  };
  afterEach(() => globalTokenCache.delete(uri));

  const operators = [
    ['SELECT a AS x, b', 'projection'],
    ['EXTEND a + 1 AS x', 'projection'],
    ['AGGREGATE SUM(a) AS total DESC GROUP AND ORDER BY b AS category NULLS LAST', 'projection'],
    ['WHERE a > 0', 'filter'],
    ['SET a = a + 1', 'columns'],
    ['DROP a, b', 'columns'],
    ['RENAME a AS b', 'columns'],
    ['AS row_alias', 'alias'],
    ['JOIN other o USING (id)', 'source'],
    ['INNER JOIN other o ON t.id = o.id', 'source'],
    ['LEFT OUTER JOIN other o ON t.id = o.id', 'source'],
    ['RIGHT JOIN other o USING (id)', 'source'],
    ['FULL OUTER JOIN other o USING (id)', 'source'],
    ['CROSS JOIN other o', 'source'],
    ['CALL ds.fn(1) AS result', 'source'],
    ['ORDER BY a DESC, b', 'order'],
    ['LIMIT 10 OFFSET 1', 'limit'],
    ['UNION ALL (FROM other)', 'set'],
    ['INTERSECT DISTINCT (SELECT 1)', 'set'],
    ['EXCEPT DISTINCT (SELECT 1)', 'set'],
    ["PIVOT (SUM(a) AS total FOR quarter IN ('Q1' AS q1, 'Q2')) AS p", 'relation'],
    ['UNPIVOT INCLUDE NULLS (value FOR quarter IN (q1 AS 1, q2 AS 2)) AS u', 'relation'],
    ['TABLESAMPLE SYSTEM (10 PERCENT)', 'relation'],
    ['WINDOW win AS (PARTITION BY a)', 'relation'],
    ['DISTINCT', 'distinct'],
    ['WITH c AS (SELECT 1)', 'unsupported'],
    ['MATCH_RECOGNIZE (PATTERN (a))', 'unsupported'],
    ['FUTURE_OPERATOR a', 'unsupported'],
    ['SELECT', 'unsupported'],
  ] as const;
  for (const [operator, kind] of operators) {
    it(`models or explicitly rejects ${operator}`, async () => {
      const text = `FROM input AS t |> /* stage */ ${operator};`;
      const ast = (await new Parser().parse(item(text)))[0];
      expect(ast.pipeClauses).to.have.length(1);
      expect(ast.pipeClauses[0].kind).to.equal(kind);
      expect(ast.hasUnsupportedQuerySyntax).to.equal(kind === 'unsupported');
      expect(resolve(text).statements[0].status).to.equal(kind === 'unsupported' ? 'unsupported' : 'supported');
      if (kind !== 'unsupported') expect(ast.pipeInput[0].alias).to.equal('t');
    });
  }

  it('models grouping aliases, ordering suffixes, source aliases and join conditions', async () => {
    const ast = (
      await new Parser().parse(
        item(
          'FROM input t |> LEFT /* type */ OUTER JOIN other AS o ON o.id = t.id |> AGGREGATE SUM(o.a) AS total DESC GROUP AND ORDER BY t.b AS category NULLS LAST;',
        ),
      )
    )[0];
    const [join, aggregate] = ast.pipeClauses;
    expect(join.operator).to.equal('LEFT OUTER JOIN');
    if (join.kind !== 'source' || aggregate.kind !== 'projection') throw new Error('Wrong stage model');
    expect(join.relation?.alias).to.equal('o');
    expect(join.condition.map((token) => token.value).join('')).to.equal('o.id=t.id');
    expect(aggregate.items[0].alias?.value).to.equal('total');
    expect(aggregate.items[0].ordering.map((token) => token.value)).to.deep.equal(['DESC']);
    expect(aggregate.groupBy[0].alias?.value).to.equal('category');
    expect(aggregate.groupBy[0].ordering.map((token) => token.value)).to.deep.equal(['NULLS', 'LAST']);
  });

  it('models pivot and unpivot operands and aliases', async () => {
    for (const operator of [operators[20][0], operators[21][0]]) {
      const stage = (await new Parser().parse(item(`FROM input |> ${operator};`)))[0].pipeClauses[0];
      if (stage.kind !== 'relation') throw new Error('Wrong relation model');
      expect(stage.alias?.value).to.equal(stage.operator === 'PIVOT' ? 'p' : 'u');
      expect(stage.pivot?.values[0].alias?.value ?? stage.unpivot?.values[0].alias?.value).to.equal(
        stage.operator === 'PIVOT' ? 'q1' : '1',
      );
      expect((stage.pivot?.forColumns ?? stage.unpivot?.forColumn)?.[0].value).to.equal('quarter');
    }
  });

  it('models nested CTEs and subqueries recursively with original ranges', async () => {
    const text = 'WITH c AS (FROM input i |> SELECT i.a) FROM (FROM c |> WHERE a > 1) q |> SELECT q.a;';
    const ast = (await new Parser().parse(item(text)))[0];
    expect(ast.pipeClauses.map((stage) => stage.operator)).to.deep.equal(['SELECT']);
    expect(ast.queryBlocks).to.have.length(2);
    expect(ast.queryBlocks.map((block) => block.pipeClauses[0].operator)).to.deep.equal(['SELECT', 'WHERE']);
    const source = TextDocument.create(uri, 'googlesql', 1, text);
    for (const block of ast.queryBlocks) {
      const token = block.sourceTokens[block.pipeClauses[0].start];
      expect(text[source.offsetAt(token.range.start)]).to.equal('|');
    }
  });

  it('models value projections, named windows and optional limit offsets', () => {
    const stages = pipeClauses(
      tokenizeSource(
        'FROM input |> SELECT AS VALUE a |> SELECT SUM(a) OVER win AS total WINDOW win AS (PARTITION BY b) |> LIMIT 10',
      ),
    );
    const [value, window, limit] = stages;
    if (value.kind !== 'projection' || window.kind !== 'projection' || limit.kind !== 'limit')
      throw new Error('Wrong stage model');
    expect(value.output).to.equal('value');
    expect(value.items[0].expression.map((token) => token.value)).to.deep.equal(['a']);
    expect(window.windows[0].expression[0].value).to.equal('win');
    expect(window.windows[0].alias).to.equal(undefined);
    expect(limit.limit.map((token) => token.value)).to.deep.equal(['10']);
    expect(limit.offset).to.deep.equal([]);
  });

  it('preserves partial relation operands and rejects missing operators while editing', () => {
    for (const operator of ['PIVOT amount', 'UNPIVOT amount', 'TABLESAMPLE SYSTEM', 'WINDOW win']) {
      const stage = pipeClauses(tokenizeSource(`FROM input |> ${operator}`))[0];
      if (stage.kind !== 'relation') throw new Error('Wrong relation model');
      expect(stage.operands[0].expression[0].value).to.equal(operator.split(' ')[1]);
      expect(stage.alias).to.equal(undefined);
      expect(stage.pivot).to.equal(undefined);
      expect(stage.unpivot).to.equal(undefined);
      if (stage.sample) expect(stage.sample.size).to.deep.equal([]);
    }
    const stage = pipeClauses(tokenizeSource('FROM input |>'))[0];
    expect(stage.kind).to.equal('unsupported');
    if (stage.kind === 'unsupported') expect(stage.reason).to.equal('Incomplete pipe operator: ');
    const items = pipeItems(tokenizeSource('a,, b,'), 0, 5);
    expect(items.map((item) => item.expression[0].value)).to.deep.equal(['a', 'b']);
  });

  it('retains pivot output aliases in identifier checks and excludes the FOR declaration from references', async () => {
    const text =
      "FROM input t |> JOIN other o USING (id) |> PIVOT (SUM(t.amount) AS `total` FOR `quarter` IN ('Q1' AS `q1`)) AS `p`;";
    expect((await check(text, ['RF02'])).names).to.deep.equal([]);
    expect((await check(text, ['RF06'])).names).to.deep.equal(['`total`', '`quarter`', '`q1`', '`p`']);
  });

  it('keeps JOIN USING names exempt from alias qualification but checks other columns', async () => {
    expect((await check('FROM input t |> JOIN other o USING (id) |> SELECT id, amount', ['AL05'])).names).to.deep.equal(
      ['amount'],
    );
  });

  it('counts explicit projections after DROP and value-table projections in set operations', async () => {
    expect((await check('FROM input |> SELECT a, b |> DROP b |> UNION ALL (SELECT 1)', ['AM07'])).names).to.deep.equal(
      [],
    );
    expect(
      (await check('FROM input |> SELECT a, b |> DROP b |> UNION ALL (SELECT 1, 2)', ['AM07'])).names,
    ).to.deep.equal(['UNION']);
    expect((await check('FROM input |> SELECT AS VALUE a |> UNION ALL (SELECT 1)', ['AM07'])).names).to.deep.equal([]);
  });

  it('ignores multiplication outside projections and checks initial SELECT aliases without a FROM', async () => {
    expect((await check('FROM input |> WHERE a * 2 > 0 |> SET a = a * 3', ['AM04'])).names).to.deep.equal([]);
    expect((await check('SELECT 1 AS x |> EXTEND x + 1 AS y', ['AL02'])).names).to.deep.equal(['AS', 'AS']);
  });

  it('preserves temporal aliases for dotted timestamp expressions and partial expressions', () => {
    for (const expression of ['snapshot.value', '123']) {
      const resolver = resolve(`FROM input FOR SYSTEM_TIME AS OF ${expression} AS t |> SELECT t.a`);
      expect(resolver.scopes[0].sources[0].alias).to.equal('t');
      expect(resolver.scopes[1].sources[0].alias).to.equal('t');
    }
    const resolver = resolve('WITH c AS (SELECT 1 AS a) SELECT a FROM c |> SELECT a');
    expect(resolver.scopes.find((scope) => scope.pipe)?.sources[0].kind).to.equal('pipe');
    expect(resolve('FROM input |> CALL 123 |> SELECT a').scopes.at(-1)?.sources[0].kind).to.equal('pipe');
  });

  it('removes only AS and adjacent horizontal whitespace at document boundaries', async () => {
    for (const [text, start, end, expected] of [
      ['AS alias', 0, 2, 'alias'],
      ['value AS', 6, 8, 'value'],
      ['AS', 0, 2, ''],
      ['value\nAS\nalias', 6, 8, 'value\n\nalias'],
    ] as const) {
      await new Parser().parse(item(text));
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const edit = implicitAliasEdit(uri, { start: document.positionAt(start), end: document.positionAt(end) });
      expect(TextDocument.applyEdits(document, [edit])).to.equal(expected);
    }
  });

  it('tracks range-variable visibility and output aliases stage by stage', () => {
    const resolver = resolve(
      'FROM input t |> EXTEND t.a + 1 AS x |> WHERE x > 0 |> AS row_alias |> JOIN other o USING (id) |> SELECT row_alias.id AS key |> WHERE key > 0 |> AGGREGATE COUNT(*) AS n |> WHERE n > 1',
    );
    const stages = resolver.scopes.filter((scope) => scope.pipe);
    expect(stages.map((scope) => scope.sources.map((source) => source.alias))).to.deep.equal([
      ['t'],
      ['t'],
      ['t'],
      ['row_alias', 'o'],
      ['row_alias', 'o'],
      [undefined],
      [undefined],
      [undefined],
    ]);
    expect(stages[1].visibleAliases?.map((token) => token.value)).to.deep.equal(['x']);
    expect(stages[5].visibleAliases?.map((token) => token.value)).to.deep.equal(['key']);
    expect(stages[7].visibleAliases?.map((token) => token.value)).to.deep.equal(['n']);
    expect(stages[4].usingColumns.map((token) => token.value)).to.deep.equal(['id']);
  });

  it('preserves aliases across SET/DROP/RENAME/DISTINCT/ORDER/LIMIT, and resets them for CALL and sets', () => {
    for (const operator of ['SET a = 1', 'DROP a', 'RENAME a AS b', 'DISTINCT', 'ORDER BY a', 'LIMIT 1']) {
      const resolver = resolve(`FROM input t |> ${operator} |> WHERE t.b > 0`);
      expect(resolver.scopes.at(-1)?.sources[0].alias, operator).to.equal('t');
    }
    for (const operator of ['CALL ds.fn()', 'UNION ALL (SELECT 1)']) {
      const resolver = resolve(`FROM input t |> ${operator} |> WHERE a > 0`);
      expect(resolver.scopes.find((scope) => scope.pipe?.operator === 'WHERE')?.sources[0].alias).to.equal(undefined);
    }
  });

  for (const expression of [
    "TIMESTAMP '2026-01-01'",
    'CURRENT_TIMESTAMP()',
    '@snapshot',
    '(SELECT MAX(ts) FROM history)',
  ]) {
    it(`resolves temporal source and alias: ${expression}`, async () => {
      const text = `SELECT t.a AS output FROM ds.input FOR SYSTEM_TIME AS OF ${expression} AS t;`;
      const resolver = resolve(text);
      expect(resolver.statements[0].status).to.equal('supported');
      expect(resolver.scopes[0].sources[0].alias).to.equal('t');
      expect((await check(text, ['AL01', 'AL02', 'RF01'])).diagnostics.map(code)).to.include.members(['AL01', 'AL02']);
      expect((await check(text, ['RF01'])).diagnostics).to.deep.equal([]);
    });
  }

  const cases: [string, string, string[]][] = [
    ['AL01', 'FROM input AS t |> JOIN other AS o USING (id)', ['AS', 'AS']],
    [
      'AL02',
      'FROM input |> SELECT a AS x |> EXTEND x + 1 AS y |> AGGREGATE SUM(y) AS total GROUP BY x AS category',
      ['AS', 'AS', 'AS', 'AS'],
    ],
    ['AL04', 'FROM input t |> JOIN other t ON t.id = t.id', ['t', 't']],
    ['AL05', 'FROM input t |> WHERE a > 0 |> SELECT t.a', ['a']],
    ['AL06', 'FROM ds.input |> JOIN other ON TRUE', ['ds.input', 'other']],
    ['AL08', 'FROM input |> SELECT a AS x, b AS X', ['a AS x', 'b AS X']],
    ['AL08', 'FROM input |> SELECT a AS x |> EXTEND b AS x', ['x', 'b AS x']],
    ['AL09', 'FROM input |> SELECT t.a AS a', [' AS a']],
    ['AM04', 'FROM input |> SELECT t.*, a * 2, COUNT(*)', ['t.*']],
    ['AM05', 'FROM input |> JOIN other USING (id)', ['JOIN']],
    ['AM06', 'FROM input |> AGGREGATE COUNT(*) GROUP BY 1, category', ['GROUP BY']],
    ['AM06', 'FROM input |> AGGREGATE COUNT(*) GROUP AND ORDER BY 1, category', ['GROUP AND ORDER BY']],
    ['AM07', 'FROM input |> SELECT a |> UNION ALL (SELECT 1, 2)', ['UNION']],
    ['RF01', 'FROM input t |> SELECT t.a |> WHERE t.a > 0', ['t.a']],
    ['RF01', 'FROM input t |> UNION ALL (SELECT t.a)', ['t.a']],
    ['RF02', 'FROM input t |> JOIN other o USING (id) |> SELECT id, a, t.b, o.c', ['a']],
    ['RF03', 'FROM input t |> SELECT t.a, b', ['b']],
    ['RF04', 'FROM input |> SELECT a AS date', ['date']],
    ['RF05', 'FROM input |> SELECT a AS `bad-name`', ['`bad-name`']],
    ['RF06', 'FROM input |> SELECT `a`', ['`a`']],
  ];
  for (const [rule, text, names] of cases) {
    it(`enables ${rule} with exact stage-local diagnostics`, async () => {
      expect((await check(`${text};`, [rule])).names).to.deep.equal(names);
    });
  }
  for (const [rule, text] of [
    ['AL01', 'FROM input t |> AS row_alias'],
    ['AL02', 'FROM input t |> AS row_alias'],
    ['AL08', 'FROM input |> WHERE a > 0'],
    ['AL09', 'FROM input |> EXTEND a + 1 AS a'],
    ['AM04', 'FROM input |> AGGREGATE COUNT(*) AS n |> EXTEND n * 2 AS doubled'],
    ['AM05', 'FROM input |> CALL ds.fn()'],
    ['AM06', 'FROM input |> WHERE a > 0'],
    ['AM07', 'FROM input |> SELECT a, b'],
    ['RF02', 'FROM input t |> JOIN other o USING (id) |> SET a = t.a |> DROP b |> RENAME c AS d'],
    ['RF01', 'FROM input t |> DISTINCT |> WHERE t.a > 0'],
    ['RF02', 'FROM input t |> EXTEND a + 1 AS x |> JOIN other o USING (id) |> WHERE x > 0'],
    ['RF02', 'FROM input t |> JOIN other o USING (id) |> UNPIVOT (value FOR quarter IN (q1, q2))'],
    ['AL08', 'FROM input |> SELECT CASE WHEN a THEN 1 ELSE 2 END, CASE WHEN b THEN 3 ELSE 4 END'],
  ]) {
    it(`has an explicit not-applicable or valid path for ${rule}: ${text}`, async () => {
      expect((await check(`${text};`, [rule])).names).to.deep.equal([]);
    });
  }

  it('keeps unknown-width inputs opaque and compares every known set operand', async () => {
    for (const text of [
      'FROM input |> UNION ALL (SELECT 1, 2)',
      'FROM input |> SELECT * |> UNION ALL (SELECT 1, 2)',
      'FROM input |> SELECT a |> UNION ALL BY NAME (SELECT 1, 2)',
      'FROM (SELECT 1) t JOIN other o ON TRUE |> UNION ALL (SELECT 1, 2)',
      'FROM input |> AGGREGATE SUM(a) GROUP BY ROLLUP(b, c) |> UNION ALL (SELECT 1, 2, 3)',
    ])
      expect((await check(text, ['AM07'])).names, text).to.deep.equal([]);
    expect(
      (await check('FROM input |> SELECT a |> UNION ALL (SELECT 1), (SELECT 1, 2)', ['AM07'])).names,
    ).to.deep.equal(['UNION']);
    expect(
      (await check('WITH c AS (FROM input |> SELECT a) SELECT * FROM c UNION ALL SELECT 1, 2', ['AM07'])).names,
    ).to.deep.equal(['UNION']);
    expect((await check('FROM input |> SELECT AS STRUCT a, b |> UNION ALL (SELECT 1)', ['AM07'])).names).to.deep.equal(
      [],
    );
  });

  it('does not qualify SET outputs back to the original row, but qualifies columns owned by a new AS alias', async () => {
    const rules: RulesSettings = { RF03: { options: { single_table_references: 'qualified' } } };
    expect((await check('FROM input t |> SET a = t.a + 1 |> SELECT a, t.b', ['RF03'], rules)).names).to.deep.equal([]);
    expect((await check('FROM input t |> SELECT t.a |> AS q |> SELECT a', ['RF03'], rules)).names).to.deep.equal(['a']);
    expect(
      (await check('FROM input t |> SELECT t.a |> AS q |> JOIN other o USING (id) |> SELECT a', ['RF02'])).names,
    ).to.deep.equal(['a']);
  });

  it('does not duplicate alias diagnostics from traditional children of a supported pipeline', async () => {
    expect(
      (await check('FROM (SELECT a AS x FROM dataset.input AS t) q |> SELECT q.x', ['AL01', 'AL02'])).names,
    ).to.deep.equal(['AS', 'AS']);
  });

  for (const eol of ['\n', '\r\n', '\r']) {
    it(`preserves comments and stage placement around multiline alias fixes (${JSON.stringify(eol)})`, async () => {
      const text = `FROM input${eol}AS t${eol}|> SELECT t.a /* keep block */${eol}AS a, t.b -- keep line${eol}AS output;${eol}`;
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const active = ['AL01', 'AL02', 'AL09'];
      const fixed = TextDocument.applyEdits(document, await formatDocument(document, settings(active)));
      expect(fixed).to.include('/* keep block */');
      expect(fixed).to.include(`-- keep line${eol}`);
      expect(fixed.split('|>')).to.have.length(2);
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, fixed), settings(active))).to.deep.equal([]);
    });
  }

  for (const eol of ['\n', '\r\n', '\r']) {
    it(`fixes and formats supported stages idempotently (${JSON.stringify(eol)})`, async () => {
      const text = `FROM input AS t${eol}|> JOIN other AS o USING (id) -- comment${eol}|> SELECT t.a AS a, o.b AS \`result\`;${eol}`;
      const active = ['AL01', 'AL02', 'AL09', 'AM05', 'RF06'];
      const { linter, diagnostics } = await check(text, active);
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const actions = await linter.createCodeActions({
        textDocument: { uri },
        range: Range.create(0, 0, document.lineCount, 0),
        context: { diagnostics, only: [sourceFixAllKind] },
      });
      expect(actions).to.have.length(1);
      const fixed = TextDocument.applyEdits(document, actions[0].edit!.changes![uri]);
      expect(fixed.split('|>')).to.have.length(3);
      expect(fixed).to.include(`-- comment${eol}|>`);
      expect(fixed).to.include('INNER JOIN');
      const second = await check(fixed, active);
      const again = await second.linter.createCodeActions({
        textDocument: { uri },
        range: Range.create(0, 0, document.lineCount, 0),
        context: { diagnostics: second.diagnostics, only: [sourceFixAllKind] },
      });
      // Overlapping AL02/AL09 fixes may take a second pass.
      const final = again.length
        ? TextDocument.applyEdits(TextDocument.create(uri, 'googlesql', 2, fixed), again[0].edit!.changes![uri])
        : fixed;
      expect((await check(final, active)).diagnostics).to.deep.equal([]);
      const formatted = TextDocument.applyEdits(document, await formatDocument(document, settings(active)));
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, formatted), settings(active))).to.deep.equal(
        [],
      );
      expect(formatted.replaceAll(eol, '')).not.to.match(/[\r\n]/);
    });
  }

  it('protects unsupported blocks and descendants while linting traditional siblings', async () => {
    for (const body of [
      'FROM input AS t |> WITH c AS (SELECT a AS x FROM nested AS n) |> SELECT t.*',
      'FROM input AS t |> FUTURE_OPERATOR a |> SELECT t.*',
      'SELECT * FROM GRAPH_TABLE(g MATCH (n) COLUMNS(n.id))',
      'FROM input MATCH_RECOGNIZE (PATTERN (a))',
    ]) {
      const text = `WITH unsupported AS (${body}) SELECT a AS x FROM input AS t;`;
      const { diagnostics } = await check(text, ['AL01', 'AL02', 'AM04', 'AM05', 'RF06']);
      const start = text.indexOf(body),
        end = start + body.length;
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      for (const diagnostic of diagnostics) {
        expect(
          document.offsetAt(diagnostic.range.start) >= end || document.offsetAt(diagnostic.range.end) <= start,
        ).to.equal(true);
      }
      const formatted = TextDocument.applyEdits(
        document,
        await formatDocument(document, settings(['AL01', 'AL02', 'AM04', 'AM05', 'RF06'])),
      );
      expect(formatted).to.include(body);
    }
  });

  it('updates stage models and diagnostics on incremental insertion/removal', async () => {
    const text = 'FROM input t |> SELECT t.a;';
    const { linter } = await check(text, ['RF01']);
    const diagnostics = await linter.verifyChanges({
      textDocument: { uri, version: 2 },
      contentChanges: [{ range: Range.create(0, text.length - 1, 0, text.length - 1), text: ' |> WHERE t.a > 0' }],
    });
    expect(diagnostics.map(code)).to.deep.equal(['RF01']);
    expect(
      await linter.verifyChanges({
        textDocument: { uri, version: 3 },
        contentChanges: [
          { range: Range.create(0, text.length - 1, 0, text.length - 1 + ' |> WHERE t.a > 0'.length), text: '' },
        ],
      }),
    ).to.deep.equal([]);
  });
});
