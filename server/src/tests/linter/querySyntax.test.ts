import { expect } from 'chai';
import { CodeActionKind, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentCodeActions, formatDocument } from '../../formatting';
import { Linter, sourceFixAllKind } from '../../linter/linter';
import { Parser } from '../../linter/parser';
import { StatementType } from '../../linter/parser/enums';
import { globalTokenCache } from '../../linter/parser/tokenCache';
import { ruleRegistry } from '../../linter/rules/rules';
import { defaultSettings } from '../../settings';

const operators = [
  ['WHERE', 'amount > 0'],
  ['AGGREGATE', 'SUM(amount) AS total GROUP BY category'],
  ['EXTEND', 'amount * 2 AS doubled'],
  ['SET', 'amount = amount + 1'],
  ['DROP', 'secret'],
  ['RENAME', 'amount AS total'],
  ['AS', 't'],
  ['SELECT', '* EXCEPT (secret)'],
  ['ORDER BY', 'amount DESC'],
  ['LIMIT', '10 OFFSET 1'],
  ['JOIN', 'dataset.other USING (id)'],
  ['INNER JOIN', 'dataset.other USING (id)'],
  ['LEFT OUTER JOIN', 'dataset.other USING (id)'],
  ['CROSS JOIN', 'dataset.other'],
  ['CALL', 'dataset.my_tvf()'],
  ['PIVOT', "(SUM(amount) FOR quarter IN ('Q1', 'Q2'))"],
  ['UNPIVOT', '(amount FOR quarter IN (q1, q2))'],
  ['TABLESAMPLE', 'SYSTEM (10 PERCENT)'],
  ['UNION', 'ALL (FROM dataset.other)'],
  ['INTERSECT', 'DISTINCT (FROM dataset.other)'],
  ['EXCEPT', 'DISTINCT (FROM dataset.other)'],
  ['DISTINCT', ''],
  ['WITH', 'totals AS (SELECT 1 AS n)'],
  ['MATCH_RECOGNIZE', '(ORDER BY amount MEASURES FIRST(a.amount) AS first_amount PATTERN (a+) DEFINE a AS amount > 0)'],
] as const;

const corpus = [
  'FROM dataset.sales;\n',
  'FROM dataset.sales |> SET amount = NULLIF(amount, 0) |> SELECT NULL_VALUE;\n',
  ...operators.map(([operator, body]) => `FROM dataset.sales |> ${operator}${body ? ` ${body}` : ''};\n`),
  `FROM dataset.sales
|> WHERE amount > 0
|> AGGREGATE SUM(amount) AS total GROUP BY category
|> EXTEND total + 1 AS adjusted
|> ORDER BY adjusted DESC
|> LIMIT 10;\n`,
  'FROM (FROM dataset.sales |> SELECT amount) |> EXTEND amount + 1 AS adjusted;\n',
  'FROM dataset.sales |> UNION ALL (FROM dataset.other |> WHERE amount > 0) |> LIMIT 10;\n',
  "FROM dataset.sales |> /* |> DROP fake; */\n-- |> SET fake = 1;\nSELECT 'a; |> DROP secret' AS text;\n",
  `SELECT * FROM dataset.sales
MATCH_RECOGNIZE (
  PARTITION BY customer
  ORDER BY sale_date
  MEASURES FIRST(low.sale_date) AS start_date
  AFTER MATCH SKIP PAST LAST ROW
  PATTERN (low+ high*)
  DEFINE low AS amount < 100, high AS amount >= 100
);\n`,
  `SELECT * FROM GRAPH_TABLE(
  FinGraph
  MATCH (a:Account)-[t:Transfers]->(b:Account)
  WHERE t.amount > 100
  COLUMNS (a.id AS sender, b.id AS recipient)
);\n`,
  `SELECT * FROM GRAPH_TABLE(
  FinGraph
  MATCH ANY SHORTEST (a:Account)-[t:Transfers]->(b:Account)
  COLUMNS (a.id AS sender)
);\n`,
  "SELECT amount FROM dataset.sales FOR SYSTEM_TIME AS OF TIMESTAMP '2026-01-01 00:00:00+00';\n",
  "FROM dataset.sales FOR SYSTEM_TIME AS OF TIMESTAMP '2026-01-01 00:00:00+00' |> SELECT amount;\n",
  "SELECT amount FROM dataset.sales FOR\nSYSTEM_TIME /* timestamp */ AS\nOF TIMESTAMP '2026-01-01 00:00:00+00';\n",
  'FROM dataset.sales |> LEFT /* join type */\nOUTER JOIN dataset.other USING (id) |> ORDER /* sorting */\nBY amount;\n',
];

