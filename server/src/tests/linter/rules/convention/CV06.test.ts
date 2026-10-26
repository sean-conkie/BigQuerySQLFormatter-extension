import { expect } from 'chai';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Linter } from '../../../../linter/linter';
import { defaultSettings } from '../../../../settings';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { formatDocument } from '../../../../formatting';
import { Terminator } from '../../../../linter/rules/convention/CV06';

describe('CV06 statement terminators', () => {
  const uri = 'cv06.bqsql';
  afterEach(() => globalTokenCache.delete(uri));
  for (const [text, fixed] of [
    ['SELECT a', 'SELECT a;\n'],
    ['SELECT a\n', 'SELECT a;\n'],
    ['SELECT a  ;\n', 'SELECT a;\n'],
    ['SELECT a\n\n ;\n', 'SELECT a;\n'],
    ['SELECT a; SELECT b;', 'SELECT a;\nSELECT b;\n'],
    ['SELECT a -- note\n;\n', 'SELECT a; -- note\n\n'],
    ['SELECT a -- note', 'SELECT a; -- note\n'],
    ["SELECT ';'; -- note", "SELECT ';'; -- note\n"],
    ['SELECT `a;`;\n', 'SELECT `a;`;\n'],
    ['-- comment only', '-- comment only'],
    ['/* ; */\n', '/* ; */\n'],
    ["SELECT 'unfinished", "SELECT 'unfinished"],
    ['SELECT a;\nSELECT b;\n', 'SELECT a;\nSELECT b;\n'],
  ] as const) {
    it(`fixes ${JSON.stringify(text)}`, async () => {
      const linter = new Linter(defaultSettings);
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const diagnostics = (await linter.verify({ uri, text, languageId: 'googlesql', version: 1 })).filter((d) =>
        String(d.code).startsWith('CV06:'),
      );
      const actions = await linter.createCodeActions({
        textDocument: { uri },
        range: { start: document.positionAt(0), end: document.positionAt(text.length) },
        context: { diagnostics },
      });
      const edits =
        actions.find((action) => action.kind === 'source.fixAll.bigquerySQLFormatter')?.edit?.changes?.[uri] ?? [];
      const result = TextDocument.applyEdits(document, edits);
      expect(result).to.equal(fixed);
      expect(
        (await linter.verify({ uri, text: result, languageId: 'googlesql', version: 2 })).filter((d) =>
          String(d.code).startsWith('CV06:'),
        ),
      ).to.have.length(0);
    });
  }

  it('preserves CRLF when formatting and converges with the EOF rule', async () => {
    const document = TextDocument.create(uri, 'googlesql', 1, 'SELECT a\r\nFROM t');
    const edits = await formatDocument(document, {
      ...defaultSettings,
      rules: { groups: { aliasing: false, layout: false } },
    });
    expect(TextDocument.applyEdits(document, edits)).to.equal('select a\r\nfrom t;\r\n');
  });

  it('clears cached fixes on close and does not expose edits for stale diagnostics', async () => {
    const linter = new Linter(defaultSettings);
    const diagnostics = await linter.verify({ uri, text: 'SELECT a', languageId: 'googlesql', version: 1 });
    const diagnostic = diagnostics.find((d) => String(d.code).startsWith('CV06:'))!;
    const rule = linter.parserRules.find((entry) => entry instanceof Terminator)!;
    linter.closeDocument(uri);
    expect(rule.createCodeAction({ uri }, diagnostic)).to.deep.equal([]);
  });
});
