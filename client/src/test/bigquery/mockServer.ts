import { createServer, type Server } from 'node:http';
import { once } from 'node:events';

export type MockScenario =
  | 'success'
  | 'slow'
  | 'disconnect'
  | 'rateLimitExceeded'
  | 'redirect'
  | 'invalidQuery'
  | 'notFound'
  | 'accessDenied'
  | 'accessNotConfigured'
  | 'serviceUsageDenied'
  | 'script'
  | 'nestedSchema'
  | number;

export interface RecordedRequest {
  url: string;
  method: string;
  authorization?: string;
  quotaProject?: string;
  body?: unknown;
}

export class MockBigQueryServer {
  readonly requests: RecordedRequest[] = [];
  scenarios: MockScenario[] = [];
  fallback: MockScenario = 'success';
  errorPayload?: unknown;
  jobPayload?: unknown;
  private readonly server: Server;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  endpoint = '';

  constructor() {
    this.server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const content = Buffer.concat(chunks).toString();
      this.requests.push({
        url: request.url!,
        method: request.method!,
        authorization: request.headers.authorization,
        quotaProject:
          typeof request.headers['x-goog-user-project'] === 'string'
            ? request.headers['x-goog-user-project']
            : undefined,
        ...(content ? { body: JSON.parse(content) } : {}),
      });
      const scenario = this.scenarios.shift() ?? this.fallback;
      if (scenario === 'disconnect') {
        request.socket.destroy();
        return;
      }
      if (scenario === 'redirect') {
        response.writeHead(302, { location: `${this.endpoint}redirected` });
        response.end();
        return;
      }
      response.setHeader('Content-Type', 'application/json');
      const send = () => {
        const errors: Partial<Record<MockScenario, { status: number; reason: string; message: string }>> = {
          invalidQuery: { status: 400, reason: 'invalidQuery', message: 'Unrecognized name: PRIVATE_QUERY at [2:8]' },
          notFound: {
            status: 404,
            reason: 'notFound',
            message: 'Not found: Table test-project:test_dataset.PRIVATE_SCHEMA_COLUMN',
          },
          accessDenied: {
            status: 403,
            reason: 'accessDenied',
            message:
              'User does not have permission to query table PRIVATE_SCHEMA_COLUMN, or perhaps it does not exist.',
          },
          accessNotConfigured: {
            status: 403,
            reason: 'accessNotConfigured',
            message: 'BigQuery API has not been used in project 123 before or it is disabled.',
          },
          serviceUsageDenied: {
            status: 403,
            reason: 'forbidden',
            message: 'Caller does not have required permission to use project test-quota.',
          },
          rateLimitExceeded: { status: 429, reason: 'rateLimitExceeded', message: 'PRIVATE_QUERY_OR_TOKEN' },
        };
        const failure = errors[scenario];
        if (typeof scenario === 'number' || failure) {
          response.statusCode = typeof scenario === 'number' ? scenario : failure!.status;
          response.end(
            JSON.stringify(
              this.errorPayload === undefined
                ? {
                    error: {
                      errors: [{ reason: failure?.reason ?? 'mockError' }],
                      message: failure?.message ?? 'PRIVATE_QUERY_OR_TOKEN',
                    },
                  }
                : this.errorPayload,
            ),
          );
        } else if (request.url?.includes('/jobs')) {
          response.end(
            JSON.stringify(
              this.jobPayload ?? {
                statistics: {
                  query: {
                    statementType: scenario === 'script' ? 'SCRIPT' : 'SELECT',
                    totalBytesProcessed: scenario === 'script' ? '0' : '1234',
                  },
                },
              },
            ),
          );
        } else if (request.url?.match(/\/tables\/[^?]+/)) {
          response.end(
            JSON.stringify({
              schema: {
                fields:
                  scenario === 'nestedSchema'
                    ? [{ name: 'record_column', type: 'RECORD', fields: [{ name: 'nested_column', type: 'STRING' }] }]
                    : [{ name: 'PRIVATE_SCHEMA_COLUMN', type: 'STRING' }],
              },
            }),
          );
        } else if (request.url?.includes('/tables')) {
          response.end(
            JSON.stringify({
              tables: [
                { tableReference: { projectId: 'test-project', datasetId: 'test_dataset', tableId: 'test_table' } },
              ],
              nextPageToken: 'next-table-page',
            }),
          );
        } else {
          response.end(
            JSON.stringify({
              datasets: [{ datasetReference: { projectId: 'test-project', datasetId: 'test_dataset' } }],
              nextPageToken: 'next-page',
            }),
          );
        }
      };
      if (scenario === 'slow') {
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          send();
        }, 1000);
        this.timers.add(timer);
      } else send();
    });
  }

  async start(): Promise<void> {
    this.server.listen(0, '127.0.0.1');
    await once(this.server, 'listening');
    const address = this.server.address();
    if (!address || typeof address === 'string') throw new Error('Mock BigQuery server did not obtain a port');
    this.endpoint = `http://127.0.0.1:${address.port}/bigquery/v2/`;
  }

  async close(): Promise<void> {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    const closed = once(this.server, 'close');
    this.server.close();
    this.server.closeAllConnections();
    await closed;
  }
}
