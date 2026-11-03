import { expect } from 'chai';
import { CodeActionKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { Linter } from '../../../../linter/linter';
import { Parser } from '../../../../linter/parser';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { Indent } from '../../../../linter/rules/layout/LT02';
import { defaultSettings } from '../../../../settings';
import { proceduralFixtures } from '../../../proceduralFixtures';

describe('LT02 procedural safety', () => {
  const uri = 'file:///procedural.bqsql';
  const document = (text: string) => TextDocument.create(uri, 'googlesql', 1, text);

  afterEach(() => globalTokenCache.delete(uri));

  for (const text of proceduralFixtures) {
    it(`leaves procedural tokens alone: ${JSON.stringify(text)}`, async () => {
      const source = document(text);
      const linter = new Linter(defaultSettings);
      try {
        const diagnostics = await linter.verify({ uri, languageId: 'googlesql', version: 1, text });
        expect(diagnostics.filter((entry) => String(entry.code).startsWith('LT02:'))).to.deep.equal([]);
        const rule = new Indent(defaultSettings, 0);
        expect(
          rule.evaluate(await new Parser().parse({ uri, languageId: 'googlesql', version: 1, text }), uri),
        ).to.equal(null);
        const warnings: string[] = [];
        const report = (message: string) => warnings.push(message);
        const expected = `${text}\n`;
        const formatted = TextDocument.applyEdits(
          source,
          await formatDocument(source, defaultSettings, undefined, undefined, report),
        );
        expect(formatted).to.equal(expected);
        expect(await formatDocument(document(formatted), defaultSettings, undefined, undefined, report)).to.deep.equal(
          [],
        );
        const params = {
          textDocument: { uri },
          range: { start: source.positionAt(0), end: source.positionAt(text.length) },
          context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
        };
        const actions = await createDocumentCodeActions(source, defaultSettings, params, undefined, report);
        expect(TextDocument.applyEdits(source, actions[0]?.edit?.changes?.[uri] ?? [])).to.equal(expected);
        const selection = await formatDocument(source, defaultSettings, params.range, undefined, report);
        expect(TextDocument.applyEdits(source, selection)).to.equal(expected);
        expect(warnings).to.deep.equal([]);
      } finally {
        linter.closeDocument(uri);
      }
    });
  }

  for (const eol of ['\n', '\r\n', '\r']) {
    it(`preserves procedural whitespace with ${JSON.stringify(eol)} line endings`, async () => {
      const text = proceduralFixtures[4].replace(/\n/g, eol);
      const source = document(text);
      const warnings: string[] = [];
      const formatted = TextDocument.applyEdits(
        source,
        await formatDocument(source, defaultSettings, undefined, undefined, (message) => warnings.push(message)),
      );
      expect(formatted).to.equal(text + eol);
      expect(await formatDocument(document(formatted), defaultSettings)).to.deep.equal([]);
      expect(warnings).to.deep.equal([]);
    });
  }
});
