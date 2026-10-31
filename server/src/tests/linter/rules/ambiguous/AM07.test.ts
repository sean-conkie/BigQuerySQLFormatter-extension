import { expect } from 'chai';
import { Linter } from '../../../../linter/linter';
import { defaultSettings } from '../../../../settings';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';

describe('AM07 set column counts', () => {
  const uri = 'am07.bqsql';
  afterEach(() => globalTokenCache.delete(uri));
  for (const [text, count] of [
    ['WITH', 0],
    ['WITH AS (SELECT 1)', 0],
    ['WITH cte', 0],
    ['WITH cte AS SELECT 1', 0],
    ['SELECT a UNION ALL SELECT b, c', 1],
    ['SELECT a, b UNION SELECT c, d', 0],
    ['SELECT a UNION ALL SELECT b, c UNION ALL SELECT d, e, f', 2],
    ['SELECT a INTERSECT DISTINCT SELECT b, c', 1],
    ['SELECT a, b EXCEPT DISTINCT SELECT c', 1],
    ['((SELECT a UNION ALL SELECT b, c))', 1],
    ['SELECT ALL a UNION ALL SELECT DISTINCT b, c', 1],
    ["SELECT COALESCE(a, b), STRUCT(1, 2), [1, 2], 'a,b' UNION ALL SELECT c, d, e, f", 0],
    ["SELECT STRUCT<a INT64, b STRING>(1, 'b') UNION ALL SELECT x", 0],
    ["SELECT STRUCT<a ARRAY<INT64>, b STRING>([1], 'b') UNION ALL SELECT x", 0],
    ['(SELECT a, b) UNION ALL (SELECT c)', 1],
    ['(SELECT a, b) UNION ALL (SELECT c) ORDER BY 1', 1],
    ['SELECT a UNION ALL (SELECT', 0],
    ['SELECT a FROM (SELECT a UNION ALL SELECT b, c)', 1],
    ['SELECT ARRAY(SELECT a UNION ALL SELECT b, c) UNION ALL SELECT x', 1],
    ['SELECT COALESCE((SELECT a UNION ALL SELECT b, c), 0)', 1],
    ['SELECT [STRUCT((SELECT a UNION ALL SELECT b, c))]', 1],
    ['WITH cte AS (SELECT a, b FROM t) SELECT * FROM cte UNION SELECT c, d, e FROM u', 1],
    ['WITH cte AS (SELECT a, b FROM t) SELECT cte.* FROM cte UNION SELECT c, d FROM u', 0],
    ['WITH `cte` AS (SELECT a, b) SELECT x.* FROM `cte` x UNION ALL SELECT c', 1],
    ['WITH cte AS (SELECT a, b) SELECT field.* FROM cte UNION ALL SELECT c', 0],
    ['WITH cte AS (SELECT a, b FROM t) SELECT * EXCEPT (b) FROM cte UNION ALL SELECT c', 0],
    ['WITH cte AS (SELECT a, b, c) SELECT * EXCEPT (a, b) FROM cte UNION ALL SELECT x, y', 1],
    ['WITH cte AS (SELECT a, b) SELECT c.* FROM cte AS c UNION ALL SELECT x', 1],
    ['WITH RECURSIVE cte AS (SELECT a, b UNION ALL SELECT a, b FROM cte) SELECT * FROM cte UNION ALL SELECT x', 1],
    ['WITH cte (a, b) AS (SELECT * FROM external_table) SELECT * FROM cte UNION ALL SELECT x', 1],
    ['WITH cte AS (SELECT * FROM external_table) SELECT * FROM cte UNION ALL SELECT x', 0],
    ['WITH cte AS (SELECT a, b) SELECT * FROM cte JOIN other ON TRUE UNION ALL SELECT x', 0],
    ['WITH cte AS (SELECT a, b) SELECT * FROM cte, other UNION ALL SELECT x', 0],
    ['WITH cte AS (SELECT a, b FROM t), next AS (SELECT * FROM cte) SELECT * FROM next UNION ALL SELECT c', 1],
    ['SELECT * FROM external_table UNION ALL SELECT a, b', 0],
    ['SELECT * FROM project.dataset.table UNION ALL SELECT a, b', 0],
    ['SELECT * UNION ALL SELECT a, b', 0],
    ['SELECT * FROM', 0],
    ['SELECT * FROM external_table UNION ALL SELECT a UNION ALL SELECT b, c', 1],
    ['SELECT COUNT(*) UNION ALL SELECT a', 0],
    ['SELECT a * b UNION ALL SELECT c', 0],
    ['SELECT a UNION ALL BY NAME SELECT b, c', 0],
    ['SELECT AS STRUCT a, b UNION ALL SELECT AS STRUCT c', 0],
    ['SELECT AS VALUE a UNION ALL SELECT AS VALUE b', 0],
    ['SELECT a UNION ALL SELECT b; SELECT a, b UNION ALL SELECT c', 1],
    ["SELECT 'UNION SELECT a, b', `a,b` -- UNION\nUNION ALL SELECT c, d", 0],
  ] as const) {
    it(`checks ${JSON.stringify(text)}`, async () => {
      const diagnostics = await new Linter(defaultSettings).verify({ uri, text, languageId: 'googlesql', version: 1 });
      expect(diagnostics.filter((d) => String(d.code).startsWith('AM07:'))).to.have.length(count);
    });
  }
});
