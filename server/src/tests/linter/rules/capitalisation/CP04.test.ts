import { expect } from 'chai';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CodeActionKind } from 'vscode-languageserver/node';
import { defaultSettings } from '../../../../settings';
import type { CapitalisationPolicy } from '../../../../ruleOptions';
import { Literals } from '../../../../linter/rules/capitalisation/CP04';
import { Parser } from '../../../../linter/parser';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';

describe('Literals', () => {
  const uri = 'literals.sql';
  const otherUri = 'other-literals.sql';
  const parser = new Parser();
  let instance: Literals;

  beforeEach(() => {
    instance = new Literals(defaultSettings, 0);
  });

  afterEach(() => {
    instance.closeDocument(uri);
    instance.closeDocument(otherUri);
    globalTokenCache.delete(uri);
    globalTokenCache.delete(otherUri);
  });

  async function evaluate(text: string) {
    await parser.parse({ text, uri, languageId: 'googlesql', version: 1 });
    return instance.evaluate(text, uri);
  }

  it('returns no diagnostics when disabled or no token cache is available', () => {
    expect(instance.evaluate('select NULL;')).to.equal(null);
    expect(instance.evaluate('select NULL;', uri)).to.equal(null);
    instance.enabled = false;
    expect(instance.evaluate('select NULL;', uri)).to.equal(null);
    expect(
      instance.createCodeAction(
        { uri },
        instance.createDiagnostic({
          start: { line: 0, character: 7 },
          end: { line: 0, character: 11 },
        }),
      ),
    ).to.deep.equal([]);
  });

  it('checks mixed-case literals, but not substrings, comments, strings or quoted identifiers', async () => {
    const diagnostics = await evaluate(
      "select True, Null, fAlSe, true_value, NULLABLE, 'TRUE', `NULL`; -- FALSE\n/* Null */\nselect '''True\nNULL''';\n",
    );
    expect(diagnostics).to.have.length(3);
    expect(diagnostics!.map((diagnostic) => globalTokenCache.get(uri)!.getText(diagnostic.range))).to.deep.equal([
      'True',
      'Null',
      'fAlSe',
    ]);
  });

  for (const [policy, source, expected] of [
    ['lower', 'select TRUE, Null, false;', 'select true, null, false;'],
    ['upper', 'select true, Null, FALSE;', 'select TRUE, NULL, FALSE;'],
    ['consistent', 'select TRUE, Null, false;', 'select TRUE, NULL, FALSE;'],
    ['consistent', 'select true, NULL, False;', 'select true, null, false;'],
    ['consistent', 'select True, NULL, false;', 'select true, null, false;'],
  ] satisfies [CapitalisationPolicy, string, string][]) {
    it(`provides quick fixes and Fix All for ${policy}: ${source}`, async () => {
      instance = new Literals(
        {
          ...defaultSettings,
          rules: { CP04: { options: { capitalisation_policy: policy } } },
        },
        0,
      );
      const diagnostics = await evaluate(source);
      const edits = diagnostics!.map((diagnostic) => {
        const actions = instance.createCodeAction({ uri }, diagnostic);
        expect(actions.map((action) => action.kind)).to.have.members([
          CodeActionKind.QuickFix,
          CodeActionKind.SourceFixAll,
        ]);
        return actions[0].edit!.changes![uri][0];
      });
      expect(TextDocument.applyEdits(TextDocument.create(uri, 'googlesql', 1, source), edits)).to.equal(expected);
      expect(await evaluate(expected)).to.equal(null);
    });
  }

  it('infers consistent casing afresh after edits and independently per document', async () => {
    instance = new Literals(
      {
        ...defaultSettings,
        rules: { CP04: { options: { capitalisation_policy: 'consistent' } } },
      },
      0,
    );
    expect(await evaluate('select TRUE, NULL;')).to.equal(null);
    await parser.parse({ text: 'select true, null;', uri: otherUri, languageId: 'googlesql', version: 1 });
    expect(instance.evaluate('select true, null;', otherUri)).to.equal(null);
    expect(await evaluate('select TRUE, NULL;')).to.equal(null);
    expect(await evaluate('select true, null;')).to.equal(null);
    const diagnostics = await evaluate('-- TRUE\nselect null, TRUE;');
    expect(diagnostics).to.have.length(1);
    instance.closeDocument(uri);
    expect(instance.createCodeAction({ uri }, diagnostics![0])).to.deep.equal([]);
  });
});
