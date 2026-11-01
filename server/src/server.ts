import {
  createConnection,
  ProposedFeatures,
  type InitializeParams,
  DidChangeConfigurationNotification,
  type CompletionItem,
  type CompletionList,
  type TextDocumentPositionParams,
  TextDocumentSyncKind,
  type InitializeResult,
  CodeActionKind,
  type CodeActionParams,
  type CodeAction,
  type HoverParams,
  type Hover,
  ShowMessageNotification,
  MessageType,
  type CancellationToken,
  type Range,
  type TextEdit,
  LSPErrorCodes,
  ResponseError,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  defaultSettings,
  documentSettings,
  getDocumentSettings,
  mergeSettings,
  parseSettings,
  type ServerSettings,
} from './settings';
import { closeTextDocument, validateTextDocument } from './validate';
import { createDocumentCodeActions, formatDocument } from './formatting';
import { sourceFixAllKind } from './linter/linter';
import { CompletionBuilder } from './completions';
import { SchemaBuilder, type SchemaProvider } from './completions/schema';
import type { SchemaResponse } from '../../shared/schema';
import { ValidationScheduler } from './validationScheduler';
import { awaitWithCancellation, checkCancellation } from './cancellation';
import { GrammarLoader } from './linter/grammarLoader';
import { tokenizeSource } from './linter/rules/source';

const connection = createConnection(ProposedFeatures.all);

connection.onRequest('bigquerySQLFormatter/sourceTokens', ({ text }: { text: string }) => tokenizeSource(text));

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
let hasSchemaProvider = false;
let globalSettings: ServerSettings = defaultSettings;
let workspaceUris: string[] = [];
const documents = new Map<string, TextDocument>();
const validations = new ValidationScheduler(
  (diagnostics) => {
    connection.sendDiagnostics(diagnostics);
  },
  (message) => connection.console.error(message),
);

function reportConfigurationError(message: string): void {
  connection.console.error(message);
  void connection.sendNotification(ShowMessageNotification.type, { type: MessageType.Error, message });
}

function reportFormattingWarning(message: string): void {
  connection.console.warn(message);
  void connection.sendNotification(ShowMessageNotification.type, { type: MessageType.Warning, message });
}

async function settingsForDocument(uri: string): Promise<ServerSettings> {
  try {
    return await getDocumentSettings(
      uri,
      connection,
      globalSettings,
      hasConfigurationCapability,
      workspaceUris,
      (message) => reportConfigurationError(`Unable to configure ${uri}: ${message}`),
    );
  } catch (error) {
    const message = `Unable to configure ${uri}: ${error instanceof Error ? error.message : String(error)}`;
    void connection.sendNotification(ShowMessageNotification.type, { type: MessageType.Error, message });
    throw error;
  }
}

function revalidateDocuments(): void {
  documentSettings.clear();
  for (const document of documents.values()) validateDocument(document);
}

function validateDocument(document: TextDocument, delay = 0): void {
  const snapshot = {
    uri: document.uri,
    languageId: document.languageId,
    version: document.version,
    text: document.getText(),
  };
  validations.schedule(
    document.uri,
    async (token) => {
      const settings = await awaitWithCancellation(settingsForDocument(document.uri), token);
      checkCancellation(token);
      return validateTextDocument(snapshot, settings, token);
    },
    delay,
  );
}

// region event handlers

connection.onInitialize(async (params: InitializeParams) => {
  const capabilities = params.capabilities;
  hasSchemaProvider = params.initializationOptions?.schemaProvider === true;
  workspaceUris = params.workspaceFolders?.map((folder) => folder.uri) ?? (params.rootUri ? [params.rootUri] : []);

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
  hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
  hasDiagnosticRelatedInformationCapability = !!capabilities.textDocument?.publishDiagnostics?.relatedInformation;

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['.'],
      },
      codeActionProvider: {
        codeActionKinds: [CodeActionKind.QuickFix, sourceFixAllKind],
      },
      documentFormattingProvider: true,
      documentRangeFormattingProvider: true,
      hoverProvider: true,
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  connection.console.info('Loading GoogleSQL grammar and Oniguruma WASM');
  try {
    const grammar = await new GrammarLoader().loadGrammar('source.googlesql');
    if (!grammar) throw new Error('GoogleSQL grammar was not found');
  } catch (error) {
    connection.console.error(`Language server initialization failed: ${String(error)}`);
    throw error;
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((event) => {
      const removed = new Set(event.removed.map((folder) => folder.uri));
      workspaceUris = [...workspaceUris.filter((uri) => !removed.has(uri)), ...event.added.map((folder) => folder.uri)];
      revalidateDocuments();
    });
  }
  connection.console.info('GoogleSQL language server ready');
  void connection.sendNotification('bigquerySQLFormatter/ready');
});

