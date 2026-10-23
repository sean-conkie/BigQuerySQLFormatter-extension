import { expect } from 'chai';
import { CodeActionKind, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Linter } from '../../linter/linter';
import { NotEqual } from '../../linter/rules/convention/CV01';
import { defaultSettings } from '../../settings';

describe('Code action overlap handling', () => {
  const uri = 'code-actions.sql';
  const rule = new NotEqual(defaultSettings, 0);
  const cases = [
    {
      name: 'overlapping ranges on one line',
      ranges: [Range.create(0, 1, 0, 4), Range.create(0, 3, 0, 5)],
      kept: [1],
      fixed: 'abc!=f\nabcdef\nabcdef\n',
    },
    {
      name: 'duplicate ranges',
      ranges: [Range.create(0, 1, 0, 4), Range.create(0, 1, 0, 4)],
      kept: [0],
      fixed: 'a!=ef\nabcdef\nabcdef\n',
    },
    {
      name: 'adjacent ranges',
      ranges: [Range.create(0, 1, 0, 3), Range.create(0, 3, 0, 5)],
      kept: [1, 0],
      fixed: 'a!=!=f\nabcdef\nabcdef\n',
    },
    {
      name: 'ranges on separate lines supplied out of order',
      ranges: [Range.create(0, 1, 0, 3), Range.create(2, 1, 2, 3), Range.create(1, 1, 1, 3)],
      kept: [1, 2, 0],
      fixed: 'a!=def\na!=def\na!=def\n',
    },
    {
      name: 'nested multiline ranges',
      ranges: [Range.create(0, 1, 2, 5), Range.create(1, 1, 1, 3)],
      kept: [1],
      fixed: 'abcdef\na!=def\nabcdef\n',
    },
  ];

  for (const { name, ranges, kept, fixed } of cases) {
    it(`keeps fix-all edits disjoint and preserves individual quick fixes for ${name}`, async () => {
      const linter = new Linter(defaultSettings);
      linter.regexRules = [rule];
      linter.parserRules = [];
      const diagnostics = ranges.map((range) => rule.createDiagnostic(range, uri));
      const actions = await linter.createCodeActions({
        textDocument: { uri },
        range: Range.create(0, 0, 3, 0),
        context: { diagnostics },
      });
      const fixAll = actions.filter((action) => action.kind === CodeActionKind.SourceFixAll);
      expect(fixAll.map((action) => action.diagnostics)).to.deep.equal(kept.map((index) => [diagnostics[index]]));
      expect(
        actions.filter((action) => action.kind === CodeActionKind.QuickFix).map((action) => action.diagnostics),
      ).to.deep.equal(diagnostics.map((diagnostic) => [diagnostic]));
      const edits = fixAll.flatMap((action) => action.edit?.changes?.[uri] ?? []);
      expect(
        TextDocument.applyEdits(TextDocument.create(uri, 'googlesql', 1, 'abcdef\nabcdef\nabcdef\n'), edits),
      ).to.equal(fixed);
    });
  }

  it('returns no actions for unknown or non-fixable rules', async () => {
    const linter = new Linter(defaultSettings);
    const nonFixable = [...linter.regexRules, ...linter.parserRules].find((entry) => !entry.is_fix_compatible);
    if (!nonFixable) throw new Error('Expected a non-fixable rule');
    const range = Range.create(0, 0, 0, 2);
    expect(
      await linter.createCodeActions({
        textDocument: { uri },
        range,
        context: {
          diagnostics: [
            { ...rule.createDiagnostic(range), code: 'UNKNOWN: unknown' },
            nonFixable.createDiagnostic(range),
          ],
        },
      }),
    ).to.deep.equal([]);
  });
});
