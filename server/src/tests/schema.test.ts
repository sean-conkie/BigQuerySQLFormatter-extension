import assert from 'node:assert/strict';
import {
  CancellationToken,
  CancellationTokenSource,
  CompletionItemKind,
  type CompletionList,
  type TextEdit,
  InitializeRequest,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { SchemaRequest, SchemaResponse } from '../../../shared/schema';
import { SchemaBuilder } from '../completions/schema';
import { quoteIdentifierPath } from '../linter/quoting';
import { tokenizeSource, schemaPositionAllowed } from '../linter/rules/source';
import { QueryScopeResolver } from '../linter/scope';
import { startTestServer } from './serverProcess';
import { Linter } from '../linter/linter';
import { globalTokenCache } from '../linter/parser/tokenCache';
import { defaultSettings } from '../settings';

describe('Schema completion and hover', () => {
  const requests: SchemaRequest[] = [];
  const field = {
    name: 'CustomerID',
    type: 'STRING',
    mode: 'NULLABLE',
    description: 'Customer **identifier**',
  };
  const record = {
    name: 'Address',
    type: 'RECORD',
    mode: 'REPEATED',
    fields: [
      {
        name: 'City',
        type: 'RECORD',
        mode: 'NULLABLE',
        fields: [{ name: 'Name', type: 'STRING', mode: 'NULLABLE' }],
      },
    ],
  };
  let disabled: boolean;
  let pending: boolean;
  const provider = async (request: SchemaRequest): Promise<SchemaResponse> => {
    requests.push(request);
    if (disabled) return { unavailable: true, entries: [] };
    if (request.contextOnly) return { entries: [], defaultDataset: 'Analytics', projectId: 'default-project' };
    if (request.table)
      return {
        pending,
        entries: [
          {
            name: request.table,
            type: 'VIEW',
            description: 'Orders view',
            numRows: '123',
            numBytes: '456',
            partitioning: '{"field":"Date"}',
            clustering: ['CustomerID'],
            lastModifiedTime: '0',
            fields: [field, record, { name: 'select', type: 'INTEGER', mode: 'REQUIRED' }],
          },
        ],
      };
    if (request.dataset)
      return {
        pending,
        entries: [
          { name: 'Orders', type: 'TABLE' },
          { name: '2024 Sales', type: 'EXTERNAL' },
        ],
      };
    return { pending, defaultDataset: 'Analytics', entries: [{ name: 'Analytics', location: 'EU' }] };
  };

  beforeEach(() => {
    requests.length = 0;
    disabled = false;
    pending = false;
  });
  afterEach(() => globalTokenCache.delete('file:///schema.bqsql'));

  describe('Schema LSP protocol', function () {
    this.timeout(10000);
    let server: ReturnType<typeof startTestServer>;
    beforeEach(() => {
      server = startTestServer();
    });
    afterEach(async () => {
      await server.stop();
    });

    it('returns incomplete lists while pending and exact function fallback when unavailable', async () => {
      let unavailable = false;
      server.connection.onRequest('bigquerySQLFormatter/schema', (request: SchemaRequest): SchemaResponse => {
        if (unavailable) return { entries: [], unavailable: true };
        if (request.contextOnly) return { entries: [] };
        return { entries: [], pending: true };
      });
      await server.connection.sendRequest(InitializeRequest.type, {
        processId: process.pid,
        rootUri: null,
        capabilities: {},
        initializationOptions: { schemaProvider: true },
      });
      const uri = 'file:///schema-process.bqsql';
      const text = 'SELECT AB FROM ds.Orders';
      await server.connection.sendNotification('textDocument/didOpen', {
        textDocument: { uri, languageId: 'googlesql', version: 1, text },
      });
      await server.nextDiagnostics();
      const params = { textDocument: { uri }, position: { line: 0, character: 9 } };
      const pending = await server.connection.sendRequest<CompletionList>('textDocument/completion', params);
      assert.equal(pending.isIncomplete, true);
      assert.ok(pending.items.some((item) => item.label === 'abs'));
      unavailable = true;
      const fallback = await server.connection.sendRequest('textDocument/completion', params);
      assert.deepEqual(fallback, pending.items);
      const hover = await server.connection.sendRequest('textDocument/hover', {
        ...params,
        position: { line: 0, character: text.indexOf('Orders') + 1 },
      });
      assert.equal(hover, null);
    });

    it('cancels pending server-to-client metadata requests', async () => {
      let started: () => void;
      const requested = new Promise<void>((resolve) => {
        started = resolve;
      });
      server.connection.onRequest(
        'bigquerySQLFormatter/schema',
        (_request: SchemaRequest, token) =>
          new Promise<SchemaResponse>((resolve) => {
            started();
            token.onCancellationRequested(() => resolve({ unavailable: true, entries: [] }));
          }),
      );
      await server.connection.sendRequest(InitializeRequest.type, {
        processId: process.pid,
        rootUri: null,
        capabilities: {},
        initializationOptions: { schemaProvider: true },
      });
      const uri = 'file:///schema-cancel.bqsql';
      await server.connection.sendNotification('textDocument/didOpen', {
        textDocument: { uri, languageId: 'googlesql', version: 1, text: 'SELECT x FROM ds.Orders' },
      });
      await server.nextDiagnostics();
      const cancellation = new CancellationTokenSource();
      try {
        const waiting = server.connection.sendRequest(
          'textDocument/completion',
          {
            textDocument: { uri },
            position: { line: 0, character: 8 },
          },
          cancellation.token,
        );
        await requested;
        cancellation.cancel();
        await assert.rejects(waiting, /cancelled/);
      } finally {
        cancellation.dispose();
      }
    });
  });

  function build(sql: string) {
    const offset = sql.indexOf('¦');
    assert.ok(offset >= 0);
    const document = TextDocument.create('file:///schema.bqsql', 'googlesql', 1, sql.replace('¦', ''));
    return { builder: new SchemaBuilder(document, provider), document, position: document.positionAt(offset) };
  }

  async function complete(sql: string): Promise<CompletionList> {
    const { builder, position } = build(sql);
    return (await builder.completions(position, CancellationToken.None)) ?? { items: [], isIncomplete: false };
  }

  function inserted(sql: string, result: CompletionList, label: string): string {
    const { document } = build(sql);
    const item = result.items.find((item) => item.label === label)!;
    assert.ok(item, label);
    return TextDocument.applyEdits(document, [item.textEdit as TextEdit]);
  }

  for (const prefix of [
    'SELECT * FROM ',
    'SELECT * FROM a JOIN ',
    'INSERT INTO ',
    'MERGE ',
    'UPDATE ',
    'DELETE FROM ',
    'CREATE TABLE out AS SELECT * FROM ',
  ]) {
    it(`completes datasets and default tables after ${prefix}`, async () => {
      const result = await complete(`${prefix}¦`);
      assert.ok(result.items.some((item) => item.label === 'Analytics'));
      assert.ok(result.items.some((item) => item.label === 'Orders'));
      assert.equal(result.items.find((item) => item.label === 'Analytics')?.detail, 'DATASET - EU');
      assert.ok(requests.some((request) => request.dataset === 'Analytics'));
    });
  }

  for (const path of [
    'Analytics.',
    'other-project.Analytics.',
    '`other-project.Analytics.',
    '`other-project.Analytics.¦`',
  ]) {
    it(`completes table paths in ${path}`, async () => {
      const sql = `SELECT * FROM ${path.includes('¦') ? path : `${path}¦`}`;
      const result = await complete(sql);
      assert.ok(result.items.some((item) => item.label === 'Orders'));
      assert.equal(
        inserted(sql, result, 'Orders'),
        `SELECT * FROM ${path.startsWith('Analytics') ? 'Analytics' : 'other-project.Analytics'}.Orders`,
      );
      assert.ok(inserted(sql, result, '2024 Sales').includes('`'));
    });
  }

  it('treats a non-dataset qualifier as an explicitly named project', async () => {
    const result = await complete('SELECT * FROM other-project.¦');
    assert.ok(result.items.some((item) => item.label === 'Analytics'));
    assert.ok(requests.some((request) => request.project === 'other-project' && !request.dataset));
    assert.ok(!requests.some((request) => request.dataset === 'other-project'));
  });

  it('searches only the default project and explicitly named document projects', async () => {
    await complete('SELECT * FROM other-project.Analytics.Orders; SELECT * FROM ¦');
    assert.ok(requests.some((request) => request.project === 'other-project' && !request.dataset));
    assert.ok(requests.every((request) => request.project === undefined || request.project === 'other-project'));
  });

  for (const sql of [
    'SELECT ¦ FROM Analytics.Orders o',
    'SELECT * FROM Analytics.Orders o WHERE ¦',
    'SELECT * FROM Analytics.Orders o JOIN Analytics.Other t ON ¦',
    'SELECT CustomerID FROM Analytics.Orders GROUP BY ¦',
    'SELECT CustomerID FROM Analytics.Orders GROUP BY CustomerID, ¦',
    'SELECT CustomerID FROM Analytics.Orders ORDER BY ¦',
    'SELECT CustomerID FROM Analytics.Orders ORDER BY CustomerID, ¦',
    'FROM Analytics.Orders |> SELECT ¦',
    'FROM Analytics.Orders |> WHERE ¦',
    'FROM Analytics.Orders |> EXTEND ¦',
    'FROM Analytics.Orders |> AGGREGATE ¦',
    'FROM Analytics.Orders |> ORDER BY ¦',
    'UPDATE Analytics.Orders SET ¦',
    'MERGE Analytics.Orders o USING Analytics.Other t ON ¦',
    'CREATE TABLE out AS SELECT ¦ FROM Analytics.Orders',
    'SELECT CustomerID, ¦ FROM Analytics.Orders',
  ]) {
    it(`completes visible columns in ${sql}`, async () => {
      const result = await complete(sql);
      assert.ok(result.items.some((item) => item.label === 'CustomerID'));
      assert.equal(result.items.find((item) => item.label === 'CustomerID')?.kind, CompletionItemKind.Field);
      assert.ok(String(result.items.find((item) => item.label === 'CustomerID')?.insertText).endsWith('CustomerID'));
    });
  }

  it('resolves alias columns and nested RECORD fields at arbitrary depth', async () => {
    assert.equal((await complete('SELECT o.¦ FROM Analytics.Orders o')).items[0].insertText, 'o.CustomerID');
    assert.equal((await complete('SELECT o.Address.¦ FROM Analytics.Orders o')).items[0].insertText, 'o.Address.City');
    assert.equal(
      (await complete('SELECT o.Address.City.¦ FROM Analytics.Orders o')).items[0].insertText,
      'o.Address.City.Name',
    );
    assert.equal(
      (await complete('SELECT Address.City.¦ FROM Analytics.Orders')).items[0].insertText,
      'Address.City.Name',
    );
  });

  it('qualifies duplicate columns instead of inserting ambiguous SQL', async () => {
    const result = await complete('SELECT ¦ FROM Analytics.Orders o JOIN Analytics.Other t ON TRUE');
    assert.deepEqual(
      result.items.filter((item) => item.label === 'CustomerID').map((item) => item.insertText),
      ['o.CustomerID', 't.CustomerID'],
    );
    const { builder, position } = build('SELECT Customer¦ID FROM Analytics.Orders o JOIN Analytics.Other t ON TRUE');
    assert.equal(await builder.hover(position, CancellationToken.None), null);
  });

  it('does not leak sibling query sources and resolves correlated aliases', async () => {
    await complete('SELECT (SELECT o.¦ FROM Analytics.Inner i) FROM Analytics.Outer o');
    assert.deepEqual(
      requests.filter((request) => request.table).map((request) => request.table),
      ['Outer'],
    );
    requests.length = 0;
    await complete('SELECT * FROM Analytics.LeftTable UNION ALL SELECT ¦ FROM Analytics.RightTable');
    assert.deepEqual(
      requests.filter((request) => request.table).map((request) => request.table),
      ['RightTable'],
    );
  });

  for (const sql of [
    'WITH x AS (SELECT CustomerID, 1 AS Derived FROM Analytics.Orders) SELECT x.¦ FROM x',
    'SELECT x.¦ FROM (SELECT CustomerID, 1 AS Derived FROM Analytics.Orders) x',
  ]) {
    it('offers static CTE/subquery outputs without fetching source schemas', async () => {
      const result = await complete(sql);
      assert.deepEqual(
        result.items.map((item) => item.label),
        ['CustomerID', 'Derived'],
      );
      assert.equal(requests.filter((request) => !request.contextOnly).length, 0);
    });
  }

  it('does not guess CTE wildcard outputs or UNNEST/TVF schemas', async () => {
    assert.equal((await complete('WITH x AS (SELECT * FROM Analytics.Orders) SELECT x.¦ FROM x')).items.length, 0);
    assert.equal((await complete('SELECT u.¦ FROM UNNEST([1, 2]) u')).items.length, 0);
  });

  it('tracks static pipe projections and aliases without guessing schemas', async () => {
    const result = await complete('FROM Analytics.Orders |> SELECT CustomerID AS Derived |> AS p |> SELECT p.¦');
    assert.deepEqual(
      result.items.map((item) => item.label),
      ['Derived'],
    );
    assert.ok(!requests.some((request) => request.table));
    const direct = await complete('FROM Analytics.Orders |> AS p |> SELECT p.¦');
    assert.ok(direct.items.some((item) => item.label === 'CustomerID'));
  });

  it('marks pending metadata incomplete and leaves unavailable results to function completion', async () => {
    pending = true;
    assert.equal((await complete('SELECT ¦ FROM Analytics.Orders')).isIncomplete, true);
    disabled = true;
    const { builder, position } = build('SELECT ¦ FROM Analytics.Orders');
    assert.equal(await builder.completions(position, CancellationToken.None), undefined);
    assert.equal(requests.at(-1)?.contextOnly, true);
  });

  for (const text of [
    "SELECT 'FROM ¦",
    'SELECT "JOIN ¦"',
    "SELECT r'''FROM ¦'''",
    'SELECT 1 -- FROM ¦',
    'SELECT 1 # JOIN ¦',
    'SELECT /* FROM ¦ */ 1',
  ]) {
    it(`never requests metadata from a comment or string: ${text}`, async () => {
      await complete(text);
      const { builder, position } = build(text);
      assert.equal(await builder.hover(position, CancellationToken.None), null);
      assert.equal(requests.length, 0);
    });
  }

  it('honours cancellation before and during metadata requests', async () => {
    const cancellation = new CancellationTokenSource();
    const { builder, position } = build('SELECT ¦ FROM Analytics.Orders');
    cancellation.cancel();
    await assert.rejects(builder.completions(position, cancellation.token), /cancelled/);
    assert.equal(requests.length, 0);
    const second = new CancellationTokenSource();
    const document = build('SELECT ¦ FROM Analytics.Orders').document;
    const slow = new SchemaBuilder(document, () => new Promise(() => {}));
    const waiting = slow.completions(position, second.token);
    second.cancel();
    await assert.rejects(waiting, /cancelled/);
    cancellation.dispose();
    second.dispose();
  });

  for (const [sql, expected] of [
    [
      'SELECT * FROM Analytics.Or¦ders',
      ['VIEW', 'Orders view', 'Rows: 123', '456 bytes', 'Partitioning:', 'Clustering:', '1970-01-01'],
    ],
    ['SELECT * FROM `other-project.Analytics.Or¦ders`', ['VIEW', 'Orders view']],
    ['SELECT o.Customer¦ID FROM Analytics.Orders o', ['STRING', 'NULLABLE', 'Customer']],
    ['SELECT o.Address.City.Na¦me FROM Analytics.Orders o', ['STRING', 'NULLABLE']],
    ['SELECT o.Add¦ress FROM Analytics.Orders o', ['RECORD', 'REPEATED', 'City', 'Name']],
    ['SELECT * FROM Anal¦ytics.Orders', ['EU', 'DATASET']],
    ['SELECT * FROM `other-project.Anal¦ytics.Orders`', ['EU', 'DATASET']],
  ] as const) {
    it(`hovers schema metadata in ${sql}`, async () => {
      const { builder, position } = build(sql);
      const hover = await builder.hover(position, CancellationToken.None);
      assert.ok(hover);
      assert.ok(typeof hover.contents === 'object' && 'value' in hover.contents);
      for (const text of expected) assert.ok(hover.contents.value.includes(text), text);
    });
  }

  it('escapes metadata Markdown instead of creating links or commands', async () => {
    const result = await complete('SELECT ¦ FROM Analytics.Orders');
    const documentation = result.items.find((item) => item.label === 'CustomerID')?.documentation;
    assert.ok(typeof documentation === 'object');
    assert.ok(documentation.value.includes('\\*\\*identifier\\*\\*'));
  });

  it('shares minimal quoting rules with RF06', () => {
    for (const [parts, allowDash, expected] of [
      [['CustomerID'], false, 'CustomerID'],
      [['select'], false, '`select`'],
      [['2024 Sales'], false, '`2024 Sales`'],
      [['my-project', 'Analytics', 'Orders'], true, 'my-project.Analytics.Orders'],
      [['my-project', 'Analytics', 'Orders'], false, '`my-project.Analytics.Orders`'],
      [['Analytics', 'select'], true, 'Analytics.select'],
      [['o', 'select'], false, 'o.select'],
      [['a`b'], false, '`a\\`b`'],
    ] as const)
      assert.equal(quoteIdentifierPath([...parts], allowDash), expected);
  });

  it('does not trigger RF06 or CP02 for completed tables and appropriately quoted columns', async () => {
    const linter = new Linter({
      ...defaultSettings,
      rules: { RF06: { options: { check_table_paths: true } }, CP02: { options: { capitalisation_policy: 'lower' } } },
    });
    for (const [sql, label] of [
      ['SELECT * FROM Analytics.¦', 'Orders'],
      ['SELECT * FROM other-project.Analytics.¦', 'Orders'],
      ['SELECT * FROM Analytics.¦', '2024 Sales'],
      ['SELECT ¦ FROM Analytics.Orders', 'select'],
      ['SELECT o.¦ FROM Analytics.Orders o', 'select'],
    ]) {
      const text = inserted(sql, await complete(sql), label);
      const diagnostics = await linter.verify({
        uri: 'file:///schema.bqsql',
        languageId: 'googlesql',
        version: 1,
        text,
      });
      assert.deepEqual(
        diagnostics.filter((diagnostic) => /^(RF06|CP02):/.test(String(diagnostic.code))),
        [],
        text,
      );
    }
    const sql = 'SELECT ¦ FROM Analytics.Orders';
    const text = inserted(sql, await complete(sql), 'CustomerID');
    const diagnostics = await linter.verify({ uri: 'file:///schema.bqsql', languageId: 'googlesql', version: 2, text });
    assert.ok(diagnostics.some((diagnostic) => String(diagnostic.code).startsWith('CP02:')));
    assert.ok(!diagnostics.some((diagnostic) => String(diagnostic.code).startsWith('RF06:')));
  });

  it('keeps CREATE AS source scopes available to existing consumers', () => {
    const resolver = new QueryScopeResolver(tokenizeSource('CREATE TABLE t AS SELECT x FROM dataset.source'));
    assert.equal(resolver.scopes[0].sources[0].path.join('.'), 'dataset.source');
    assert.equal(schemaPositionAllowed('SELECT /* comment */ x', 21), true);
  });

  it('reports warmed in-memory completion latency', async () => {
    const { builder, position } = build('SELECT o.¦ FROM Analytics.Orders o');
    const timings: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await builder.completions(position, CancellationToken.None);
      timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    console.log(
      `Schema builder cached latency (100 runs): median=${timings[50].toFixed(3)}ms p95=${timings[95].toFixed(3)}ms`,
    );
  });
});
