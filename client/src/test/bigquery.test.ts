import assert from 'node:assert/strict';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import * as vscode from 'vscode';
import sinon from 'sinon';
import type { ExtensionApi } from '../extension';
import { MockBigQueryServer } from './bigquery/mockServer';
import { activate, getDocUri, waitForDiagnostics } from './helper';

suite('BigQuery integration extension host', () => {
  test('keeps the BigQuery bundle unloaded with features disabled and preserves offline linting', async () => {
    const extension = vscode.extensions.getExtension<ExtensionApi>('sean-conkie.bigquerysqlformatter')!;
    const api = await extension.activate();
    await api.ready();
    const bundle = path.join(extension.extensionPath, 'dist', 'bigquery.js');
    assert.equal(require.cache[bundle], undefined);
    await assert.rejects(api.bigquery.request('schema', { operation: 'datasets.list' }), /disabled|untrusted/);
    assert.equal(require.cache[bundle], undefined);
    const uri = getDocUri('diagnostics.bqsql');
    await activate(uri);
    await waitForDiagnostics(uri, (diagnostics) => diagnostics.length > 0);
    if (process.env.BQSQL_TEST_UNTRUSTED === '1') assert.equal(vscode.workspace.isTrusted, false);
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  });

  test('wires opt-in settings, consent, transport, cancellation and reset without contacting Google', async () => {
    const mock = new MockBigQueryServer();
    await mock.start();
    const originalEndpoint = process.env.BQSQL_TEST_BIGQUERY_ENDPOINT;
    process.env.BQSQL_TEST_BIGQUERY_ENDPOINT = mock.endpoint;
    const config = vscode.workspace.getConfiguration('bigquerySQLFormatter.bigquery');
    const extension = vscode.extensions.getExtension<ExtensionApi>('sean-conkie.bigquerysqlformatter')!;
    const runtimeVscode: typeof vscode = createRequire(
      realpathSync(path.join(extension.extensionPath, 'dist', 'bigquery.js')),
    )('vscode');
    const prompt = sinon.stub(runtimeVscode.window, 'showInformationMessage');
    prompt.callsFake(
      async <T extends string | vscode.MessageItem>(
        _message: string,
        _options?: vscode.MessageOptions | T,
        ...items: T[]
      ): Promise<T | undefined> => items.find((item) => item === 'Allow'),
    );
    try {
      await config.update('projectId', 'test-project', vscode.ConfigurationTarget.Global);
      await config.update('schema.enabled', true, vscode.ConfigurationTarget.Global);
      const api = await extension.activate();
      if (!vscode.workspace.isTrusted) {
        await assert.rejects(api.bigquery.request('schema', { operation: 'datasets.list' }), /untrusted/);
        assert.equal(mock.requests.length, 0);
        assert.equal(prompt.callCount, 0);
        return;
      }
      const response = await api.bigquery.request('schema', { operation: 'datasets.list' });
      assert.deepEqual(response, {
        datasets: [{ datasetReference: { projectId: 'test-project', datasetId: 'test_dataset' } }],
        nextPageToken: 'next-page',
      });
      assert.equal(mock.requests[0].authorization, 'Bearer bqsql-test-token');
      assert.equal(mock.requests[0].quotaProject, undefined);
      assert.match(String(prompt.firstCall.args[0]), /test-project/);
      assert.match(String(prompt.firstCall.args[0]), /automatic \(not set\)/);
      await api.bigquery.request('schema', { operation: 'datasets.list' });
      assert.equal(prompt.callCount, 1);
      await config.update('location', 'EU', vscode.ConfigurationTarget.Global);
      await api.bigquery.request('schema', { operation: 'datasets.list' });
      assert.match(String(prompt.secondCall.args[0]), /EU/);
      await config.update('location', 'US', vscode.ConfigurationTarget.Global);
      await config.update('location', 'EU', vscode.ConfigurationTarget.Global);
      await api.bigquery.request('schema', { operation: 'datasets.list' });
      await vscode.commands.executeCommand('bigquerySQLFormatter.bigquery.resetConsent');
      await api.bigquery.request('schema', { operation: 'datasets.list' });
      assert.equal(prompt.getCalls().filter((call) => call.args[1] && typeof call.args[1] === 'object').length, 4);
      await config.update('quotaProjectId', 'test-quota', vscode.ConfigurationTarget.Global);
      await api.bigquery.request('schema', { operation: 'datasets.list' });
      assert.equal(mock.requests[mock.requests.length - 1].quotaProject, 'test-quota');
      assert.match(String(prompt.lastCall.args[0]), /quota project "test-quota"/);
      const cancelled = new AbortController();
      cancelled.abort();
      const before = mock.requests.length;
      await assert.rejects(api.bigquery.request('schema', { operation: 'datasets.list' }, undefined, cancelled.signal));
      assert.equal(mock.requests.length, before);
    } finally {
      prompt.restore();
      await config.update('schema.enabled', undefined, vscode.ConfigurationTarget.Global);
      await config.update('projectId', undefined, vscode.ConfigurationTarget.Global);
      await config.update('quotaProjectId', undefined, vscode.ConfigurationTarget.Global);
      await config.update('location', undefined, vscode.ConfigurationTarget.Global);
      await vscode.commands.executeCommand('bigquerySQLFormatter.bigquery.resetConsent');
      await mock.close();
      if (originalEndpoint === undefined) delete process.env.BQSQL_TEST_BIGQUERY_ENDPOINT;
      else process.env.BQSQL_TEST_BIGQUERY_ENDPOINT = originalEndpoint;
    }
  });
});
