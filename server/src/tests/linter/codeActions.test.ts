import { expect } from 'chai';
import { CodeActionKind, Range, type Diagnostic } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Linter, sourceFixAllKind } from '../../linter/linter';
import { NotEqual } from '../../linter/rules/convention/CV01';
import { defaultSettings } from '../../settings';
import sinon from 'sinon';
import { globalTokenCache } from '../../linter/parser/tokenCache';

describe('Diagnostic helper actions', () => {
  const uri = 'file:///diagnostic-actions.bqsql';
  const linter = () => new Linter(defaultSettings);
  const document = (text: string) => TextDocument.create(uri, 'googlesql', 1, text);
  const actionsFor = (instance: Linter, diagnostics: Diagnostic[], only: string = CodeActionKind.QuickFix) =>
    instance.createCodeActions({
      textDocument: { uri },
      range: Range.create(0, 0, 20, 0),
      context: { diagnostics, only: [only] },
    });
  const verify = (instance: Linter, text: string) =>
    instance.verify({ uri, languageId: 'googlesql', version: 1, text });

  afterEach(() => globalTokenCache.delete(uri));

  for (const eol of ['\n', '\r\n', '\r']) {
    for (const [suffix, replacement] of [
      ['', '  -- noqa: CV05'],
      [' -- noqa: LT01, ST01', ' -- noqa: LT01, ST01, CV05'],
      [' --NoQa: lt01', ' --NoQa: lt01, CV05'],
      [' -- noqa: A, B  ', ' -- noqa: A, B, CV05  '],
    ]) {
      it(`suppresses only the selected rule with ${JSON.stringify(suffix)} and ${JSON.stringify(eol)}`, async () => {
        const instance = linter();
        const text = `select a = NULL;${suffix}${eol}select b = NULL;${eol}`;
        const diagnostics = await verify(instance, text);
        const actions = await actionsFor(instance, diagnostics);
        const action = actions.find(
          (entry) => entry.title === 'Disable CV05 for this line.' && entry.diagnostics?.[0].range.start.line === 0,
        )!;
        expect(action).not.to.equal(undefined);
        expect(action.kind).to.equal(CodeActionKind.QuickFix);
        const edited = TextDocument.applyEdits(document(text), action.edit!.changes![uri]);
        expect(edited).to.equal(`select a = NULL;${replacement}${eol}select b = NULL;${eol}`);
        expect(await verify(instance, edited)).to.deep.equal(
          diagnostics.filter(
            (diagnostic) => !(String(diagnostic.code).startsWith('CV05:') && diagnostic.range.start.line === 0),
          ),
        );
      });
    }
  }

  for (const suffix of [
    ' -- noqa',
    ' -- ordinary comment',
    ' # comment',
    ' -- noqa: disable=ST01',
    ' -- noqa: enable=ST01',
    ' /* open\ncomment */',
    " '''open\nstring'''",
    ' """open\nstring"""',
    " r'''open\nstring'''",
    " b'''open\nbytes'''",
    ' `open\nidentifier`',
    " '''unterminated",
    ' -- noqa: invalid prose',
  ]) {
    it(`does not append suppression inside ${JSON.stringify(suffix)}`, async () => {
      const instance = linter();
      await verify(instance, `select a = null${suffix}\n`);
      const diagnostic = new NotEqual(defaultSettings, 0).createDiagnostic(Range.create(0, 0, 0, 6), uri);
      const actions = await actionsFor(instance, [diagnostic]);
      expect(actions.some((action) => action.title.startsWith('Disable '))).to.equal(false);
    });
  }

  for (const suffix of [" 'closed'", " '''closed'''", ' /* closed */', ' `closed`', " '-- not a comment'"]) {
    it(`allows suppression after ${suffix}`, async () => {
      const instance = linter();
      await verify(instance, `select a = null,${suffix}\n`);
      const diagnostic = new NotEqual(defaultSettings, 0).createDiagnostic(Range.create(0, 0, 0, 6), uri);
      expect((await actionsFor(instance, [diagnostic])).some((action) => action.title.startsWith('Disable '))).to.equal(
        true,
      );
    });
  }

  it('offers helper actions for every rule, including rules without a fix', async () => {
    const instance = linter();
    await verify(instance, 'select a;\n');
    for (const rule of [...instance.regexRules, ...instance.parserRules]) {
      instance.settings = { ...defaultSettings, rules: { [rule.code]: { enabled: true } } };
      const diagnostic = rule.createDiagnostic(Range.create(0, 0, 0, 6), uri);
      const actions = await actionsFor(instance, [diagnostic]);
      expect(actions.map((action) => action.title)).to.include(`Disable ${rule.code} for this line.`);
      const docs = actions.find((action) => action.title === `Show documentation for ${rule.code}.`)!;
      expect(docs.command).to.deep.equal({
        title: docs.title,
        command: 'bigquerySQLFormatter.openRuleDocumentation',
        arguments: [diagnostic.codeDescription!.href],
      });
    }
  });

  it('deduplicates suppression by start line and code and puts helpers after real fixes', async () => {
    const instance = linter();
    const diagnostics = await verify(instance, 'select a = null, b = null;\n');
    const selected = diagnostics.filter((diagnostic) => String(diagnostic.code).startsWith('CV05:'));
    expect(selected).to.have.length(2);
    const actions = await actionsFor(instance, selected);
    expect(actions.filter((action) => action.title === 'Disable CV05 for this line.')).to.have.length(1);
    expect(actions.slice(0, 2).every((action) => !/^(Disable |Show documentation)/.test(action.title))).to.equal(true);
    const fixAll = await actionsFor(instance, selected, CodeActionKind.SourceFixAll);
    expect(fixAll).to.have.length(1);
    expect(TextDocument.applyEdits(document('select a = null, b = null;\n'), fixAll[0].edit!.changes![uri])).to.equal(
      'select a is null, b is null;\n',
    );
  });

  it('offers suppression for pipe diagnostics and for a diagnostic spanning lines', async () => {
    for (const text of ['from ds.t |> select a;\n', '\nselect a;\n']) {
      const instance = linter();
      const diagnostics = await verify(instance, text);
      const diagnostic = diagnostics.find((entry) => /^(LT91|LT13):/.test(String(entry.code)))!;
      expect(diagnostic).not.to.equal(undefined);
      const code = String(diagnostic.code).split(':', 1)[0];
      const action = (await actionsFor(instance, [diagnostic])).find(
        (entry) => entry.title === `Disable ${code} for this line.`,
      )!;
      expect(action.edit!.changes![uri][0].range.start.line).to.equal(diagnostic.range.start.line);
      const edited = TextDocument.applyEdits(document(text), action.edit!.changes![uri]);
      expect((await verify(instance, edited)).some((entry) => entry.code === diagnostic.code)).to.equal(false);
    }
  });

  it('uses incoming lexical state on continued and empty literal/comment lines', async () => {
    for (const text of ["select '''open\n\nclosed''';\n", '/* open\n\nclosed */\n']) {
      const instance = linter();
      await verify(instance, text);
      const rule = new NotEqual(defaultSettings, 0);
      const diagnostic = rule.createDiagnostic(Range.create(1, 0, 1, 0), uri);
      expect((await actionsFor(instance, [diagnostic])).some((action) => action.title.startsWith('Disable '))).to.equal(
        false,
      );
    }
  });
});

