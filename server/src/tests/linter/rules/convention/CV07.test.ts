import { expect } from 'chai';
import { CodeActionKind } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Linter } from '../../../../linter/linter';
import { globalTokenCache } from '../../../../linter/parser/tokenCache';
import { defaultSettings, type ServerSettings } from '../../../../settings';
import { ruleRegistry } from '../../../../linter/rules/rules';
import { formatDocument } from '../../../../formatting';

describe('CV07 statement brackets', () => {
  const uri = 'file:///cv07.bqsql';
  const settings: ServerSettings = {
    ...defaultSettings,
    rules: { exclude: ruleRegistry.map((Rule) => new Rule(defaultSettings, 0).code).filter((code) => code !== 'CV07') },
  };

  afterEach(() => globalTokenCache.delete(uri));

  async function verify(text: string, configuration = settings) {
    const linter = new Linter(configuration);
    const document = TextDocument.create(uri, 'googlesql', 1, text);
    const diagnostics = await linter.verify({ uri, text, languageId: 'googlesql', version: 1 });
    const actions = await linter.createCodeActions({
      textDocument: { uri },
      range: { start: document.positionAt(0), end: document.positionAt(text.length) },
      context: { diagnostics },
    });
    linter.closeDocument(uri);
    return { document, diagnostics, actions };
  }

  for (const [text, fixed] of [
    ['(select foo from bar);', 'select foo from bar;'],
    ['((select foo from (select * from bar)));', 'select foo from (select * from bar);'],
    ['(  ( select 1 )  );', 'select 1;'],
    ['(select 1)', 'select 1'],
    ['(with q as (select 1 a) select a from q);', 'with q as (select 1 a) select a from q;'],
    ['(from t |> select a);', 'from t |> select a;'],
    ['(select 1); (select 2);', 'select 1; select 2;'],
    ['(/* keep */ select 1 /* end */);', '/* keep */ select 1 /* end */;'],
    ['( /* outer */ ( /* inner */ select 1 ) /* end */ );', '/* outer */ /* inner */ select 1 /* end */;'],
    ['(insert into t (select 1));', 'insert into t (select 1);'],
    ['(select "(;)", `MixedCase` from `Dataset.Table`);', 'select "(;)", `MixedCase` from `Dataset.Table`;'],
    ['begin (select 1); (select 2); end;', 'begin select 1; select 2; end;'],
    [
      'if exists (select 1) then (select 2); else (select 3); end if;',
      'if exists (select 1) then select 2; else select 3; end if;',
    ],
    [
      'if true then (select 1); elseif false then (select 2); end if;',
      'if true then select 1; elseif false then select 2; end if;',
    ],
    ['label: loop (select 1); end loop label;', 'label: loop select 1; end loop label;'],
    ['while false do (select 1); end while;', 'while false do select 1; end while;'],
    ['for row in (select 1 n) do (select row.n); end for;', 'for row in (select 1 n) do select row.n; end for;'],
    ['repeat (select 1); until true end repeat;', 'repeat select 1; until true end repeat;'],
    [
      'case n when 1 then (select 1); when 2 then (select 2); else (select 3); end case;',
      'case n when 1 then select 1; when 2 then select 2; else select 3; end case;',
    ],
    [
      'if case when true then true else false end then (select 1); end if;',
      'if case when true then true else false end then select 1; end if;',
    ],
    [
      'begin if true then (select 1); end if; exception when error then (select 2); end;',
      'begin if true then select 1; end if; exception when error then select 2; end;',
    ],
  ]) {
    it(`removes only whole-statement brackets: ${JSON.stringify(text)}`, async () => {
      const { document, diagnostics, actions } = await verify(text);
      expect(diagnostics.length).to.be.greaterThan(0);
      for (const kind of [CodeActionKind.QuickFix, 'source.fixAll.bigquerySQLFormatter']) {
        const matching = actions.filter(
          (action) => action.kind === kind && action.title !== 'Disable CV07 for this line.',
        );
        const edits = matching.flatMap((action) => action.edit?.changes?.[uri] ?? []);
        expect(TextDocument.applyEdits(document, edits)).to.equal(fixed);
      }
      expect((await verify(fixed)).diagnostics).to.have.length(0);
    });
  }

  for (const text of [
    '(select 1) union all (select 2);',
    '(select a from t) order by a;',
    '(select a from t) limit 1;',
    'create table t as (select 1);',
    'insert into t (select 1);',
    'select * from (select 1);',
    'select exists (select 1);',
    'select (select 1);',
    "select '(select 1);', `((select))`; -- (select 2);",
    '/* (select 1); */',
    '(select 1;',
    '((select 1);',
    '();',
    '(foo);',
    'if (select true) then select 1; end if;',
    'select case when true then (select 1) else (select 2) end;',
    '(select 1) + 2;',
    '(from t |> unsupported_stage);',
    'begin transaction; select 1; commit transaction;',
    '(select * from t match_recognize (partition by a order by b pattern (A) define A as true));',
  ]) {
    it(`leaves partial, protected or malformed statements alone: ${JSON.stringify(text)}`, async () => {
      expect((await verify(text)).diagnostics).to.have.length(0);
    });
  }

  for (const eol of ['\n', '\r\n', '\r']) {
    it(`keeps comments and ${JSON.stringify(eol)} line endings`, async () => {
      const text = `( ${eol}-- leading${eol}select 1 -- trailing${eol} );`;
      const { document, actions } = await verify(text);
      const edits = actions.find((action) => action.kind === 'source.fixAll.bigquerySQLFormatter')!.edit!.changes![uri];
      expect(TextDocument.applyEdits(document, edits)).to.equal(`-- leading${eol}select 1 -- trailing${eol};`);
      const source = TextDocument.create(uri, 'googlesql', 1, `( ${eol}select 1${eol} );`);
      const formatted = TextDocument.applyEdits(source, await formatDocument(source, settings));
      expect(formatted).to.equal('select 1;');
      expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, formatted), settings)).to.deep.equal([]);
    });
  }

  it('reports the whole bracketed range and is enabled by default', async () => {
    const { diagnostics } = await verify('  ((select 1));', defaultSettings);
    const diagnostic = diagnostics.find((entry) => String(entry.code).startsWith('CV07:'))!;
    expect(diagnostic.range).to.deep.equal({ start: { line: 0, character: 2 }, end: { line: 0, character: 14 } });
  });

  for (const text of [
    '(select 1); -- noqa',
    '(select 1); -- noqa: CV07',
    '-- noqa: disable=CV07\n(select 1);\n-- noqa: enable=CV07\nselect 2;',
    '-- noqa: disable=all\n(select 1);\n-- noqa: enable=all\nselect 2;',
  ]) {
    it(`honors suppression: ${JSON.stringify(text)}`, async () => {
      expect((await verify(text)).diagnostics).to.have.length(0);
    });
  }

  it('honors rule settings', async () => {
    expect(
      (await verify('(select 1);', { ...settings, rules: { CV07: { enabled: false } } })).diagnostics.filter((entry) =>
        String(entry.code).startsWith('CV07:'),
      ),
    ).to.have.length(0);
  });

  it('restores diagnostics after a region is re-enabled', async () => {
    const { diagnostics } = await verify('-- noqa: disable=CV07\n(select 1);\n-- noqa: enable=CV07\n(select 2);');
    expect(diagnostics).to.have.length(1);
    expect(diagnostics[0].range.start.line).to.equal(3);
  });

  it('converges with default formatting and Fix All in a script containing a pipe query', async () => {
    const text = 'begin\n  ((from t |> select a));\nend;';
    const { document, actions } = await verify(text, defaultSettings);
    const fixed = TextDocument.applyEdits(
      document,
      actions.find((action) => action.kind === 'source.fixAll.bigquerySQLFormatter')!.edit!.changes![uri],
    );
    const formatted = TextDocument.applyEdits(document, await formatDocument(document, defaultSettings));
    for (const result of [fixed, formatted]) {
      expect((await verify(result)).diagnostics).to.have.length(0);
    }
    expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, formatted), defaultSettings)).to.deep.equal(
      [],
    );
  });
});
