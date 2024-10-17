/*
Extension.ts is the entry point for the extension. It is responsible for activating the extension and starting the language server. 
The extension is activated when the user opens a file with the .sql extension. The language server is started when the extension is activated.
The language server is implemented in the server folder.
*/

import * as path from 'path';
import { commands, workspace, ExtensionContext, window, StatusBarAlignment } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

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
  statusBarItem.command = 'extension.selectOption';
  statusBarItem.text = 'Select Option';
  statusBarItem.tooltip = 'Click to select an option';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

	// Register the command that is invoked when the status bar item is clicked
  context.subscriptions.push(
    commands.registerCommand('extension.selectOption', async () => {
      const options = ['Option 1', 'Option 2', 'Option 3'];
      const selectedProject = await window.showQuickPick(options, {
        placeHolder: 'Select an option',
      });

      if (selectedProject) {
        const editor = window.activeTextEditor;
        if (editor) {
          const documentUri = editor.document.uri.toString();

          // Store the selected option against the documentUri
					context.workspaceState.update(documentUri, selectedProject);

          // Optionally, send the selected option to the server via LSP
          client.sendNotification('custom/optionSelected', {
            uri: documentUri,
            option: selectedProject,
          });

          // Update the status bar item text
          statusBarItem.text = `Option: ${selectedProject}`;

          window.showInformationMessage(`Selected '${selectedProject}' for ${editor.document.fileName}`);
        }
      }
    })
  );

	window.onDidChangeActiveTextEditor((editor) => {
		if (editor) {
			const documentUri = editor.document.uri.toString();
			const selectedProject = context.workspaceState.get(documentUri) || 'Select Option';
			statusBarItem.text = `Option: ${selectedProject}`;
		}
	});
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
