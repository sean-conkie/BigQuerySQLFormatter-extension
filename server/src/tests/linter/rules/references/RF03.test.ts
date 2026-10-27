import { expect } from 'chai';
import { CodeActionKind, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { defaultSettings, parseSettings, type RulesSettings, type ServerSettings } from '../../../../settings';

describe('RF03 single-source consistency', () => {
  const uri = 'file:///rf03.sql';
  const groups = {
    aliasing: false,
    ambiguous: false,
    capitalisation: false,
    convention: false,
    layout: false,
    structure: false,
  };
  const settings = (policy = 'consistent', rules: RulesSettings = {}): ServerSettings => ({
    ...defaultSettings,
    rules: { groups, RF03: { options: { single_table_references: policy } }, ...rules },
  });
  afterEach(() => globalTokenCache.delete(uri));

  async function check(text: string, policy = 'consistent', rules: RulesSettings = {}) {
    const linter = new Linter(settings(policy, rules));
    const diagnostics = (await linter.verify({ uri, languageId: 'googlesql', version: 1, text })).filter(({ code }) =>
      String(code).startsWith('RF03:'),
    );
    return { linter, diagnostics, names: diagnostics.map(({ range }) => globalTokenCache.get(uri)!.getText(range)) };
  }

  for (const [source, alias] of [
    ['foo f', 'f'],
    ['foo', 'foo'],
    ['Project.Dataset.Orders', 'Orders'],
    ['`Project.Dataset.Orders`', 'Orders'],
  ]) {
    it(`supports all policies for ${source}`, async () => {
      expect((await check(`select a, ${alias}.b from ${source};`)).names).to.deep.equal([`${alias}.b`]);
      expect((await check(`select ${alias}.b, a from ${source};`)).names).to.deep.equal(['a']);
      expect((await check(`select a, ${alias}.b from ${source};`, 'qualified')).names).to.deep.equal(['a']);
      expect((await check(`select a, ${alias}.b from ${source};`, 'unqualified')).names).to.deep.equal([`${alias}.b`]);
    });
  }

  it('classifies STRUCT paths by the source alias, preserving nested fields', async () => {
    expect((await check('select address.city, c.address.zip from customers c;')).names).to.deep.equal([
      'c.address.zip',
    ]);
    expect((await check('select address.city, address.zip from customers c;')).names).to.deep.equal([]);
    const document = TextDocument.create(uri, 'googlesql', 1, 'select address.city, c.address.zip from customers c;');
    expect(TextDocument.applyEdits(document, await formatDocument(document, settings('qualified')))).to.equal(
      'select c.address.city, c.address.zip from customers c;',
    );
    expect(TextDocument.applyEdits(document, await formatDocument(document, settings('unqualified')))).to.equal(
      'select address.city, address.zip from customers c;',
    );
  });

  for (const sql of [
    'select (select o.id, i.id from inner_table i) from orders o;',
    'select f.*, * from foo f;',
    'select x, x.a from unnest([struct(1 as a)]) x;',
    'select foo, foo.foo from foo;',
    'select f.a, b from foo f, bar b;',
    'select a, f.b from foo f |> select c;',
    'select a, f.b from foo f; -- noqa: RF03',
  ]) {
    it(`excludes unsafe or inapplicable references: ${sql}`, async () => {
      for (const policy of ['consistent', 'qualified', 'unqualified']) {
        expect((await check(sql, policy)).names).to.deep.equal(
          sql.startsWith('select (select') && policy === 'unqualified' ? ['i.id'] : [],
        );
      }
    });
  }

  it('supports a CTE source and independent query policies', async () => {
    expect((await check('with c as (select f.a, b from foo f) select a, c.b from c;')).names).to.deep.equal([
      'c.b',
      'b',
    ]);
  });

  it('does not rewrite select-alias references when unqualifying their expressions', async () => {
    const text = 'select f.a as label from foo f order by label;';
    expect((await check(text, 'unqualified')).names).to.deep.equal(['f.a']);
  });

  it('provides a quick fix and preserves comments between qualifier and column', async () => {
    const text = 'select a, f./* keep */b from foo f;';
    const { linter, diagnostics } = await check(text);
    const actions = await linter.createCodeActions({
      textDocument: { uri },
      range: diagnostics[0].range,
      context: { diagnostics, only: [CodeActionKind.QuickFix] },
    });
    expect(actions).to.have.length(1);
    expect(
      TextDocument.applyEdits(TextDocument.create(uri, 'googlesql', 1, text), actions[0].edit!.changes![uri]),
    ).to.equal('select a, /* keep */b from foo f;');
  });

  for (const eol of ['\n', '\r\n', '\r']) {
    for (const policy of ['consistent', 'qualified', 'unqualified']) {
      it(`makes formatting and Fix All idempotent for ${policy} with ${JSON.stringify(eol)}`, async () => {
        const source = `select${eol}  a,${eol}  Orders.b${eol}from Project.SalesData.Orders;${eol}`;
        const expected =
          policy === 'qualified' ? source.replace(`  a,`, '  Orders.a,') : source.replace('Orders.b', 'b');
        const document = TextDocument.create(uri, 'googlesql', 1, source);
        const config = settings(policy);
        expect(TextDocument.applyEdits(document, await formatDocument(document, config))).to.equal(expected);
        const fixed = TextDocument.create(uri, 'googlesql', 2, expected);
        expect(await formatDocument(fixed, config)).to.deep.equal([]);
        const params = {
          textDocument: { uri },
          range: Range.create(0, 0, 100, 0),
          context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
        };
        const actions = await createDocumentCodeActions(document, config, params);
        expect(TextDocument.applyEdits(document, actions[0].edit!.changes![uri])).to.equal(expected);
        expect(await createDocumentCodeActions(fixed, config, params)).to.deep.equal([]);
      });
    }
  }

  it('quotes aliases when needed and preserves source path spelling', async () => {
    const document = TextDocument.create(
      uri,
      'googlesql',
      1,
      'select a from `My-Project.MyDataset.MyTable` as `odd-alias`;',
    );
    expect(TextDocument.applyEdits(document, await formatDocument(document, settings('qualified')))).to.equal(
      'select `odd-alias`.a from `My-Project.MyDataset.MyTable` as `odd-alias`;',
    );
  });

  it('parses project options and respects disabled rules, severity and groups', async () => {
    const rules = parseSettings({ rules: { RF03: { options: { single_table_references: 'qualified' } } } }).rules;
    expect((await check('select a from foo;', 'consistent', rules)).names).to.deep.equal(['a']);
    for (const rules of [
      { RF03: { enabled: false } },
      { RF03: { severity: 'off' } },
      { groups: { references: false } },
      { exclude: ['RF03'] },
    ] satisfies RulesSettings[]) {
      expect((await check('select a, f.b from foo f;', 'consistent', rules)).names).to.deep.equal([]);
    }
    expect(
      (await check('select a, f.b from foo f;', 'consistent', { RF03: { severity: 'error' } })).diagnostics[0].severity,
    ).to.equal(DiagnosticSeverity.Error);
  });
});
