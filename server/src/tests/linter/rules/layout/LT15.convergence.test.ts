import { expect } from 'chai';
import sinon from 'sinon';
import { CodeActionKind, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { Linter } from '../../../../linter/linter';
import { ruleRegistry } from '../../../../linter/rules/rules';
import { defaultSettings, type ServerSettings } from '../../../../settings';

describe('LT15 convergence', () => {
  const uri = 'file:///lt15-convergence.sql';
  const document = (text: string) => TextDocument.create(uri, 'googlesql', 1, text);
  const isolated = (codes: string[], policy = 'earlier'): ServerSettings => ({
    ...defaultSettings,
    rules: {
      exclude: ruleRegistry.map((Rule) => new Rule(defaultSettings, 0).code).filter((code) => !codes.includes(code)),
      ST09: { options: { preferred_first_table_in_join_clause: policy } },
      LT90: { enabled: codes.includes('LT90') },
    },
  });
  const configurations: [string, ServerSettings][] = [
    ['LT15 alone', isolated(['LT15'])],
    ['defaults', defaultSettings],
    ...['earlier', 'later'].flatMap((policy): [string, ServerSettings][] => [
      [`combined ${policy}`, isolated(['LT15', 'AM05', 'LT02', 'ST09'], policy)],
      [`parenthesised ${policy}`, isolated(['LT15', 'AM05', 'LT02', 'ST09', 'LT90'], policy)],
    ]),
  ];

  afterEach(() => sinon.restore());

  for (const join of ['inner join', 'left join', 'full join', 'cross join', 'join'])
    for (const condition of [
      'b.a = f.a',
      'b.a = f.a and b.c = f.c',
      'b.a = f.a and b.c = f.c and b.d = f.d',
      'b.a = f.a and b.c < f.c or b.d > f.d',
      'b.a != f.a and b.c is null',
      'b.a < f.a or b.c > f.c and b.d != f.d',
    ])
      for (const [name, settings] of configurations)
        it(`converges within 12 passes: ${join} / ${condition} / ${name}`, async () => {
          const source = document(`select f.a from ds.foo as f\n${join} ds.bar as b on ${condition};\n`);
          const verify = sinon.spy(Linter.prototype, 'verify');
          const warning = sinon.spy();
          const formatted = TextDocument.applyEdits(
            source,
            await formatDocument(source, settings, undefined, undefined, warning),
          );
          expect(verify.callCount).to.be.at.most(12);
          expect(warning.called).to.equal(false);
          expect(await formatDocument(document(formatted), settings, undefined, undefined, warning)).to.deep.equal([]);
          expect(warning.called).to.equal(false);
          if (name === 'LT15 alone') expect(formatted).to.equal(source.getText());
        });

  for (const eol of ['\n', '\r\n', '\r'])
    for (const condition of [
      'b.a = f.a and b.c < f.c',
      `b.a = f.a${eol}and b.long_column != f.long_column`,
      `b.a = f.a and b.c < f.c${eol}or b.d > f.d`,
      '(b.a = f.a and b.c < f.c) or b.d is null',
    ])
      it(`keeps Fix All and selections stable for ${JSON.stringify(condition)} / ${JSON.stringify(eol)}`, async () => {
        const text = `select f.a from ds.foo as f${eol}left join ds.bar as b on ${condition};${eol}`;
        const source = document(text);
        const settings = { ...defaultSettings, rules: { LT90: { enabled: true } } };
        const warning = sinon.spy();
        const expected = TextDocument.applyEdits(
          source,
          await formatDocument(source, settings, undefined, undefined, warning),
        );
        const actions = await createDocumentCodeActions(
          source,
          settings,
          {
            textDocument: { uri },
            range: Range.create(0, 0, 100, 0),
            context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
          },
          undefined,
          warning,
        );
        expect(TextDocument.applyEdits(source, actions[0].edit!.changes![uri])).to.equal(expected);
        const selected = document(`-- untouched${eol}${text}-- untouched`);
        const range = {
          start: selected.positionAt(eol.length + 12),
          end: selected.positionAt(selected.getText().length - 12),
        };
        const fixed = TextDocument.applyEdits(
          selected,
          await formatDocument(selected, settings, range, undefined, warning),
        );
        expect(fixed).to.equal(`-- untouched${eol}${expected}-- untouched`);
        expect(await formatDocument(document(expected), settings, undefined, undefined, warning)).to.deep.equal([]);
        expect(warning.called).to.equal(false);
      });

  it('leaves mixed single-line/multiline and nested groups unchanged with LT15 alone', async () => {
    for (const condition of [
      'b.a = f.a and b.c < f.c\nor b.long_column != f.long_column',
      '(b.a = f.a and b.c < f.c) or b.d is null',
      'b.a = f.a and (b.c < f.c or b.d > f.d)',
    ]) {
      const source = document(`select f.a from ds.foo f\nleft join ds.bar b on ${condition};\n`);
      expect(await formatDocument(source, isolated(['LT15']))).to.deep.equal([]);
    }
    const source = document('select a from t where a = 1 and b = 2;\n');
    expect(await formatDocument(source, isolated(['LT15']))).to.deep.equal([]);
  });
});
