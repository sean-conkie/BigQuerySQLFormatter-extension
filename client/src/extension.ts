/*
Extension.ts is the entry point for the extension. It is responsible for activating the extension and starting the language server. 
The extension is activated when the user opens a GoogleSQL document. The language server is started when the extension is activated.
The language server is implemented in the server folder.
*/

import * as path from 'node:path';
import type { ExtensionContext } from 'vscode';

import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'googlesql' }],
  };

  // Create the language client and start the client.
  client = new LanguageClient('bigqueryLanguageServer', 'BigQuery Server', serverOptions, clientOptions);

  // Start the client. This will also launch the server
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
