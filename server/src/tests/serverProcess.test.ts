import { expect } from 'chai';
import { rejects } from 'node:assert/strict';
import * as path from 'node:path';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { InitializeRequest, LogMessageNotification, MessageType } from 'vscode-languageserver/node';
import { startTestServer } from './serverProcess';

describe('Test language server lifecycle', function () {
  this.timeout(10000);
  let server: ReturnType<typeof startTestServer>;

  beforeEach(() => {
    server = startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('exposes source tokens for offline dry-run analysis, shielding comments and strings', async () => {
    await server.connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: {},
      rootUri: null,
    });
    const tokens = await server.connection.sendRequest<{ value: string; literal: boolean }[]>(
      'bigquerySQLFormatter/sourceTokens',
      { text: `-- @ignored {{ template }}\nSELECT @name, @@project_id, ?, """@literal \${notTemplate}"""` },
    );
    expect(tokens.map((token) => token.value)).to.deep.equal([
      'SELECT',
      '@',
      'name',
      ',',
      '@',
      '@',
      'project_id',
      ',',
      '?',
      ',',
      `"""@literal \${notTemplate}"""`,
    ]);
    expect(tokens[tokens.length - 1].literal).to.equal(true);
  });
  it('waits for the child to close and destroys its streams during teardown', async () => {
    await server.connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: {},
      rootUri: null,
    });
    await server.stop();
    expect(server.child.exitCode !== null || server.child.signalCode !== null).to.equal(true);
    expect(server.child.stdin.destroyed).to.equal(true);
    expect(server.child.stdout.destroyed).to.equal(true);
    expect(server.child.stderr.destroyed).to.equal(true);
  });

  it('rejects pending diagnostics when the server process exits', async () => {
    await server.connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: {},
      rootUri: null,
    });
    const result = server.nextDiagnostics().then(
      () => undefined,
      (error: unknown) => error,
    );
    server.child.kill();
    const error = await result;
    expect(error)
      .to.be.instanceOf(Error)
      .with.property('message')
      .that.matches(/exited|connection closed/);
  });

  it('rejects pending diagnostic waits when teardown runs', async () => {
    const result = server.nextDiagnostics().then(
      () => undefined,
      (error: unknown) => error,
    );
    await server.stop();
    expect(await result)
      .to.be.instanceOf(Error)
      .with.property('message', 'Test language server stopped.');
  });

  it('surfaces server validation errors instead of waiting for the diagnostic timeout', async () => {
    await server.connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: {},
      rootUri: null,
    });
    const result = server.nextDiagnostics().then(
      () => undefined,
      (error: unknown) => error,
    );
    await server.connection.sendNotification('workspace/didChangeConfiguration', {
      settings: { bigquerySQLFormatter: { maxNumberOfProblems: -1 } },
    });
    const error = await result;
    expect(error)
      .to.be.instanceOf(Error)
      .with.property('message')
      .that.includes('maxNumberOfProblems must be a non-negative integer');
  });

  it('bounds diagnostic waits when the server sends no response', async () => {
    const result = await server.nextDiagnostics(20).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(result).to.be.instanceOf(Error).with.property('message', 'Timed out waiting for server diagnostics. ');
  });
});

describe('Language server startup failures', function () {
  this.timeout(15000);
  let directory: string;
  let server: ReturnType<typeof startTestServer> | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(path.resolve(__dirname, '../../.startup-failure-'));
    const runtime = path.resolve(__dirname, '..');
    await cp(runtime, directory, {
      recursive: true,
      filter: (source) => source !== path.join(runtime, 'tests'),
    });
  });

  afterEach(async () => {
    try {
      await server?.stop();
    } finally {
      server = undefined;
      await rm(directory, { recursive: true, force: true });
    }
  });

  for (const asset of ['missing WASM', 'invalid grammar', 'missing grammar'] as const) {
    it(`rejects initialization and logs the cause without signaling readiness for ${asset}`, async () => {
      let serverPath = path.join(directory, 'server.js');
      if (asset === 'missing WASM') {
        await rm(path.join(directory, 'linter', 'onig.wasm'));
      } else if (asset === 'invalid grammar') {
        await writeFile(path.join(directory, 'linter', 'syntaxes', 'googlesql.tmLanguage.json'), '{');
      } else {
        serverPath = path.join(directory, 'startup.js');
        await writeFile(
          serverPath,
          [
            "const { GrammarLoader } = require('./linter/grammarLoader');",
            'GrammarLoader.prototype.loadGrammar = async () => null;',
            "require('./server');",
          ].join('\n'),
        );
      }
      server = startTestServer(serverPath);
      const errors: string[] = [];
      let ready = false;
      server.connection.onNotification(LogMessageNotification.type, (params) => {
        if (params.type === MessageType.Error) errors.push(params.message);
      });
      server.connection.onNotification('bigquerySQLFormatter/ready', () => {
        ready = true;
      });
      const causes = {
        'missing WASM': /ENOENT.*onig\.wasm/,
        'invalid grammar': /JSON/,
        'missing grammar': /GoogleSQL grammar was not found/,
      };
      const cause = causes[asset];
      await rejects(
        server.connection.sendRequest(InitializeRequest.type, {
          processId: process.pid,
          capabilities: {},
          rootUri: null,
        }),
        cause,
      );
      expect(errors).to.have.length(1);
      expect(errors[0])
        .to.match(/^Language server initialization failed:/)
        .and.to.match(cause);
      expect(ready).to.equal(false);
    });
  }
});
