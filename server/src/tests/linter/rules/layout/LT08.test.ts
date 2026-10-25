import { expect } from 'chai';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Linter } from '../../../../linter/linter';
import { defaultSettings } from '../../../../settings';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { formatDocument } from '../../../../formatting';

describe('LT08 CTE blank lines', () => {
  const uri = 'lt08.bqsql';
  afterEach(() => globalTokenCache.delete(uri));
  for (const [text, fixed] of [
    ['WITH c AS (\n SELECT a\n)\nSELECT a FROM c;\n', 'WITH c AS (\n SELECT a\n)\n\nSELECT a FROM c;\n'],
    ['WITH c AS (SELECT a) SELECT a FROM c;\n', 'WITH c AS (SELECT a)\n\nSELECT a FROM c;\n'],
    [
      'WITH c AS (SELECT a), d AS (SELECT b) SELECT a FROM c;\n',
      'WITH c AS (SELECT a),\n\nd AS (SELECT b)\n\nSELECT a FROM c;\n',
    ],
    [
      'WITH c AS (SELECT a),\nd AS (SELECT b)\nSELECT a FROM c;\n',
      'WITH c AS (SELECT a),\n\nd AS (SELECT b)\n\nSELECT a FROM c;\n',
    ],
    ['WITH c AS (SELECT a)\n\nSELECT a FROM c;\n', 'WITH c AS (SELECT a)\n\nSELECT a FROM c;\n'],
    ['WITH c AS (SELECT a) -- keep\nSELECT a FROM c;\n', 'WITH c AS (SELECT a) -- keep\n\nSELECT a FROM c;\n'],
    ['WITH c AS (SELECT a)\n-- comment\nSELECT a FROM c;\n', 'WITH c AS (SELECT a)\n-- comment\n\nSELECT a FROM c;\n'],
    ['WITH c AS (SELECT a) /* keep */ SELECT a FROM c;\n', 'WITH c AS (SELECT a) /* keep */ \n\nSELECT a FROM c;\n'],
    ['SELECT a FROM (SELECT b) t;\n', 'SELECT a FROM (SELECT b) t;\n'],
    ['WITH c AS (\nSELECT a', 'WITH c AS (\nSELECT a'],
    ['WITH c AS (SELECT a)', 'WITH c AS (SELECT a)'],
  ] as const) {
    it(`fixes ${JSON.stringify(text)}`, async () => {
      const linter = new Linter(defaultSettings);
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const diagnostics = (await linter.verify({ uri, text, languageId: 'googlesql', version: 1 })).filter((d) =>
        String(d.code).startsWith('LT08:'),
      );
      const actions = await linter.createCodeActions({
        textDocument: { uri },
        range: { start: document.positionAt(0), end: document.positionAt(text.length) },
        context: { diagnostics },
      });
      const edits =
        actions.find((action) => action.kind === 'source.fixAll.bigquerySQLFormatter')?.edit?.changes?.[uri] ?? [];
      expect(TextDocument.applyEdits(document, edits)).to.equal(fixed);
      expect(
        (await linter.verify({ uri, text: fixed, languageId: 'googlesql', version: 2 })).filter((d) =>
          String(d.code).startsWith('LT08:'),
        ),
      ).to.have.length(0);
    });
  }

  it('converges with LT07 and CV06, including nested CTEs and CRLF', async () => {
    const text = 'WITH c AS (\r\n  WITH d AS (\r\n    SELECT a)\r\n  SELECT a FROM d)\r\nSELECT a FROM c';
    const document = TextDocument.create(uri, 'googlesql', 1, text);
    const settings = { ...defaultSettings, rules: { LT02: { enabled: false }, groups: { aliasing: false } } };
    const edits = await formatDocument(document, settings);
    const fixed = TextDocument.applyEdits(document, edits);
    expect(fixed).to.equal(
      'WITH c AS (\r\n  WITH d AS (\r\n    SELECT a\r\n  )\r\n\r\n  SELECT a FROM d\r\n)\r\n\r\nSELECT a FROM c;\r\n',
    );
    expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, fixed), settings)).to.deep.equal([]);
  });
});
