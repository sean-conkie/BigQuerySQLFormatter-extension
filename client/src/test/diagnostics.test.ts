/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as assert from 'node:assert';
import { getDocUri, activate, waitForDiagnostics } from './helper';

suite('Language server diagnostics', () => {
  const docUri = getDocUri('diagnostics.bqsql');

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  });

  test('Reports diagnostics on open and clears them after an edit', async () => {
    const initialDiagnostics = waitForDiagnostics(docUri, (diagnostics) => diagnostics.length > 0);
    const editor = await activate(docUri);
    assert.equal(editor.document.languageId, 'googlesql');

    const diagnostics = await initialDiagnostics;
    assert.equal(diagnostics.length, 1);
    const code = diagnostics[0].code;
    assert.equal(typeof code === 'object' ? code.value : code, 'LT13: start_of_file');
    assert.equal(diagnostics[0].message, 'Files must not begin with newlines or whitespace.');
    assert.deepEqual(diagnostics[0].range, new vscode.Range(0, 0, 0, 1));
    assert.equal(diagnostics[0].severity, vscode.DiagnosticSeverity.Error);
    assert.equal(diagnostics[0].source, 'BigQuery SQL Formatter');

    const clearedDiagnostics = waitForDiagnostics(docUri, (diagnostics) => diagnostics.length === 0);
    assert.equal(await editor.edit((edit) => edit.delete(new vscode.Range(0, 0, 1, 0))), true);
    await clearedDiagnostics;
  });

  test('Clears diagnostics when a document leaves the language and recomputes them on return', async () => {
    const editor = await activate(docUri);
    const closed = waitForDiagnostics(docUri, (diagnostics) => diagnostics.length === 0);
    await vscode.languages.setTextDocumentLanguage(editor.document, 'plaintext');
    await closed;
    const reopened = waitForDiagnostics(docUri, (diagnostics) => diagnostics.length > 0);
    await vscode.languages.setTextDocumentLanguage(editor.document, 'googlesql');
    await reopened;
  });
});
