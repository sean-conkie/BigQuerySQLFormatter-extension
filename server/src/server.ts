import {
	createConnection,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	CodeActionKind,
	CodeActionParams,
	CodeAction,
	HoverParams,
	Hover
} from 'vscode-languageserver/node';
import { defaultSettings, documentSettings, getDocumentSettings, ServerSettings } from './settings';
import { Linter } from './linter/linter';
import { validateTextDocument, validateTextDocumentChanges } from './validate';
import { CompletionBuilder } from './completions';

const connection = createConnection(ProposedFeatures.all);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
let globalSettings: ServerSettings = defaultSettings;

// region event handlers

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			},
			codeActionProvider: {
				codeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll]
			},
			hoverProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
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
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
		});
	}
});

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ServerSettings>(
			(change.settings.bigqueryLanguageServer || defaultSettings)
		);
	}
});

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received a file change event');
});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

connection.onDidOpenTextDocument(async (params) => {
	connection.sendDiagnostics(await validateTextDocument(params.textDocument, await getDocumentSettings(params.textDocument.uri, connection, globalSettings, hasConfigurationCapability)));
});

connection.onDidChangeTextDocument(async (params) => {
	connection.sendDiagnostics(await validateTextDocumentChanges(params, await getDocumentSettings(params.textDocument.uri, connection, globalSettings, hasConfigurationCapability)));
});

connection.onCodeAction(async (params: CodeActionParams): Promise<CodeAction[]> => {
	const linter = new Linter(globalSettings);
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
