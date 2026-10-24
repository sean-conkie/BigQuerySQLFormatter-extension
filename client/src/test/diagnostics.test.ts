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

  test('Formats documents/selections and applies formatting or Fix All on save', async () => {
    const directory = await mkdtemp(path.join(getDocPath(''), 'formatting-'));
    const uri = vscode.Uri.file(path.join(directory, 'query.bqsql'));
    const settings = vscode.workspace.getConfiguration('editor', { uri, languageId: 'googlesql' });
    const original = settings.inspect('formatOnSave')?.globalLanguageValue;
    const originalActions = settings.inspect('codeActionsOnSave')?.globalLanguageValue;
    const hasRule = (diagnostics: readonly vscode.Diagnostic[], rule: string) =>
      diagnostics.some((diagnostic) => {
        const code = diagnostic.code;
        return String(typeof code === 'object' ? code.value : code).startsWith(`${rule}:`);
      });
    try {
      await writeFile(uri.fsPath, 'select a = NULL;\nselect b = NULL;\n');
      const opened = waitForDiagnostics(uri, (diagnostics) => diagnostics.length > 0);
      const editor = await activate(uri);
      await opened;
      assert.equal(settings.get('defaultFormatter'), 'sean-conkie.bigquerysqlformatter');
      const selected = await vscode.commands.executeCommand<vscode.TextEdit[]>(
        'vscode.executeFormatRangeProvider',
        uri,
        new vscode.Range(1, 0, 2, 0),
        { tabSize: 2, insertSpaces: true },
      );
      assert.ok(selected.length > 0);
      await editor.edit((edit) => {
        for (const replacement of selected) edit.replace(replacement.range, replacement.newText);
      });
      assert.equal(editor.document.getText(), 'select a = NULL;\nselect b is null;\n');
      const formatted = await vscode.commands.executeCommand<vscode.TextEdit[]>(
        'vscode.executeFormatDocumentProvider',
        uri,
        { tabSize: 2, insertSpaces: true },
      );
      assert.ok(formatted.length > 0);
      const manuallyFormatted = waitForDiagnostics(
        uri,
        (diagnostics) => !hasRule(diagnostics, 'CP04') && !hasRule(diagnostics, 'CV05'),
      );
      await editor.edit((edit) => {
        for (const replacement of formatted) edit.replace(replacement.range, replacement.newText);
      });
      assert.equal(editor.document.getText(), 'select a is null;\nselect b is null;\n');
      await manuallyFormatted;
      const second = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
        'vscode.executeFormatDocumentProvider',
        uri,
        { tabSize: 2, insertSpaces: true },
      );
      assert.ok(!second || second.length === 0);
      await settings.update('formatOnSave', true, vscode.ConfigurationTarget.Global, true);
      const formatInputReady = waitForDiagnostics(uri, (diagnostics) => hasRule(diagnostics, 'CP04'));
      await editor.edit((edit) =>
        edit.replace(new vscode.Range(0, 0, editor.document.lineCount, 0), 'select a = NULL;\nselect b = NULL;\n'),
      );
      await formatInputReady;
      const formattedOnSave = waitForDiagnostics(
        uri,
        (diagnostics) => !hasRule(diagnostics, 'CP04') && !hasRule(diagnostics, 'CV05'),
      );
      assert.equal(await editor.document.save(), true);
      await formattedOnSave;
      assert.equal(editor.document.getText(), 'select a is null;\nselect b is null;\n', 'format-on-save output');
      await settings.update('formatOnSave', false, vscode.ConfigurationTarget.Global, true);
      await settings.update(
        'codeActionsOnSave',
        { 'source.fixAll.bigquerySQLFormatter': 'explicit' },
        vscode.ConfigurationTarget.Global,
        true,
      );
      const fixInputReady = waitForDiagnostics(uri, (diagnostics) => hasRule(diagnostics, 'CV05'));
      await editor.edit((edit) =>
        edit.replace(new vscode.Range(0, 0, editor.document.lineCount, 0), 'select a = null;\nselect b = null;\n'),
      );
      await fixInputReady;
      const fixedOnSave = waitForDiagnostics(uri, (diagnostics) => !hasRule(diagnostics, 'CV05'));
      assert.equal(await editor.document.save(), true);
      await fixedOnSave;
      assert.equal(editor.document.getText(), 'select a is null;\nselect b is null;\n', 'Fix All on save output');
    } finally {
      await settings.update('formatOnSave', original, vscode.ConfigurationTarget.Global, true);
      await settings.update('codeActionsOnSave', originalActions, vscode.ConfigurationTarget.Global, true);
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
      await rm(directory, { recursive: true });
    }
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
