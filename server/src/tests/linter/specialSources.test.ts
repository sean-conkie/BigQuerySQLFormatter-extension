import { expect } from 'chai';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { formatDocument } from '../../formatting';
import { Linter, sourceFixAllKind } from '../../linter/linter';
import { Parser } from '../../linter/parser';
import { globalTokenCache } from '../../linter/parser/tokenCache';
import { ruleRegistry } from '../../linter/rules/rules';
import { tokenizeSource } from '../../linter/rules/source';
import { QueryScopeResolver } from '../../linter/scope';
import { extendedQueryRanges, specialQueryRules, unsupportedBlock } from '../../linter/parser/queryBlocks';
import { specialSource } from '../../linter/parser/specialSources';
import { defaultSettings, type RulesSettings } from '../../settings';

describe('MATCH_RECOGNIZE and GRAPH_TABLE sources', () => {
  const uri = 'file:///special-sources.bqsql';
  const item = (text: string) => ({ uri, text, version: 1, languageId: 'googlesql' });
  const pattern = `Sales s MATCH_RECOGNIZE (
    PARTITION BY customer
    ORDER BY sale_date
    MEASURES FIRST(low.sale_date) AS start_date, LAST(high.sale_date) AS end_date
    AFTER MATCH SKIP TO NEXT ROW
    PATTERN (low+ high+)
    DEFINE low AS amount < 100, high AS amount >= 100
  ) AS matches`;
  const graph = `GRAPH_TABLE(
    FinGraph
    MATCH (a:Account)-[t:Transfers]->(b:Account)
    WHERE t.amount > 100
    COLUMNS (a.id AS sender, b.id AS recipient)
  ) AS transfers`;
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

  for (const source of [pattern, graph]) {
    it(`supports scopes for ${source.split('(')[0]}`, () => {
      const resolver = new QueryScopeResolver(tokenizeSource(`SELECT * FROM ${source}`));
      expect(resolver.statements[0].status).to.equal('supported');
      expect(resolver.scopes[0].sources).to.have.length(1);
    });

    it(`checks outer aliases and references for ${source.split('(')[0]}`, async () => {
      const text = `SELECT missing.id AS result FROM ${source}`;
      expect((await check(text, ['RF01'])).names).to.deep.equal(['missing.id']);
      expect((await check(text, ['AL02'])).names).to.deep.equal(['AS']);
      expect((await check(text, ['AM04'])).names).to.deep.equal([]);
      expect((await check(`SELECT * FROM ${source}`, ['AM04'])).names).to.deep.equal(['*']);
    });

    it(`does not flag documented pattern qualifiers in ${source.split('(')[0]}`, async () => {
      expect(
        (await check(`SELECT 1 FROM ${source}`, ['RF01', 'RF02', 'RF03', 'AL04', 'AL05', 'AL08', 'AL09'])).names,
      ).to.deep.equal([]);
    });
  }

  it('never re-cases a graph object path', async () => {
    const text = 'SELECT sender FROM GRAPH_TABLE(Project.Dataset.FinGraph MATCH (a:Account) COLUMNS (a.id AS sender))';
    const { names } = await check(text, ['CP02'], { CP02: { options: { extended_capitalisation_policy: 'lower' } } });
    expect(names.some((name) => /Project|Dataset|FinGraph/.test(name))).to.equal(false);
  });

  it('protects incomplete dashed graph paths while still checking column casing', async () => {
    const sql = 'SELECT MixedColumn FROM GRAPH_TABLE(Project.My-Dataset.FinGraph)';
    expect(
      (await check(sql, ['CP02'], { CP02: { options: { extended_capitalisation_policy: 'lower' } } })).names,
    ).to.deep.equal(['MixedColumn']);
  });

  it('infers named graph outputs without inventing names for anonymous expressions', () => {
    const model = specialSource(tokenizeSource('GRAPH_TABLE(g MATCH (n) COLUMNS(n.id, 1))'), 0);
    expect(model?.kind).to.equal('graph-table');
    expect(model?.outputColumns.map((token) => token.value)).to.deep.equal(['id']);
  });

  it('ignores malformed definitions while retaining valid pattern definitions', () => {
    const tokens = tokenizeSource(pattern.replace('low AS amount < 100', 'low amount < 100'));
    const model = specialSource(
      tokens,
      tokens.findIndex((token) => token.value === 'MATCH_RECOGNIZE'),
    );
    if (model?.kind !== 'match-recognize') throw new Error('Wrong source model');
    expect(model.definitions.map((definition) => definition.variable.value)).to.deep.equal(['high']);
  });

  it('protects specialist blocks unless their rule explicitly supports them', async () => {
    const ast = (await new Parser().parse(item(`SELECT * FROM ${graph}`)))[0];
    expect(unsupportedBlock(ast, true)).to.equal(true);
    expect(extendedQueryRanges({ 0: ast })).to.deep.equal([ast.sourceRange]);
    expect(extendedQueryRanges({ 0: ast }, true, true)).to.deep.equal([]);
  });

  it('checks pipe output aliases without treating FROM-only input as a SELECT list', async () => {
    const sql = `FROM ${graph} |> SELECT transfers.sender AS output`;
    expect((await check(sql, ['AL02', 'AL08', 'AL09'])).names).to.deep.equal(['AS']);
  });

  it('skips SELECT modifiers when checking duplicate specialist output aliases', async () => {
    for (const modifier of ['DISTINCT', 'ALL']) {
      const sql = `SELECT ${modifier} transfers.sender AS output, transfers.recipient AS output FROM ${graph}`;
      expect((await check(sql, ['AL08'])).names).to.deep.equal([
        'transfers.sender AS output',
        'transfers.recipient AS output',
      ]);
    }
  });

  it('models pattern clauses, output columns and input scope without leaking pattern variables', async () => {
    const text = `SELECT matches.start_date FROM ${pattern}`;
    const ast = (await new Parser().parse(item(text)))[0];
    expect(ast.hasUnsupportedQuerySyntax).to.equal(false);
    const model = ast.specialSources[0];
    if (model.kind !== 'match-recognize') throw new Error('Wrong source model');
    expect(model.partitionBy[0].expression[0].value).to.equal('customer');
    expect(model.orderBy[0].expression[0].value).to.equal('sale_date');
    expect(model.measures.map((item) => item.alias?.value)).to.deep.equal(['start_date', 'end_date']);
    expect(model.afterMatchSkip.map((token) => token.value)).to.deep.equal(['MATCH', 'SKIP', 'TO', 'NEXT', 'ROW']);
    expect(model.pattern.map((token) => token.value)).to.deep.equal(['(', 'low', '+', 'high', '+', ')']);
    expect(model.definitions.map((item) => item.variable.value)).to.deep.equal(['low', 'high']);
    expect(model.alias?.value).to.equal('matches');
    expect(model.outputColumns.map((token) => token.value)).to.deep.equal(['customer', 'start_date', 'end_date']);
    const resolver = new QueryScopeResolver(tokenizeSource(text));
    const inner = resolver.scopes.find((scope) => scope.special)!;
    expect(inner.sources[0].path).to.deep.equal(['Sales']);
    expect(resolver.resolveSource(inner, 'low')?.source).to.equal(inner.sources[0]);
    expect(resolver.resolveSource(inner, 'high')?.source).to.equal(inner.sources[0]);
    expect(resolver.resolveSource(inner, 'matches')).to.equal(undefined);
    expect(resolver.resolveSource(resolver.scopes[0], 'low')).to.equal(undefined);
    expect(resolver.scopes[0].sources[0].outputColumns).to.have.length(3);
  });

  it('models opaque graph patterns, declared variables and COLUMNS expressions', async () => {
    const ast = (await new Parser().parse(item(`SELECT * FROM ${graph}`)))[0];
    const model = ast.specialSources[0];
    if (model.kind !== 'graph-table') throw new Error('Wrong source model');
    expect(model.graphName.map((token) => token.value)).to.deep.equal(['FinGraph']);
    expect(model.variables.map((token) => token.value)).to.deep.equal(['a', 't', 'b']);
    expect(model.pattern.map((token) => token.value)).to.include.members(['WHERE', 'amount']);
    expect(model.outputColumns.map((token) => token.value)).to.deep.equal(['sender', 'recipient']);
    const resolver = new QueryScopeResolver(tokenizeSource(`SELECT * FROM ${graph}`));
    const inner = resolver.scopes.find((scope) => scope.special)!;
    for (const name of ['a', 't', 'b']) expect(resolver.resolveSource(inner, name)?.correlated).to.equal(false);
    expect(resolver.resolveSource(inner, 'transfers')).to.equal(undefined);
    expect(
      (await check(`SELECT * FROM ${graph.replace('a.id AS sender', 'missing.id AS sender')}`, ['RF01'])).names,
    ).to.deep.equal(['missing.id']);
  });

  it('models comments and nested CTE/subquery sources and rebuilds them after incremental edits', async () => {
    const text = `WITH c AS (SELECT * FROM ${pattern.replace('FIRST(low.sale_date)', 'FIRST(/* preserved */ low.sale_date)')})
SELECT q.sender FROM (SELECT * FROM ${graph}) q`;
    const parser = new Parser();
    const ast = (await parser.parse(item(text)))[0];
    expect(ast.specialSources).to.deep.equal([]);
    expect(ast.queryBlocks.map((block) => block.specialSources[0].kind)).to.deep.equal([
      'match-recognize',
      'graph-table',
    ]);
    const position = TextDocument.create(uri, 'googlesql', 1, text).positionAt(text.indexOf('FinGraph'));
    const updated = (
      await parser.parseChange({
        textDocument: { uri, version: 2 },
        contentChanges: [
          { range: { start: position, end: { ...position, character: position.character + 8 } }, text: 'OtherGraph' },
        ],
      })
    )[0];
    const model = updated.queryBlocks[1].specialSources[0];
    if (model.kind !== 'graph-table') throw new Error('Wrong source model');
    expect(model.graphName[0].value).to.equal('OtherGraph');
    expect(updated.queryBlocks[0].specialSources[0].kind).to.equal('match-recognize');
  });

  const cases: [string, string, string[]][] = [
    ['AL01', `SELECT 1 FROM ${graph}`, ['AS']],
    ['AL01', `SELECT 1 FROM ${pattern.replace('Sales s', 'Sales AS s')}`, ['AS', 'AS']],
    ['AL02', `SELECT transfers.sender AS output FROM ${graph}`, ['AS']],
    ['AL04', `SELECT 1 FROM ${graph} CROSS JOIN other transfers`, ['transfers', 'transfers']],
    ['AL05', `SELECT sender FROM ${graph}`, ['sender']],
    ['AL06', 'SELECT 1 FROM GRAPH_TABLE(g MATCH (n) COLUMNS(n.id))', ['GRAPH_TABLE(g MATCH (n) COLUMNS(n.id))']],
    [
      'AL08',
      `SELECT transfers.sender AS x, transfers.recipient AS x FROM ${graph}`,
      ['transfers.sender AS x', 'transfers.recipient AS x'],
    ],
    ['AL08', 'SELECT 1 FROM GRAPH_TABLE(g MATCH (n) COLUMNS(n.id AS x, n.name AS x))', ['n.id AS x', 'n.name AS x']],
    ['AL09', `SELECT transfers.sender AS sender FROM ${graph}`, [' AS sender']],
    ['AM01', `SELECT DISTINCT transfers.sender FROM ${graph} GROUP BY transfers.sender`, ['DISTINCT']],
    ['AM02', `SELECT 1 FROM ${graph} UNION SELECT 2`, ['UNION']],
    ['AM05', `SELECT 1 FROM ${graph} JOIN other o ON transfers.sender = o.id`, ['JOIN']],
    ['AM06', `SELECT sender FROM ${graph} GROUP BY sender ORDER BY 1`, ['ORDER BY']],
    ['AM07', `SELECT sender FROM ${graph} UNION ALL SELECT 1, 2`, ['UNION']],
    ['RF01', `SELECT a.id FROM ${graph}`, ['a.id']],
    ['RF01', `SELECT s.sale_date FROM ${pattern}`, ['s.sale_date']],
    ['RF02', `SELECT sender FROM ${graph} CROSS JOIN other o`, ['sender']],
    ['RF03', `SELECT transfers.sender, recipient FROM ${graph}`, ['recipient']],
    ['RF04', 'SELECT 1 FROM GRAPH_TABLE(g MATCH (n) COLUMNS(n.id AS date))', ['date']],
    ['RF05', 'SELECT 1 FROM GRAPH_TABLE(g MATCH (n) COLUMNS(n.id AS `bad-name`))', ['`bad-name`']],
    ['RF06', 'SELECT 1 FROM GRAPH_TABLE(g MATCH (n) COLUMNS(n.id AS `sender`))', ['`sender`']],
  ];
  for (const [rule, sql, expected] of cases) {
    it(`enables ${rule} with exact diagnostic ranges: ${expected.join(', ')}`, async () => {
      expect((await check(sql, [rule])).names).to.deep.equal(expected);
    });
  }

  it('keeps graph patterns opaque and pattern qualification unchanged under RF03 policies', async () => {
    for (const single_table_references of ['qualified', 'unqualified'] as const) {
      for (const source of [pattern, graph]) {
        expect(
          (
            await check(`SELECT 1 FROM ${source}`, ['RF03'], {
              RF03: { options: { single_table_references } },
            })
          ).names,
        ).to.deep.equal([]);
      }
    }
    const opaque = 'SELECT 1 FROM GRAPH_TABLE(g MATCH (n:Label WHERE missing.property > 0) COLUMNS(n.id AS id))';
    expect((await check(opaque, ['RF01', 'RF02', 'RF03'])).names).to.deep.equal([]);
  });

  it('uses the specialist output width for stars and CTEs in positional sets', async () => {
    for (const [source, width] of [
      [pattern, 3],
      [graph, 2],
    ] as const) {
      const projection = Array.from({ length: width }, (_, index) => String(index)).join(', ');
      for (const sql of [
        `SELECT * FROM ${source} UNION ALL SELECT ${projection}`,
        `WITH c AS (SELECT * FROM ${source}) SELECT * FROM c UNION ALL SELECT ${projection}`,
        `FROM ${source} |> UNION ALL (SELECT ${projection})`,
      ]) {
        expect((await check(sql, ['AM07'])).names).to.deep.equal([]);
        expect(
          (await check(sql.replace(`SELECT ${projection}`, `SELECT ${projection}, 99`), ['AM07'])).names,
        ).to.deep.equal(['UNION']);
      }
    }
    expect(
      (await check(`SELECT transfers.* EXCEPT (recipient) FROM ${graph} UNION ALL SELECT 1, 2`, ['AM07'])).names,
    ).to.deep.equal(['UNION']);
  });

  it('leaves unknown wildcard widths alone when specialist aliases do not match', async () => {
    for (const source of [pattern, graph, graph.replace('AS transfers', '')]) {
      expect(
        (await check(`SELECT missing.* FROM ${source} UNION ALL SELECT 1, 2, 3, 4`, ['AM07'])).names,
      ).to.deep.equal([]);
    }
  });

  it('applies rule-specific noqa and region suppression inside modelled blocks', async () => {
    const sql = `SELECT missing.id FROM ${graph}`;
    expect(
      (await check(sql.replace('SELECT missing.id', 'SELECT missing.id -- noqa: RF01\n'), ['RF01'])).names,
    ).to.deep.equal([]);
    expect((await check(`-- noqa: disable=RF01\n${sql};\n-- noqa: enable=RF01\n${sql}`, ['RF01'])).names).to.deep.equal(
      ['missing.id'],
    );
  });

  it('checks a compliant specialist corpus with every opted-in rule enabled', async () => {
    const sources = [
      pattern.replace('AS matches', 'matches'),
      pattern
        .replace(
          'Sales s',
          '(SELECT sales_input.sale_date, sales_input.customer, sales_input.amount FROM Sales sales_input) s',
        )
        .replace('AS matches', 'matches'),
      pattern
        .replace('AFTER MATCH SKIP TO NEXT ROW', 'AFTER MATCH SKIP PAST LAST ROW')
        .replace('low+ high+', '(low | high)+')
        .replace('AS matches', 'matches'),
      pattern
        .replace('ORDER BY sale_date', 'ORDER /* ordering */ BY sale_date DESC')
        .replace('FIRST(low.sale_date)', 'FIRST(/* measure */ low.sale_date)')
        .replace('AS matches', 'matches'),
      graph.replace('AS transfers', 'transfers'),
      graph.replace('MATCH (a:', 'MATCH ANY SHORTEST (a:').replace('AS transfers', 'transfers'),
      graph
        .replace('MATCH (a:', 'MATCH ALL SHORTEST (a:')
        .replace('WHERE t.amount > 100', "WHERE t.note = 'MATCH_RECOGNIZE (PATTERN (fake))'")
        .replace('AS transfers', 'transfers'),
    ];
    for (const source of sources) {
      const projection = source.includes('GRAPH_TABLE') ? 'transfers.sender' : 'matches.start_date';
      expect((await check(`SELECT ${projection} FROM ${source}`, [...specialQueryRules])).names).to.deep.equal([]);
    }
  });

  it('keeps LT/ST rules gated without hiding structural rules in enclosing queries', async () => {
    const sql = `SELECT CASE WHEN transfers.sender IS NULL THEN NULL ELSE transfers.sender END
FROM ${graph}`;
    expect(
      (await check(sql, ['LT02', 'LT03', 'LT04', 'LT09', 'LT91', 'ST01', 'ST02', 'ST07', 'ST09'])).names,
    ).to.deep.equal([]);
    expect(
      (await check(`SELECT q.sender AS result FROM (${sql}) q JOIN other AS o USING (sender)`, ['AL01', 'AL02'])).names,
    ).to.deep.equal(['AS', 'AS']);
  });

  it('limits selection formatting to the selected output and preserves the specialist body', async () => {
    const firstLine = 'SELECT transfers.sender AS sender';
    const rest = `\nFROM ${graph}`;
    const document = TextDocument.create(uri, 'googlesql', 1, firstLine + rest);
    const edits = await formatDocument(document, defaultSettings, {
      start: document.positionAt(0),
      end: document.positionAt(firstLine.length),
    });
    expect(TextDocument.applyEdits(document, edits)).to.equal(`select transfers.sender${rest}`);
  });

  it('keeps malformed constructs unsupported, without confusing literals and comments for clauses', async () => {
    for (const sql of [
      'SELECT * FROM GRAPH_TABLE(g MATCH (n))',
      'SELECT * FROM GRAPH_TABLE(g MATCH (n) COLUMNS(n.id)',
      'SELECT * FROM t MATCH_RECOGNIZE (PATTERN (a))',
    ]) {
      const ast = (await new Parser().parse(item(sql)))[0];
      expect(ast.hasUnsupportedQuerySyntax).to.equal(true);
      expect((await check(sql, [...specialQueryRules])).names).to.deep.equal([]);
    }
    expect(
      (await new Parser().parse(item("SELECT 'GRAPH_TABLE(g MATCH (n))' /* MATCH_RECOGNIZE () */")))[0].specialSources,
    ).to.deep.equal([]);
  });

  for (const eol of ['\n', '\r\n', '\r']) {
    it(`converges formatting and Fix All without changing graph names or required AS (${JSON.stringify(eol)})`, async () => {
      const text =
        `SELECT transfers.sender AS sender FROM ${graph};\nSELECT matches.start_date AS start_date FROM ${pattern};\n`.replaceAll(
          '\n',
          eol,
        );
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const warnings: string[] = [];
      const edits = await formatDocument(document, defaultSettings, undefined, undefined, (warning) =>
        warnings.push(warning),
      );
      const formatted = TextDocument.applyEdits(document, edits);
      expect(warnings).to.deep.equal([]);
      expect(formatted).to.include('FinGraph');
      expect(formatted).to.match(/as start_date/i);
      expect(formatted).to.match(/low as amount/i);
      expect(formatted.replaceAll(eol, '')).not.to.match(/[\r\n]/);
      const next = TextDocument.create(uri, 'googlesql', 2, formatted);
      expect(await formatDocument(next, defaultSettings)).to.deep.equal([]);
      const { linter, diagnostics } = await check(formatted, [...specialQueryRules]);
      const actions = await linter.createCodeActions({
        textDocument: { uri },
        range: { start: next.positionAt(0), end: next.positionAt(formatted.length) },
        context: { diagnostics, only: [sourceFixAllKind] },
      });
      expect(actions).to.deep.equal([]);
    });
  }
});
