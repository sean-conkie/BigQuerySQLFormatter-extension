/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as assert from 'node:assert';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import * as path from 'node:path';
import { getDocUri, getDocPath, activate, waitForDiagnostics } from './helper';

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
    assert.equal(diagnostics[0].severity, vscode.DiagnosticSeverity.Warning);
    assert.equal(diagnostics[0].source, 'BigQuery SQL Formatter');

    const clearedDiagnostics = waitForDiagnostics(docUri, (diagnostics) => diagnostics.length === 0);
    assert.equal(await editor.edit((edit) => edit.delete(new vscode.Range(0, 0, 1, 0))), true);
    await clearedDiagnostics;
  });

  test('Clears diagnostics when a document leaves the language and recomputes them on return', async () => {
    const editor = await activate(docUri);
    const closed = waitForDiagnostics(docUri, (diagnostics) => diagnostics.length === 0);
    await vscode.languages.setTextDocumentLanguage(editor.document, 'sql');
    await closed;
    const reopened = waitForDiagnostics(docUri, (diagnostics) => diagnostics.length > 0);
    await vscode.languages.setTextDocumentLanguage(editor.document, 'googlesql');
    await reopened;
  });

  test('Leaves generic SQL files in SQL language mode', async () => {
    const document = await vscode.workspace.openTextDocument(getDocUri('diagnostics.sql'));
    await vscode.window.showTextDocument(document);
    assert.equal(document.languageId, 'sql');
  });

  test('Applies editor rule settings and watches project config creation, edits, and deletion', async () => {
    const directory = await mkdtemp(path.join(getDocPath(''), 'rule-config-'));
    const uri = vscode.Uri.file(path.join(directory, 'query.bqsql'));
    const configPath = path.join(directory, '.bqsqlformatter.json');
    const settings = vscode.workspace.getConfiguration('bigquerySQLFormatter', uri);
    const original = settings.inspect('rules')?.globalValue;
    const lt13 = (diagnostics: readonly vscode.Diagnostic[]) =>
      diagnostics.find((diagnostic) => {
        const code = diagnostic.code;
        return (typeof code === 'object' ? code.value : code) === 'LT13: start_of_file';
      });
    try {
      await writeFile(uri.fsPath, '\nselect abs(-1);\n');
      const opened = waitForDiagnostics(
        uri,
        (diagnostics) => lt13(diagnostics)?.severity === vscode.DiagnosticSeverity.Warning,
      );
      await activate(uri);
      await opened;

      const editorChanged = waitForDiagnostics(
        uri,
        (diagnostics) => lt13(diagnostics)?.severity === vscode.DiagnosticSeverity.Error,
      );
      await settings.update('rules', { LT13: { severity: 'error' } }, vscode.ConfigurationTarget.Global);
      await editorChanged;

      const created = waitForDiagnostics(uri, (diagnostics) => !lt13(diagnostics));
      await writeFile(configPath, '{"rules":{"LT13":{"enabled":false}}}');
      await created;

      const edited = waitForDiagnostics(
        uri,
        (diagnostics) => lt13(diagnostics)?.severity === vscode.DiagnosticSeverity.Hint,
      );
      await writeFile(configPath, '{"rules":{"LT13":{"enabled":true,"severity":"hint"}}}');
      await edited;

      const deleted = waitForDiagnostics(
        uri,
        (diagnostics) => lt13(diagnostics)?.severity === vscode.DiagnosticSeverity.Error,
      );
      await rm(configPath);
      await deleted;

      const disabled = waitForDiagnostics(uri, (diagnostics) => !lt13(diagnostics));
      await settings.update('rules', { LT13: { severity: 'off' } }, vscode.ConfigurationTarget.Global);
      await disabled;
    } finally {
      await settings.update('rules', original, vscode.ConfigurationTarget.Global);
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
      await rm(directory, { recursive: true });
    }
  });
});