connection.onDidChangeConfiguration((change) => {
  if (!hasConfigurationCapability) {
    try {
      globalSettings = mergeSettings(
        defaultSettings,
        parseSettings(change.settings?.bigquerySQLFormatter ?? {}, (message) =>
          reportConfigurationError(`Invalid BigQuery SQL Formatter settings: ${message}`),
        ),
      );
    } catch (error) {
      const message = `Invalid BigQuery SQL Formatter settings: ${error instanceof Error ? error.message : String(error)}`;
      connection.console.error(message);
      void connection.sendNotification(ShowMessageNotification.type, { type: MessageType.Error, message });
      return;
    }
  }
  revalidateDocuments();
});

connection.onDidChangeWatchedFiles((params) => {
  if (params.changes.some((change) => change.uri.endsWith('/.bqsqlformatter.json'))) revalidateDocuments();
});

connection.onDidOpenTextDocument((params) => {
  const document = TextDocument.create(
    params.textDocument.uri,
    params.textDocument.languageId,
    params.textDocument.version,
    params.textDocument.text,
  );
  documents.set(document.uri, document);
  validateDocument(document);
});

connection.onDidChangeTextDocument((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document || params.textDocument.version <= document.version) {
    connection.console.warn(`Ignoring change for closed document or stale version: ${params.textDocument.uri}`);
    return;
  }
  TextDocument.update(document, params.contentChanges, params.textDocument.version);
  validateDocument(document, 250);
});

connection.onDidCloseTextDocument((params) => {
  validations.cancel(params.textDocument.uri);
  documents.delete(params.textDocument.uri);
  connection.sendDiagnostics(closeTextDocument(params.textDocument.uri));
});

connection.onCodeAction(async (params: CodeActionParams, token): Promise<CodeAction[]> => {
  checkCancellation(token);
  const settings = await awaitWithCancellation(settingsForDocument(params.textDocument.uri), token);
  checkCancellation(token);
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];
  const version = document.version;
  const actions = await createDocumentCodeActions(document, settings, params, token, reportFormattingWarning);
  ensureCurrentDocument(document, version);
  return actions;
});

function ensureCurrentDocument(document: TextDocument, version: number): void {
  if (documents.get(document.uri) !== document || document.version !== version) {
    throw new ResponseError(LSPErrorCodes.ContentModified, 'Document changed while computing fixes.');
  }
}

async function formatting(uri: string, range: Range | undefined, token: CancellationToken): Promise<TextEdit[]> {
  checkCancellation(token);
  const settings = await awaitWithCancellation(settingsForDocument(uri), token);
  checkCancellation(token);
  const document = documents.get(uri);
  if (!document) return [];
  const version = document.version;
  const edits = await formatDocument(document, settings, range, token, reportFormattingWarning);
  ensureCurrentDocument(document, version);
  return edits;
}

connection.onDocumentFormatting((params, token) => formatting(params.textDocument.uri, undefined, token));
connection.onDocumentRangeFormatting((params, token) => formatting(params.textDocument.uri, params.range, token));

const schemaProvider: SchemaProvider = (request, token) =>
  connection.sendRequest<SchemaResponse>('bigquerySQLFormatter/schema', request, token);

connection.onCompletion(
  async (params: TextDocumentPositionParams, token): Promise<CompletionItem[] | CompletionList> => {
    checkCancellation(token);
    const completionBuilder = new CompletionBuilder(params.textDocument.uri);
    const functions = completionBuilder.getCompletions(params);
    const document = documents.get(params.textDocument.uri);
    if (!document || !hasSchemaProvider) return functions;
    const schema = await new SchemaBuilder(document, schemaProvider).completions(params.position, token);
    return schema ? { isIncomplete: schema.isIncomplete, items: [...schema.items, ...functions] } : functions;
  },
);

connection.onHover(async (params: HoverParams, token): Promise<Hover | null> => {
  checkCancellation(token);
  const completionBuilder = new CompletionBuilder(params.textDocument.uri);
  const functions = completionBuilder.getHover(params);
  if (functions) return functions;
  const document = documents.get(params.textDocument.uri);
  return document && hasSchemaProvider
    ? new SchemaBuilder(document, schemaProvider).hover(params.position, token)
    : null;
});

connection.listen();
// endregion event handlers
