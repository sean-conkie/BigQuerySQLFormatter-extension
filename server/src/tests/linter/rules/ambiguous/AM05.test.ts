import { expect } from 'chai';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CodeActionKind } from 'vscode-languageserver/node';
import { Linter } from '../../../../linter/linter';
import { defaultSettings } from '../../../../settings';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';

describe('AM05 explicit inner joins', () => {
  const uri = 'am05.bqsql';
  afterEach(() => globalTokenCache.delete(uri));

  for (const join of [
    'INNER JOIN',
    'LEFT JOIN',
    'RIGHT OUTER JOIN',
    'FULL JOIN',
    'CROSS JOIN',
    'LEFT /* note */ JOIN',
  ]) {
    it(`accepts ${join}`, async () => {
      const diagnostics = await new Linter(defaultSettings).verify({
        uri,
        text: `SELECT a FROM t ${join} u ON t.id = u.id;`,
        languageId: 'googlesql',
        version: 1,
      });
      expect(diagnostics.filter((d) => String(d.code).startsWith('AM05:'))).to.have.length(0);
    });
  }

  it('ignores comments, strings, identifiers, and longer names', async () => {
    const diagnostics = await new Linter(defaultSettings).verify({
      uri,
      text: "SELECT 'JOIN', `JOIN`, joint FROM t; -- JOIN\n/* JOIN */",
      languageId: 'googlesql',
      version: 1,
    });
    expect(diagnostics.filter((d) => String(d.code).startsWith('AM05:'))).to.have.length(0);
  });

  for (const join of ['join', 'JOIN']) {
    it(`fixes nested and multiple ${join}s without changing their conditions`, async () => {
      const text = `SELECT a FROM t ${join} (SELECT b FROM v ${join} w ON v.id = w.id) u ON t.id = u.id;\n`;
      const linter = new Linter(defaultSettings);
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const diagnostics = (await linter.verify({ uri, text, languageId: 'googlesql', version: 1 })).filter((d) =>
        String(d.code).startsWith('AM05:'),
      );
      expect(diagnostics).to.have.length(2);
      const actions = await linter.createCodeActions({
        textDocument: { uri },
        range: diagnostics[0].range,
        context: { diagnostics },
      });
      const fix = actions.find((action) => action.kind === 'source.fixAll.bigquerySQLFormatter')!;
      const fixed = TextDocument.applyEdits(document, fix.edit!.changes![uri]);
      expect(fixed).to.equal(text.replaceAll(join, `${join === 'join' ? 'inner' : 'INNER'} ${join}`));
      expect(actions.filter((action) => action.kind === CodeActionKind.QuickFix)).to.have.length(2);
      expect(
        (await linter.verify({ uri, text: fixed, languageId: 'googlesql', version: 2 })).filter((d) =>
          String(d.code).startsWith('AM05:'),
        ),
      ).to.have.length(0);
    });
  }
});
