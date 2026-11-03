import { expect } from 'chai';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { formatDocument } from '../formatting';
import { defaultSettings } from '../settings';
import { Linter } from '../linter/linter';
import { globalTokenCache } from '../linter/parser/tokenCache';
import { tokenizeSource } from '../linter/rules/source';
import { proceduralFixtures } from './proceduralFixtures';
import { CodeActionKind } from 'vscode-languageserver/node';

describe('Default-rule fixture convergence', function () {
  this.timeout(120000);
  const fixtures = new Map<string, string>();

  function collect(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (entry.name.endsWith('.test.ts')) {
        const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node): void => {
          // Existing rule fixtures are embedded SQL literals rather than separate SQL files.
          if (
            (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
            /^\s*(select|with|from|create|insert|update|delete|merge)\b/i.test(node.text)
          ) {
            fixtures.set(node.text, `${entry.name}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    }
  }
  collect(resolve(__dirname, '../../src/tests/linter/rules'));
  for (const text of proceduralFixtures) fixtures.set(text, 'procedural script');

  it('collects the existing rule fixture corpus', () => {
    expect(fixtures.size).to.be.greaterThan(300);
  });
  for (const [text, location] of fixtures) {
    it(`converges with defaults: ${location}: ${JSON.stringify(text)}`, async () => {
      const source = TextDocument.create('file:///corpus.sql', 'googlesql', 1, text);
      const linter = new Linter({ ...defaultSettings, maxNumberOfProblems: Number.MAX_SAFE_INTEGER });
      try {
        const diagnostics = await linter.verify({
          uri: source.uri,
          languageId: source.languageId,
          version: source.version,
          text,
        });
        for (const { range } of diagnostics) {
          for (const position of [range.start, range.end]) {
            expect(Number.isInteger(position.line) && Number.isInteger(position.character)).to.equal(true);
            expect(source.positionAt(source.offsetAt(position))).to.deep.equal(position);
          }
          expect(source.offsetAt(range.start)).to.be.at.most(source.offsetAt(range.end));
        }
        const actions = await linter.createCodeActions({
          textDocument: { uri: source.uri },
          range: { start: source.positionAt(0), end: source.positionAt(text.length) },
          context: {
            diagnostics: diagnostics.filter((entry) => String(entry.code).startsWith('LT02:')),
            only: [CodeActionKind.QuickFix],
          },
        });
        for (const action of actions) {
          const fixed = TextDocument.applyEdits(source, action.edit?.changes?.[source.uri] ?? []);
          expect(tokenizeSource(fixed).map((token) => token.value)).to.deep.equal(
            tokenizeSource(text).map((token) => token.value),
          );
        }
      } finally {
        linter.closeDocument(source.uri);
        globalTokenCache.delete(source.uri);
      }
      const warnings: string[] = [];
      const report = (message: string) => warnings.push(message);
      const formatted = TextDocument.applyEdits(
        source,
        await formatDocument(source, defaultSettings, undefined, undefined, report),
      );
      const repeated = await formatDocument(
        TextDocument.create(source.uri, source.languageId, 2, formatted),
        defaultSettings,
        undefined,
        undefined,
        report,
      );
      expect(warnings).to.deep.equal([]);
      expect(repeated).to.deep.equal([]);
    });
  }
});
