
import { DidChangeTextDocumentParams, Diagnostic,	TextDocumentItem, PublishDiagnosticsParams } from 'vscode-languageserver/node';
import { Linter } from './linter/linter';
import { ServerSettings } from './settings';

export async function validateTextDocument(textDocument: TextDocumentItem, settings: ServerSettings): Promise<PublishDiagnosticsParams> {
	// Create the linter
	const linter = new Linter(settings);

	const diagnostics: Diagnostic[] = await linter.verify(textDocument);

	// Send the computed diagnostics to VSCode.
	return { uri: textDocument.uri, diagnostics };
}

export async function validateTextDocumentChanges(textDocumentChangeParams: DidChangeTextDocumentParams, settings: ServerSettings): Promise<PublishDiagnosticsParams> {
	// Create the linter
	const linter = new Linter(settings);

	const diagnostics: Diagnostic[] = await linter.verifyChanges(textDocumentChangeParams);

	// Send the computed diagnostics to VSCode.
	return { uri: textDocumentChangeParams.textDocument.uri, diagnostics };
}