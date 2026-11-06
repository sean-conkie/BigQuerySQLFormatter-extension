import { expect } from 'chai';
import { CodeActionKind, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../../../formatting';
import { ruleRegistry } from '../../../../linter/rules/rules';
import { defaultSettings, type ServerSettings } from '../../../../settings';

describe('LT02 alias and JOIN layout', () => {
  const uri = 'file:///lt02-layout.sql';
  const document = (text: string) => TextDocument.create(uri, 'googlesql', 1, text);
  const onlyIndent: ServerSettings = {
    ...defaultSettings,
    rules: {
      exclude: ruleRegistry.map((Rule) => new Rule(defaultSettings, 0).code).filter((code) => code !== 'LT02'),
    },
  };

  async function check(text: string, expected: string, settings = defaultSettings): Promise<void> {
    const source = document(text);
    const warnings: string[] = [];
    const report = (message: string) => warnings.push(message);
    expect(
      TextDocument.applyEdits(source, await formatDocument(source, settings, undefined, undefined, report)),
    ).to.equal(expected);
    const actions = await createDocumentCodeActions(
      source,
      settings,
      {
        textDocument: { uri },
        range: Range.create(0, 0, 100, 0),
        context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
      },
      undefined,
      report,
    );
    expect(TextDocument.applyEdits(source, actions[0]?.edit?.changes?.[uri] ?? [])).to.equal(expected);
    expect(await formatDocument(document(expected), settings, undefined, undefined, report)).to.deep.equal([]);
    expect(warnings).to.deep.equal([]);
  }

  for (const eol of ['\n', '\r\n', '\r']) {
    for (const [expression, expected] of [
      ['amt', 'amt'],
      ['case when amt is null then 0 else amt end', 'coalesce(amt, 0)'],
      [
        'case when amt = 1 then 1 else case when amt = 2 then 2 else 3 end end',
        'case when amt = 1 then 1 when amt = 2 then 2 else 3 end',
      ],
    ])
      it(`leaves one alias separator after rewrites: ${expression} / ${JSON.stringify(eol)}`, async () => {
        await check(`select ${expression} as v from ds.t;${eol}`, `select ${expected} v from ds.t;${eol}`);
      });

    for (const join of ['inner join', 'left join', 'right join', 'full join', 'cross join', 'join'])
      it(`indents ${join} and ON continuations relative to FROM / ${JSON.stringify(eol)}`, async () => {
        const lines = ['select f.a', '  from ds.foo f', `${join} ds.bar b`, 'on f.a = b.a', 'and f.c = b.c;'];
        await check(
          lines.join(eol),
          [
            'select f.a',
            '  from ds.foo f',
            `    ${join} ds.bar b`,
            '      on f.a = b.a',
            '        and f.c = b.c;',
          ].join(eol),
          onlyIndent,
        );
      });

    it(`handles multiple JOINs inside CTEs and subqueries / ${JSON.stringify(eol)}`, async () => {
      const text = [
        'with c as (',
        '  select f.a',
        '    from ds.foo f',
        'inner join ds.bar b on f.a = b.a',
        'left join ds.baz c on f.a = c.a',
        ')',
        'select s.a',
        '  from (',
        '    select f.a',
        '      from ds.foo f',
        'full join ds.bar b',
        'on f.a = b.a',
        '  ) s;',
      ].join(eol);
      await check(
        text,
        text
          .replace('inner join', '      inner join')
          .replace('left join', '      left join')
          .replace('full join', '        full join')
          .replace(`${eol}on f.a`, `${eol}          on f.a`),
        onlyIndent,
      );
    });

    it(`shares the JOIN body layout with pipe stages / ${JSON.stringify(eol)}`, async () => {
      const text = ['from ds.foo f', '|> left join ds.bar b', 'on f.a = b.a', 'and f.c = b.c', '|> select f.a;'].join(
        eol,
      );
      await check(
        text,
        ['from ds.foo f', '|> left join ds.bar b', '  on f.a = b.a', '    and f.c = b.c', '|> select f.a;'].join(eol),
        onlyIndent,
      );
    });

    it(`indents a default CROSS JOIN without a condition / ${JSON.stringify(eol)}`, async () => {
      await check(
        ['select f.a', '  from ds.foo f', 'cross join ds.bar b;'].join(eol),
        ['select f.a', '  from ds.foo f', '    cross join ds.bar b;', ''].join(eol),
      );
    });

    it(`handles nested pipe JOIN stages without moving other stages / ${JSON.stringify(eol)}`, async () => {
      const text = [
        'with c as (',
        '  from ds.foo f',
        '  |> inner join ds.bar b',
        'on f.a = b.a',
        'and f.c = b.c',
        '  |> select f.a',
        ')',
        'from c',
        '|> select a;',
      ].join(eol);
      await check(
        text,
        text.replace(`${eol}on f.a`, `${eol}    on f.a`).replace(`${eol}and f.c`, `${eol}      and f.c`),
        onlyIndent,
      );
    });
  }

  it('keeps explicit aliases when AL02 is disabled and aligns implicit aliases with one separator', async () => {
    await check('select amt as v from ds.t;', 'select amt as v from ds.t;', onlyIndent);
    await check('select amt  v from ds.t;', 'select amt v from ds.t;', onlyIndent);
    await check('select amt as v from ds.t;', 'select amt v from ds.t;', {
      ...onlyIndent,
      rules: { exclude: onlyIndent.rules?.exclude?.filter((code) => code !== 'AL02') },
    });
  });

  it('leaves malformed JOINs and unsupported query blocks unchanged', async () => {
    for (const text of [
      'select f.a from ds.foo f join',
      'from ds.foo |> join',
      'from ds.foo |> with x as (select a from ds.bar) |> select a;',
      'select * from ds.foo match_recognize (pattern (a) define a as true);',
    ]) {
      const formatted = TextDocument.applyEdits(document(text), await formatDocument(document(text), onlyIndent));
      expect(await formatDocument(document(formatted), onlyIndent)).to.deep.equal([]);
      if (!text.includes('select f.a')) expect(formatted).to.equal(text);
    }
  });

  it('preserves comments, literals, quoted names and inline JOIN spacing', async () => {
    const text =
      "select 'join\\non', f.a\n  from ds.foo f join ds.bar b on f.a = b.a\n-- keep\nleft join `ds.MixedCase` c\non f.a = c.a;";
    await check(text, text.replace('\nleft join', '\n    left join').replace('\non f.a', '\n      on f.a'), onlyIndent);
  });

  it('respects disabled indentation and noqa directives', async () => {
    for (const text of [
      'select f.a\n  from ds.foo f\nleft join ds.bar b on f.a = b.a; -- noqa: LT02',
      'select f.a\n  from ds.foo f\nleft join ds.bar b on f.a = b.a; -- noqa',
      '-- noqa: disable=LT02\nselect f.a\n  from ds.foo f\nleft join ds.bar b on f.a = b.a;\n-- noqa: enable=LT02',
    ])
      await check(text, text, onlyIndent);
    const text = 'select f.a\n  from ds.foo f\nleft join ds.bar b on f.a = b.a;';
    await check(text, text, { ...onlyIndent, rules: { ...onlyIndent.rules, LT02: { enabled: false } } });
  });
});
