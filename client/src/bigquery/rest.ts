import { GoogleAuth, OAuth2Client, type AnyAuthClient } from 'google-auth-library';
import { GaxiosError, type GaxiosOptions, type GaxiosResponse } from 'gaxios';
import { setTimeout as delay } from 'node:timers/promises';

export class BigQueryError extends Error {
  constructor(
    public readonly kind:
      | 'auth'
      | 'permission'
      | 'notFound'
      | 'network'
      | 'timeout'
      | 'rateLimit'
      | 'api'
      | 'cancelled'
      | 'disabled'
      | 'consent',
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'BigQueryError';
  }
}

export interface Credentials {
  projectId(): Promise<string>;
  check(): Promise<void>;
  retry(): void;
  request(options: GaxiosOptions): Promise<GaxiosResponse<unknown>>;
}

export function createCredentials(): Credentials {
  const testMode = Boolean(process.env.BQSQL_TEST_BIGQUERY_ENDPOINT);
  if (testMode) apiEndpoint();
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/bigquery'],
  });
  let checked: Promise<AnyAuthClient> | undefined;
  const client = () => {
    checked ??= (async () => {
      const credential = testMode
        ? new OAuth2Client({ credentials: { access_token: 'bqsql-test-token', expiry_date: Date.now() + 86400000 } })
        : await auth.getClient();
      credential.quotaProjectId = undefined;
      await credential.getAccessToken();
      return credential;
    })().catch(() => {
      throw new BigQueryError(
        'auth',
        'BigQuery credentials unavailable. Run gcloud auth application-default login, or configure GOOGLE_APPLICATION_CREDENTIALS, then retry.',
      );
    });
    return checked;
  };
  return {
    projectId: () => (testMode ? Promise.resolve('test-project') : auth.getProjectId()),
    check: async () => {
      await client();
    },
    retry: () => {
      checked = undefined;
    },
    request: async (options) => (await client()).request(options),
  };
}

export type BigQueryRequest =
  | { operation: 'jobs.insert'; query: string }
  | { operation: 'datasets.list'; project?: string; pageToken?: string }
  | { operation: 'tables.list'; project?: string; dataset?: string; pageToken?: string }
  | { operation: 'tables.get'; project?: string; dataset?: string; table: string };

export interface RequestContext {
  project: string;
  quotaProjectId?: string;
  location?: string;
  defaultDataset?: string;
}

export interface RequestMetadata {
  operation: BigQueryRequest['operation'];
  project: string;
  location?: string;
  durationMs: number;
  status: number | BigQueryError['kind'];
}

export function apiEndpoint(): string {
  const override = process.env.BQSQL_TEST_BIGQUERY_ENDPOINT;
  if (!override) return 'https://bigquery.googleapis.com/bigquery/v2/';
  const url = new URL(override);
  // A test override must never send real ADC to a remote endpoint.
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('BQSQL_TEST_BIGQUERY_ENDPOINT must be a loopback HTTP URL');
  }
  return `${url.href.replace(/\/$/, '')}/`;
}

export async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort: () => void;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        abort = () => reject(signal.reason);
        signal.addEventListener('abort', abort, { once: true });
      }),
    ]);
  } finally {
    signal.removeEventListener('abort', abort!);
  }
}

function classify(error: unknown, signal: AbortSignal, context: RequestContext): BigQueryError {
  if (signal.aborted) {
    return signal.reason instanceof BigQueryError
      ? signal.reason
      : new BigQueryError('cancelled', 'BigQuery request cancelled.');
  }
  if (!(error instanceof GaxiosError))
    return new BigQueryError('network', 'BigQuery network request failed. Check your connection and proxy settings.');
  const status = error.response?.status;
  if (status === 401)
    return new BigQueryError(
      'auth',
      'BigQuery sign-in expired. Run gcloud auth application-default login, then retry.',
      status,
    );
  const details = errorDetails(error);
  if (status === 403 && details.reasons.includes('accessNotConfigured'))
    return new BigQueryError(
      'permission',
      'BigQuery API is disabled in the credential project. Enable it there, or set bigquerySQLFormatter.bigquery.quotaProjectId to an API-enabled project and grant roles/serviceusage.serviceUsageConsumer.',
      status,
    );
  if (
    status === 403 &&
    (details.message.includes('required permission to use project') || details.reasons.includes('serviceUsageDenied'))
  )
    return new BigQueryError(
      'permission',
      'BigQuery quota-project permission denied. Grant roles/serviceusage.serviceUsageConsumer on the quota project, or remove bigquerySQLFormatter.bigquery.quotaProjectId.',
      status,
    );
  if (status === 403 && !rateLimited(error))
    return new BigQueryError(
      'permission',
      `BigQuery permission denied. Check the project and your IAM permissions.${context.location && details.reasons.includes('accessDenied') && details.message.includes('or perhaps it does not exist') ? ' BigQuery also reports location mismatches as access denied. Check bigquerySQLFormatter.bigquery.location and that all referenced datasets are in the same region.' : ''}`,
      status,
    );
  if (status === 404)
    return new BigQueryError(
      'notFound',
      'BigQuery project, dataset, table or location was not found. Check your settings.',
      status,
    );
  if (rateLimited(error)) return new BigQueryError('rateLimit', 'BigQuery rate limit reached. Wait and retry.', status);
  if (!status)
    return new BigQueryError('network', 'BigQuery network request failed. Check your connection and proxy settings.');
  return new BigQueryError('api', `BigQuery API request failed (HTTP ${status}). Check the request and retry.`, status);
}

