import { expect } from 'chai';
import { Linter } from '../../linter/linter';
import { joinConditions } from '../../linter/joins';
import { globalTokenCache } from '../../linter/parser/tokenCache';
import { sourceTokens } from '../../linter/rules/source';
import { defaultSettings } from '../../settings';

describe('JOIN condition model', () => {
  const uri = 'file:///joins.sql';
  afterEach(() => globalTokenCache.delete(uri));
  async function model(text: string) {
    await new Linter(defaultSettings).verify({ uri, languageId: 'googlesql', version: 1, text });
    const cache = globalTokenCache.get(uri)!;
    return joinConditions(sourceTokens(cache), cache);
  }
  it('retains parentheses and ordered AND/OR structure', async () => {
    const [condition] = await model('select a.id from a join b on (b.id = a.id and b.x < a.x) or b.y >= a.y;');
    expect(condition.expression.kind).to.equal('boolean');
    if (condition.expression.kind !== 'boolean') throw new Error('Expected boolean join expression');
    expect(condition.expression.operators).to.deep.equal(['OR']);
    expect(condition.expression.children[0].kind).to.equal('group');
    expect(condition.comparisons.map(({ operator }) => operator)).to.deep.equal(['=', '<', '>=']);
    expect(condition.comparisons[0].left.sources[0].alias).to.equal('b');
    expect(condition.comparisons[0].right.sources[0].alias).to.equal('a');
  });
  it('models multiple joins independently and stops at query clauses', async () => {
    const conditions = await model(
      'select a.id from a left join b on b.id=a.id inner join c on c.id=b.id where a.id=1 order by a.id;',
    );
    expect(conditions).to.have.length(2);
    expect(conditions.map(({ source }) => source.alias)).to.deep.equal(['b', 'c']);
    expect(conditions.map(({ comparisons }) => comparisons.length)).to.deep.equal([1, 1]);
  });
  it('models joins inside CTEs and subqueries without mixing scopes', async () => {
    const conditions = await model(
      'with c as (select a.id from a join b on b.id=a.id) select c.id from c join (select x.id from x join y on y.id=x.id) z on z.id=c.id;',
    );
    expect(conditions).to.have.length(3);
    expect(conditions.map(({ comparisons }) => comparisons.length)).to.deep.equal([1, 1, 1]);
    expect(new Set(conditions.map(({ scope }) => scope)).size).to.equal(3);
  });
  it('does not split BETWEEN bounds or CASE conditions on AND', async () => {
    const [condition] = await model(
      'select a.id from a join b on a.x between b.lo and b.hi and case when b.flag then b.id else b.other end = a.id;',
    );
    expect(condition.expression.kind).to.equal('boolean');
    if (condition.expression.kind !== 'boolean') throw new Error('Expected boolean join expression');
    expect(condition.expression.operators).to.deep.equal(['AND']);
    expect(condition.comparisons).to.have.length(1);
  });
  it('does not classify unqualified, STRUCT or correlated operands as safely movable', async () => {
    const conditions = await model(
      'select (select b.id from b join c on c.id = a.id and b.id = address.id and c.id = id) from a;',
    );
    expect(conditions[0].comparisons.map(({ right }) => right.safe)).to.deep.equal([false, false, false]);
  });
  it('skips USING and pipe-stage joins', async () => {
    expect(await model('select * from a join b using(id);')).to.deep.equal([]);
    expect(await model('from a |> join b on b.id=a.id;')).to.deep.equal([]);
  });
});
