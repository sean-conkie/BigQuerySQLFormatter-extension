import { expect } from 'chai';
import sinon from 'sinon';
import {
  CancellationTokenSource,
  CodeActionKind,
  LSPErrorCodes,
  Range,
  type TextEdit,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../formatting';
import { Linter, sourceFixAllKind } from '../linter/linter';
import { globalTokenCache } from '../linter/parser/tokenCache';
import { defaultSettings } from '../settings';
import type { CapitalisationPolicy } from '../ruleOptions';

describe('Formatting and document fixes', () => {
  const uri = 'file:///formatting.bqsql';
  const document = (text: string) => TextDocument.create(uri, 'googlesql', 1, text);

  afterEach(() => {
    sinon.restore();
    globalTokenCache.delete(uri);
  });

  for (const [policy, expected] of [
    ['lower', 'select true, null, false;\n'],
    ['upper', 'select TRUE, NULL, FALSE;\n'],
    ['consistent', 'select TRUE, NULL, FALSE;\n'],
  ] satisfies [CapitalisationPolicy, string][]) {
    it(`uses ${policy} in combined Fix All and idempotent formatting`, async () => {
      const source = document('select TRUE, Null, false;\n');
      const settings = {
        ...defaultSettings,
        rules: { CP04: { options: { capitalisation_policy: policy } } },
      };
      const actions = await createDocumentCodeActions(source, settings, {
        textDocument: { uri },
        range: Range.create(0, 0, 0, 0),
        context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
      });
      expect(TextDocument.applyEdits(source, actions[0].edit!.changes![uri])).to.equal(expected);
      expect(TextDocument.applyEdits(source, await formatDocument(source, settings))).to.equal(expected);
      expect(await formatDocument(document(expected), settings)).to.deep.equal([]);
    });
  }

  for (const eol of ['\n', '\r\n', '\r']) {
    it(`formats every fixable issue idempotently with ${JSON.stringify(eol)} line endings`, async () => {
      const source = document(`select t.col  ${eol}  from dataset.table as t${eol} where t.col != NULL;`);
      const formatted = TextDocument.applyEdits(source, await formatDocument(source, defaultSettings));
      expect(formatted).to.equal(`select t.col${eol}  from dataset.table t${eol} where t.col is not null;${eol}`);
      expect(await formatDocument(document(formatted), defaultSettings)).to.deep.equal([]);
    });
  }

  it('formats beyond the published diagnostic limit, including a zero limit', async () => {
    const source = document('select a = NULL, b = NULL;\n');
    for (const maxNumberOfProblems of [0, 1]) {
      const edits = await formatDocument(source, { ...defaultSettings, maxNumberOfProblems });
      expect(TextDocument.applyEdits(source, edits)).to.equal('select a is null, b is null;\n');
    }
  });

  it('honors disabled rules, groups and noqa without changing strings or comments', async () => {
    const source = document("select 'TRUE', a = NULL; -- noqa: CV05\nselect b = NULL;\n-- FALSE\n");
    const edits = await formatDocument(source, {
      ...defaultSettings,
      rules: { groups: { capitalisation: false } },
    });
    expect(TextDocument.applyEdits(source, edits)).to.equal(
      "select 'TRUE', a = NULL; -- noqa: CV05\nselect b is NULL;\n-- FALSE\n",
    );
  });

  it('formats only edits fully inside a selection and tracks its end across passes', async () => {
    const source = document('select a = NULL;\nselect b = NULL;\nselect c = NULL;\n');
    const range = Range.create(1, 0, 2, 0);
    const edits = await formatDocument(source, defaultSettings, range);
    expect(edits).to.have.length(1);
    expect(edits[0].range).to.deep.equal(range);
    const fixed = TextDocument.applyEdits(source, edits);
    expect(fixed).to.equal('select a = NULL;\nselect b is null;\nselect c = NULL;\n');
    expect(await formatDocument(document(fixed), defaultSettings, range)).to.deep.equal([]);
  });

  it('does not apply fixes crossing selection boundaries', async () => {
    const source = document('select a = NULL;\n');
    expect(await formatDocument(source, defaultSettings, Range.create(0, 11, 0, 13))).to.deep.equal([]);
  });

  it('returns no edits for clean, empty, comment-only and non-fixable input', async () => {
    for (const text of ['select a;\n', '', '-- hello\n', 'select t.*\n  from dataset.table t;\n']) {
      expect(await formatDocument(document(text), defaultSettings), text).to.deep.equal([]);
    }
  });

  it('builds one document-wide fix-all even when context diagnostics are empty', async () => {
    const source = document('select a = null, b = null;\n');
    const actions = await createDocumentCodeActions(
      source,
      { ...defaultSettings, maxNumberOfProblems: 0 },
      {
        textDocument: { uri },
        range: Range.create(0, 0, 0, 0),
        context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
      },
    );
    expect(actions).to.have.length(1);
    expect(actions[0].kind).to.equal(sourceFixAllKind);
    expect(TextDocument.applyEdits(source, actions[0].edit!.changes![uri])).to.equal('select a is null, b is null;\n');
    expect(actions[0].diagnostics).to.have.length(2);
    for (const diagnostic of actions[0].diagnostics ?? []) {
      for (const related of diagnostic.relatedInformation ?? []) expect(related.location.uri).to.equal(uri);
    }
  });

  it('preserves per-diagnostic quick fixes', async () => {
    const source = document('select a = null, b = null;\n');
    const diagnostics = await new Linter(defaultSettings).verify({
      uri,
      languageId: source.languageId,
      version: 1,
      text: source.getText(),
    });
    const diagnostic = diagnostics.find((entry) => String(entry.code).startsWith('CV05:'))!;
    const actions = await createDocumentCodeActions(source, defaultSettings, {
      textDocument: { uri },
      range: diagnostic.range,
      context: { diagnostics: [diagnostic], only: [CodeActionKind.QuickFix] },
    });
    expect(actions).to.have.length(1);
    expect(actions[0].diagnostics).to.deep.equal([diagnostic]);
    expect(TextDocument.applyEdits(source, actions[0].edit!.changes![uri])).to.equal('select a is null, b = null;\n');
  });

  it('does not let rule fixes mutate request diagnostics or expand their ranges twice', async () => {
    const source = document('select t.col\n  from dataset.table as t;\n');
    const diagnostics = await new Linter(defaultSettings).verify({
      uri,
      languageId: source.languageId,
      version: 1,
      text: source.getText(),
    });
    const original = structuredClone(diagnostics);
    const params = {
      textDocument: { uri },
      range: Range.create(0, 0, 2, 0),
      context: { diagnostics },
    };
    const first = await createDocumentCodeActions(source, defaultSettings, params);
    const second = await createDocumentCodeActions(source, defaultSettings, params);
    expect(first).to.deep.equal(second);
    expect(diagnostics).to.deep.equal(original);
    for (const action of first) {
      expect(TextDocument.applyEdits(source, action.edit!.changes![uri])).to.equal(
        'select t.col\n  from dataset.table t;\n',
      );
    }
  });

  it('does not mutate live document caches and cleans up temporary caches', async () => {
    const source = document('select a = NULL;\n');
    await new Linter(defaultSettings).verify({ uri, languageId: 'googlesql', version: 1, text: source.getText() });
    const cache = globalTokenCache.get(uri);
    const keys = [...globalTokenCache.keys()];
    await formatDocument(source, defaultSettings);
    expect(globalTokenCache.get(uri)).to.equal(cache);
    expect(cache!.getText()).to.equal(source.getText());
    expect([...globalTokenCache.keys()]).to.deep.equal(keys);
  });

  it('cancels formatting without returning partial edits or leaking caches', async () => {
    const source = new CancellationTokenSource();
    const keys = [...globalTokenCache.keys()];
    source.cancel();
    try {
      await formatDocument(document('select a = NULL;\n'), defaultSettings, undefined, source.token);
      expect.fail('Expected cancellation');
    } catch (error) {
      expect(error).to.have.property('code', LSPErrorCodes.RequestCancelled);
    } finally {
      source.dispose();
    }
    expect([...globalTokenCache.keys()]).to.deep.equal(keys);
  });

  for (const behavior of ['cycling', 'growing', 'changing']) {
    for (const operation of ['formatting', 'selection', 'Fix All']) {
      it(`recovers and reports ${behavior} rules during ${operation}`, async () => {
        const keys = [...globalTokenCache.keys()];
        let calls = 0;
        const warning = sinon.spy();
        const unstable = { code: 'LT15: comparison_operators', range: Range.create(0, 0, 0, 1), message: 'Test' };
        const stable = { code: 'CP01: keywords', range: Range.create(0, 2, 0, 3), message: 'Test' };
        sinon
          .stub(Linter.prototype, 'verify')
          .callsFake(async (source) => [unstable, ...(source.text.endsWith('z') ? [stable] : [])]);
        sinon.stub(Linter.prototype, 'createCodeActions').callsFake(async (params) => {
          const diagnostics = params.context.diagnostics;
          return [
            {
              title: 'Test',
              kind: sourceFixAllKind,
              diagnostics,
              edit: {
                changes: {
                  [params.textDocument.uri]: diagnostics.flatMap((diagnostic) =>
                    diagnostic === stable
                      ? [{ range: stable.range, newText: 'Z' }]
                      : [
                          {
                            range: Range.create(0, 0, 0, 1),
                            newText:
                              behavior === 'cycling'
                                ? ++calls % 2
                                  ? 'b'
                                  : 'a'
                                : behavior === 'growing'
                                  ? `a${' '.repeat(++calls)}`
                                  : String.fromCharCode(1000 + calls++),
                          },
                        ],
                  ),
                },
              },
            },
          ];
        });
        const source = document('a z');
        let edits: TextEdit[];
        if (operation === 'Fix All') {
          const actions = await createDocumentCodeActions(
            source,
            defaultSettings,
            {
              textDocument: { uri },
              range: Range.create(0, 0, 0, 3),
              context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
            },
            undefined,
            warning,
          );
          edits = actions[0].edit!.changes![uri];
        } else {
          edits = await formatDocument(
            source,
            defaultSettings,
            operation === 'selection' ? Range.create(0, 0, 0, 3) : undefined,
            undefined,
            warning,
          );
        }
        expect(TextDocument.applyEdits(source, edits)).to.equal('a Z');
        expect(warning.calledOnce).to.equal(true);
        expect(warning.firstCall.args[0]).to.include('LT15').and.not.include('CP01');
        expect([...globalTokenCache.keys()]).to.deep.equal(keys);
      });
    }
  }

  it('fails explicitly if unstable fixes have no rule attribution', async () => {
    sinon.stub(Linter.prototype, 'verify').resolves([]);
    let calls = 0;
    sinon.stub(Linter.prototype, 'createCodeActions').callsFake(async (params) => [
      {
        title: 'Unattributed fix',
        kind: sourceFixAllKind,
        edit: {
          changes: {
            [params.textDocument.uri]: [
              {
                range: Range.create(0, 0, 0, 1),
                newText: ++calls % 2 ? 'b' : 'a',
              },
            ],
          },
        },
      },
    ]);
    try {
      await formatDocument(document('a'), defaultSettings);
      expect.fail('Expected an unattributed convergence failure');
    } catch (error) {
      expect(error).to.have.property('code', LSPErrorCodes.RequestFailed);
      expect(error).to.have.property('message').that.includes('rule codes');
    }
  });
});
