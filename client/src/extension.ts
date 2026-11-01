/*
Extension.ts is the entry point for the extension. It is responsible for activating the extension and starting the language server. 
The extension is activated when the user opens a GoogleSQL document. The language server is started when the extension is activated.
The language server is implemented in the server folder.
*/

import * as path from 'node:path';
import { workspace, window, type ExtensionContext, type LogOutputChannel, type ViewColumn } from 'vscode';

import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import { registerBigQuery, type BigQueryApi } from './bigquery/loader';
import type { SchemaRequest } from '../../shared/schema';

let client: LanguageClient;

export interface ExtensionApi {
  ready(): Promise<void>;
  serverLog(): readonly string[];
  bigquery: BigQueryApi;
}

export function activate(context: ExtensionContext): ExtensionApi {
  const bigquery = registerBigQuery(context, async (text) => {
    await started;
    return client.sendRequest('bigquerySQLFormatter/sourceTokens', { text });
  });
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));

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
  const configWatcher = workspace.createFileSystemWatcher('**/.bqsqlformatter.json');
  context.subscriptions.push(configWatcher);
  const output = window.createOutputChannel('BigQuery Server', { log: true });
  context.subscriptions.push(output);
  const logs: string[] = [];
  const record = (value: string) => {
    logs.push(...value.split(/\r?\n/).map((line) => `${new Date().toISOString()} ${line.slice(-2000)}`));
    if (logs.length > 80) logs.splice(0, logs.length - 80);
  };
  const logged =
    (method: 'trace' | 'debug' | 'info' | 'warn' | 'error') =>
    (message: string, ...args: unknown[]) => {
      record(`${method}: ${message} ${args.map(String).join(' ')}`);
      output[method](message, ...args);
    };
  const outputChannel: LogOutputChannel = {
    name: output.name,
    get logLevel() {
      return output.logLevel;
    },
    onDidChangeLogLevel: output.onDidChangeLogLevel,
    trace: logged('trace'),
    debug: logged('debug'),
    info: logged('info'),
    warn: logged('warn'),
    error: logged('error'),
    append: (value) => {
      record(value);
      output.append(value);
    },
    appendLine: (value) => {
      record(value);
      output.appendLine(value);
    },
    replace: (value) => {
      record(value);
      output.replace(value);
    },
    clear: () => output.clear(),
    show: (columnOrFocus?: ViewColumn | boolean, preserveFocus?: boolean) => {
      if (typeof columnOrFocus === 'boolean') output.show(columnOrFocus);
      else output.show(columnOrFocus, preserveFocus);
    },
    hide: () => output.hide(),
    dispose: () => output.dispose(),
  };
  const clientOptions: LanguageClientOptions = {
    initializationOptions: { schemaProvider: true },
    documentSelector: [{ scheme: 'file', language: 'googlesql' }],
    synchronize: {
      fileEvents: configWatcher,
    },
    outputChannel,
    traceOutputChannel: outputChannel,
  };

  // Create the language client and start the client.
  client = new LanguageClient('bigquerySQLFormatter', 'BigQuery Server', serverOptions, clientOptions);
  context.subscriptions.push(
    client.onRequest('bigquerySQLFormatter/schema', (request: SchemaRequest, token) => {
      const controller = new AbortController();
      const cancellation = token.onCancellationRequested(() => controller.abort());
      if (token.isCancellationRequested) controller.abort();
      return bigquery.schema(request, controller.signal).finally(() => cancellation.dispose());
    }),
  );

  const ready = new Promise<void>((resolve) => {
    context.subscriptions.push(client.onNotification('bigquerySQLFormatter/ready', () => resolve()));
  });
  const started = Promise.all([client.start(), ready]).then(() => undefined);
  void started.catch((error) => client.error('Language server startup failed', error, true));
  return { ready: () => started, serverLog: () => logs.slice(), bigquery };
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
