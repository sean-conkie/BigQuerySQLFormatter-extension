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
    code: 'CP02',
    lower: 'with cte as (select a as b from MyProject.ds.tbl t) select c.b from cte c;\n',
    upper: 'with CTE as (select A as B from MyProject.DS.TBL T) select C.B from CTE C;\n',
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
          groups: { aliasing: false, ambiguous: false, convention: false, layout: false, structure: false },
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
          'select `Quoted`, `Project.Dataset.Table`.field, foo implicitalias from MyProject.mydataset.mytable t;\n',
        );
        const quoted = 'select t.Field from `MyProject.MyDataset.MyTable` T;\n';
        expect(TextDocument.applyEdits(document(quoted), await formatDocument(document(quoted), settings()))).to.equal(
          'select t.field from `MyProject.MyDataset.MyTable` t;\n',
        );
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
