import { expect } from 'chai';
import { CodeActionKind, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { defaultSettings, parseSettings, type RulesSettings, type ServerSettings } from '../../../../settings';

describe('RF06 unnecessary quoting', () => {
  const uri = 'file:///rf06.sql';
  const onlyReferences: RulesSettings = {
    groups: {
      aliasing: false,
      ambiguous: false,
      capitalisation: false,
      convention: false,
      layout: false,
      structure: false,
    },
  };
  afterEach(() => globalTokenCache.delete(uri));

  async function check(text: string, options: Record<string, boolean | string[]> = {}, rules: RulesSettings = {}) {
    const linter = new Linter({ ...defaultSettings, rules: { ...onlyReferences, RF06: { options }, ...rules } });
    const diagnostics = (await linter.verify({ uri, languageId: 'googlesql', version: 1, text })).filter((diagnostic) =>
      String(diagnostic.code).startsWith('RF06:'),
    );
    return { linter, diagnostics, names: diagnostics.map(({ range }) => globalTokenCache.get(uri)!.getText(range)) };
  }

  it('checks columns, aliases, fields, CTE definitions and visible references', async () => {
    expect(
      (await check('with `cte` as (select `col` as `foo` from ds.orders as `o`) select o.`status` from `cte` o;'))
        .names,
    ).to.deep.equal(['`cte`', '`col`', '`foo`', '`o`', '`status`', '`cte`']);
  });

  it('keeps required backticks and does not change string literals or UDF names', async () => {
    expect(
      (
        await check(
          'select `select`, `1st_value`, `order total`, `dashed-name`, `has\\\\escape`, `a.b`, `Ds.Udf`(x), "foo", \'`foo`\';',
        )
      ).names,
    ).to.deep.equal([]);
  });

  it('allows reserved words in subsequent field path parts, not the first', async () => {
    expect((await check('select o.`select`, `from`.col, `ordinary`.`from` from ds.orders o;')).names).to.deep.equal([
      '`select`',
      '`ordinary`',
      '`from`',
    ]);
  });

  it('skips table paths and DDL/DML targets by default', async () => {
    expect(
      (
        await check(
          'select x from `project.dataset.table`; create table `ds.tbl` (`field` int64); insert into `ds.tbl` select x from `ds.source`;',
        )
      ).names,
    ).to.deep.equal(['`field`']);
  });

  it('optionally checks table paths, allowing dashed first parts only in FROM/TABLE', async () => {
    expect(
      (
        await check(
          'select x from `my-project.ds.table`, `project.ds.select`, `select.ds.tbl`, `ds.bad-name`, `1project.ds.tbl`; create table `my-project.ds.tbl` (x int64); insert into `my-project.ds.tbl` select x from ds.tbl;',
          {
            check_table_paths: true,
          },
        )
      ).names,
    ).to.deep.equal(['`my-project.ds.table`', '`project.ds.select`', '`my-project.ds.tbl`']);
  });

  it('handles separately quoted path parts and preserves case-sensitive names', async () => {
    expect(
      (
        await check('select x from `My-Project`.`SalesData`.`select`;', {
          check_table_paths: true,
        })
      ).names,
    ).to.deep.equal(['`My-Project`', '`SalesData`', '`select`']);
  });

  it('supports case-insensitive ignored names and noqa', async () => {
    expect((await check('select `Foo`, `Bar`;', { ignore_words: ['fOO'] })).names).to.deep.equal(['`Bar`']);
    expect((await check('select `foo`; -- noqa: RF06')).names).to.deep.equal([]);
  });

  it('does not unquote callable names when table path checking is enabled', async () => {
    expect(
      (
        await check('create temp function `MyFn`(x int64) as (x); select `MyFn`(x) from `Ds.MyTvf`(1);', {
          check_table_paths: true,
        })
      ).names,
    ).to.deep.equal([]);
  });

  it('preserves case-sensitive table paths when applying RF06 and CP02 together', async () => {
    const source = 'select `Col` from `My-Project.SalesData.Orders` as `O`;\n';
    const settings: ServerSettings = {
      ...defaultSettings,
      rules: {
        ...onlyReferences,
        groups: { ...onlyReferences.groups, capitalisation: true },
        RF06: { options: { check_table_paths: true } },
      },
    };
    const document = TextDocument.create(uri, 'googlesql', 1, source);
    expect(TextDocument.applyEdits(document, await formatDocument(document, settings))).to.equal(
      'select col from My-Project.SalesData.Orders as o;\n',
    );
  });

  it('supports project options and disabled reference rules', async () => {
    const rules = parseSettings({ rules: { RF06: { options: { ignore_words: ['foo'] } } } }).rules;
    expect((await check('select `foo`;', {}, rules)).names).to.deep.equal([]);
    for (const rules of [
      { RF06: { enabled: false } },
      { groups: { references: false } },
      { exclude: ['RF06'] },
    ] satisfies RulesSettings[]) {
      expect((await check('select `foo`;', {}, rules)).names).to.deep.equal([]);
    }
  });

  it('quick fixes preserve identifier text exactly, including mixed case', async () => {
    const text = 'select `MiXeD`;';
    const { linter, diagnostics } = await check(text);
    const actions = await linter.createCodeActions({
      textDocument: { uri },
      range: diagnostics[0].range,
      context: { diagnostics, only: [CodeActionKind.QuickFix] },
    });
    expect(actions).to.have.length(1);
    expect(
      TextDocument.applyEdits(TextDocument.create(uri, 'googlesql', 1, text), actions[0].edit!.changes![uri]),
    ).to.equal('select MiXeD;');
  });

  for (const eol of ['\n', '\r\n']) {
    it(`keeps Fix All and formatting idempotent with CP02 and ${JSON.stringify(eol)}`, async () => {
      const settings: ServerSettings = {
        ...defaultSettings,
        rules: { ...onlyReferences, groups: { ...onlyReferences.groups, capitalisation: true } },
      };
      const source = `with \`MyCte\` as (select \`MyColumn\` as \`MyAlias\` from \`Project.Dataset.Table\`)${eol}select \`MyAlias\` from \`MyCte\`;${eol}`;
      const expected = `with mycte as (select mycolumn as myalias from \`Project.Dataset.Table\`)${eol}select myalias from mycte;${eol}`;
      const document = TextDocument.create(uri, 'googlesql', 1, source);
      expect(TextDocument.applyEdits(document, await formatDocument(document, settings))).to.equal(expected);
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, expected), settings)).to.deep.equal([]);
      const actions = await createDocumentCodeActions(document, settings, {
        textDocument: { uri },
        range: Range.create(0, 0, 100, 0),
        context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
      });
      const fixed = TextDocument.create(
        uri,
        'googlesql',
        2,
        TextDocument.applyEdits(document, actions[0]?.edit?.changes?.[uri] ?? []),
      );
      expect(fixed.getText()).to.equal(expected);
      expect(
        await createDocumentCodeActions(fixed, settings, {
          textDocument: { uri },
          range: Range.create(0, 0, 100, 0),
          context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
        }),
      ).to.deep.equal([]);
    });
  }
});
