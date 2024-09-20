/**
 * @fileoverview Language Server for BigQuery SQL Formatter
 * 
 */

import {
	createConnection,
	TextDocuments,
	Diagnostic,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import {
	Linter
} from './linter/linter';

import { defaultSettings, ServerSettings } from './settings';
// import * as vscode from 'vscode';

// const outputChannel = vscode.window.createOutputChannel('BigQuery SQL Formatter', {log: true});

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.

const connection = createConnection(ProposedFeatures.all);
connection.console.log('Server connection created');

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
connection.console.log('Server text document manager created');

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;
	connection.console.log('Server initialized');

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
			}
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
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The global settings, used when the `workspace/configuration` request is not supported by the client.
let globalSettings: ServerSettings = defaultSettings;
connection.console.log('Server global settings created');

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ServerSettings>> = new Map();
connection.console.log('Server document settings cache created');

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ServerSettings>(
			(change.settings.bigqueryLanguageServer || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ServerSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'bigquerySQLFormatter'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a document has changed. This event is emitted
// when the document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

/**
 * Validates the text document and sends diagnostics to VSCode
 * @name validateTextDocument
 * @param textDocument 
 */
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	// Create the linter
	const linter = new Linter(settings);

	const diagnostics: Diagnostic[] = await linter.verify(textDocument.getText());

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received a file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);

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

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
connection.console.log('Server text document manager listening');

// Listen on the connection
connection.listen();
connection.console.log('Server listening');
