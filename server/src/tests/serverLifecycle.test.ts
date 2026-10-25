import { expect } from 'chai';
import * as path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import {
  type ProtocolConnection,
  InitializeRequest,
  InitializedNotification,
  DidOpenTextDocumentNotification,
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  type PublishDiagnosticsParams,
  LogMessageNotification,
  type LogMessageParams,
  MessageType,
  DiagnosticSeverity,
  CompletionRequest,
  HoverRequest,
  CodeActionRequest,
  CancellationTokenSource,
  LSPErrorCodes,
  ResponseError,
  DocumentFormattingRequest,
  DocumentRangeFormattingRequest,
  type CodeAction,
  ShowMessageNotification,
  type ShowMessageParams,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { defaultSettings, type ServerSettings } from '../settings';
import { sourceFixAllKind } from '../linter/linter';
import { startTestServer } from './serverProcess';

describe('Language server validation queue', function () {
  this.timeout(15000);
  let uri: string;
  let testDirectory: string;
  let server: ReturnType<typeof startTestServer>;
  let connection: ProtocolConnection;
  let nextDiagnostics: () => Promise<PublishDiagnosticsParams>;

  beforeEach(async () => {
    testDirectory = await mkdtemp(path.join(tmpdir(), 'bqsql-server-queue-'));
    uri = pathToFileURL(path.join(testDirectory, 'queued-validation.sql')).href;
    server = startTestServer();
    connection = server.connection;
    nextDiagnostics = server.nextDiagnostics;
  });

  afterEach(async () => {
    try {
      await server.stop();
    } finally {
      await rm(testDirectory, { recursive: true, force: true });
    }
  });

  it('advertises and serves document/range formatting and a single document-wide fix-all', async () => {
    const initialized = await connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: {},
      rootUri: null,
    });
    expect(initialized.capabilities.documentFormattingProvider).to.equal(true);
    expect(initialized.capabilities.documentRangeFormattingProvider).to.equal(true);
    expect(initialized.capabilities.codeActionProvider)
      .to.have.property('codeActionKinds')
      .that.includes(sourceFixAllKind);
    await connection.sendNotification('workspace/didChangeConfiguration', {
      settings: { bigquerySQLFormatter: { maxNumberOfProblems: 0 } },
    });
    let document = TextDocument.create(uri, 'googlesql', 1, 'select a = NULL;\nselect b = NULL;\n');
    await connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: { uri, languageId: document.languageId, version: document.version, text: document.getText() },
    });
    expect((await nextDiagnostics()).diagnostics).to.deep.equal([]);
    const actions = await connection.sendRequest(CodeActionRequest.type, {
      textDocument: { uri },
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      context: { diagnostics: [], only: ['source.fixAll'] },
    });
    expect(actions).to.have.length(1);
    expect(actions![0]).to.have.property('kind', sourceFixAllKind);
    const fixAll = actions![0] as CodeAction;
    expect(TextDocument.applyEdits(document, fixAll.edit!.changes![uri])).to.equal(
      'select a is null;\nselect b is null;\n',
    );
    const options = { tabSize: 2, insertSpaces: true };
    const selection = await connection.sendRequest(DocumentRangeFormattingRequest.type, {
      textDocument: { uri },
      options,
      range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } },
    });
    expect(TextDocument.applyEdits(document, selection ?? [])).to.equal('select a = NULL;\nselect b is null;\n');
    const edits = await connection.sendRequest(DocumentFormattingRequest.type, { textDocument: { uri }, options });
    const text = TextDocument.applyEdits(document, edits ?? []);
    expect(text).to.equal('select a is null;\nselect b is null;\n');
    document = TextDocument.create(uri, 'googlesql', 2, text);
    await connection.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: { uri, version: 2 },
      contentChanges: [{ text }],
    });
    expect(
      await connection.sendRequest(DocumentFormattingRequest.type, { textDocument: { uri }, options }),
    ).to.deep.equal([]);
    await nextDiagnostics();
    await connection.sendNotification(DidCloseTextDocumentNotification.type, { textDocument: { uri } });
    await nextDiagnostics();
    expect(
      await connection.sendRequest(DocumentFormattingRequest.type, { textDocument: { uri }, options }),
    ).to.deep.equal([]);
  });

  it('revalidates live option changes and project overrides without reopening documents', async () => {
    await connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: {},
      rootUri: pathToFileURL(testDirectory).href,
    });
    const setEditorPolicy = (policy: string) =>
      connection.sendNotification('workspace/didChangeConfiguration', {
        settings: {
          bigquerySQLFormatter: {
            rules: { CP04: { severity: 'error', options: { capitalisation_policy: policy } } },
          },
        },
      });
    await setEditorPolicy('upper');
    await connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: { uri, languageId: 'googlesql', version: 1, text: 'select TRUE, null;\n' },
    });
    const literalDiagnostics = async () =>
      (await nextDiagnostics()).diagnostics.filter((diagnostic) => String(diagnostic.code).startsWith('CP04:'));
    let diagnostics = await literalDiagnostics();
    expect(diagnostics.map((diagnostic) => diagnostic.range.start.character)).to.deep.equal([13]);
    expect(diagnostics[0].severity).to.equal(DiagnosticSeverity.Error);

    await setEditorPolicy('lower');
    expect((await literalDiagnostics()).map((diagnostic) => diagnostic.range.start.character)).to.deep.equal([7]);

    const configPath = path.join(testDirectory, '.bqsqlformatter.json');
    const notifyProject = (type: number) =>
      connection.sendNotification('workspace/didChangeWatchedFiles', {
        changes: [{ uri: pathToFileURL(configPath).href, type }],
      });
    await writeFile(configPath, '{"rules":{"CP04":{"options":{"capitalisation_policy":"upper"}}}}');
    await notifyProject(1);
    diagnostics = await literalDiagnostics();
    expect(diagnostics.map((diagnostic) => diagnostic.range.start.character)).to.deep.equal([13]);
    expect(diagnostics[0].severity).to.equal(DiagnosticSeverity.Error);
    await writeFile(configPath, '{"rules":{"CP04":{"options":{"capitalisation_policy":"lower"}}}}');
    await notifyProject(2);
    expect((await literalDiagnostics()).map((diagnostic) => diagnostic.range.start.character)).to.deep.equal([7]);
    await setEditorPolicy('upper');
    expect((await literalDiagnostics()).map((diagnostic) => diagnostic.range.start.character)).to.deep.equal([7]);
    await rm(configPath);
    await notifyProject(3);
    expect((await literalDiagnostics()).map((diagnostic) => diagnostic.range.start.character)).to.deep.equal([13]);
  });

  it('reports invalid resource-scoped and project options visibly while continuing with defaults', async () => {
    let policy = 'upper';
    connection.onRequest('workspace/configuration', () => [
      {
        rules: { CP04: { options: { capitalisation_policy: policy } } },
      },
    ]);
    await connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: { workspace: { configuration: true } },
      rootUri: pathToFileURL(testDirectory).href,
    });
    await connection.sendNotification(InitializedNotification.type, {});
    await connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: { uri, languageId: 'googlesql', version: 1, text: 'select TRUE, null;\n' },
    });
    const literalPositions = async () =>
      (await nextDiagnostics()).diagnostics
        .filter((diagnostic) => String(diagnostic.code).startsWith('CP04:'))
        .map((diagnostic) => diagnostic.range.start.character);
    expect(await literalPositions()).to.deep.equal([13]);

    for (const source of ['editor', 'project']) {
      let resolveMessage!: (params: ShowMessageParams) => void;
      const message = new Promise<ShowMessageParams>((resolve) => {
        resolveMessage = resolve;
      });
      const listener = connection.onNotification(ShowMessageNotification.type, resolveMessage);
      try {
        if (source === 'editor') {
          policy = 'invalid';
          await connection.sendNotification('workspace/didChangeConfiguration', { settings: {} });
        } else {
          const configPath = path.join(testDirectory, '.bqsqlformatter.json');
          await writeFile(configPath, '{"rules":{"CP04":{"options":{"unknown":true}}}}');
          await connection.sendNotification('workspace/didChangeWatchedFiles', {
            changes: [{ uri: pathToFileURL(configPath).href, type: 1 }],
          });
        }
        const error = await message;
        expect(error.type).to.equal(MessageType.Error);
        expect(error.message).to.include('rules.CP04.options').and.include('using rule option defaults');
        if (source === 'project') expect(error.message).to.include('.bqsqlformatter.json');
        expect(await literalPositions()).to.deep.equal([7]);
      } finally {
        listener.dispose();
      }
      policy = 'upper';
      if (source === 'editor') {
        await connection.sendNotification('workspace/didChangeConfiguration', { settings: {} });
        expect(await literalPositions()).to.deep.equal([13]);
      }
    }
    const document = TextDocument.create(uri, 'googlesql', 1, 'select TRUE, null;\n');
    const edits = await connection.sendRequest(DocumentFormattingRequest.type, {
      textDocument: { uri },
      options: { tabSize: 2, insertSpaces: true },
    });
    expect(TextDocument.applyEdits(document, edits ?? [])).to.equal('select true, null;\n');
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

  it('coalesces rapid incremental and multi-change edits and publishes only the latest version', async () => {
    await connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: {},
      rootUri: null,
    });
    await connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: { uri, languageId: 'googlesql', version: 1, text: 'select a;\n' },
    });
    await nextDiagnostics();
    const received = server.diagnostics;
    received.length = 0;
    await connection.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: { uri, version: 2 },
      contentChanges: [{ range: { start: { line: 0, character: 7 }, end: { line: 0, character: 8 } }, text: 'ifnull' }],
    });
    await connection.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: { uri, version: 3 },
      contentChanges: [
        { range: { start: { line: 0, character: 13 }, end: { line: 0, character: 13 } }, text: '(1, 0)' },
      ],
    });
    await connection.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: { uri, version: 4 },
      contentChanges: [
        { range: { start: { line: 0, character: 7 }, end: { line: 0, character: 13 } }, text: 'nvl' },
        { range: { start: { line: 0, character: 10 }, end: { line: 0, character: 11 } }, text: '(' },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(received).to.deep.equal([]);
    await nextDiagnostics();
    expect(received).to.have.length(1);
    expect(received[0].version).to.equal(4);
    expect(received[0].diagnostics.find((diagnostic) => diagnostic.code === 'CV02: coalesce')?.range).to.deep.equal({
      start: { line: 0, character: 7 },
      end: { line: 0, character: 10 },
    });
  });

  it('reloads created, edited, and deleted project settings with resource-scoped overrides', async () => {
    const directory = await mkdtemp(path.join(testDirectory, 'config-'));
    const nested = path.join(directory, 'queries');
    const configPath = path.join(directory, '.bqsqlformatter.json');
    const configUri = pathToFileURL(configPath).href;
    const documentUri = pathToFileURL(path.join(nested, 'query.sql')).href;
    const cv05 = (result: PublishDiagnosticsParams) =>
      result.diagnostics.find((diagnostic) => String(diagnostic.code).startsWith('CV05:'));
    let editorSettings: ServerSettings = { ...defaultSettings, rules: { CV05: { severity: 'hint' } } };
    connection.onRequest('workspace/configuration', (params: { items: { scopeUri: string }[] }) => {
      expect(params.items[0].scopeUri).to.equal(documentUri);
      return [editorSettings];
    });
    try {
      await mkdir(nested);
      await connection.sendRequest(InitializeRequest.type, {
        processId: process.pid,
        capabilities: { workspace: { configuration: true } },
        rootUri: pathToFileURL(directory).href,
      });
      await connection.sendNotification(DidOpenTextDocumentNotification.type, {
        textDocument: { uri: documentUri, languageId: 'googlesql', version: 1, text: 'select a = null;\n' },
      });
      expect(cv05(await nextDiagnostics())?.severity).to.equal(DiagnosticSeverity.Hint);
      await writeFile(configPath, '{"rules":{"CV05":{"enabled":false}}}');
      await connection.sendNotification('workspace/didChangeWatchedFiles', { changes: [{ uri: configUri, type: 1 }] });
      expect(cv05(await nextDiagnostics())).to.equal(undefined);
      await writeFile(configPath, '{"rules":{"CV05":{"enabled":true,"severity":"error"}}}');
      await connection.sendNotification('workspace/didChangeWatchedFiles', { changes: [{ uri: configUri, type: 2 }] });
      expect(cv05(await nextDiagnostics())?.severity).to.equal(DiagnosticSeverity.Error);
      await rm(configPath);
      await connection.sendNotification('workspace/didChangeWatchedFiles', { changes: [{ uri: configUri, type: 3 }] });
      expect(cv05(await nextDiagnostics())?.severity).to.equal(DiagnosticSeverity.Hint);
      editorSettings = { ...defaultSettings, rules: { CV05: { severity: 'hint', enabled: false } } };
      await connection.sendNotification('workspace/didChangeConfiguration', { settings: {} });
      expect(cv05(await nextDiagnostics())).to.equal(undefined);
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it('reports invalid project configuration visibly and recovers after a watched edit', async () => {
    const directory = await mkdtemp(path.join(testDirectory, 'invalid-config-'));
    const configPath = path.join(directory, '.bqsqlformatter.json');
    const documentUri = pathToFileURL(path.join(directory, 'query.sql')).href;
    const shownError = new Promise<string>((resolve) => {
      connection.onNotification('window/showMessage', (params: { message: string }) => resolve(params.message));
    });
    try {
      await writeFile(configPath, '{"rules":{"CV05":{"severity":"fatal"}}}');
      await connection.sendRequest(InitializeRequest.type, {
        processId: process.pid,
        capabilities: {},
        rootUri: pathToFileURL(directory).href,
      });
      await connection.sendNotification(DidOpenTextDocumentNotification.type, {
        textDocument: { uri: documentUri, languageId: 'googlesql', version: 1, text: 'select a = null;\n' },
      });
      expect(await shownError)
        .to.include(configPath)
        .and.include('severity');
      await writeFile(configPath, '{"rules":{"CV05":{"severity":"error"}}}');
      await connection.sendNotification('workspace/didChangeWatchedFiles', {
        changes: [{ uri: pathToFileURL(configPath).href, type: 2 }],
      });
      expect(
        (await nextDiagnostics()).diagnostics.find((diagnostic) => String(diagnostic.code).startsWith('CV05:'))
          ?.severity,
      ).to.equal(DiagnosticSeverity.Error);
    } finally {
      await rm(directory, { recursive: true });
    }
  });

  it('honours LSP cancellation of a code-action request while awaiting settings', async () => {
    let release!: (settings: ServerSettings[]) => void;
    const settings = new Promise<ServerSettings[]>((resolve) => {
      release = resolve;
    });
    const requested = new Promise<void>((resolve) => {
      connection.onRequest('workspace/configuration', () => {
        resolve();
        return settings;
      });
    });
    await connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: { workspace: { configuration: true } },
      rootUri: null,
    });
    await connection.sendNotification(DidOpenTextDocumentNotification.type, {
      textDocument: { uri, languageId: 'googlesql', version: 1, text: 'select 1;\n' },
    });
    await requested;
    const source = new CancellationTokenSource();
    const result = connection
      .sendRequest(
        CodeActionRequest.type,
        {
          textDocument: { uri },
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          context: { diagnostics: [] },
        },
        source.token,
      )
      .then(
        () => null,
        (error: unknown) => error,
      );
    const position = { textDocument: { uri }, position: { line: 0, character: 0 } };
    await connection.sendRequest(HoverRequest.type, position);
    source.cancel();
    await connection.sendRequest(HoverRequest.type, position);
    try {
      expect(await result)
        .to.be.instanceOf(ResponseError)
        .with.property('code', LSPErrorCodes.RequestCancelled);
    } finally {
      release([defaultSettings]);
      source.dispose();
    }
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
    rejectSettings(new Error('Intentional settings failure'));
    const error = await validationError;
    expect(error.message).to.include(uri).and.include('Intentional settings failure');
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