function errorDetails(error: GaxiosError): { reasons: string[]; message: string } {
  const data: unknown = error.response?.data;
  if (
    typeof data !== 'object' ||
    data === null ||
    !('error' in data) ||
    typeof data.error !== 'object' ||
    data.error === null
  )
    return { reasons: [], message: '' };
  return {
    message: 'message' in data.error && typeof data.error.message === 'string' ? data.error.message : '',
    reasons:
      'errors' in data.error && Array.isArray(data.error.errors)
        ? data.error.errors.flatMap((entry: unknown) =>
            typeof entry === 'object' && entry !== null && 'reason' in entry && typeof entry.reason === 'string'
              ? [entry.reason]
              : [],
          )
        : [],
  };
}

function rateLimited(error: GaxiosError): boolean {
  return error.response?.status === 429 || errorDetails(error).reasons.includes('rateLimitExceeded');
}

export class BigQueryRestClient {
  private readonly endpoint: string;

  constructor(
    private readonly credentials: Credentials,
    private readonly log: (metadata: RequestMetadata) => void,
  ) {
    this.endpoint = apiEndpoint();
  }

  async request(request: BigQueryRequest, context: RequestContext, signal: AbortSignal): Promise<unknown> {
    const started = performance.now();
    let status: RequestMetadata['status'] = 'api';
    try {
      const component = (value: string | undefined, name: string) => {
        if (!value || !/^[a-zA-Z0-9_.:-]+$/.test(value)) throw new BigQueryError('api', `Invalid BigQuery ${name}.`);
        return encodeURIComponent(value);
      };
      const project = component(
        request.operation === 'jobs.insert' ? context.project : (request.project ?? context.project),
        'project',
      );
      let path = `projects/${project}/`;
      const params: Record<string, string> = {};
      if ('pageToken' in request && request.pageToken) params.pageToken = request.pageToken;
      if (request.operation === 'jobs.insert') path += 'jobs';
      else if (request.operation === 'datasets.list') path += 'datasets';
      else {
        path += `datasets/${component(request.dataset ?? context.defaultDataset, 'dataset')}/tables`;
        if (request.operation === 'tables.get') path += `/${component(request.table, 'table')}`;
      }
      const url = new URL(path, this.endpoint).href;
      try {
        await abortable(this.credentials.check(), signal);
      } catch (error) {
        if (signal.aborted) throw error;
        throw new BigQueryError(
          'auth',
          'BigQuery credentials unavailable. Run gcloud auth application-default login, or configure GOOGLE_APPLICATION_CREDENTIALS, then retry.',
        );
      }
      const options: GaxiosOptions = {
        url,
        headers: context.quotaProjectId ? { 'x-goog-user-project': context.quotaProjectId } : {},
        params,
        signal,
        retry: false,
        maxRedirects: 0,
        redirect: 'manual',
        responseType: 'json',
        method: request.operation === 'jobs.insert' ? 'POST' : 'GET',
      };
      if (request.operation === 'jobs.insert') {
        options.data = {
          jobReference: { projectId: context.project, ...(context.location ? { location: context.location } : {}) },
          configuration: {
            dryRun: true,
            query: {
              query: request.query,
              useLegacySql: false,
              ...(context.defaultDataset
                ? { defaultDataset: { projectId: context.project, datasetId: context.defaultDataset } }
                : {}),
            },
          },
        };
      }
      for (let attempt = 0; ; attempt++) {
        try {
          signal.throwIfAborted();
          const response = await this.credentials.request(options);
          status = response.status;
          return response.data;
        } catch (error) {
          if (
            signal.aborted ||
            !(error instanceof GaxiosError) ||
            attempt >= 3 ||
            (!rateLimited(error) && (error.response?.status ?? 0) < 500)
          )
            throw error;
          await delay(100 * 2 ** attempt + Math.random() * 50, undefined, { signal });
        }
      }
    } catch (error) {
      const failure = error instanceof BigQueryError ? error : classify(error, signal, context);
      status = failure.status ?? failure.kind;
      throw failure;
    } finally {
      this.log({
        operation: request.operation,
        project: request.operation === 'jobs.insert' ? context.project : (request.project ?? context.project),
        location: context.location,
        durationMs: Math.round(performance.now() - started),
        status,
      });
    }
  }
}
