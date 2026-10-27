import { expect } from 'chai';
import { INITIAL } from 'vscode-textmate';
import { QueryScopeResolver } from '../../linter/scope';
import { DocumentCache } from '../../linter/parser/tokenCache';
import { LineToken } from '../../linter/parser/token';
import { sourceTokens } from '../../linter/rules/source';

describe('Query scope resolver', () => {
  function resolve(sql: string) {
    const cache = new DocumentCache();
    sql.split('\n').forEach((line, index) => {
      cache.set(index, new LineToken([], 0, line.length, line, index, [], INITIAL));
    });
    return new QueryScopeResolver(sourceTokens(cache));
  }

  it('collects multiple joins, qualified implicit aliases and quoted paths', () => {
    const resolver = resolve(
      'SELECT o.id FROM proj.ds.orders o JOIN ds.sales USING(id) LEFT JOIN `proj.ds.items` AS i ON i.id = o.id',
    );
    const scope = resolver.scopes[0];
    expect(scope.sources.map((source) => [source.kind, source.path, source.alias, source.explicitAlias])).to.deep.equal(
      [
        ['table', ['proj', 'ds', 'orders'], 'o', false],
        ['table', ['ds', 'sales'], 'sales', false],
        ['table', ['proj', 'ds', 'items'], 'i', true],
      ],
    );
    expect(scope.usingColumns.map((token) => token.value)).to.deep.equal(['id']);
    expect(scope.sources[0].range).to.deep.equal({
      start: { line: 0, character: 17 },
      end: { line: 0, character: 33 },
    });
  });

  it('collects comma sources, dashed projects, select aliases and USING columns', () => {
    const { scopes } = resolve(
      'SELECT a.id AS id, a.name label, plain FROM my-project.ds.orders a, other b JOIN third c USING(id, name)',
    );
    expect(scopes[0].sources.map((source) => source.alias)).to.deep.equal(['a', 'b', 'c']);
    expect(scopes[0].sources[0].path).to.deep.equal(['my-project', 'ds', 'orders']);
    expect(scopes[0].selectAliases.map((token) => token.value)).to.deep.equal(['id', 'label', 'plain']);
    expect(scopes[0].usingColumns.map((token) => token.value)).to.deep.equal(['id', 'name']);
  });

  it('derives implicit aliases from qualified tables and select-list paths', () => {
    const resolver = resolve('SELECT DISTINCT orders.id, orders.record.name FROM proj.ds.orders');
    const scope = resolver.scopes[0];
    expect(scope.sources[0].alias).to.equal('orders');
    expect(scope.selectAliases.map((token) => token.value)).to.deep.equal(['id', 'name']);
    expect(resolver.classifyReference(scope, ['orders', 'record', 'name'])).to.have.property('kind', 'table-qualified');
  });

  it('resolves ordinary CTE visibility without allowing forward or self references', () => {
    const resolver = resolve('WITH a AS (SELECT * FROM a JOIN b ON TRUE), b AS (SELECT * FROM a) SELECT * FROM b');
    const [main, a, b] = resolver.scopes;
    expect(main.ctes.map((cte) => cte.name)).to.deep.equal(['a', 'b']);
    expect(a.sources.map((source) => source.kind)).to.deep.equal(['table', 'table']);
    expect(b.sources[0].kind).to.equal('cte');
    expect(b.sources[0].cte).to.equal(main.ctes[0]);
    expect(main.sources[0].cte).to.equal(main.ctes[1]);
    expect(resolver.visibleCtes(b).map((cte) => cte.name)).to.deep.equal(['a']);
  });

  it('makes recursive CTEs visible to themselves and earlier definitions', () => {
    const { scopes } = resolve(
      'WITH RECURSIVE a AS (SELECT * FROM a JOIN b USING(id)), b AS (SELECT * FROM a) SELECT * FROM b',
    );
    expect(scopes[1].sources.map((source) => source.kind)).to.deep.equal(['cte', 'cte']);
    expect(scopes[2].sources[0].cte).to.equal(scopes[0].ctes[0]);
  });

  it('does not expose main-query aliases inside a CTE body, including set branches', () => {
    const resolver = resolve(
      'WITH c AS (SELECT o.id FROM input UNION ALL SELECT o.id FROM input) SELECT * FROM orders o',
    );
    expect(resolver.resolveSource(resolver.scopes[1], 'o')).to.equal(undefined);
    expect(resolver.resolveSource(resolver.scopes[2], 'o')).to.equal(undefined);
    expect(resolver.visibleCtes(resolver.scopes[0]).map((cte) => cte.name)).to.deep.equal(['c']);
  });

  it('handles nested WITH environments and name shadowing', () => {
    const resolver = resolve(
      'WITH a AS (SELECT * FROM base) SELECT * FROM (WITH a AS (SELECT * FROM other), b AS (SELECT * FROM a) SELECT * FROM b) q JOIN a ON TRUE',
    );
    const main = resolver.scopes[0];
    const inner = resolver.scopes.find((scope) => scope.ctes.some((cte) => cte.name === 'b'))!;
    const b = resolver.scopes.find((scope) => scope.sources[0]?.cte === inner.ctes[0])!;
    expect(inner.parent).to.equal(main);
    expect(b.sources[0].cte).to.equal(inner.ctes[0]);
    expect(main.sources[0].kind).to.equal('subquery');
    expect(main.sources[0].alias).to.equal('q');
    expect(main.sources[1].cte).to.equal(main.ctes[0]);
    expect(resolver.visibleCtes(b).map((cte) => cte.name)).to.deep.equal(['a']);
  });

  it('resolves correlated references with nearest-scope alias shadowing', () => {
    const resolver = resolve(
      'SELECT (SELECT o.id FROM inner_table i WHERE i.id = o.id), (SELECT o.id FROM shadow o) FROM orders o',
    );
    const [outer, correlated, shadow] = resolver.scopes;
    expect(correlated.parent).to.equal(outer);
    expect(resolver.classifyReference(correlated, ['o', 'id'])).to.deep.equal({
      kind: 'table-qualified',
      source: outer.sources[0],
      correlated: true,
    });
    expect(resolver.classifyReference(shadow, ['o', 'id'])).to.deep.equal({
      kind: 'table-qualified',
      source: shadow.sources[0],
      correlated: false,
    });
    expect(resolver.classifyReference(outer, ['i', 'id'])).to.deep.equal({ kind: 'struct-field' });
    expect(resolver.classifyReference(outer, ['record', 'nested', 'field'])).to.deep.equal({ kind: 'struct-field' });
    expect(resolver.classifyReference(outer, ['id'])).to.deep.equal({ kind: 'unqualified' });
  });

  for (const [sql, aliases] of [
    ['SELECT * FROM UNNEST([1, 2]) x', ['x', undefined]],
    ['SELECT * FROM UNNEST([1, 2]) AS x WITH OFFSET AS pos', ['x', 'pos']],
    ['SELECT * FROM UNNEST([1, 2]) x WITH OFFSET pos', ['x', 'pos']],
    ['SELECT * FROM UNNEST([1, 2]) WITH OFFSET', [undefined, 'offset']],
    ['SELECT * FROM UNNEST([1, 2])', [undefined, undefined]],
  ] as const) {
    it(`models value-table sources: ${sql}`, () => {
      const resolver = resolve(sql);
      const source = resolver.scopes[0].sources[0];
      expect(source.kind).to.equal('unnest');
      expect([source.alias, source.offsetAlias]).to.deep.equal(aliases);
      if (source.offsetAlias)
        expect(resolver.resolveSource(resolver.scopes[0], source.offsetAlias)?.source).to.equal(source);
    });
  }

  it('models table-valued functions and aliased subqueries without confusing their arguments with sources', () => {
    const { scopes } = resolve('SELECT * FROM ds.fn(1, STRUCT(2 AS id)) AS f JOIN (SELECT id FROM t) q USING(id)');
    expect(scopes[0].sources.map((source) => [source.kind, source.alias])).to.deep.equal([
      ['tvf', 'f'],
      ['subquery', 'q'],
    ]);
    expect(scopes[1].sources.map((source) => source.alias)).to.deep.equal(['t']);
  });

  for (const [sql, sources] of [
    [
      'UPDATE proj.ds.orders o SET id = 1 FROM source s WHERE o.id = s.id',
      [
        ['dml-target', 'o'],
        ['table', 's'],
      ],
    ],
    ['DELETE FROM orders o WHERE id = 1', [['dml-target', 'o']]],
    ['DELETE orders WHERE id = 1', [['dml-target', 'orders']]],
    [
      'MERGE INTO orders o USING source s ON o.id = s.id WHEN MATCHED THEN UPDATE SET id = s.id',
      [
        ['dml-target', 'o'],
        ['table', 's'],
      ],
    ],
    ['INSERT INTO proj.ds.orders (id) VALUES (1)', [['dml-target', 'orders']]],
    ['INSERT orders (id) SELECT id FROM source', [['dml-target', 'orders']]],
  ] as const) {
    it(`collects DML targets: ${sql}`, () => {
      const { scopes } = resolve(sql);
      expect(scopes[0].kind).to.equal('dml');
      expect(scopes[0].sources.map((source) => [source.kind, source.alias])).to.deep.equal(sources);
    });
  }

  it('handles CTEs in INSERT and keeps input sources in their query scope', () => {
    const resolver = resolve('INSERT INTO orders WITH cte AS (SELECT id FROM input) SELECT id FROM cte');
    const query = resolver.scopes.find((scope) => scope.ctes.length)!;
    expect(query.sources[0].kind).to.equal('cte');
    expect(query.parent).to.equal(resolver.scopes[0]);
  });

  it('does not confuse SELECT star EXCEPT with a set operation', () => {
    const resolver = resolve('SELECT * EXCEPT(secret) FROM orders o');
    expect(resolver.scopes).to.have.length(1);
    expect(resolver.scopes[0].sources[0].alias).to.equal('o');
  });

  it('distinguishes select aliases from expression operands and reserved keywords', () => {
    const resolver = resolve(
      "SELECT a AND b, a + b, a IS NULL, SUM(a) total, 'x' label, CASE WHEN a THEN b END result FROM t",
    );
    expect(resolver.scopes[0].selectAliases.map((token) => token.value)).to.deep.equal(['total', 'label', 'result']);
    expect(resolve('SELECT match_recognize FROM t').statements[0].status).to.equal('supported');
    expect(
      resolve('SELECT EXTRACT(YEAR FROM date), a IS DISTINCT FROM b FROM orders').scopes[0].sources.map(
        (source) => source.alias,
      ),
    ).to.deep.equal(['orders']);
  });

  it('retains scopes across name-matched set operations', () => {
    const resolver = resolve('SELECT id FROM a UNION ALL BY NAME ON (id) SELECT id FROM b GROUP BY id, 1');
    expect(resolver.scopes.map((scope) => scope.sources[0].alias)).to.deep.equal(['a', 'b']);
    expect(resolver.scopes[1].clauses[0].kind).to.equal('group');
  });

  it('separates set branches and statements while retaining the WITH environment', () => {
    const resolver = resolve(
      'WITH c AS (SELECT * FROM t) SELECT * FROM c x GROUP BY 1 UNION ALL SELECT * FROM c y ORDER BY y.id; SELECT * FROM z',
    );
    const x = resolver.scopes.find((scope) => scope.sources[0]?.alias === 'x')!;
    const y = resolver.scopes.find((scope) => scope.sources[0]?.alias === 'y')!;
    expect(y.sources[0].kind).to.equal('cte');
    expect(resolver.resolveSource(y, 'x')).to.equal(undefined);
    expect(x.clauses.map((clause) => clause.kind)).to.deep.equal(['group']);
    expect(y.clauses.map((clause) => clause.kind)).to.deep.equal(['order']);
    expect(resolver.statements).to.have.length(2);
    expect(resolver.scopeAt(y.sources[0].start)).to.equal(y);
    expect(resolver.scopeAt(-1)).to.equal(undefined);
  });

  for (const sql of [
    'FROM t |> SELECT id',
    'SELECT * FROM t MATCH_RECOGNIZE (PATTERN (a))',
    'SELECT * FROM GRAPH_TABLE(g MATCH (n) COLUMNS(n.id))',
    'SELECT * FROM t FOR SYSTEM_TIME AS OF CURRENT_TIMESTAMP()',
  ]) {
    it(`reports unsupported query syntax: ${sql}`, () => {
      const resolver = resolve(`${sql}; SELECT * FROM supported`);
      expect(resolver.statements.map((statement) => statement.status)).to.deep.equal(['unsupported', 'supported']);
      expect(resolver.statements[0].scopes).to.deep.equal([]);
      expect(resolver.scopes[0].sources[0].alias).to.equal('supported');
    });
  }

  it('ignores comments and literals that resemble query syntax', () => {
    const resolver = resolve("SELECT 'GRAPH_TABLE ; FROM x |> SELECT' AS text /* JOIN fake */ FROM `GRAPH_TABLE`");
    expect(resolver.statements[0].status).to.equal('supported');
    expect(resolver.scopes[0].sources.map((source) => source.path)).to.deep.equal([['GRAPH_TABLE']]);
  });

  it('handles bracket-wrapped queries and incomplete input without speculative sources', () => {
    const resolver = resolve('((SELECT * FROM t)); SELECT * FROM (SELECT * FROM missing');
    expect(resolver.scopes[0].sources[0].alias).to.equal('t');
    expect(resolver.scopes[1].sources).to.deep.equal([]);
    expect(resolve('SELECT * FROM fn(').scopes[0].sources).to.deep.equal([]);
    expect(resolve('SELECT * FROM').scopes[0].sources).to.deep.equal([]);
    expect(resolve('; -- no query\n')).to.have.property('scopes').with.length(0);
  });
});
