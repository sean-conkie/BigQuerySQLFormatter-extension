import { expect } from 'chai';
import sinon from 'sinon';
import { Range, type Diagnostic } from 'vscode-languageserver/node';
import { Linter } from '../../linter/linter';
import { Parser } from '../../linter/parser';
import { Indent } from '../../linter/rules/layout/LT02';
import { globalTokenCache } from '../../linter/parser/tokenCache';
import { defaultSettings } from '../../settings';
import { closeTextDocument, validateTextDocument, validateTextDocumentChanges } from '../../validate';

describe('Diagnostic range safety', () => {
  const uri = 'file:///incomplete.bqsql';
  const document = (text: string) => ({ uri, text, languageId: 'googlesql', version: 1 });

  afterEach(() => {
    sinon.restore();
    closeTextDocument(uri);
  });

  for (const text of [
    'select * f',
    'select * fr',
    'select * fro',
    'select * from',
    'select a from t wh',
    'select a from t where a = 1 gr',
    'select a from t group by a hav',
    'select s. from dataset.table s',
    'select g.repository. from dataset.table g',
  ]) {
    it(`produces only in-document integer ranges for ${JSON.stringify(text)}`, async () => {
      const linter = new Linter(defaultSettings);
      const diagnostics = await linter.verify(document(text));
      for (const { range } of diagnostics) {
        expect(range.start.line).to.equal(0);
        expect(range.end.line).to.equal(0);
        for (const position of [range.start, range.end]) {
          expect(Number.isInteger(position.character)).to.equal(true);
          expect(position.character).to.be.within(0, text.length);
        }
        expect(range.start.character).to.be.at.most(range.end.character);
      }
      const rule = new Indent(defaultSettings, 0);
      const raw = rule.evaluate(await new Parser().parse(document(text)), uri);
      expect(JSON.stringify(raw)).not.to.contain('"character":null');
      linter.closeDocument(uri);
    });
  }

  it('drops and logs each invalid diagnostic by rule code, retaining valid entries on open and edit', async () => {
    const invalid: Range[] = [
      [0, NaN, 0, 1],
      [0, Infinity, 0, 1],
      [0, -1, 0, 1],
      [0, 0.5, 0, 1],
      [-1, 0, 0, 1],
      [0.5, 0, 1, 0],
      [0, 0, 0, Infinity],
      [0, 0, 0, -1],
      [0, 2, 0, 1],
      [1, 0, 0, 1],
      [2, 0, 2, 0],
      [0, 0, 0, 100],
      [0, 0, 2, 0],
    ].map(([startLine, startCharacter, endLine, endCharacter]) => ({
      start: { line: startLine, character: startCharacter },
      end: { line: endLine, character: endCharacter },
    }));
    invalid.push(JSON.parse('{"start":{"line":0,"character":null},"end":{"line":0,"character":1}}'));
    const good: Diagnostic = { code: 'LT02: indent', message: 'valid', severity: 2, range: Range.create(0, 0, 0, 1) };
    sinon
      .stub(Indent.prototype, 'evaluate')
      .returns([...invalid.map((range) => ({ ...good, message: 'SQL must not be logged', range })), good]);
    const warning = sinon.stub(console, 'warn');
    const opened = await validateTextDocument(document('select 1;\n'), defaultSettings);
    expect(opened.diagnostics).to.include.deep.members([good]);
    expect(opened.diagnostics.some((entry) => entry.message === 'SQL must not be logged')).to.equal(false);
    expect(warning.callCount).to.equal(invalid.length);
    expect(warning.args.every(([message]) => message === 'Dropped invalid diagnostic from rule LT02.')).to.equal(true);
    const changed = await validateTextDocumentChanges(
      { textDocument: { uri, version: 2 }, contentChanges: [{ text: 'select 2;\n' }] },
      defaultSettings,
    );
    expect(changed.diagnostics).to.include.deep.members([good]);
    expect(warning.callCount).to.equal(2 * invalid.length);
    expect(globalTokenCache.has(uri)).to.equal(true);
  });
});
