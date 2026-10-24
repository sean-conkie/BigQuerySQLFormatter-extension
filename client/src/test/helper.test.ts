import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { waitForDiagnostics } from './helper';

suite('Diagnostic test synchronization', () => {
  test('Resolves diagnostics already published without requiring another change event', async () => {
    const uri = vscode.Uri.parse('diagnostics-test:already-published');
    const collection = vscode.languages.createDiagnosticCollection('diagnostics-test');
    const message = 'Already-published diagnostic';
    const matches = (diagnostics: readonly vscode.Diagnostic[]) => diagnostics.some((d) => d.message === message);
    try {
      const published = waitForDiagnostics(uri, matches);
      collection.set(uri, [new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), message)]);
      await published;
      const existing = await waitForDiagnostics(uri, matches);
      assert.equal(existing[0].message, message);
    } finally {
      collection.dispose();
    }
  });
});