describe('Code action overlap handling', () => {
  const uri = 'code-actions.sql';
  const rule = new NotEqual(defaultSettings, 0);
  const cases = [
    {
      name: 'a range overlapping a non-adjacent accepted edit',
      ranges: [Range.create(0, 0, 2, 5), Range.create(2, 1, 2, 3), Range.create(1, 1, 1, 3)],
      kept: [1, 2],
      fixed: 'abcdef\na!=def\na!=def\n',
    },
    {
      name: 'duplicate insertions',
      ranges: [Range.create(0, 1, 0, 1), Range.create(0, 1, 0, 1)],
      kept: [0],
      fixed: 'a!=bcdef\nabcdef\nabcdef\n',
    },
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
      const fixAll = actions.filter((action) => action.kind === sourceFixAllKind);
      expect(fixAll).to.have.length(1);
      expect(fixAll[0].diagnostics).to.deep.equal(kept.map((index) => diagnostics[index]));
      expect(
        actions
          .filter((action) => action.kind === CodeActionKind.QuickFix && !action.command)
          .map((action) => action.diagnostics),
      ).to.deep.equal(diagnostics.map((diagnostic) => [diagnostic]));
      const edits = fixAll.flatMap((action) => action.edit?.changes?.[uri] ?? []);
      expect(
        TextDocument.applyEdits(TextDocument.create(uri, 'googlesql', 1, 'abcdef\nabcdef\nabcdef\n'), edits),
      ).to.equal(fixed);
    });
  }

  it('uses actual edit ranges and keeps multi-edit fixes atomic', async () => {
    const linter = new Linter(defaultSettings);
    const localRule = new NotEqual(defaultSettings, 0);
    linter.regexRules = [localRule];
    linter.parserRules = [];
    const diagnostics = [Range.create(0, 0, 0, 1), Range.create(0, 2, 0, 3), Range.create(0, 4, 0, 5)].map((range) =>
      localRule.createDiagnostic(range),
    );
    const stub = sinon.stub(localRule, 'createCodeAction');
    const replacements = [
      [{ range: Range.create(0, 1, 0, 4), newText: 'A' }],
      [
        { range: Range.create(0, 3, 0, 5), newText: 'B' },
        { range: Range.create(1, 0, 1, 1), newText: 'B' },
      ],
      [{ range: Range.create(0, 1, 0, 2), newText: 'C' }],
    ];
    diagnostics.forEach((diagnostic, index) => {
      stub.withArgs({ uri }, diagnostic).returns([
        {
          title: 'Fix',
          kind: CodeActionKind.SourceFixAll,
          diagnostics: [diagnostic],
          edit: { changes: { [uri]: replacements[index] } },
        },
      ]);
    });
    const actions = await linter.createCodeActions({
      textDocument: { uri },
      range: Range.create(0, 0, 2, 0),
      context: { diagnostics },
    });
    expect(actions.filter((action) => action.kind === sourceFixAllKind)).to.have.length(1);
    expect(actions[0].edit?.changes?.[uri]).to.deep.equal([...replacements[1], ...replacements[2]]);
  });

  for (const only of [
    CodeActionKind.Source,
    CodeActionKind.SourceFixAll,
    sourceFixAllKind,
    CodeActionKind.QuickFix,
    'source.fixAll.other',
  ]) {
    it(`respects context.only for ${only}`, async () => {
      const linter = new Linter(defaultSettings);
      const range = Range.create(0, 0, 0, 2);
      const actions = await linter.createCodeActions({
        textDocument: { uri },
        range,
        context: { diagnostics: [rule.createDiagnostic(range)], only: [only] },
      });
      expect(actions.map((action) => action.kind)).to.deep.equal(
        only === 'source.fixAll.other' ? [] : only === CodeActionKind.QuickFix ? [only, only] : [sourceFixAllKind],
      );
    });
  }

  it('ignores unknown rules and offers only documentation for non-fixable rules without cached text', async () => {
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
    ).to.have.length(1);
  });
});