describe('Recent query syntax', () => {
  const uri = 'file:///query-syntax.bqsql';
  const item = (text: string) => ({ uri, text, languageId: 'googlesql', version: 1 });
  const document = (text: string) => TextDocument.create(uri, 'googlesql', 1, text);

  afterEach(() => globalTokenCache.delete(uri));

  for (const [operator, body] of operators) {
    it(`scopes pipe ${operator} as a keyword, including lowercase and intervening comments`, async () => {
      for (const spelling of [operator, operator.toLowerCase()]) {
        const text = `FROM dataset.sales |> /* comment */\n-- comment\n${spelling} ${body};`;
        const ast = await new Parser().parse(item(text));
        const tokens = [...globalTokenCache.get(uri)!.tokens].flatMap((line) => line.tokens);
        expect(
          tokens.filter((token) => token.scopes.includes('keyword.operator.pipe.sql')).map((t) => t.value),
        ).to.deep.equal(['|>']);
        const keyword = tokens.find(
          (token) =>
            token.scopes.includes('keyword.control.pipe.sql') || token.scopes.includes('keyword.control.query.sql'),
        );
        expect(keyword?.value).to.equal(spelling);
        expect(keyword?.scopes).not.to.include('meta.dml.sql');
        expect(keyword?.scopes).not.to.include('meta.ddl.sql');
        expect(ast[0].type).to.equal(StatementType.SELECT);
        expect(ast[0].pipeStages[0].operator).to.equal(operator);
      }
    });
  }

  describe('Mixed traditional and extended query blocks', () => {
    const uri = 'file:///mixed-query-syntax.bqsql';
    const item = (text: string) => ({ uri, text, languageId: 'googlesql', version: 1 });
    const code = (diagnostic: { code?: string | number }) => String(diagnostic.code).split(':', 1)[0];
    const extendedBodies = [
      'FROM dataset.sales |> SELECT amount',
      'SELECT * FROM dataset.sales MATCH_RECOGNIZE (ORDER BY amount MEASURES FIRST(a.amount) AS n PATTERN (a+) DEFINE a AS amount > 0)',
      'SELECT * FROM GRAPH_TABLE(FinGraph MATCH (a:Account) COLUMNS (a.id AS id))',
      "SELECT * FROM dataset.sales FOR SYSTEM_TIME AS OF TIMESTAMP '2026-01-01 00:00:00+00'",
      'FROM dataset.sales',
    ];
    let linter: Linter;

    beforeEach(() => {
      linter = new Linter(defaultSettings);
    });
    afterEach(() => {
      linter.closeDocument(uri);
      globalTokenCache.delete(uri);
    });

    for (const body of extendedBodies) {
      for (const wrapper of ['CTE', 'FROM subquery', 'scalar subquery'] as const) {
        it(`restores traditional AST, source and regex rules around ${wrapper}: ${body}`, async () => {
          const outer = 'SELECT t.id AS value, t.other FROM dataset.sales AS t JOIN dataset.other AS u USING (id)';
          const text =
            wrapper === 'CTE'
              ? `WITH cte AS (${body})\n${outer};\n`
              : wrapper === 'FROM subquery'
                ? `SELECT * FROM (${body}) AS t JOIN dataset.other AS u USING (id);\n`
                : `${outer} WHERE t.id = (${body});\n`;
          const source = TextDocument.create(uri, 'googlesql', 1, text);
          const diagnostics = await linter.verify(item(text));
          const codes = diagnostics.map(code);
          expect(codes, text).to.include.members(
            wrapper === 'FROM subquery' ? ['AM04', 'AM05', 'ST07'] : ['AL01', 'AL02', 'AM05', 'ST07'],
          );
          const start = text.lastIndexOf(body);
          const end = start + body.length;
          const safe = new Set([
            'CP01',
            'CP02',
            'CP03',
            'CP04',
            'CP05',
            'CV01',
            'CV02',
            'CV04',
            'CV05',
            'CV13',
            'LT01',
            'LT12',
            'LT13',
          ]);
          for (const diagnostic of diagnostics.filter((diagnostic) => !safe.has(code(diagnostic)))) {
            expect(
              source.offsetAt(diagnostic.range.end) <= start || source.offsetAt(diagnostic.range.start) >= end,
              `${code(diagnostic)} in ${text}`,
            ).to.equal(true);
          }
        });
      }
    }

    it('exposes traditional sibling and enclosing blocks without merging their select lists', async () => {
      const text = `WITH extended AS (${extendedBodies[0]}),
    traditional AS (SELECT t.id AS value FROM dataset.sales AS t)
    SELECT u.id AS value FROM dataset.other AS u;\n`;
      const ast = await new Parser().parse(item(text));
      expect(ast[0].hasExtendedQuerySyntax).to.equal(false);
      expect(ast[0].queryBlocks.map((block) => block.hasExtendedQuerySyntax)).to.deep.equal([true, false]);
      expect(ast[0].columns).to.have.length(1);
      expect(ast[0].queryBlocks[1].columns).to.have.length(1);
      const diagnostics = await linter.verify(item(text));
      expect(
        diagnostics
          .filter((diagnostic) => code(diagnostic) === 'AL02')
          .map((diagnostic) => diagnostic.range.start.line),
      ).to.deep.equal([2, 1]);
      expect(diagnostics.filter((diagnostic) => code(diagnostic) === 'AL01')).to.have.length(2);
    });

    it('restores nested traditional blocks but keeps unsupported ancestors conservatively skipped', async () => {
      const text = `SELECT * FROM (
    WITH extended AS (${extendedBodies[0]})
    SELECT t.id AS value FROM dataset.sales AS t
    ) AS result;\n`;
      const diagnostics = await linter.verify(item(text));
      expect(
        diagnostics
          .filter((diagnostic) => code(diagnostic) === 'AL02')
          .map((diagnostic) => diagnostic.range.start.line),
      ).to.deep.equal([2]);
      const unsupported = `FROM (SELECT t.id AS value FROM dataset.sales AS t) |> SELECT *;\n`;
      expect(
        (await linter.verify(item(unsupported))).filter((diagnostic) =>
          ['AL01', 'AL02', 'AM04'].includes(code(diagnostic)),
        ),
      ).to.deep.equal([]);
    });

    it('does not infer a projection count from an opaque query and still checks traditional set branches', async () => {
      for (const [text, count] of [
        [`WITH cte AS (${extendedBodies[0]}) SELECT * FROM cte UNION ALL SELECT a, b;\n`, 0],
        [`WITH cte AS (${extendedBodies[0]}) SELECT a UNION ALL SELECT b, c;\n`, 1],
        [`WITH cte AS (${extendedBodies[0]}), other AS (SELECT a UNION ALL SELECT b, c) SELECT * FROM other;\n`, 1],
      ] as const) {
        const diagnostics = await linter.verify(item(text));
        expect(
          diagnostics.filter((diagnostic) => code(diagnostic) === 'AM07'),
          text,
        ).to.have.length(count);
      }
    });

    it('isolates GROUP/ORDER context and preserves same-line statement boundaries', async () => {
      const text = `WITH cte AS (SELECT x FROM dataset.sales FOR SYSTEM_TIME AS OF CURRENT_TIMESTAMP() ORDER BY 1)
    SELECT x FROM dataset.other GROUP BY x ORDER BY 1;FROM dataset.sales |> SELECT *;SELECT * FROM dataset.other;\n`;
      const diagnostics = await linter.verify(item(text));
      expect(diagnostics.filter((diagnostic) => code(diagnostic) === 'AM06')).to.have.length(1);
      expect(diagnostics.filter((diagnostic) => code(diagnostic) === 'AM04')).to.have.length(1);
    });

    it('uses the enclosing DISTINCT token rather than one inside a skipped CTE', async () => {
      const text = `WITH cte AS (FROM dataset.sales |> SELECT DISTINCT amount)
SELECT DISTINCT t.id FROM dataset.sales t GROUP BY t.id;\n`;
      const diagnostics = await linter.verify(item(text));
      expect(
        diagnostics
          .filter((diagnostic) => code(diagnostic) === 'AM01')
          .map((diagnostic) => diagnostic.range.start.line),
      ).to.deep.equal([1]);
    });

    it('rejects whole actions when any edit crosses into a skipped query body', async () => {
      const text = `WITH cte AS (${extendedBodies[0]}) SELECT t.id FROM dataset.sales AS t;\n`;
      const diagnostics = await linter.verify(item(text));
      const diagnostic = diagnostics.find((diagnostic) => code(diagnostic) === 'AL01')!;
      const rule = linter.parserRules.find((rule) => rule.code === 'AL01')!;
      const inside = Range.create(0, text.indexOf('|>'), 0, text.indexOf('|>'));
      for (const ranges of [[Range.create(0, 0, 0, text.length - 1)], [inside], [diagnostic.range, inside]]) {
        rule.createCodeAction = () =>
          [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll].map((kind) => ({
            title: 'Crossing fix',
            kind,
            diagnostics: [diagnostic],
            edit: { changes: { [uri]: ranges.map((range) => ({ range, newText: '' })) } },
          }));
        const actions = await linter.createCodeActions({
          textDocument: { uri },
          range: Range.create(0, 0, 1, 0),
          context: { diagnostics: [diagnostic] },
        });
        expect(actions).to.deep.equal([]);
      }
    });

    it('handles comments, quoted fake boundaries, nested functions and unfinished subqueries', async () => {
      for (const text of [
        `/* leading */ WITH cte AS (/* before FROM */ ${extendedBodies[0]}) SELECT t.id AS value FROM dataset.sales AS t;\n`,
        `SELECT COALESCE((/* comment */ ${extendedBodies[0]}), 0), '(SELECT |> fake)' FROM dataset.sales AS t;\n`,
        `SELECT * FROM (${extendedBodies[0]}`,
        `WITH cte AS (${extendedBodies[0]}) SELECT * FROM dataset.other WHERE EXISTS (${extendedBodies[0]}`,
      ]) {
        const diagnostics = await linter.verify(item(text));
        expect(diagnostics.map(code), text).to.include(
          text.startsWith('/*') ? 'AL02' : text.startsWith('SELECT COALESCE') ? 'AL01' : 'AM04',
        );
      }
    });

    it('reclassifies nested blocks after incremental edits in both directions', async () => {
      const text = `WITH cte AS (${extendedBodies[0]}) SELECT * FROM dataset.other;\n`;
      expect((await linter.verify(item(text))).filter((diagnostic) => code(diagnostic) === 'AM04')).to.have.length(1);
      const traditional = 'WITH cte AS (SELECT * FROM dataset.sales) SELECT * FROM dataset.other;\n';
      const changed = await linter.verifyChanges({
        textDocument: { uri, version: 2 },
        contentChanges: [{ text: traditional }],
      });
      expect(changed.filter((diagnostic) => code(diagnostic) === 'AM04')).to.have.length(2);
      const restored = await linter.verifyChanges({
        textDocument: { uri, version: 3 },
        contentChanges: [
          {
            range: Range.create(0, 13, 0, 13 + 'SELECT * FROM dataset.sales'.length),
            text: extendedBodies[0],
          },
        ],
      });
      expect(restored.filter((diagnostic) => code(diagnostic) === 'AM04')).to.have.length(1);
      expect(globalTokenCache.get(uri)!.getText()).to.equal(text);
    });

    for (const eol of ['\n', '\r\n', '\r']) {
      it(`formats and fixes traditional blocks idempotently without rewriting skipped bodies (${JSON.stringify(eol)})`, async () => {
        const settings = { ...defaultSettings, rules: { groups: { capitalisation: false } } };
        const body = 'FROM dataset.sales |> JOIN dataset.other USING (id) |> SELECT *';
        const text = `WITH cte AS (${eol}${body}${eol})${eol}SELECT t.id AS value FROM dataset.sales AS t INNER JOIN dataset.other AS u USING (id);${eol}`;
        const source = TextDocument.create(uri, 'googlesql', 1, text);
        const formatted = TextDocument.applyEdits(source, await formatDocument(source, settings));
        expect(formatted).not.to.equal(text);
        expect(formatted).to.include(body);
        expect(formatted).to.include('INNER JOIN');
        expect(formatted).not.to.include('AS value');
        expect(await formatDocument(TextDocument.create(uri, 'googlesql', 2, formatted), settings)).to.deep.equal([]);
        const actions = await createDocumentCodeActions(source, settings, {
          textDocument: { uri },
          range: Range.create(0, 0, source.lineCount, 0),
          context: { diagnostics: [], only: [sourceFixAllKind] },
        });
        expect(actions).to.have.length(1);
        const fixed = TextDocument.applyEdits(source, actions[0].edit!.changes![uri]);
        expect(fixed).to.include(body);
        const again = await createDocumentCodeActions(TextDocument.create(uri, 'googlesql', 2, fixed), settings, {
          textDocument: { uri },
          range: Range.create(0, 0, source.lineCount, 0),
          context: { diagnostics: [], only: [sourceFixAllKind] },
        });
        expect(again).to.deep.equal([]);
      });
    }
  });

  it('preserves stage tokens and distinguishes nested pipelines from their enclosing stages', async () => {
    const ast = await new Parser().parse(
      item('FROM dataset.sales |> UNION ALL (FROM dataset.other |> SELECT amount) |> LIMIT 10;\n'),
    );
    expect(ast[0].hasExtendedQuerySyntax).to.equal(true);
    expect(ast[0].pipeStages.map(({ operator, depth }) => ({ operator, depth }))).to.deep.equal([
      { operator: 'UNION', depth: 0 },
      { operator: 'SELECT', depth: 1 },
      { operator: 'LIMIT', depth: 0 },
    ]);
    expect(ast[0].pipeStages[0].tokens.map((token) => token.value).join('')).to.equal(
      '|> UNION ALL (FROM dataset.other |> SELECT amount) ',
    );
    expect(ast[0].pipeStages[1].tokens.map((token) => token.value).join('')).to.equal('|> SELECT amount)');
  });

  it('keeps multiword pipe operators together across comments and line breaks', async () => {
    const ast = await new Parser().parse(item(corpus[corpus.length - 1]));
    expect(ast[0].pipeStages.map((stage) => stage.operator)).to.deep.equal(['LEFT OUTER JOIN', 'ORDER BY']);
  });

  it('ignores fake syntax/terminators in comments, strings and quoted identifiers', async () => {
    const ast = await new Parser().parse(
      item("SELECT 'a; |> DROP x', `b; MATCH_RECOGNIZE` /* ; GRAPH_TABLE */; -- ; |>\nSELECT amount;\n"),
    );
    const statements = Object.values(ast).filter((statement) => statement.statement?.trim());
    expect(statements).to.have.length(2);
    expect(statements.every((statement) => !statement.hasExtendedQuerySyntax)).to.equal(true);
    expect(statements[0].statement).to.equal("SELECT 'a; |> DROP x', `b; MATCH_RECOGNIZE` /* ; GRAPH_TABLE */;");
    expect(statements[1].statement).to.equal(' -- ; |>\nSELECT amount;');
  });

  it('splits same-line and unterminated statements without losing their tokens', async () => {
    const ast = await new Parser().parse(item('FROM t |> SET x = 1;SELECT y;FROM z |> DROP secret'));
    expect(Object.values(ast).map((statement) => statement.statement)).to.deep.equal([
      'FROM t |> SET x = 1;',
      'SELECT y;',
      'FROM z |> DROP secret',
    ]);
    expect(ast[1].hasExtendedQuerySyntax).to.equal(false);
    expect(ast[1].columns).to.have.length(1);
    expect(ast[1].tokens[0].startIndex).to.equal(20);
    expect(ast[2].pipeStages[0].operator).to.equal('DROP');
  });

  it('scopes pattern, graph and temporal query keywords through nested parentheses', async () => {
    for (const text of corpus.slice(-7, -1)) {
      const ast = await new Parser().parse(item(text));
      expect(ast[0].hasExtendedQuerySyntax, text).to.equal(true);
      const tokens = [...globalTokenCache.get(uri)!.tokens].flatMap((line) => line.tokens);
      for (const value of ['MATCH_RECOGNIZE', 'MEASURES', 'PATTERN', 'DEFINE', 'GRAPH_TABLE', 'MATCH', 'COLUMNS']) {
        const token = tokens.find((candidate) => candidate.value === value);
        if (token)
          expect(
            token.scopes.some((scope) => scope.startsWith('keyword.')),
            value,
          ).to.equal(true);
      }
      expect(
        tokens.some((token) => token.scopes.includes('punctuation.unmatched.bracket.round.end.sql')),
        text,
      ).to.equal(false);
    }
  });

  for (const RuleClass of ruleRegistry) {
    const code = new RuleClass(defaultSettings, 0).code;
    it(`checks or explicitly skips ${code} without false positives across the corpus`, async () => {
      const linter = new Linter(defaultSettings);
      linter.parserRules = linter.parserRules.filter((rule) => rule.code === code);
      linter.regexRules = linter.regexRules.filter((rule) => rule.code === code);
      for (const rule of [...linter.parserRules, ...linter.regexRules]) rule.enabled = true;
      try {
        for (const text of corpus) {
          const diagnostics = await linter.verify(item(text));
          if (code.startsWith('CP') && code !== 'CP04') {
            for (const diagnostic of diagnostics) {
              const value = globalTokenCache.get(uri)!.getText(diagnostic.range);
              expect(value, text).not.to.equal(value.toLowerCase());
            }
          } else {
            expect(diagnostics, text).to.deep.equal([]);
          }
        }
      } finally {
        linter.closeDocument(uri);
      }
    });
  }

  it('preserves every corpus query through formatting and Fix All, idempotently', async () => {
    const settings = { ...defaultSettings, rules: { groups: { capitalisation: false } } };
    for (const text of corpus) {
      const source = document(text);
      expect(await formatDocument(source, settings), text).to.deep.equal([]);
      const actions = await createDocumentCodeActions(source, settings, {
        textDocument: { uri },
        range: Range.create(0, 0, source.lineCount, 0),
        context: { diagnostics: [], only: [CodeActionKind.SourceFixAll] },
      });
      expect(actions, text).to.deep.equal([]);
    }
  });

  it('keeps safe fixes active, protects literals/comments and converges with every line ending', async () => {
    for (const eol of ['\n', '\r\n', '\r']) {
      const text = `FROM dataset.sales |> WHERE amount = NULL AND active <> FALSE  ${eol}|> SELECT 'TRUE; |> SET x = NULL' AS text; -- FALSE${eol}`;
      const source = document(text);
      const expected = `from dataset.sales |> where amount is null and active != false${eol}|> select 'TRUE; |> SET x = NULL' as text; -- FALSE${eol}`;
      const formatted = TextDocument.applyEdits(source, await formatDocument(source, defaultSettings));
      expect(formatted).to.equal(expected);
      expect(await formatDocument(document(formatted), defaultSettings)).to.deep.equal([]);
      const actions = await createDocumentCodeActions(source, defaultSettings, {
        textDocument: { uri },
        range: Range.create(0, 0, source.lineCount, 0),
        context: { diagnostics: [], only: [sourceFixAllKind] },
      });
      const fixed = TextDocument.applyEdits(source, actions[0].edit!.changes![uri]);
      expect(await formatDocument(document(fixed), defaultSettings)).to.deep.equal([]);
      expect(fixed).to.equal(expected);
    }
  });

  it('continues checking traditional statements beside extended syntax on the same line', async () => {
    const linter = new Linter(defaultSettings);
    try {
      const diagnostics = await linter.verify(item('FROM t |> SELECT *;SELECT * FROM dataset.sales;\n'));
      expect(diagnostics.some((diagnostic) => String(diagnostic.code).startsWith('AM04:'))).to.equal(true);
      expect(
        diagnostics
          .filter((diagnostic) => !String(diagnostic.code).startsWith('CP01:'))
          .every((diagnostic) => diagnostic.range.start.character >= 19),
      ).to.equal(true);
    } finally {
      linter.closeDocument(uri);
    }
  });

  it('updates query classification after incremental edits', async () => {
    const parser = new Parser();
    const text = 'FROM dataset.sales |> DROP secret;\n';
    await parser.parse(item(text));
    const changed = await parser.parseChange({
      textDocument: { uri, version: 2 },
      contentChanges: [{ range: Range.create(0, 0, 0, text.length - 1), text: 'SELECT amount;' }],
    });
    expect(changed[0].hasExtendedQuerySyntax).to.equal(false);
    expect(changed[0].pipeStages).to.deep.equal([]);
    expect(changed[0].columns).to.have.length(1);
  });
});
