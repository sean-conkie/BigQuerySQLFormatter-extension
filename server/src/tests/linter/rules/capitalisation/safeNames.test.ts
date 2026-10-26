import { expect } from 'chai';
import { CodeActionKind, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { defaultSettings, type ServerSettings } from '../../../../settings';
import type { CapitalisationPolicy } from '../../../../ruleOptions';

describe('Case-sensitive BigQuery names (#403)', () => {
  const uri = 'file:///safe-names.bqsql';
  afterEach(() => globalTokenCache.delete(uri));

  async function check(source: string, expected: string, settings: ServerSettings) {
    const document = TextDocument.create(uri, 'googlesql', 1, source);
    const actions = await createDocumentCodeActions(document, settings, {
      textDocument: { uri },
      range: Range.create(0, 0, 100, 0),
      context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
    });
    const edits = actions.flatMap((action) => action.edit?.changes?.[uri] ?? []);
    expect(TextDocument.applyEdits(document, edits), 'Fix All').to.equal(expected);
    expect(TextDocument.applyEdits(document, await formatDocument(document, settings)), 'formatting').to.equal(
      expected,
    );
    expect(
      await formatDocument(TextDocument.create(uri, 'googlesql', 2, expected), settings),
      'idempotence',
    ).to.deep.equal([]);
  }

  function configuration(policy: CapitalisationPolicy): ServerSettings {
    return {
      ...defaultSettings,
      rules: {
        groups: { aliasing: false, ambiguous: false, convention: false, layout: false, structure: false },
        exclude: ['CP01', 'CP04', 'CP05'],
        CP02: { options: { capitalisation_policy: policy } },
        CP03: { options: { capitalisation_policy: policy } },
      },
    };
  }

  for (const policy of ['lower', 'upper', 'consistent'] as const) {
    const casing = (value: string) => (policy === 'upper' ? value.toUpperCase() : value.toLowerCase());
    const settings = configuration(policy);
    for (const table of ['MyProject.SalesData.Orders', 'SalesData.Orders', 'Orders', '`MyProject.SalesData.Orders`']) {
      it(`preserves ${table} under ${policy}`, async () => {
        await check(`select Id from ${table} o;\n`, `select ${casing('id')} from ${table} ${casing('o')};\n`, settings);
      });
    }

    it(`preserves qualified and unqualified UDFs and TVFs under ${policy}`, async () => {
      await check(
        'select MyDataset.ParseSku(sku), ParseSku(sku), MyProject.Ds.SUM(x), MyDataset.SUM(x), SAFE.MyFunc(x), SUM(x) from Ds.MyTvf(1);\n',
        `select MyDataset.ParseSku(${casing('sku')}), ParseSku(${casing('sku')}), MyProject.Ds.SUM(${casing('x')}), MyDataset.SUM(${casing('x')}), SAFE.MyFunc(${casing('x')}), ${policy === 'lower' ? 'sum' : 'SUM'}(${casing('x')}) from Ds.MyTvf(1);\n`,
        settings,
      );
    });

    it(`preserves DDL/DML targets and temporary UDFs under ${policy}`, async () => {
      const source =
        'create table SalesData.Orders (Id int64);\n' +
        'insert into Orders (Id) select Id from SalesData.Orders;\n' +
        'merge Orders T using SalesData.Orders S on T.Id = S.Id when matched then update set Id = S.Id;\n' +
        'update Orders set Id = 1;\ndelete from Orders where Id = 1;\ndelete Orders where Id = 1;\n' +
        'create temp function ParseSku(sku string) as (sku);\nselect ParseSku(Id) from Orders;\n';
      await check(source, source.replace(/\b(Id|T|S|sku)\b/g, casing), settings);
    });

    it(`checks CTE definitions and only visible CTE references under ${policy}`, async () => {
      const source =
        'with Orders as (select Id from Orders), Next as (select Id from Orders) select n.Id from Next n, Orders o;\n' +
        'select Id from Orders;\n' +
        'select Id from (with InnerCte as (select Id from SalesData.Orders) select Id from InnerCte) q join InnerCte t on q.Id = t.Id;\n';
      const expected =
        `with ${casing('orders')} as (select ${casing('id')} from Orders), ${casing('next')} as (select ${casing('id')} from ${casing('orders')}) select ${casing('n.id')} from ${casing('next')} ${casing('n')}, ${casing('orders')} ${casing('o')};\n` +
        `select ${casing('id')} from Orders;\n` +
        `select ${casing('id')} from (with ${casing('innercte')} as (select ${casing('id')} from SalesData.Orders) select ${casing('id')} from ${casing('innercte')}) ${casing('q')} join InnerCte ${casing('t')} on ${casing('q.id')} = ${casing('t.id')};\n`;
      await check(source, expected, settings);
    });

    it(`preserves comma-separated tables and pipe sources under ${policy}`, async () => {
      await check(
        'from Orders |> join SalesData.Orders o on Id = o.Id |> select Id;\nselect Id from Orders o, SalesData.Orders s;\n',
        `from Orders |> join SalesData.Orders ${casing('o')} on ${casing('id')} = ${casing('o.id')} |> select ${casing('id')};\nselect ${casing('id')} from Orders ${casing('o')}, SalesData.Orders ${casing('s')};\n`,
        settings,
      );
    });
  }

  it('ignores case-sensitive names when selecting consistent casing', async () => {
    await check(
      'create table ORDERS (id int64);\nselect UDF(x), Ds.Udf(x), SUM(x), max(x) from ORDERS;\n',
      'create table ORDERS (id int64);\nselect UDF(x), Ds.Udf(x), SUM(x), MAX(x) from ORDERS;\n',
      configuration('consistent'),
    );
  });

  it('handles recursive CTEs, earlier table references and CTEs inside DML', async () => {
    await check(
      'with recursive Cte as (select Id from Cte) select Id from Cte;\n' +
        'with First as (select Id from Later), Later as (select Id from Orders) select Id from Later;\n' +
        'insert into Orders with Cte as (select Id from Orders) select Id from Cte;\n',
      'with recursive cte as (select id from cte) select id from cte;\n' +
        'with first as (select id from Later), later as (select id from Orders) select id from later;\n' +
        'insert into Orders with cte as (select id from Orders) select id from cte;\n',
      configuration('lower'),
    );
  });

  it('checks expression operands after FROM without treating them as tables', async () => {
    await check(
      'select EXTRACT(YEAR FROM CreatedAt), A IS DISTINCT FROM B, A LIKE Pattern from Orders;\n',
      'select extract(YEAR FROM createdat), a IS DISTINCT FROM b, a LIKE pattern from Orders;\n',
      configuration('lower'),
    );
  });

  it('preserves quoted CTE names, literal lookalikes and comments within table paths', async () => {
    await check(
      "with `QuotedCte` as (select 'WITH Cte AS (SELECT Id FROM Orders)' as Text from Project /* x */ . Dataset . Orders) select Text from `QuotedCte`;\n",
      "with `QuotedCte` as (select 'WITH Cte AS (SELECT Id FROM Orders)' as text from Project /* x */ . Dataset . Orders) select text from `QuotedCte`;\n",
      configuration('lower'),
    );
  });

  it('preserves UDF namespaces separated by whitespace or comments', async () => {
    await check(
      'select MyDataset . ParseSku(Id), MyProject /* CaseSensitive */ . MyDataset . ParseSku(Id) from Orders;\n',
      'select MyDataset . ParseSku(id), MyProject /* CaseSensitive */ . MyDataset . ParseSku(id) from Orders;\n',
      configuration('lower'),
    );
  });

  it('does not mistake builtin suffixes of quoted UDF paths for built-ins', async () => {
    await check(
      'select `MyDataset`.SUM(Id), `MyDataset.SUM`(Id), `SUM`(Id) from Orders;\n',
      'select `MyDataset`.SUM(id), `MyDataset.SUM`(id), `SUM`(id) from Orders;\n',
      configuration('lower'),
    );
  });

  it('preserves builtin-looking table targets and shadowing temporary UDFs', async () => {
    await check(
      'insert into SUM (Id) values (1);\ninsert Orders (Id) values (1);\nalter table Orders rename to NewOrders;\n' +
        'create temp function `SUM`(x int64) as (x);\nselect SUM(Id), MAX(Id) from Orders;\n',
      'insert into SUM (id) values (1);\ninsert Orders (id) values (1);\nalter table Orders rename to NewOrders;\n' +
        'create temp function `SUM`(x int64) as (x);\nselect SUM(id), max(id) from Orders;\n',
      configuration('lower'),
    );
  });

  it('checks catalogued namespaced and SAFE-prefixed built-ins, but not qualified UDF suffixes', async () => {
    const source =
      'select SAFE.SQRT(x), SAFE.NET.HOST(x), NET.HOST(x), AI.GENERATE(x), ML.PREDICT(x), KEYS.NEW_KEYSET(x), HLL_COUNT.INIT(x), Ds.NET.HOST(x);\n';
    await check(
      source,
      source.replace(
        /SAFE\.SQRT|SAFE\.NET\.HOST|NET\.HOST|AI\.GENERATE|ML\.PREDICT|KEYS\.NEW_KEYSET|HLL_COUNT\.INIT/g,
        (name, offset: number) => (source.slice(offset - 3, offset) === 'Ds.' ? name : name.toLowerCase()),
      ),
      configuration('lower'),
    );
  });

  it('preserves case-sensitive names with all default rules enabled', async () => {
    await check(
      'select Id from MyProject.SalesData.Orders o;\n',
      'select id from MyProject.SalesData.Orders o;\n',
      defaultSettings,
    );
    await check(
      'select MyDataset.ParseSku(sku), SUM(x) from Orders;\n',
      'select MyDataset.ParseSku(sku), sum(x) from Orders;\n',
      defaultSettings,
    );
    await check('select o.Id from SalesData.Orders as o;\n', 'select o.id from SalesData.Orders o;\n', defaultSettings);
  });
});
