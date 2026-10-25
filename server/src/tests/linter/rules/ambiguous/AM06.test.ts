import { expect } from 'chai';
import { Linter } from '../../../../linter/linter';
import { defaultSettings } from '../../../../settings';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';

describe('AM06 column references', () => {
  const uri = 'am06.bqsql';
  afterEach(() => globalTokenCache.delete(uri));
  for (const [text, count] of [
    ['SELECT foo, bar FROM t GROUP BY foo, 2', 1],
    ['SELECT foo, bar FROM t ORDER BY 1, bar DESC NULLS LAST', 1],
    ['SELECT foo, bar FROM t GROUP BY foo, bar ORDER BY foo', 0],
    ['SELECT foo, bar FROM t GROUP BY 1, 2 ORDER BY 1 DESC NULLS LAST', 0],
    ['SELECT foo, bar FROM t GROUP BY foo, bar ORDER BY 1', 1],
    ['SELECT foo FROM t GROUP BY ALL ORDER BY foo', 0],
    ['SELECT a FROM t ORDER BY COALESCE(a, 1), 2', 1],
    ['SELECT a FROM t ORDER BY a + 1, b', 0],
    ['SELECT a FROM t ORDER BY `1`, a', 0],
    ["SELECT 'ORDER BY 1, a' -- GROUP BY a, 2\nFROM t", 0],
    ['SELECT a, ROW_NUMBER() OVER (ORDER BY 1, a) FROM t ORDER BY 1', 0],
    ['SELECT ARRAY_AGG(a ORDER BY 1, a) FROM t GROUP BY 1', 0],
    ['SELECT a FROM (SELECT a FROM t GROUP BY 1 ORDER BY 1) GROUP BY a', 0],
    ['SELECT a FROM t GROUP BY 1; SELECT a FROM t ORDER BY a', 0],
    ['SELECT a FROM t ORDER BY a UNION ALL SELECT a FROM u ORDER BY 1', 0],
    ['SELECT a FROM t GROUP BY ROLLUP(a, b), 1', 1],
    ['SELECT a FROM t ORDER BY a,', 0],
  ] as const) {
    it(`checks ${JSON.stringify(text)}`, async () => {
      const diagnostics = await new Linter(defaultSettings).verify({ uri, text, languageId: 'googlesql', version: 1 });
      expect(diagnostics.filter((d) => String(d.code).startsWith('AM06:'))).to.have.length(count);
    });
  }
});
