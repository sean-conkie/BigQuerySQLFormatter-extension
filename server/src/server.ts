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
  type PublishDiagnosticsParams,
} from 'vscode-languageserver/node';
import { defaultSettings, documentSettings, getDocumentSettings, type ServerSettings } from './settings';
import { Linter } from './linter/linter';
import { closeTextDocument, validateTextDocument, validateTextDocumentChanges } from './validate';
import { CompletionBuilder } from './completions';
import { globalTokenCache } from './linter/parser/tokenCache';

const connection = createConnection(ProposedFeatures.all);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
let globalSettings: ServerSettings = defaultSettings;
const documentSessions = new Map<string, symbol>();
const pendingValidations = new Map<string, Promise<void>>();

function validateDocument(uri: string, validate: () => Promise<PublishDiagnosticsParams>): void {
  const session = documentSessions.get(uri);
  const pending = (pendingValidations.get(uri) ?? Promise.resolve())
    .then(async () => {
      if (documentSessions.get(uri) !== session) {
        return;
      }
      const diagnostics = await validate();
      if (documentSessions.get(uri) === session) {
        connection.sendDiagnostics(diagnostics);
      } else {
        closeTextDocument(uri);
      }
    })
    .catch((error) => {
      connection.console.error(`Validation failed for ${uri}: ${String(error)}`);
    })
    .finally(() => {
      if (pendingValidations.get(uri) === pending) {
        pendingValidations.delete(uri);
      }
    });
  pendingValidations.set(uri, pending);
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
        resolveProvider: true,
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
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {});
  }
});

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = { ...defaultSettings, ...change.settings.bigquerySQLFormatter };
  }
  for (const uri of documentSessions.keys()) {
    validateDocument(uri, async () => {
      const settings = await getDocumentSettings(uri, connection, globalSettings, hasConfigurationCapability);
      return validateTextDocument(
        {
          uri,
          languageId: 'googlesql',
          version: 0,
          text: globalTokenCache.get(uri)!.getText(),
        },
        settings,
      );
    });
  }
});

connection.onDidChangeWatchedFiles((_change) => {
  // Monitored files have change in VSCode
  connection.console.log('We received a file change event');
});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  if (item.data === 1) {
    item.detail = 'TypeScript details';
    item.documentation = 'TypeScript documentation';
  } else if (item.data === 2) {
    item.detail = 'JavaScript details';
    item.documentation = 'JavaScript documentation';
  }
  return item;
});

connection.onDidOpenTextDocument((params) => {
  documentSessions.set(params.textDocument.uri, Symbol());
  validateDocument(params.textDocument.uri, async () =>
    validateTextDocument(
      params.textDocument,
      await getDocumentSettings(params.textDocument.uri, connection, globalSettings, hasConfigurationCapability),
    ),
  );
});

connection.onDidChangeTextDocument((params) => {
  validateDocument(params.textDocument.uri, async () =>
    validateTextDocumentChanges(
      params,
      await getDocumentSettings(params.textDocument.uri, connection, globalSettings, hasConfigurationCapability),
    ),
  );
});

connection.onDidCloseTextDocument((params) => {
  documentSessions.delete(params.textDocument.uri);
  connection.sendDiagnostics(closeTextDocument(params.textDocument.uri));
});

connection.onCodeAction(async (params: CodeActionParams): Promise<CodeAction[]> => {
  const linter = new Linter(
    await getDocumentSettings(params.textDocument.uri, connection, globalSettings, hasConfigurationCapability),
  );
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
