import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { connect, type Socket } from 'node:net';
import { once } from 'node:events';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { Gaxios } from 'gaxios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sinon from 'sinon';
import {
  BigQueryError,
  BigQueryRestClient,
  apiEndpoint,
  createCredentials,
  type Credentials,
  type RequestMetadata,
} from '../../bigquery/rest';
import { BigQueryService, type BigQueryHost } from '../../bigquery/service';
import { parseBigQuerySettings, type BigQuerySettings } from '../../bigquery/settings';
import { MockBigQueryServer } from './mockServer';
import { dryRunResult } from '../../bigquery/dryRun';

describe('BigQuery foundation (offline)', function () {
  this.timeout(15000);
  let mock: MockBigQueryServer;
  let originalEndpoint: string | undefined;
  let settings: BigQuerySettings;
  let trusted: boolean;
  let accepted: boolean;
  let credentials: Credentials;
  let service: BigQueryService;
  let host: BigQueryHost;
  let logs: RequestMetadata[];
  let notifications: string[];
  let prompts: [string, string | undefined, string | undefined][];
  let consent: Map<string, string>;

  beforeEach(async () => {
    originalEndpoint = process.env.BQSQL_TEST_BIGQUERY_ENDPOINT;
    mock = new MockBigQueryServer();
    await mock.start();
    process.env.BQSQL_TEST_BIGQUERY_ENDPOINT = mock.endpoint;
    settings = parseBigQuerySettings(
      (key) =>
        ({ projectId: 'test-project', 'dryRun.enabled': true, 'schema.enabled': true, defaultDataset: 'test_dataset' })[
          key
        ],
    );
    trusted = true;
    accepted = true;
    logs = [];
    notifications = [];
    prompts = [];
    consent = new Map();
    const authClient = new OAuth2Client({
      credentials: { access_token: 'PRIVATE_TOKEN', expiry_date: Date.now() + 86400000 },
    });
    credentials = {
      projectId: async () => 'adc-project',
      check: async () => undefined,
      retry: () => undefined,
      request: (options) => authClient.request(options),
    };
    host = {
      trusted: () => trusted,
      settings: () => settings,
      scope: (resource) => resource ?? 'workspace',
      consent: (scope) => consent.get(scope),
      saveConsent: async (scope, identity) => {
        if (identity) consent.set(scope, identity);
        else consent.delete(scope);
      },
      prompt: async (project, location, billingProject) => {
        prompts.push([project, location, billingProject]);
        return accepted;
      },
      notify: (message) => notifications.push(message),
      status: () => undefined,
    };
    service = new BigQueryService(
      host,
      credentials,
      new BigQueryRestClient(credentials, (metadata) => logs.push(metadata)),
    );
  });

  afterEach(async () => {
    service.dispose();
    await mock.close();
    if (originalEndpoint === undefined) delete process.env.BQSQL_TEST_BIGQUERY_ENDPOINT;
    else process.env.BQSQL_TEST_BIGQUERY_ENDPOINT = originalEndpoint;
  });

  it('has opt-in defaults and validates settings rather than silently coercing', () => {
    const defaults = parseBigQuerySettings(() => undefined);
    assert.throws(() => parseBigQuerySettings((key) => (key === 'timeoutMs' ? 2147483648 : undefined)), /timeoutMs/);
    assert.deepEqual(defaults, {
      projectId: undefined,
      quotaProjectId: undefined,
      location: undefined,
      defaultDataset: undefined,
      timeoutMs: 10000,
      dryRun: { enabled: false, trigger: 'onSave', costPerTiB: undefined },
      schema: { enabled: false, cacheTtlMinutes: 60 },
    });

    for (const [key, value] of Object.entries({
      projectId: '../redirect',
      location: 'US\nTOKEN',
      defaultDataset: 'dataset/table',
      timeoutMs: 0,
      'dryRun.enabled': 'true',
      'schema.enabled': 1,
      'dryRun.trigger': 'onType',
      'dryRun.costPerTiB': -1,
      'schema.cacheTtlMinutes': NaN,
    }))
      assert.throws(
        () => parseBigQuerySettings((candidate) => (candidate === key ? value : undefined)),
        /Invalid BigQuery setting/,
      );
  });

  it('uses real-mode ADC discovery and caches a successful auth check without contacting Google', async () => {
    const client = new OAuth2Client({
      credentials: { access_token: 'PRIVATE_TOKEN', expiry_date: Date.now() + 86400000 },
    });
    const getClient = sinon.stub(GoogleAuth.prototype, 'getClient').resolves(client);
    const getProject = sinon.stub(GoogleAuth.prototype, 'getProjectId').resolves('adc-project');
    delete process.env.BQSQL_TEST_BIGQUERY_ENDPOINT;
    try {
      const provider = createCredentials();
      await Promise.all([provider.check(), provider.check()]);
      assert.equal(await provider.projectId(), 'adc-project');
      await provider.request({ url: `${mock.endpoint}projects/adc-project/datasets` });
      assert.equal(getClient.callCount, 1);
      assert.equal(getProject.callCount, 1);
      assert.equal(mock.requests[0].authorization, 'Bearer PRIVATE_TOKEN');
    } finally {
      getClient.restore();
      getProject.restore();
      process.env.BQSQL_TEST_BIGQUERY_ENDPOINT = mock.endpoint;
    }
  });

  it('skips background authentication when disabled or untrusted and reports raw failures safely', async () => {
    credentials.check = async () => {
      throw new Error('PRIVATE_TOKEN');
    };
    trusted = false;
    await service.checkCredentials();
    trusted = true;
    settings.dryRun.enabled = false;
    settings.schema.enabled = false;
    await service.checkCredentials();
    assert.equal(notifications.length, 0);
    settings.schema.enabled = true;
    await service.checkCredentials();
    assert.equal(notifications.length, 1);
    assert.match(notifications[0], /application-default login/);
    assert(!notifications[0].includes('PRIVATE_TOKEN'));
  });

  it('times out or cancels an in-flight background credential check', async () => {
    credentials.check = () => new Promise(() => undefined);
    settings.timeoutMs = 15;
    await service.checkCredentials();
    assert.match(notifications[0], /timed out/);
    const pending = service.checkCredentials();
    service.invalidate();
    await pending;
    assert.equal(notifications.length, 1);
  });

  it('rejects invalid default/target projects, unavailable ADC projects and unexpected dialog failures', async () => {
    settings.projectId = undefined;
    credentials.projectId = async () => 'invalid/project';
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'api' });
    credentials.projectId = async () => {
      throw new Error('PRIVATE_TOKEN');
    };
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'auth' });
    settings.projectId = 'test-project';
    await assert.rejects(service.request('schema', { operation: 'datasets.list', project: 'invalid/project' }), {
      kind: 'api',
    });
    host.prompt = async () => {
      throw new Error('PRIVATE_TOKEN');
    };
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'api' });
    assert(!notifications.join(' ').includes('PRIVATE_TOKEN'));
    assert.equal(mock.requests.length, 0);
  });

  it('rechecks workspace trust after consent has been saved', async () => {
    host.saveConsent = async () => {
      trusted = false;
    };
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'disabled' });
    assert.equal(mock.requests.length, 0);
  });

  it('reports direct REST authentication failures and cancellation before sending data', async () => {
    const rest = new BigQueryRestClient(credentials, (metadata) => logs.push(metadata));
    credentials.check = async () => {
      throw new Error('PRIVATE_TOKEN');
    };
    await assert.rejects(
      rest.request({ operation: 'datasets.list' }, { project: 'test-project' }, new AbortController().signal),
      { kind: 'auth' },
    );
    credentials.check = () => new Promise(() => undefined);
    for (const reason of [new BigQueryError('timeout', 'Authentication deadline'), new Error('Cancelled')]) {
      const controller = new AbortController();
      const pending = rest.request({ operation: 'datasets.list' }, { project: 'test-project' }, controller.signal);
      controller.abort(reason);
      await assert.rejects(pending, { kind: reason instanceof BigQueryError ? 'timeout' : 'cancelled' });
    }
    assert.equal(mock.requests.length, 0);
    assert(!JSON.stringify(logs).includes('PRIVATE_TOKEN'));
  });

  it('classifies non-HTTP network failures without leaking their messages', async () => {
    credentials.request = async () => {
      throw new Error('PRIVATE_TOKEN');
    };
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'network' });
    assert.match(notifications[0], /network/);
    assert(!notifications[0].includes('PRIVATE_TOKEN'));
  });

  it('handles malformed error bodies and reason-only service-usage failures', async () => {
    mock.fallback = 400;
    for (const payload of [null, 'unexpected', {}, { error: null }, { error: { errors: ['invalid', {}] } }]) {
      mock.errorPayload = payload;
      await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'api', status: 400 });
    }
    mock.fallback = 403;
    mock.errorPayload = { error: { errors: [{ reason: 'serviceUsageDenied' }] } };
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'permission' });
    assert.match(notifications[1], /roles\/serviceusage.serviceUsageConsumer/);
  });

  it('supports a slow successful response and dry runs with no default dataset or location', async () => {
    mock.fallback = 'slow';
    settings.defaultDataset = undefined;
    const response = await service.request('dryRun', { operation: 'jobs.insert', query: 'SELECT 1' });
    assert.deepEqual(response, { statistics: { query: { statementType: 'SELECT', totalBytesProcessed: '1234' } } });
    assert.deepEqual(mock.requests[0].body, {
      jobReference: { projectId: 'test-project' },
      configuration: { dryRun: true, query: { query: 'SELECT 1', useLegacySql: false } },
    });
    const rest = new BigQueryRestClient(credentials, (metadata) => logs.push(metadata));
    await assert.rejects(
      rest.request({ operation: 'tables.list' }, { project: 'test-project' }, new AbortController().signal),
      { kind: 'api' },
    );
  });
  it('never authenticates or calls BigQuery when untrusted, disabled or mismatched', async () => {
    credentials.check = async () => {
      assert.fail('Authentication must not run');
    };
    credentials.projectId = async () => {
      assert.fail('ADC discovery must not run');
    };
    settings.projectId = undefined;
    trusted = false;
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'disabled' });
    trusted = true;
    settings.schema.enabled = false;
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'disabled' });
    await assert.rejects(service.request('dryRun', { operation: 'datasets.list' }), { kind: 'disabled' });
    assert.equal(mock.requests.length, 0);
    assert.equal(prompts.length, 0);
  });

  it('forbids global fetch in the BigQuery source and keeps auth on the Node-20-compatible major', () => {
    const directory = resolve(__dirname, '../../../src/bigquery');
    for (const file of readdirSync(directory).filter((name) => name.endsWith('.ts'))) {
      assert(
        !/\bfetch\s*\(/.test(readFileSync(resolve(directory, file), 'utf8')),
        `${file} must use the auth client's request()`,
      );
    }
    const manifest: { dependencies: Record<string, string> } = JSON.parse(
      readFileSync(resolve(__dirname, '../../../package.json'), 'utf8'),
    );
    assert.match(manifest.dependencies['google-auth-library'], /^\^10\./);
    assert.match(manifest.dependencies.gaxios, /^\^7\./);
    const dependabot = readFileSync(resolve(__dirname, '../../../../.github/dependabot.yml'), 'utf8');
    for (const dependency of ['google-auth-library', 'gaxios', 'gcp-metadata']) {
      assert(
        new RegExp(`dependency-name: "${dependency}"\\s+update-types:\\s+- "version-update:semver-major"`).test(
          dependabot,
        ),
      );
    }
  });

  it('caches the background credential result and friendly failure until explicit retry', async () => {
    const check = sinon.stub(OAuth2Client.prototype, 'getAccessToken').rejects(new Error('PRIVATE_TOKEN'));
    try {
      const provider = createCredentials();
      service.dispose();
      service = new BigQueryService(
        host,
        provider,
        new BigQueryRestClient(provider, (metadata) => logs.push(metadata)),
      );
      await Promise.all([service.checkCredentials(), service.checkCredentials()]);
      await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'auth' });
      assert.equal(check.callCount, 1);
      assert.equal(notifications.length, 1);
      assert.match(notifications[0], /application-default login/);
      service.retry();
      await service.checkCredentials();
      assert.equal(check.callCount, 2);
      assert.equal(notifications.length, 2);
      assert.equal(mock.requests.length, 0);
    } finally {
      check.restore();
    }
  });

  it('only sends a quota-project header when explicitly configured and rechecks consent', async () => {
    await service.request('schema', { operation: 'datasets.list' });
    assert.equal(mock.requests[0].quotaProject, undefined);
    settings.quotaProjectId = 'test-quota';
    await service.request('schema', { operation: 'datasets.list' });
    assert.equal(mock.requests[1].quotaProject, 'test-quota');
    assert.equal(prompts.length, 2);
  });

  for (const [scenario, message] of [
    ['accessNotConfigured', 'Enable it there'],
    ['serviceUsageDenied', 'roles/serviceusage.serviceUsageConsumer'],
    ['accessDenied', 'location mismatches'],
  ] as const) {
    it(`maps ${scenario} to the spike's actionable hint without exposing the API body`, async () => {
      settings.location = 'EU';
      mock.fallback = scenario;
      await assert.rejects(service.request('schema', { operation: 'datasets.list' }), {
        kind: 'permission',
        status: 403,
      });
      assert.match(notifications[0], new RegExp(message));
      assert(!JSON.stringify(logs).includes('PRIVATE_'));
      assert(!notifications[0].includes('PRIVATE_'));
      if (scenario === 'accessDenied') {
        settings.location = undefined;
        service.retry();
        await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'permission' });
        assert(!notifications[1].includes('location mismatches'));
      }
    });
  }

  it('provides SELECT/SCRIPT, pagination and nested RECORD fixtures for downstream features', async () => {
    const select = await service.request('dryRun', { operation: 'jobs.insert', query: 'SELECT 1' });
    assert.deepEqual(select, { statistics: { query: { statementType: 'SELECT', totalBytesProcessed: '1234' } } });
    mock.fallback = 'script';
    const script = await service.request('dryRun', { operation: 'jobs.insert', query: 'BEGIN SELECT 1; END;' });
    assert.deepEqual(script, { statistics: { query: { statementType: 'SCRIPT', totalBytesProcessed: '0' } } });
    mock.fallback = 'nestedSchema';
    assert.deepEqual(await service.request('schema', { operation: 'tables.get', table: 'test_table' }), {
      schema: {
        fields: [{ name: 'record_column', type: 'RECORD', fields: [{ name: 'nested_column', type: 'STRING' }] }],
      },
    });

    await service.request('schema', { operation: 'tables.list', pageToken: 'next-table-page' });
    assert.match(mock.requests[mock.requests.length - 1].url, /pageToken=next-table-page/);
    mock.fallback = 'invalidQuery';
    await assert.rejects(service.request('dryRun', { operation: 'jobs.insert', query: 'SELECT nope' }), {
      kind: 'api',
      status: 400,
    });
    mock.fallback = 'notFound';
    await assert.rejects(service.request('schema', { operation: 'tables.get', table: 'missing' }), {
      kind: 'notFound',
      status: 404,
    });
  });

  it('deduplicates concurrent consent, re-prompts on project/location changes and isolates workspaces', async () => {
    await Promise.all([
      service.request('schema', { operation: 'datasets.list' }),
      service.request('schema', { operation: 'datasets.list' }),
    ]);
    assert.deepEqual(prompts, [['test-project', undefined, 'test-project']]);
    settings.location = 'EU';
    await service.request('schema', { operation: 'datasets.list' });
    settings.projectId = 'other-project';
    await service.request('schema', { operation: 'datasets.list' });
    settings.projectId = 'test-project';
    await service.request('schema', { operation: 'datasets.list' });
    await service.request('schema', { operation: 'datasets.list' }, 'other-workspace');
    assert.equal(prompts.length, 5);
    assert.deepEqual(prompts[1], ['test-project', 'EU', 'test-project']);
    consent.clear();
    service.invalidate();
    await service.request('schema', { operation: 'datasets.list' });
    assert.equal(prompts.length, 6);
  });

  it('sends declared scalar parameters and preserves the first query error without logging it', async () => {
    const parameters = {
      name: { type: 'STRING', value: 'PRIVATE_PARAMETER' },
      count: { type: 'INT64', value: 3 },
      nullable: { type: 'STRING', value: null },
      flag: { type: 'BOOL', value: false },
    };
    await service.request('dryRun', { operation: 'jobs.insert', query: 'SELECT @name, @count', parameters });
    assert.deepEqual(mock.requests[0].body, {
      jobReference: { projectId: 'test-project' },
      configuration: {
        dryRun: true,
        query: {
          query: 'SELECT @name, @count',
          useLegacySql: false,
          parameterMode: 'NAMED',
          queryParameters: [
            { name: 'name', parameterType: { type: 'STRING' }, parameterValue: { value: 'PRIVATE_PARAMETER' } },
            { name: 'count', parameterType: { type: 'INT64' }, parameterValue: { value: '3' } },
            { name: 'nullable', parameterType: { type: 'STRING' }, parameterValue: { value: null } },
            { name: 'flag', parameterType: { type: 'BOOL' }, parameterValue: { value: 'false' } },
          ],
          defaultDataset: { projectId: 'test-project', datasetId: 'test_dataset' },
        },
      },
    });
    mock.fallback = 'invalidQuery';
    await assert.rejects(service.request('dryRun', { operation: 'jobs.insert', query: 'SELECT nope' }), {
      queryMessage: 'Unrecognized name: PRIVATE_QUERY at [2:8]',
    });
    mock.fallback = 'success';
    mock.jobPayload = { status: { errorResult: { message: 'first at [1:2]' }, errors: [{ message: 'second' }] } };
    await assert.rejects(service.request('dryRun', { operation: 'jobs.insert', query: 'SELECT nope' }), {
      queryMessage: 'first at [1:2]',
    });
    assert(!JSON.stringify(logs).includes('PRIVATE_'));
    assert(!notifications.join(' ').includes('PRIVATE_'));
  });

  it('does not interpret malformed job status objects as query errors', async () => {
    for (const response of [
      [],
      { status: null },
      { status: 'invalid' },
      { status: {} },
      { status: { errorResult: null } },
      { status: { errorResult: {} } },
      { status: { errorResult: { message: 42 } } },
    ]) {
      mock.jobPayload = response;
      assert.deepEqual(
        await service.request('dryRun', { operation: 'jobs.insert', query: 'SELECT 1', parameters: {} }),
        response,
      );
    }
  });

  it('validates DDL/DML using only dry-run requests and displays their returned estimates', async () => {
    for (const [query, statementType] of [
      ['CREATE SCHEMA dataset', 'CREATE_SCHEMA'],
      ['CREATE TABLE dataset.table AS SELECT 1 AS n', 'CREATE_TABLE_AS_SELECT'],
      ['CREATE VIEW dataset.view AS SELECT 1 AS n', 'CREATE_VIEW'],
      ['CREATE TEMP FUNCTION f(n INT64) AS (n); SELECT f(1)', 'SCRIPT'],
      ['INSERT INTO dataset.table SELECT 1', 'INSERT'],
      ['UPDATE dataset.table SET n = 1 WHERE TRUE', 'UPDATE'],
      ['DELETE FROM dataset.table WHERE TRUE', 'DELETE'],
      ['MERGE dataset.table t USING dataset.other s ON t.n = s.n WHEN MATCHED THEN DELETE', 'MERGE'],
    ]) {
      mock.jobPayload = { statistics: { totalBytesProcessed: '8192', query: { statementType } } };
      const response = await service.request('dryRun', { operation: 'jobs.insert', query });
      const request = mock.requests[mock.requests.length - 1];
      assert.equal(request.method, 'POST');
      assert.deepEqual(request.body, {
        jobReference: { projectId: 'test-project' },
        configuration: {
          dryRun: true,
          query: {
            query,
            useLegacySql: false,
            defaultDataset: { projectId: 'test-project', datasetId: 'test_dataset' },
          },
        },
      });
      assert.match(dryRunResult(response, false).label, /≈ 8.19 KB processed/);
    }
    assert.equal(mock.requests.length, 8);
  });

  it('names a cross-project schema lookup and billing project in consent', async () => {
    await service.request('schema', { operation: 'datasets.list', project: 'schema-project' });
    assert.deepEqual(prompts, [['schema-project', undefined, 'test-project']]);
    assert.equal(logs[0].project, 'schema-project');
    assert.equal(mock.requests[0].quotaProject, undefined);
  });

  it('does not repeat declined consent until an explicit retry', async () => {
    accepted = false;
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'consent' });
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'consent' });
    assert.equal(prompts.length, 1);
    assert.equal(mock.requests.length, 0);
    service.retry();
    accepted = true;
    await service.request('schema', { operation: 'datasets.list' });
    assert.equal(prompts.length, 2);
  });

  it('cancels a pending consent dialog on reset without storing its eventual answer', async () => {
    let answer: (value: boolean) => void;
    let prompted: () => void;
    const promptReady = new Promise<void>((resolve) => {
      prompted = resolve;
    });
    host.prompt = () =>
      new Promise((resolve) => {
        answer = resolve;
        prompted();
      });
    const request = service.request('schema', { operation: 'datasets.list' });
    await promptReady;
    service.invalidate();
    answer!(true);
    await assert.rejects(request, { kind: 'cancelled' });
    assert.equal(consent.size, 0);
    assert.equal(mock.requests.length, 0);
  });

  it('resolves the ADC project and sends only supported metadata calls or a dry run', async () => {
    settings.projectId = undefined;
    settings.location = 'US';
    await service.request('schema', { operation: 'datasets.list', pageToken: 'next-page' });
    await service.request('schema', { operation: 'tables.list' });
    const table = await service.request('schema', { operation: 'tables.get', table: 'test_table' });
    assert.deepEqual(table, { schema: { fields: [{ name: 'PRIVATE_SCHEMA_COLUMN', type: 'STRING' }] } });
    await service.request('dryRun', { operation: 'jobs.insert', query: 'SELECT PRIVATE_QUERY' });
    assert.deepEqual(prompts[0], ['adc-project', 'US', 'adc-project']);
    assert.match(mock.requests[0].url, /projects\/adc-project\/datasets\?/);
    assert.match(mock.requests[0].url, /pageToken=next-page/);
    assert.match(mock.requests[1].url, /datasets\/test_dataset\/tables/);
    assert.deepEqual(mock.requests[3].body, {
      jobReference: { projectId: 'adc-project', location: 'US' },
      configuration: {
        dryRun: true,
        query: {
          query: 'SELECT PRIVATE_QUERY',
          useLegacySql: false,
          defaultDataset: { projectId: 'adc-project', datasetId: 'test_dataset' },
        },
      },
    });
    const output = JSON.stringify(logs);
    for (const secret of ['PRIVATE_QUERY', 'PRIVATE_SCHEMA_COLUMN', 'PRIVATE_TOKEN', 'next-page'])
      assert(!output.includes(secret));
    assert.deepEqual(Object.keys(logs[0]).sort(), ['durationMs', 'location', 'operation', 'project', 'status']);
  });

  for (const [scenario, kind, message] of [
    [401, 'auth', 'sign-in'],
    [403, 'permission', 'permission'],
    [404, 'notFound', 'not found'],
    [400, 'api', 'HTTP 400'],
    ['disconnect', 'network', 'network'],
    [429, 'rateLimit', 'rate limit'],
    ['rateLimitExceeded', 'rateLimit', 'rate limit'],
    [503, 'api', 'HTTP 503'],
  ] as const) {
    it(`reports ${scenario} once, quietly rejects repeats and allows explicit retry`, async () => {
      mock.fallback = scenario;
      for (let attempt = 0; attempt < 2; attempt++)
        await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind });
      assert.equal(notifications.length, 1);
      assert.match(notifications[0], new RegExp(message));
      assert(!JSON.stringify(logs).includes('PRIVATE_'));
      service.retry();
      await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind });
      assert.equal(notifications.length, 2);
    });
  }

  it('retries transient failures with backoff and succeeds', async () => {
    mock.scenarios = [429, 'rateLimitExceeded', 500, 'success'];
    const started = performance.now();
    await service.request('schema', { operation: 'datasets.list' });
    assert.equal(mock.requests.length, 4);
    assert(performance.now() - started >= 700);
    assert.equal(notifications.length, 0);
    assert.equal(logs[0].status, 200);
  });

  it('reports missing credentials once without sending any API call', async () => {
    credentials.check = async () => {
      throw new Error('PRIVATE_TOKEN');
    };
    for (let attempt = 0; attempt < 2; attempt++)
      await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'auth' });
    assert.equal(notifications.length, 1);
    assert.match(notifications[0], /application-default login/);
    assert.equal(mock.requests.length, 0);
    assert(!JSON.stringify(logs).includes('PRIVATE_TOKEN'));
  });

  it('times out project discovery, authentication, slow responses and backoff', async () => {
    settings.timeoutMs = 30;
    settings.projectId = undefined;
    credentials.projectId = () => new Promise(() => undefined);
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'timeout' });
    settings.projectId = 'test-project';
    credentials.check = () => new Promise(() => undefined);
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'timeout' });
    credentials.check = async () => undefined;
    mock.fallback = 'slow';
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'timeout' });
    mock.fallback = 429;
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'timeout' });
  });

  it('cancels requests and retry waits without notifications', async () => {
    mock.fallback = 'slow';
    const controller = new AbortController();
    const pending = service.request('schema', { operation: 'datasets.list' }, undefined, controller.signal);
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(pending, { kind: 'cancelled' });
    mock.fallback = 429;
    const backoff = service.request('schema', { operation: 'datasets.list' });
    setTimeout(() => service.invalidate(), 40);
    await assert.rejects(backoff, { kind: 'cancelled' });
    assert.equal(notifications.length, 0);
  });

  it('does not follow redirects with credential headers', async () => {
    mock.fallback = 'redirect';
    await assert.rejects(service.request('schema', { operation: 'datasets.list' }), { kind: 'api', status: 302 });
    assert.equal(mock.requests.length, 1);
  });

  it('restricts endpoint overrides to loopback and uses synthetic credentials in test mode', async () => {
    for (const endpoint of [
      'https://example.com/',
      'http://example.com/',
      'http://user:pass@localhost/',
      'http://localhost/?redirect=yes',
    ]) {
      process.env.BQSQL_TEST_BIGQUERY_ENDPOINT = endpoint;
      assert.throws(apiEndpoint, /loopback/);
    }
    process.env.BQSQL_TEST_BIGQUERY_ENDPOINT = mock.endpoint;
    const testAuth = createCredentials();
    assert.equal(await testAuth.projectId(), 'test-project');
    await testAuth.request({ url: `${mock.endpoint}projects/test-project/datasets` });
    assert.equal(mock.requests[0].authorization, 'Bearer bqsql-test-token');
    delete process.env.BQSQL_TEST_BIGQUERY_ENDPOINT;
    assert.equal(apiEndpoint(), 'https://bigquery.googleapis.com/bigquery/v2/');
  });

  it('routes API calls through an explicit VS Code-style HTTP proxy', async () => {
    const sockets = new Set<Socket>();
    const proxy = createServer();
    let connections = 0;
    proxy.on('connect', (request, socket, head) => {
      connections++;
      const target = new URL(`http://${request.url}`);
      const upstream = connect(Number(target.port), target.hostname);
      sockets.add(upstream);
      upstream.on('error', () => socket.destroy());
      upstream.once('connect', () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        upstream.write(head);
        socket.pipe(upstream).pipe(socket);
      });
    });
    proxy.on('connection', (socket) => sockets.add(socket));
    proxy.listen(0, '127.0.0.1');
    await once(proxy, 'listening');
    const address = proxy.address();
    assert(address && typeof address !== 'string');
    try {
      const authClient = new OAuth2Client({
        credentials: { access_token: 'PRIVATE_TOKEN', expiry_date: Date.now() + 86400000 },
        transporter: new Gaxios({ agent: new HttpsProxyAgent(`http://127.0.0.1:${address.port}`) }),
      });
      const rest = new BigQueryRestClient(
        { ...credentials, request: (options) => authClient.request(options) },
        (metadata) => logs.push(metadata),
      );
      await rest.request({ operation: 'datasets.list' }, { project: 'test-project' }, new AbortController().signal);
      assert.equal(connections, 1);
      assert.equal(mock.requests.length, 1);
    } finally {
      const closed = once(proxy, 'close');
      proxy.close();
      for (const socket of sockets) socket.destroy();
      await closed;
    }
  });
});
