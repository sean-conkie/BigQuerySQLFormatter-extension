import { expect } from 'chai';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as path from 'node:path';
import {
  createProtocolConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type ProtocolConnection,
  InitializeRequest,
  InitializedNotification,
  DidOpenTextDocumentNotification,
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  PublishDiagnosticsNotification,
  type PublishDiagnosticsParams,
  LogMessageNotification,
  type LogMessageParams,
  MessageType,
  CompletionRequest,
  HoverRequest,
  CodeActionRequest,
} from 'vscode-languageserver/node';
import type { ServerSettings } from '../settings';

describe('Language server validation queue', function () {
  this.timeout(15000);
  const uri = 'file:///queued-validation.sql';
  let child: ChildProcessWithoutNullStreams;
  let connection: ProtocolConnection;
  let nextDiagnostics: () => Promise<PublishDiagnosticsParams>;

  beforeEach(() => {
    child = spawn(process.execPath, [path.join(__dirname, '../server.js'), '--stdio']);
    connection = createProtocolConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
    const received: PublishDiagnosticsParams[] = [];
    const waiting: ((params: PublishDiagnosticsParams) => void)[] = [];
    connection.onNotification(PublishDiagnosticsNotification.type, (params) => {
      const resolve = waiting.shift();
      if (resolve) {
        resolve(params);
      } else {
        received.push(params);
      }
    });
    nextDiagnostics = () =>
      new Promise((resolve) => {
        const params = received.shift();
        if (params) {
          resolve(params);
        } else {
          waiting.push(resolve);
        }
      });
    connection.onRequest('client/registerCapability', () => null);
    connection.listen();
  });

  afterEach(() => {
    connection.dispose();
    child.kill();
  });

  it('validates edits and clears diagnostics, completions, and hover on close', async () => {
    const initialized = await connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: {
        workspace: { workspaceFolders: true },
        textDocument: {
          publishDiagnostics: { relatedInformation: true },
        },
      },
      rootUri: null,
    });
    expect(initialized.capabilities.workspace?.workspaceFolders?.supported).to.equal(true);
    await connection.sendNotification(InitializedNotification.type, {});
    await connection.sendNotification('workspace/didChangeConfiguration', {
      settings: {},
    });
    await connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri,
        languageId: 'googlesql',
        version: 1,
        text: '\nselect col\nfrom dataset.table',
      },
    });
    const opened = await nextDiagnostics();
    expect(opened.uri).to.equal(uri);
    expect(opened.diagnostics).not.to.be.empty;
    const actions = await connection.sendRequest(CodeActionRequest.type, {
      textDocument: { uri },
      range: opened.diagnostics[0].range,
      context: { diagnostics: opened.diagnostics },
    });
    expect(actions).to.be.an('array').that.is.not.empty;

    await connection.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: { uri, version: 2 },
      contentChanges: [{ text: 'select abs(-1);\n' }],
    });
    const edited = await nextDiagnostics();
    expect(edited.uri).to.equal(uri);
    expect(edited.diagnostics).not.to.deep.equal(opened.diagnostics);
    const position = {
      textDocument: { uri },
      position: { line: 0, character: 8 },
    };
    const completions = await connection.sendRequest(CompletionRequest.type, position);
    if (!Array.isArray(completions)) {
      throw new Error('Expected an array of function completions');
    }
    expect(completions.map((item) => item.label)).to.include('abs');
    expect(await connection.sendRequest(HoverRequest.type, position)).not.to.equal(null);

    await connection.sendNotification(DidCloseTextDocumentNotification.type, {
      textDocument: { uri },
    });
    expect(await nextDiagnostics()).to.deep.equal({ uri, diagnostics: [] });
    expect(await connection.sendRequest(CompletionRequest.type, position)).to.deep.equal([]);
    expect(await connection.sendRequest(HoverRequest.type, position)).to.equal(null);
  });

  it('logs failed validation, skips queued changes from a closed session, and validates the reopened document', async () => {
    let rejectSettings!: (reason: Error) => void;
    const pendingSettings = new Promise<ServerSettings[]>((_resolve, reject) => {
      rejectSettings = reject;
    });
    let requests = 0;
    const settingsRequested = new Promise<void>((resolve) => {
      connection.onRequest('workspace/configuration', async () => {
        requests++;
        if (requests === 1) {
          resolve();
          return pendingSettings;
        }
        return [{ maxNumberOfProblems: 100 }];
      });
    });
    const validationError = new Promise<LogMessageParams>((resolve) => {
      connection.onNotification(LogMessageNotification.type, (params) => {
        if (params.type === MessageType.Error) {
          resolve(params);
        }
      });
    });
    await connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: { workspace: { configuration: true } },
      rootUri: null,
    });
    await connection.sendNotification(InitializedNotification.type, {});
    await connection.sendNotification('workspace/didChangeConfiguration', {
      settings: {},
    });
    await connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri,
        languageId: 'googlesql',
        version: 1,
        text: 'select stale;\n',
      },
    });
    await settingsRequested;
    await connection.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: { uri, version: 2 },
      contentChanges: [{ text: 'select still_stale;\n' }],
    });
    await connection.sendNotification(DidCloseTextDocumentNotification.type, {
      textDocument: { uri },
    });
    expect(await nextDiagnostics()).to.deep.equal({ uri, diagnostics: [] });
    await connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri,
        languageId: 'googlesql',
        version: 3,
        text: 'select abs(-1);\n',
      },
    });
    rejectSettings(new Error('Intentional settings failure'));
    const error = await validationError;
    expect(error.message).to.include(uri).and.include('Intentional settings failure');
    expect((await nextDiagnostics()).uri).to.equal(uri);
    expect(requests).to.equal(2);
    expect(
      await connection.sendRequest(HoverRequest.type, {
        textDocument: { uri },
        position: { line: 0, character: 8 },
      }),
    ).not.to.equal(null);
  });
});
