import { expect } from 'chai';
import { CodeActionKind, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { Linter, sourceFixAllKind } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { classes } from '../../../../linter/rules/capitalisation/rules';
import { defaultSettings, parseSettings, type RuleCode, type ServerSettings } from '../../../../settings';
import type { CapitalisationPolicy } from '../../../../ruleOptions';

interface CasingFixture {
  code: RuleCode;
  lower: string;
  upper: string;
  mixed: string;
  ignored: string;
  pipe: string;
}

const fixtures: CasingFixture[] = [
  {
    code: 'CP05',
    lower:
      'create table t (a int64, b string(20), c numeric(10, 2), d array<struct<e int64, f string>>, g timestamp, h json, i range<date>);\n',
    upper:
      'create table t (a INT64, b STRING(20), c NUMERIC(10, 2), d ARRAY<STRUCT<e INT64, f STRING>>, g TIMESTAMP, h JSON, i RANGE<DATE>);\n',
    mixed:
      'create table t (a Int64, b String(20), c Numeric(10, 2), d Array<Struct<e Int64, f String>>, g Timestamp, h Json, i Range<Date>);\n',
    ignored: "-- INT64\n/* STRING */\nselect 'TIMESTAMP', `INT64`, '''ARRAY\nSTRUCT''', cast(a as int64);\n",
    pipe: 'from ds.tbl |> extend cast(a as INT64) as n;\n',
  },
  {
    code: 'CP03',
    lower: "select sum(a), sqrt(b), safe_cast(c as INT64), ai.generate('x'), Ds.MyFunc(a), Custom_Fn(a);\n",
    upper: "select SUM(a), SQRT(b), SAFE_CAST(c as INT64), AI.GENERATE('x'), Ds.MyFunc(a), Custom_Fn(a);\n",
    mixed: "select Sum(a), Sqrt(b), Safe_Cast(c as INT64), Ai.Generate('x'), Ds.MyFunc(a), Custom_Fn(a);\n",
    ignored: "-- SUM(a)\n/* MAX(b) */\nselect 'COUNT(c)', `SUM`(a), '''AVG(d)\nSUM(e)''', sum(a);\n",
    pipe: "from ds.tbl |> extend AI.GENERATE('x') as answer |> aggregate SUM(a) as total;\n",
  },
  {
    code: 'CP02',
    lower: 'with cte as (select a as b from MyProject.Ds.Tbl t) select c.b from cte c;\n',
    upper: 'with CTE as (select A as B from MyProject.Ds.Tbl T) select C.B from CTE C;\n',
    mixed: 'with Cte as (select A as B from MyProject.Ds.Tbl T) select C.B from Cte C;\n',
    ignored: "-- FOO\n/* BAR */\nselect 'X', `Y`, '''Z\nQ''', a from MyProject.ds.tbl;\n",
    pipe: 'from ds.tbl |> select A as B;\n',
  },
  {
    code: 'CP01',
    lower: 'select a from t where a is not null group by a;\n',
    upper: 'SELECT a FROM t WHERE a IS NOT null GROUP BY a;\n',
    mixed: 'Select a FrOm t WhErE a Is NoT null GrOuP bY a;\n',
    ignored: "-- SELECT\n/* FROM */\nselect 'WHERE', `GROUP BY`, '''JOIN\nORDER BY''';\n",
    pipe: 'FROM t |> WHERE a > 0 |> SELECT a;\n',
  },
];

for (const fixture of fixtures) {
  describe(`${fixture.code} casing policies`, () => {
    const uri = `file:///${fixture.code}-policies.bqsql`;
    const document = (text: string) => TextDocument.create(uri, 'googlesql', 1, text);
    function settings(policy?: CapitalisationPolicy): ServerSettings {
      const configuration: ServerSettings = {
        ...defaultSettings,
        rules: {
          groups: {
            aliasing: false,
            ambiguous: false,
            convention: false,
            layout: false,
            structure: false,
            references: false,
          },
          exclude: classes.map((rule) => new rule(defaultSettings, 0).code).filter((code) => code !== fixture.code),
        },
      };
      configuration.rules![fixture.code] = { options: policy ? { capitalisation_policy: policy } : {} };
      return configuration;
    }
    async function verify(text: string, configuration = settings()) {
      const linter = new Linter(configuration);
      try {
        return await linter.verify({ uri, languageId: 'googlesql', version: 1, text });
      } finally {
        linter.closeDocument(uri);
        globalTokenCache.delete(uri);
      }
    }

    for (const eol of ['\n', '\r\n', '\r']) {
      for (const [policy, source, expected] of [
        ['lower', fixture.mixed, fixture.lower],
        ['upper', fixture.mixed, fixture.upper],
        ['consistent', fixture.upper + fixture.lower, fixture.upper + fixture.upper],
        ['consistent', fixture.lower + fixture.upper, fixture.lower + fixture.lower],
        ['consistent', fixture.mixed, fixture.lower],
      ] satisfies [CapitalisationPolicy, string, string][]) {
        it(`fixes ${policy} with ${JSON.stringify(eol)} endings, then remains idempotent`, async () => {
          const input = document(source.replaceAll('\n', eol));
          const output = expected.replaceAll('\n', eol);
          const configuration = settings(policy);
          const diagnostics = await verify(input.getText(), configuration);
          expect(diagnostics.length).to.be.greaterThan(0);
          expect(diagnostics.every((entry) => String(entry.code).startsWith(`${fixture.code}:`))).to.equal(true);
          const actions = await createDocumentCodeActions(input, configuration, {
            textDocument: { uri },
            range: Range.create(0, 0, 100, 0),
            context: { diagnostics },
          });
          const quickFixes = actions.filter((action) => action.kind === CodeActionKind.QuickFix);
          expect(quickFixes).to.have.length(diagnostics.length);
          const edits = quickFixes.flatMap((action) => action.edit!.changes![uri]);
          expect(TextDocument.applyEdits(input, edits)).to.equal(output);
          const fixAll = actions.filter((action) => action.kind === sourceFixAllKind);
          expect(fixAll).to.have.length(1);
          expect(TextDocument.applyEdits(input, fixAll[0].edit!.changes![uri])).to.equal(output);
          expect(TextDocument.applyEdits(input, await formatDocument(input, configuration))).to.equal(output);
          expect(await formatDocument(document(output), configuration)).to.deep.equal([]);
          expect(await verify(output, configuration)).to.deep.equal([]);
        });
      }
    }

    it('defaults to lowercase and ignores strings, quoted identifiers and comments', async () => {
      expect(await verify(fixture.ignored)).to.deep.equal([]);
      const input = document(fixture.mixed);
      expect(TextDocument.applyEdits(input, await formatDocument(input, settings()))).to.equal(fixture.lower);
      const combined = document(fixture.ignored + fixture.upper);
      expect(TextDocument.applyEdits(combined, await formatDocument(combined, settings('consistent')))).to.equal(
        fixture.ignored + fixture.lower,
      );
    });

    it('honors inline and region noqa directives in diagnostics and formatting', async () => {
      const inline = `${fixture.upper.trimEnd()} -- noqa: ${fixture.code}\n`;
      const region = `-- noqa: disable=${fixture.code}\n${fixture.upper}-- noqa: enable=${fixture.code}\n`;
      const source = inline + region + fixture.upper;
      const expected = inline + region + fixture.lower;
      expect(await verify(inline + region)).to.deep.equal([]);
      const input = document(source);
      expect(TextDocument.applyEdits(input, await formatDocument(input, settings()))).to.equal(expected);
    });

    it('honors disabled rules, severity and group settings', async () => {
      for (const override of [{ enabled: false }, { severity: 'off' as const }]) {
        const configuration = settings();
        configuration.rules![fixture.code] = override;
        expect(await verify(fixture.upper, configuration)).to.deep.equal([]);
        expect(await formatDocument(document(fixture.upper), configuration)).to.deep.equal([]);
      }
      const configuration = settings();
      configuration.rules!.groups!.capitalisation = false;
      expect(await verify(fixture.upper, configuration)).to.deep.equal([]);
    });

    it('validates its declared option and reports invalid values', () => {
      expect(
        parseSettings({ rules: { [fixture.code]: { options: { capitalisation_policy: 'upper' } } } }),
      ).to.have.nested.property(`rules.${fixture.code}.options.capitalisation_policy`, 'upper');
      const errors: string[] = [];
      const parsed = parseSettings(
        { rules: { [fixture.code]: { options: { capitalisation_policy: 'title' } } } },
        (message) => errors.push(message),
      );
      expect(errors).to.have.length(1);
      expect(parsed).to.have.nested.property(`rules.${fixture.code}.options.capitalisation_policy`, 'lower');
    });

    if (fixture.code === 'CP02') {
      it('preserves quoted paths and project names while fixing implicit aliases and field references', async () => {
        const source = document(
          'select `Quoted`, `Project.Dataset.Table`.Field, Foo ImplicitAlias from MyProject.MyDataset.MyTable T;\n',
        );
        expect(TextDocument.applyEdits(source, await formatDocument(source, settings()))).to.equal(
          'select `Quoted`, `Project.Dataset.Table`.field, foo implicitalias from MyProject.MyDataset.MyTable t;\n',
        );
        const quoted = 'select t.Field from `MyProject.MyDataset.MyTable` T;\n';
        expect(TextDocument.applyEdits(document(quoted), await formatDocument(document(quoted), settings()))).to.equal(
          'select t.field from `MyProject.MyDataset.MyTable` t;\n',
        );
      });
    }

    if (fixture.code === 'CP03') {
      it('does not classify DDL object names as function calls', async () => {
        for (const text of [
          'CREATE TABLE MyTable (a INT64);\n',
          'create table MyDataset.MyTable (a INT64);\n',
          'CREATE TEMP FUNCTION MyFunc(a INT64) AS (a);\n',
        ]) {
          expect(await verify(text), text).to.deep.equal([]);
        }
      });

      it('keeps function and identifier policies independent, including user-defined calls', async () => {
        const configuration = settings('upper');
        configuration.rules!.exclude = ['CP01', 'CP04', 'CP05'];
        configuration.rules!.CP02 = { options: { capitalisation_policy: 'lower' } };
        const source = document('select Ds.MyFunc(A), SUM(B) as Result;\n');
        const expected = 'select Ds.MyFunc(a), SUM(b) as result;\n';
        expect(TextDocument.applyEdits(source, await formatDocument(source, configuration))).to.equal(expected);
        expect(await formatDocument(document(expected), configuration)).to.deep.equal([]);
      });

      it('preserves table-valued and project-qualified user-defined function calls', async () => {
        const input = document('select Project.Ds.MyFunc(a) from Ds.MyTvf(1);\n');
        expect(TextDocument.applyEdits(input, await formatDocument(input, settings()))).to.equal(input.getText());
      });
    }

    if (fixture.code === 'CP05') {
      it('distinguishes parameterised types from conversion and constructor functions', async () => {
        const configuration = settings('upper');
        configuration.rules!.exclude = ['CP01', 'CP02', 'CP04'];
        configuration.rules!.CP03 = { options: { capitalisation_policy: 'lower' } };
        const source = document(
          'create table t (\n  a STRING(20),\n  b BYTES(10),\n  c ARRAY<STRUCT<d STRING(5)>>\n);\n' +
            'select STRING(123), STRUCT(1), DATE(2026, 1, 1), cast(a as string(20));\n' +
            'declare v string(10);\n',
        );
        const expected =
          'create table t (\n  a STRING(20),\n  b BYTES(10),\n  c ARRAY<STRUCT<d STRING(5)>>\n);\n' +
          'select string(123), STRUCT(1), date(2026, 1, 1), cast(a as STRING(20));\n' +
          'declare v STRING(10);\n';
        expect(TextDocument.applyEdits(source, await formatDocument(source, configuration))).to.equal(expected);
        expect(await formatDocument(document(expected), configuration)).to.deep.equal([]);
      });

      it('checks parameterised types after quoted fields and in unnamed nested type arguments', async () => {
        const source = document(
          'create table t (`Name` STRING(20), a ARRAY<STRUCT<STRING(10), BYTES(5)>>);\n' +
            'select cast(a as ARRAY<STRUCT<STRING(10)>>);\n',
        );
        const expected =
          'create table t (`Name` string(20), a array<struct<string(10), bytes(5)>>);\n' +
          'select cast(a as array<struct<string(10)>>);\n';
        expect(TextDocument.applyEdits(source, await formatDocument(source, settings()))).to.equal(expected);
        expect(await formatDocument(document(expected), settings())).to.deep.equal([]);
      });
    }

    it('remains active for pipe queries', async () => {
      const diagnostics = await verify(fixture.pipe);
      expect(diagnostics.length).to.be.greaterThan(0);
      const input = document(fixture.pipe);
      const edits = await formatDocument(input, settings());
      expect(edits.length).to.be.greaterThan(0);
      const output = TextDocument.applyEdits(input, edits);
      expect(output).to.include('|>');
      expect(await verify(output)).to.deep.equal([]);
    });
  });
}
