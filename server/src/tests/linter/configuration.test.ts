import { expect } from 'chai';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { Linter } from '../../linter/linter';
import { defaultSettings, type RulesSettings } from '../../settings';
import { globalTokenCache } from '../../linter/parser/tokenCache';
import { closeTextDocument, validateTextDocument, getDocumentLinter } from '../../validate';
import { spy } from 'sinon';

describe('Configured linting', () => {
  const uri = 'rule-configuration.sql';
  const document = { uri, languageId: 'googlesql', version: 1, text: 'select a = null;\n' };
  const isCV05 = (code: string | number | undefined) => String(code).startsWith('CV05:');

  afterEach(() => closeTextDocument(uri));

  for (const [severity, expected] of [
    ['error', DiagnosticSeverity.Error],
    ['warning', DiagnosticSeverity.Warning],
    ['information', DiagnosticSeverity.Information],
    ['hint', DiagnosticSeverity.Hint],
  ] as const) {
    it(`applies ${severity} severity and restores defaults on the same document`, async () => {
      const result = await validateTextDocument(document, { ...defaultSettings, rules: { CV05: { severity } } });
      expect(result.diagnostics.find((diagnostic) => isCV05(diagnostic.code))?.severity).to.equal(expected);
      const reset = await validateTextDocument({ ...document, version: 2 }, defaultSettings);
      expect(reset.diagnostics.find((diagnostic) => isCV05(diagnostic.code))?.severity).to.equal(
        DiagnosticSeverity.Warning,
      );
    });
  }

  for (const rules of [
    { CV05: { enabled: false } },
    { CV05: { severity: 'off' } },
    { exclude: ['CV05'] },
    { groups: { convention: false } },
  ] satisfies RulesSettings[]) {
    it(`disables evaluation and stale code actions for ${JSON.stringify(rules)}`, async () => {
      const initial = await validateTextDocument(document, defaultSettings);
      const linter = getDocumentLinter(uri, { ...defaultSettings, rules });
      const rule = linter.regexRules.find((entry) => entry.code === 'CV05')!;
      const evaluate = spy(rule, 'evaluate');
      try {
        const result = await linter.verify({ ...document, version: 2 });
        expect(result.some((diagnostic) => isCV05(diagnostic.code))).to.equal(false);
        expect(evaluate.called).to.equal(false);
        expect(
          await linter.createCodeActions({
            textDocument: { uri },
            range: initial.diagnostics[0].range,
            context: { diagnostics: initial.diagnostics.filter((diagnostic) => isCV05(diagnostic.code)) },
          }),
        ).to.deep.equal([]);
      } finally {
        evaluate.restore();
      }
    });
  }

  it('disables parser rules and restores their diagnostics when re-enabled', async () => {
    const text = 'select t.col1,\nt.col2,\n  from dataset.table t;\n';
    const initial = await validateTextDocument({ ...document, text }, defaultSettings);
    expect(initial.diagnostics.some((diagnostic) => String(diagnostic.code).startsWith('LT02:'))).to.equal(true);
    const disabled = await validateTextDocument(
      { ...document, text, version: 2 },
      {
        ...defaultSettings,
        rules: { LT02: { enabled: false } },
      },
    );
    expect(disabled.diagnostics.some((diagnostic) => String(diagnostic.code).startsWith('LT02:'))).to.equal(false);
    const restored = await validateTextDocument({ ...document, text, version: 3 }, defaultSettings);
    expect(restored.diagnostics).to.deep.equal(initial.diagnostics);
  });

  it('applies exclusions before counting the diagnostic limit', async () => {
    const linter = new Linter({
      maxNumberOfProblems: 1,
      rules: { groups: { layout: false, aliasing: false }, CV05: { enabled: false } },
    });
    const result = await linter.verify({ ...document, text: 'select a = null, nvl(b, 0);\n' });
    expect(result).to.have.length(1);
    expect(result[0].code).to.equal('CV02: coalesce');
  });

  it('supports disable/enable regions, all rules, and line suppression without enabling configured-off rules', async () => {
    const linter = new Linter(defaultSettings);
    const text = [
      '-- noqa: disable=CV05',
      'select a = null;',
      '-- noqa: enable=CV05',
      'select b = null;',
      '-- noqa: disable=all',
      'select c = null;',
      '-- noqa: enable=CV05',
      'select d = null;',
      'select e = null; -- noqa: CV05',
      '-- noqa: enable=all',
      'select f = null;',
      "select '-- noqa: disable=CV05' as txt;",
      'select g = null;',
      '/* -- noqa: disable=CV05 */',
      'select h = null;',
    ].join('\n');
    const result = await linter.verify({ ...document, text });
    expect(
      result.filter((diagnostic) => isCV05(diagnostic.code)).map((diagnostic) => diagnostic.range.start.line),
    ).to.deep.equal([3, 7, 10, 12, 14]);
    linter.settings = { ...defaultSettings, rules: { CV05: { enabled: false } } };
    expect(
      (await linter.verify({ ...document, text, version: 2 })).some((diagnostic) => isCV05(diagnostic.code)),
    ).to.equal(false);
  });

  it('updates scoped suppression after incremental edits and filters stale fixes', async () => {
    const linter = new Linter(defaultSettings);
    const initial = await linter.verify(document);
    const changed = await linter.verifyChanges({
      textDocument: { uri, version: 2 },
      contentChanges: [{ text: '-- NOQA: disable=cv05, CV01\nselect a = null;\n' }],
    });
    expect(changed.some((diagnostic) => isCV05(diagnostic.code))).to.equal(false);
    const oldDiagnostic = initial.find((diagnostic) => isCV05(diagnostic.code))!;
    const range = { start: { line: 1, character: 9 }, end: { line: 1, character: 15 } };
    expect(
      await linter.createCodeActions({
        textDocument: { uri },
        range,
        context: { diagnostics: [{ ...oldDiagnostic, range }] },
      }),
    ).to.deep.equal([]);
    const restored = await linter.verifyChanges({
      textDocument: { uri, version: 3 },
      contentChanges: [{ text: document.text }],
    });
    expect(restored).to.deep.equal(initial);
    expect(globalTokenCache.get(uri)).not.to.equal(undefined);
  });
});
