/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as path from 'node:path';
import type { ExtensionApi } from '../extension';
import { coldStartTimeout, phaseTimeout } from './timeouts';

let activationStarted: number | undefined;
let api: ExtensionApi | undefined;

function serverContext(): string {
  return `activationElapsedMs=${activationStarted === undefined ? 'not started' : Date.now() - activationStarted}; serverLog:\n${api?.serverLog().join('\n') || '(no server logs captured yet; see extension host logs)'}`;
}

export async function waitForServer(): Promise<void> {
  const ext = vscode.extensions.getExtension<ExtensionApi>('sean-conkie.bigquerysqlformatter');
  if (!ext) throw new Error('BigQuery SQL Formatter extension was not found');
  activationStarted ??= Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        const started = performance.now();
        const cold = !ext.isActive;
        api = await ext.activate();
        await api.ready();
        if (cold) console.log(`BigQuery activation to server ready: ${(performance.now() - started).toFixed(1)}ms`);
      })(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `Timed out waiting for language server readiness after ${coldStartTimeout}ms; ${serverContext()}`,
            ),
          );
        }, coldStartTimeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function activate(docUri: vscode.Uri) {
  await waitForServer();
  const doc = await vscode.workspace.openTextDocument(docUri);
  return vscode.window.showTextDocument(doc);
}

export async function warmUp(): Promise<void> {
  const started = Date.now();
  await waitForServer();
  const uri = getDocUri('diagnostics.bqsql');
  try {
    await activate(uri);
    await waitForDiagnostics(
      uri,
      (diagnostics) => diagnostics.length > 0,
      'cold-start validation',
      Math.max(1, coldStartTimeout - (Date.now() - started)),
    );
  } finally {
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  }
}

export function waitForDiagnostics(
  docUri: vscode.Uri,
  matches: (diagnostics: readonly vscode.Diagnostic[]) => boolean,
  phase = 'diagnostics',
  timeoutMs = phaseTimeout,
): Promise<readonly vscode.Diagnostic[]> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.dispose();
      const document = vscode.workspace.textDocuments.find((entry) => entry.uri.toString() === docUri.toString());
      const settings = vscode.workspace.getConfiguration('editor', document);
      reject(
        new Error(
          `Timed out waiting for ${phase} after ${Date.now() - started}ms (limit ${timeoutMs}ms) for ${docUri.toString()}: ${JSON.stringify(
            vscode.languages.getDiagnostics(docUri),
          )}; document=${JSON.stringify(
            document && {
              text: document.getText(),
              version: document.version,
              dirty: document.isDirty,
              language: document.languageId,
              formatter: settings.get('defaultFormatter'),
              formatOnSave: settings.get('formatOnSave'),
              formatOnSaveMode: settings.get('formatOnSaveMode'),
            },
          )}; ${serverContext()}`,
        ),
      );
    }, timeoutMs);
    const subscription = vscode.languages.onDidChangeDiagnostics((event) => {
      if (!event.uris.some((uri) => uri.toString() === docUri.toString())) {
        return;
      }
      checkDiagnostics();
    });
    const checkDiagnostics = () => {
      const diagnostics = vscode.languages.getDiagnostics(docUri);
      if (matches(diagnostics)) {
        clearTimeout(timeout);
        subscription.dispose();
        resolve(diagnostics);
      }
    };
    // Unchanged diagnostics need not emit another event. Subscribe before checking
    // the current state so a publication cannot be missed between those steps.
    checkDiagnostics();
  });
}

export const getDocPath = (p: string) => {
  return path.resolve(__dirname, '../../testFixture', p);
};
export const getDocUri = (p: string) => {
  return vscode.Uri.file(getDocPath(p));
};
