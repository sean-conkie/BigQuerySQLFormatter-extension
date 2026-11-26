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
import { defaultSettings, type ServerSettings } from '../settings';
import type { CapitalisationPolicy } from '../ruleOptions';
import { initialiseRules } from '../linter/rules/rules';

describe('Safe diagnostic-only rule fixes (#14)', () => {
  const uri = 'file:///safe-fixes.bqsql';
  const config = (code: string): ServerSettings => ({
    ...defaultSettings,
    rules: {
      exclude: initialiseRules(defaultSettings, 0)
        .map((rule) => rule.code)
        .filter((rule) => rule !== code),
    },
  });
  afterEach(() => globalTokenCache.delete(uri));

  const cases = [
    ['LT09', 'select a, b from foo;', 'select a,\n       b\nfrom foo;'],
    ['LT10', 'select\n  distinct a from foo;', 'select distinct\n  a from foo;'],
    ['LT10', 'select\n  as struct a from foo;', 'select as struct\n  a from foo;'],
    ['LT10', 'from foo |> select\n  all a;', 'from foo |> select all\n  a;'],
    ['LT11', 'select a from t union all select a from u;', 'select a from t\nunion all\nselect a from u;'],
    [
      'LT11',
      'select a from t intersect distinct select a from u;',
      'select a from t\nintersect distinct\nselect a from u;',
    ],
    ['LT11', 'select a from t except distinct select a from u;', 'select a from t\nexcept distinct\nselect a from u;'],
    ['AL05', 'select a from foo f;', 'select f.a from foo f;'],
    ['ST08', 'select distinct(a), b from foo;', 'select distinct a, b from foo;'],
    ['ST08', 'from foo |> select distinct(a), b;', 'from foo |> select distinct a, b;'],
  ];
  for (const [code, input, output] of cases) {
    for (const eol of ['\n', '\r\n', '\r']) {
      it(`${code} offers Quick Fix, Fix All and idempotent formatting with ${JSON.stringify(eol)}: ${input}`, async () => {
        const text = `${input.replaceAll('\n', eol)}${eol}`;
        const expected = `${output.replaceAll('\n', eol)}${eol}`;
        const document = TextDocument.create(uri, 'googlesql', 1, text);
        const settings = config(code);
        const linter = new Linter(settings);
        try {
          const diagnostics = await linter.verify({ uri, languageId: 'googlesql', version: 1, text });
          expect(diagnostics).to.have.length(1);
          const actions = await linter.createCodeActions({
            textDocument: { uri },
            range: diagnostics[0].range,
            context: { diagnostics, only: [CodeActionKind.QuickFix] },
          });
          const fix = actions.find((action) => action.edit && !action.title.includes('Disable'));
          expect(fix, 'Quick Fix').not.to.equal(undefined);
          expect(TextDocument.applyEdits(document, fix!.edit!.changes![uri])).to.equal(expected);
          expect(TextDocument.applyEdits(document, await formatDocument(document, settings))).to.equal(expected);
          const params = {
            textDocument: { uri },
            range: Range.create(0, 0, 100, 0),
            context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
          };
          const all = await createDocumentCodeActions(document, settings, params);
          expect(TextDocument.applyEdits(document, all[0].edit!.changes![uri])).to.equal(expected);
          const fixed = TextDocument.create(uri, 'googlesql', 2, expected);
          expect(await formatDocument(fixed, settings)).to.deep.equal([]);
          expect(await createDocumentCodeActions(fixed, settings, params)).to.deep.equal([]);
        } finally {
          linter.closeDocument(uri);
        }
      });
    }
  }

  for (const [code, text] of [
    ['LT09', 'select a, /* keep */ b from foo;'],
    ['LT10', 'select /* keep */\n distinct a from foo;'],
    ['AL05', 'select a from foo f join bar b on f.id = b.id;'],
    ['AL05', 'select x from unnest([1]) x;'],
    ['ST08', 'select distinct (a, b) from foo;'],
    ['ST08', 'select distinct (a) + 1 from foo;'],
    ['LT11', 'from foo |> union all (select a from bar);'],
    ['AL05', 'select @p, @@dataset_id, x from unnest([1]) x;'],
    ['AL05', 'select t.a as label from foo t order by label;'],
    ['LT09', "select 'a,b', `a,b`, func(a, b), struct(a, b), [a,b], * except(a,b) replace(func(a,b) as c) from foo;"],
    ['LT09', 'select a, from foo;'],
    ['ST08', 'select distinct (a) and b from foo;'],
    ['ST08', 'select distinct () from foo;'],
    ['ST08', 'select distinct (select a from foo);'],
    ['LT10', 'select\n as /* keep */ struct a from foo;'],
  ]) {
    it(`${code} leaves unsafe or inapplicable SQL alone: ${text}`, async () => {
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      if (code === 'LT09' && text.includes('func')) {
        const fixed = TextDocument.applyEdits(document, await formatDocument(document, config(code)));
        expect(fixed).to.equal(
          "select 'a,b',\n       `a,b`,\n       func(a, b),\n       struct(a, b),\n       [a,b],\n       * except(a,b) replace(func(a,b) as c)\nfrom foo;",
        );
      } else expect(await formatDocument(document, config(code))).to.deep.equal([]);
    });
  }

  for (const [code, text, expected] of [
    ['LT09', 'select a\n     , b, c from foo;', 'select a\n     , b\n     , c\nfrom foo;'],
    [
      'LT09',
      'from foo |> select a, b |> extend c, d |> aggregate sum(a) as a, sum(b) as b group by c, d;',
      'from foo |> select a,\n                   b |> extend c,\n                                  d |> aggregate sum(a) as a,\n                                                    sum(b) as b group by c,\n                                                                                      d;',
    ],
    ['LT10', 'select\n  as value a from foo;', 'select as value\n  a from foo;'],
    [
      'LT11',
      'select a from t /* before */ union all /* after */ select a from u;',
      'select a from t /* before */ \nunion all /* after */ \nselect a from u;',
    ],
    [
      'LT11',
      'with c as (select a from t union all select a from u) select a from c;',
      'with c as (select a from t\n           union all\n           select a from u) select a from c;',
    ],
    [
      'LT11',
      'select a from t union all select a from u except distinct select a from v;',
      'select a from t\nunion all\nselect a from u\nexcept distinct\nselect a from v;',
    ],
    [
      'LT11',
      'with first as (select a from t),\nsecond as (select a from u union all select a from v) select a from second;',
      'with first as (select a from t),\nsecond as (select a from u\n           union all\n           select a from v) select a from second;',
    ],
    ['ST08', 'select distinct (func(a, b)), c from foo;', 'select distinct func(a, b), c from foo;'],
    ['ST08', 'select distinct (/* keep */ a), b from foo;', 'select distinct /* keep */ a, b from foo;'],
    ['AL05', 'select address.city from foo f;', 'select f.address.city from foo f;'],
    [
      'AL05',
      'select a from `Project.Dataset.Table` as `odd-alias`;',
      'select `odd-alias`.a from `Project.Dataset.Table` as `odd-alias`;',
    ],
    ['AL05', 'with c as (select a from foo f) select a from c;', 'with c as (select f.a from foo f) select a from c;'],
    ['AL05', 'select (select a from bar b) from foo f;', 'select (select b.a from bar b) from foo f;'],
    [
      'AL05',
      'select array_transform(items, x -> x + a), a from foo f;',
      'select array_transform(f.items, x -> x + f.a), f.a from foo f;',
    ],
  ]) {
    it(`${code} handles structural boundaries: ${text}`, async () => {
      const document = TextDocument.create(uri, 'googlesql', 1, text);
      const fixed = TextDocument.applyEdits(document, await formatDocument(document, config(code)));
      expect(fixed).to.equal(expected);
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, fixed), config(code))).to.deep.equal([]);
    });
  }

  for (const policy of ['consistent', 'qualified', 'unqualified']) {
    it(`AL05 and RF03 converge under ${policy}`, async () => {
      const document = TextDocument.create(uri, 'googlesql', 1, 'select a, f.b from foo f;\n');
      const settings = { ...defaultSettings, rules: { RF03: { options: { single_table_references: policy } } } };
      const warnings: string[] = [];
      const fixed = TextDocument.applyEdits(
        document,
        await formatDocument(document, settings, undefined, undefined, (message) => warnings.push(message)),
      );
      expect(fixed).to.equal(
        policy === 'unqualified' ? 'select a,\n       b\nfrom foo f;\n' : 'select f.a,\n       f.b\nfrom foo f;\n',
      );
      expect(warnings).to.deep.equal([]);
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, fixed), settings)).to.deep.equal([]);
    });
  }

  it('converges across all five fixes without retaining inline set-branch indentation', async () => {
    const document = TextDocument.create(
      uri,
      'googlesql',
      1,
      'select\n  distinct(a), b from foo f union all select f.a, f.b from foo f;\n',
    );
    const expected =
      'select distinct\n       f.a,\n       f.b\nfrom foo f\nunion all\nselect f.a,\n       f.b\nfrom foo f;\n';
    const warnings: string[] = [];
    expect(
      TextDocument.applyEdits(
        document,
        await formatDocument(document, defaultSettings, undefined, undefined, (message) => warnings.push(message)),
      ),
    ).to.equal(expected);
    expect(warnings).to.deep.equal([]);
    expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, expected), defaultSettings)).to.deep.equal([]);
  });

  it('aligns later targets with the first target after a SELECT modifier', async () => {
    const source = TextDocument.create(uri, 'googlesql', 1, 'select distinct a, b from foo;\n');
    const expected = 'select distinct a,\n                b\nfrom foo;\n';
    expect(TextDocument.applyEdits(source, await formatDocument(source, defaultSettings))).to.equal(expected);
    expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, expected), defaultSettings)).to.deep.equal([]);
  });

  for (const [code, input] of cases) {
    it(`${code} respects line and region suppression`, async () => {
      for (const text of [`${input} -- noqa: ${code}`, `-- noqa: disable=${code}\n${input}\n-- noqa: enable=${code}`]) {
        expect(await formatDocument(TextDocument.create(uri, 'googlesql', 1, text), config(code))).to.deep.equal([]);
      }

      for (const [code, input] of cases) {
        it(`${code} does not edit inside unsupported query blocks`, async () => {
          const text = `from input |> with c as (${input.replace(/;$/, '')}) |> select a;`;
          expect(await formatDocument(TextDocument.create(uri, 'googlesql', 1, text), config(code))).to.deep.equal([]);
        });
      }
    });
  }
});

