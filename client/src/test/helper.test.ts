import * as assert from 'node:assert';
import * as vscode from 'vscode';
import { waitForDiagnostics, waitForServer } from './helper';
import { timeoutFromEnvironment } from './timeouts';

suite('Diagnostic test synchronization', () => {
  test('Keeps the readiness signal available after startup', async () => {
    await waitForServer();
    await waitForServer();
    const api = vscode.extensions.getExtension<import('../extension').ExtensionApi>(
      'sean-conkie.bigquerysqlformatter',
    )!.exports;
    assert.ok(api.serverLog().length > 0);
    assert.ok(api.serverLog().length <= 80);
  });

  test('Includes phase timing, activation timing and server logs on timeout', async () => {
    await assert.rejects(
      waitForDiagnostics(vscode.Uri.parse('diagnostics-test:timeout'), () => false, 'test phase', 1),
      (error: Error) => {
        assert.match(error.message, /test phase after \d+ms \(limit 1ms\)/);
        assert.match(error.message, /activationElapsedMs=\d+/);
        assert.match(error.message, /serverLog:\n.+/);
        return true;
      },
    );
  });

  test('Accepts timeout overrides and rejects invalid timer values explicitly', () => {
    const name = 'BQSQL_TEST_HELPER_TIMEOUT_MS';
    const original = process.env[name];
    try {
      delete process.env[name];
      assert.equal(timeoutFromEnvironment(name, 15000), 15000);
      process.env[name] = '90000';
      assert.equal(timeoutFromEnvironment(name, 15000), 90000);
      for (const invalid of ['', '0', '-1', '1.5', 'Infinity', 'invalid', '2147483648']) {
        process.env[name] = invalid;
        assert.throws(() => timeoutFromEnvironment(name, 15000), /must be a positive integer/);
      }
    } finally {
      if (original === undefined) delete process.env[name];
      else process.env[name] = original;
    }
  });

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
