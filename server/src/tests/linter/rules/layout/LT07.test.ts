import { expect } from 'chai';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Linter } from '../../../../linter/linter';
import { defaultSettings } from '../../../../settings';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';

describe('LT07 CTE closing brackets', () => {
  const uri = 'lt07.bqsql';
  afterEach(() => globalTokenCache.delete(uri));
  for (const [text, fixed] of [
    [
      'WITH zoo AS (\n    SELECT a FROM foo)\n\nSELECT a FROM zoo;\n',
      'WITH zoo AS (\n    SELECT a FROM foo\n)\n\nSELECT a FROM zoo;\n',
    ],
    ['WITH zoo AS (SELECT a FROM foo)\nSELECT a FROM zoo;\n', 'WITH zoo AS (SELECT a FROM foo)\nSELECT a FROM zoo;\n'],
    ['WITH zoo AS (\n  SELECT a\n)\nSELECT a FROM zoo;\n', 'WITH zoo AS (\n  SELECT a\n)\nSELECT a FROM zoo;\n'],
    [
      'WITH c AS (\n SELECT f(a, (b + 1))  ) SELECT a FROM c;\n',
      'WITH c AS (\n SELECT f(a, (b + 1))\n) SELECT a FROM c;\n',
    ],
    [
      'WITH c AS (\n SELECT a /* keep */ ) SELECT a FROM c;\n',
      'WITH c AS (\n SELECT a /* keep */\n) SELECT a FROM c;\n',
    ],
    [
      'WITH RECURSIVE c AS (\n SELECT a),\n  d AS (\n    SELECT b)\nSELECT a FROM c;\n',
      'WITH RECURSIVE c AS (\n SELECT a\n),\n  d AS (\n    SELECT b\n  )\nSELECT a FROM c;\n',
    ],
    ["SELECT 'WITH x AS (\nSELECT a)' AS x;\n", "SELECT 'WITH x AS (\nSELECT a)' AS x;\n"],
    ['WITH c AS (\n SELECT a', 'WITH c AS (\n SELECT a'],
    ['SELECT a FROM (\nSELECT b) t;\n', 'SELECT a FROM (\nSELECT b) t;\n'],
  ] as const) {
    it(`fixes ${JSON.stringify(text)}`, async () => {
      const linter = new Linter(defaultSettings);
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const diagnostics = (await linter.verify({ uri, text, languageId: 'googlesql', version: 1 })).filter((d) =>
        String(d.code).startsWith('LT07:'),
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
          String(d.code).startsWith('LT07:'),
        ),
      ).to.have.length(0);
    });
  }
});
