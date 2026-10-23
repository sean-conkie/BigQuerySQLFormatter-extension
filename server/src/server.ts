import {
  createConnection,
  ProposedFeatures,
  type InitializeParams,
  DidChangeConfigurationNotification,
  type CompletionItem,
  type TextDocumentPositionParams,
  TextDocumentSyncKind,
  type InitializeResult,
  CodeActionKind,
  type CodeActionParams,
  type CodeAction,
  type HoverParams,
  type Hover,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { defaultSettings, documentSettings, getDocumentSettings, type ServerSettings } from './settings';
import { closeTextDocument, getDocumentLinter, validateTextDocument } from './validate';
import { CompletionBuilder } from './completions';
import { ValidationScheduler } from './validationScheduler';
import { awaitWithCancellation, checkCancellation } from './cancellation';

const connection = createConnection(ProposedFeatures.all);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
let globalSettings: ServerSettings = defaultSettings;
const documents = new Map<string, TextDocument>();
const validations = new ValidationScheduler(
  (diagnostics) => {
    connection.sendDiagnostics(diagnostics);
  },
  (message) => connection.console.error(message),
);

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
      const settings = await awaitWithCancellation(
        getDocumentSettings(document.uri, connection, globalSettings, hasConfigurationCapability),
        token,
      );
      checkCancellation(token);
      return validateTextDocument(snapshot, settings, token);
    },
    delay,
  );
}

// region event handlers

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

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
      },
      codeActionProvider: {
        codeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll],
      },
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
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
});

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = { ...defaultSettings, ...change.settings.bigquerySQLFormatter };
  }
  for (const document of documents.values()) {
    validateDocument(document);
  }
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
  const settings = await awaitWithCancellation(
    getDocumentSettings(params.textDocument.uri, connection, globalSettings, hasConfigurationCapability),
    token,
  );
  checkCancellation(token);
  if (!documents.has(params.textDocument.uri)) return [];
  const linter = getDocumentLinter(params.textDocument.uri, settings);
  return linter.createCodeActions(params);
});

connection.onCompletion((params: TextDocumentPositionParams): CompletionItem[] => {
  const completionBuilder = new CompletionBuilder(params.textDocument.uri);
  return completionBuilder.getCompletions(params);
});

connection.onHover((params: HoverParams): Hover | null => {
  const completionBuilder = new CompletionBuilder(params.textDocument.uri);
  return completionBuilder.getHover(params);
});

connection.listen();
// endregion event handlers