describe('Formatting and document fixes', () => {
  const uri = 'file:///formatting.bqsql';
  const document = (text: string) => TextDocument.create(uri, 'googlesql', 1, text);

  afterEach(() => {
    sinon.restore();
    globalTokenCache.delete(uri);
  });

  for (const [policy, expected] of [
    ['lower', 'select true,\n       null,\n       false;\n'],
    ['upper', 'select TRUE,\n       NULL,\n       FALSE;\n'],
    ['consistent', 'select TRUE,\n       NULL,\n       FALSE;\n'],
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
      expect(TextDocument.applyEdits(source, edits)).to.equal('select a is null,\n       b is null;\n');
    }
  });

  it('honors disabled rules, groups and noqa without changing strings or comments', async () => {
    const source = document("select 'TRUE', a = NULL; -- noqa: CV05\nselect b = NULL;\n-- FALSE\n");
    const edits = await formatDocument(source, {
      ...defaultSettings,
      rules: { groups: { capitalisation: false } },
    });
    expect(TextDocument.applyEdits(source, edits)).to.equal(
      "select 'TRUE',\n       a = NULL; -- noqa: CV05\nselect b is NULL;\n-- FALSE\n",
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
    expect(TextDocument.applyEdits(source, actions[0].edit!.changes![uri])).to.equal(
      'select a is null,\n       b is null;\n',
    );
    expect(actions[0].diagnostics).to.have.length(3);
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
    expect(actions).to.have.length(3);
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
    for (const action of first.filter((action) => !/^(Disable |Show documentation)/.test(action.title))) {
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
