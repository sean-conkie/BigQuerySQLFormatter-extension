import assert from 'node:assert/strict';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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

  test('dry-runs files, selections and saves with isolated diagnostics, estimates and stale-result cancellation', async () => {
    const mock = new MockBigQueryServer();
    await mock.start();
    const originalEndpoint = process.env.BQSQL_TEST_BIGQUERY_ENDPOINT;
    process.env.BQSQL_TEST_BIGQUERY_ENDPOINT = mock.endpoint;
    const directory = await mkdtemp(path.join(tmpdir(), 'bqsql-dryrun-'));
    const uri = vscode.Uri.file(path.join(directory, 'query.bqsql'));
    await writeFile(uri.fsPath, 'SELECT 1');
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
    const statusSpy = sinon.spy(runtimeVscode.window, 'createStatusBarItem');
    const dryDiagnostics = () =>
      vscode.languages.getDiagnostics(uri).filter((item) => item.source === 'BigQuery dry run');
    const status = () => statusSpy.lastCall.returnValue as vscode.StatusBarItem;
    let editor: vscode.TextEditor | undefined;
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      editor = await vscode.window.showTextDocument(document);
      await config.update('projectId', 'test-project', vscode.ConfigurationTarget.Global);
      await config.update('dryRun.trigger', 'onDemand', vscode.ConfigurationTarget.Global);
      await config.update('dryRun.enabled', true, vscode.ConfigurationTarget.Global);
      const run = () => vscode.commands.executeCommand('bigquerySQLFormatter.bigquery.dryRunFile');
      if (!vscode.workspace.isTrusted) {
        await run();
        assert.equal(mock.requests.length, 0);
        assert.equal(prompt.callCount, 0);
        return;
      }
      const replace = async (text: string) => {
        assert(await editor!.edit((edit) => edit.replace(new vscode.Range(0, 0, document.lineCount, 0), text)));
      };
      await run();
      assert.match(status().text, /≈ 1.23 KB processed/);
      assert.equal(prompt.callCount, 1);
      assert.equal(mock.requests.length, 1);
      const body = mock.requests[0].body;
      assert.deepEqual(body, {
        jobReference: { projectId: 'test-project' },
        configuration: { dryRun: true, query: { query: 'SELECT 1', useLegacySql: false } },
      });
      mock.fallback = 'invalidQuery';
      await replace('SELECT 1;\nSELECT nope');
      await run();
      assert.equal(dryDiagnostics().length, 1);
      assert.deepEqual(dryDiagnostics()[0].range.start, new vscode.Position(1, 7));
      assert.match(status().text, /1 error/);
      await waitForDiagnostics(
        uri,
        (items) => items.some((item) => item.source !== 'BigQuery dry run'),
        'offline lint',
      );
      for (const eol of [vscode.EndOfLine.LF, vscode.EndOfLine.CRLF]) {
        assert(await editor.edit((edit) => edit.setEndOfLine(eol)));
        await replace('-- selection prefix\n    SELECT 1;\nSELECT nope');
        assert.equal(dryDiagnostics().length, 0);
        editor.selection = new vscode.Selection(1, 4, 2, 11);
        const beforeSelection = mock.requests.length;
        await vscode.commands.executeCommand('bigquerySQLFormatter.bigquery.dryRunSelection');
        assert.deepEqual(dryDiagnostics()[0].range.start, new vscode.Position(2, 7));
        assert.equal(mock.requests.length, beforeSelection + 1);
        const selectionBody = mock.requests[beforeSelection].body as { configuration: { query: { query: string } } };
        assert.equal(
          selectionBody.configuration.query.query,
          `SELECT 1;${eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n'}SELECT nope`,
        );
      }
      mock.fallback = 'notFound';
      await replace('SELECT * FROM `test-project.test_dataset.PRIVATE_SCHEMA_COLUMN`');
      await run();
      assert.equal(document.getText(dryDiagnostics()[0].range), 'test-project.test_dataset.PRIVATE_SCHEMA_COLUMN');
      mock.fallback = 'accessDenied';
      await config.update('location', 'EU', vscode.ConfigurationTarget.Global);
      await run();
      assert.equal(document.getText(dryDiagnostics()[0].range), 'PRIVATE_SCHEMA_COLUMN');
      assert.match(dryDiagnostics()[0].message, /location mismatches/);
      mock.fallback = 'script';
      await replace('DECLARE n INT64 DEFAULT 1;\nBEGIN SELECT n; END;');
      await run();
      assert.equal(dryDiagnostics().length, 0);
      assert.match(status().text, /≈ 0 B processed \(script;/);
      mock.fallback = 'success';
      await replace(`-- @ignored {{ ignored }}\nSELECT @name, ?, @@project_id, "@literal \${literal}"`);
      await run();
      assert.match(status().text, /parameters assumed NULL; estimate may be low/);
      await config.update(
        'dryRun.parameters',
        { name: { type: 'STRING', value: 'value' } },
        vscode.ConfigurationTarget.Global,
      );
      await replace('SELECT @name');
      await run();
      assert(!status().text.includes('assumed NULL'));
      await config.update('dryRun.parameters', { name: { type: 'STRING' } }, vscode.ConfigurationTarget.Global);
      const beforeInvalidParameters = mock.requests.length;
      await run();
      assert.equal(mock.requests.length, beforeInvalidParameters);
      assert.match(status().text, /Invalid settings/);
      await config.update(
        'dryRun.parameters',
        { name: { type: 'STRING', value: 'value' } },
        vscode.ConfigurationTarget.Global,
      );
      mock.fallback = 'invalidQuery';
      mock.errorPayload = { error: { message: 'LIMIT value should not be NULL at [1:8]' } };
      await run();
      assert.match(dryDiagnostics()[0].message, /bigquerySQLFormatter.bigquery.dryRun.parameters/);
      mock.errorPayload = undefined;
      mock.fallback = 'success';
      await config.update('dryRun.costPerTiB', 5, vscode.ConfigurationTarget.Global);
      mock.jobPayload = {
        statistics: {
          totalBytesProcessed: String(2 ** 40),
          query: {
            statementType: 'SELECT',
            referencedTables: [{ projectId: 'p', datasetId: 'd', tableId: 't@1234' }],
          },
        },
      };
      await run();
      assert.match(status().text, /estimated cost 5.00/);
      assert.match(String(status().tooltip), /p.d.t/);
      mock.jobPayload = undefined;
      for (const text of ['SELECT {{ ref("table") }}', 'config { type: "table" }\nSELECT 1']) {
        await replace(text);
        const before = mock.requests.length;
        await run();
        assert.equal(mock.requests.length, before);
        assert.match(status().text, /Skipped templated/);
      }
      await replace('SELECT nope');
      mock.fallback = 'invalidQuery';
      await document.save();
      assert.equal(dryDiagnostics().length, 0);
      await config.update('dryRun.trigger', 'onSave', vscode.ConfigurationTarget.Global);
      await replace('SELECT nope;\nSELECT nope');
      await document.save();
      await waitForDiagnostics(
        uri,
        (items) => items.some((item) => item.source === 'BigQuery dry run'),
        'on-save dry run',
      );
      assert.equal(dryDiagnostics().length, 1);
      mock.fallback = 'slow';
      const before = mock.requests.length;
      const pendingRun = run();
      const deadline = Date.now() + 5000;
      while (mock.requests.length === before && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(mock.requests.length, before + 1);
      mock.fallback = 'script';
      await replace('BEGIN SELECT 1; END;');
      await run();
      await pendingRun;
      assert.match(status().text, /script;/);
      assert.equal(dryDiagnostics().length, 0);
      await config.update('dryRun.enabled', false, vscode.ConfigurationTarget.Global);
      assert.equal(dryDiagnostics().length, 0);
      const afterDisable = mock.requests.length;
      await run();
      assert.equal(mock.requests.length, afterDisable);
    } finally {
      prompt.restore();
      statusSpy.restore();
      for (const key of [
        'dryRun.enabled',
        'dryRun.trigger',
        'dryRun.parameters',
        'dryRun.costPerTiB',
        'projectId',
        'location',
      ])
        await config.update(key, undefined, vscode.ConfigurationTarget.Global);
      await vscode.commands.executeCommand('bigquerySQLFormatter.bigquery.resetConsent');
      if (editor) await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
      await mock.close();
      await rm(directory, { recursive: true, force: true });
      if (originalEndpoint === undefined) delete process.env.BQSQL_TEST_BIGQUERY_ENDPOINT;
      else process.env.BQSQL_TEST_BIGQUERY_ENDPOINT = originalEndpoint;
    }
  });
});
