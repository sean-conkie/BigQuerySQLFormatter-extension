import { expect } from 'chai';
import * as path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import {
  InitializeRequest,
  DidOpenTextDocumentNotification,
  DidCloseTextDocumentNotification,
} from 'vscode-languageserver/node';
import { startTestServer } from './serverProcess';

describe('Language server lifecycle', function () {
  this.timeout(15000);
  let server: ReturnType<typeof startTestServer>;
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'bqsql-server-lifecycle-'));
    server = startTestServer();
  });

  afterEach(async () => {
    try {
      await server.stop();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('revalidates open documents using the correct fallback configuration section', async () => {
    const { connection, nextDiagnostics } = server;
    await connection.sendRequest(InitializeRequest.type, { processId: process.pid, capabilities: {}, rootUri: null });
    await connection.sendNotification('workspace/didChangeConfiguration', {
      settings: { bigquerySQLFormatter: { maxNumberOfProblems: 1 } },
    });
    const opened = nextDiagnostics();
    await connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri: pathToFileURL(path.join(directory, 'settings.sql')).href,
        languageId: 'googlesql',
        version: 1,
        text: 'select a = null, b = null\n',
      },
    });
    expect((await opened).diagnostics).to.have.length(1);
    const changed = nextDiagnostics();
    await connection.sendNotification('workspace/didChangeConfiguration', {
      settings: { bigquerySQLFormatter: { maxNumberOfProblems: 0 } },
    });
    expect((await changed).diagnostics).to.deep.equal([]);
  });

  it('does not publish stale diagnostics after close and can reopen the URI', async () => {
    const { connection, nextDiagnostics, diagnostics: published } = server;
    let releaseSettings!: () => void;
    const settingsReady = new Promise<void>((resolve) => {
      releaseSettings = resolve;
    });
    const settingsRequested = new Promise<void>((resolve) => {
      connection.onRequest('workspace/configuration', async () => {
        resolve();
        await settingsReady;
        return [{ maxNumberOfProblems: 100 }];
      });
    });
    await connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: { workspace: { configuration: true } },
      rootUri: null,
    });
    const document = {
      uri: pathToFileURL(path.join(directory, 'lifecycle.sql')).href,
      languageId: 'googlesql',
      version: 1,
      text: '\nselect col\nfrom dataset.table',
    };
    await connection.sendNotification(DidOpenTextDocumentNotification.type, { textDocument: document });
    await settingsRequested;
    await connection.sendNotification(DidCloseTextDocumentNotification.type, { textDocument: { uri: document.uri } });
    expect(await nextDiagnostics()).to.deep.equal({ uri: document.uri, diagnostics: [] });
    // A request is processed after the preceding notifications, without waiting for async validation.
    await connection.sendRequest('textDocument/hover', {
      textDocument: { uri: document.uri },
      position: { line: 0, character: 0 },
    });
    releaseSettings();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(published).to.deep.equal([{ uri: document.uri, diagnostics: [] }]);
    const reopened = nextDiagnostics();
    await connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: { ...document, version: 2 },
    });
    expect((await reopened).diagnostics).not.to.be.empty;
  });
});
