/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as path from 'node:path';

export async function activate(docUri: vscode.Uri) {
  const ext = vscode.extensions.getExtension('sean-conkie.bigquerysqlformatter');
  if (!ext) {
    throw new Error('BigQuery SQL Formatter extension was not found');
  }
  await ext.activate();
  const doc = await vscode.workspace.openTextDocument(docUri);
  return vscode.window.showTextDocument(doc);
}

export function waitForDiagnostics(
  docUri: vscode.Uri,
  matches: (diagnostics: readonly vscode.Diagnostic[]) => boolean,
): Promise<readonly vscode.Diagnostic[]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.dispose();
      reject(
        new Error(
          `Timed out waiting for diagnostics for ${docUri.toString()}: ${JSON.stringify(
            vscode.languages.getDiagnostics(docUri),
          )}`,
        ),
      );
    }, 15000);
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
