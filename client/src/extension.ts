/*
Extension.ts is the entry point for the extension. It is responsible for activating the extension and starting the language server. 
The extension is activated when the user opens a file with the .sql extension. The language server is started when the extension is activated.
The language server is implemented in the server folder.
*/

import * as path from 'path';
import { commands, Diagnostic,  DiagnosticCollection, workspace, ExtensionContext, window, StatusBarAlignment, languages, TextDocument, Range, StatusBarItem, LogOutputChannel, ViewColumn, Uri } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { listProjects } from './google/resourceManager';
import { RunProvider } from './codeLens/runProvider';
import { DryRunProvider } from './codeLens/dryRunProvider';
import { QueryRowsResponse } from '@google-cloud/bigquery';
import { showResultsInWebview } from './webView';


let client: LanguageClient;
let projects: string[] = [];
let diagnosticCollection: DiagnosticCollection;
let outputChannel: LogOutputChannel;

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for sql documents
		documentSelector: [
			{ scheme: 'file', language: 'sql' },
			{ scheme: 'file', language: 'sql-bigquery' },
			{ scheme: 'file', language: 'googlesql' }
		],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

  // Initialize the DiagnosticCollection
  diagnosticCollection = languages.createDiagnosticCollection('bigQueryRunDiagnostics');
  context.subscriptions.push(diagnosticCollection);

  outputChannel = window.createOutputChannel('BigQuery SQL Formatter', { log: true });
  context.subscriptions.push(outputChannel);

	/**
	 * Wraps a given action with project selection logic.
	 * Ensures that a project is selected before executing the action.
	 * If no project is selected, prompts the user to select one.
	 * 
	 * @param action - The action to be executed, which takes a Range and a TextDocument as parameters.
	 * @param range - The range within the document where the action is to be applied.
	 * @param document - The text document on which the action is to be performed.
	 * @returns A promise that resolves when the action is completed or if no project is selected.
	 */
	const codeLensActionWrapper = async (action: (range: Range, document: TextDocument, projectId: string) => [Diagnostic[], QueryRowsResponse | null], range: Range, document: TextDocument) => {
		const selectedProject: string = context.workspaceState.get(document.uri.toString());

		if (!selectedProject) {
			if (!projects || projects.length === 0) {
				window.showInformationMessage('Fetching projects...');
      	projects = await listProjects();
			}

			if (!projects || projects.length === 0) {
				window.showErrorMessage('No projects found.');
				return;
			}

			await handleProjectSelection(context, statusBarItem);

			const reCheckSelectedProject = context.workspaceState.get(document.uri.toString());
	
			if (!reCheckSelectedProject) {
				window.showErrorMessage('No project selected.');
				return;
			}
		}

		// Show the Output Channel
		outputChannel.show();

		outputChannel.info(`Running action on ${document.uri.toString()}:${range.start.line + 1}:${range.start.character} with project ${selectedProject}`);
		
		const [errors, result] = await action(range, document, selectedProject);

		// Show the results in the Output Channel
		if (errors.length > 0) {
			outputChannel.error(`Errors found in ${document.uri.toString()}:${range.start.line + 1}:${range.start.character}`);
			errors.map((error) => outputChannel.error(`${error.message} at ${document.uri.toString()}:${error.range.start.line + 1}:${error.range.start.character}`));
		} else {
			outputChannel.info(`Successfully executed ${document.uri.toString()}:${range.start.line + 1}:${range.start.character}`);
		}

		// Update the diagnostics collection
		diagnosticCollection.set(document.uri, errors);

		// display the results in a webview if any exist.
		showResultsInWebview(context, result);

	}

	const runProvider = new RunProvider();
	languages.registerCodeLensProvider('googlesql', runProvider);

	commands.registerCommand("bigquerysqlformatter.runStatement", () => {
		workspace.getConfiguration("codelens-sample").update("runStatement", true, true);
	});

	commands.registerCommand("bigquerysqlformatter.disableRunStatement", () => {
		workspace.getConfiguration("bigquerysqlformatter").update("runStatement", false, true);
	});

	commands.registerCommand("bigquerysqlformatter.runStatementAction", codeLensActionWrapper);

	const dryRunProvider = new DryRunProvider();
	languages.registerCodeLensProvider('googlesql', dryRunProvider);

	commands.registerCommand("bigquerysqlformatter.dryRunStatement", () => {
		workspace.getConfiguration("codelens-sample").update("dryRunStatement", true, true);
	});

	commands.registerCommand("bigquerysqlformatter.disableDryRunStatement", () => {
		workspace.getConfiguration("bigquerysqlformatter").update("dryRunStatement", false, true);
	});

	commands.registerCommand("bigquerysqlformatter.dryRunStatementAction", codeLensActionWrapper);

	// Create the language client and start the client.
	client = new LanguageClient(
		'bigqueryLanguageServer',
		'BigQuery Server',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();

  // Create a new status bar item
  const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  statusBarItem.command = 'bigquerysqlformatter.selectProject';
  statusBarItem.text = 'Select Project';
  statusBarItem.tooltip = 'Click to select a project';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

	// Register the command that is invoked when the status bar item is clicked
  context.subscriptions.push(
    commands.registerCommand('bigquerysqlformatter.selectProject', async () => {
			if (!projects || projects.length === 0) {
				window.showInformationMessage('Fetching projects...');
      	projects = await listProjects();
			}

			if (!projects || projects.length === 0) {
				window.showErrorMessage('No projects found.');
				return;
			}

      await handleProjectSelection(context, statusBarItem);
    })
  );

	window.onDidChangeActiveTextEditor((editor) => {
		if (editor) {
			const documentUri = editor.document.uri.toString();
			const selectedProject = context.workspaceState.get(documentUri);
			const statusBarItemText = selectedProject ? `Project: ${selectedProject}` : 'Select Project';
			statusBarItem.text = statusBarItemText;
		}
	});
}

/**
 * Handles the selection of a project from a quick pick list and updates the status bar item
 * with the selected project. The selected project is also stored in the workspace state
 * associated with the current document URI.
 *
 * @param context - The extension context used to store the selected project in the workspace state.
 * @param statusBarItem - The status bar item to update with the selected project.
 * @returns A promise that resolves when the project selection is handled.
 */
async function handleProjectSelection(context: ExtensionContext, statusBarItem: StatusBarItem) {
	const selectedProject = await window.showQuickPick(projects, {
		placeHolder: 'Select a project',
	});

	if (selectedProject) {
		const editor = window.activeTextEditor;
		if (editor) {
			const documentUri = editor.document.uri.toString();

			// Store the selected option against the documentUri
			context.workspaceState.update(documentUri, selectedProject);

			// Update the status bar item text
			statusBarItem.text = `Project: ${selectedProject}`;

			window.showInformationMessage(`Selected '${selectedProject}' for ${editor.document.fileName}`);
		}
	}
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
	return client.stop();
}
