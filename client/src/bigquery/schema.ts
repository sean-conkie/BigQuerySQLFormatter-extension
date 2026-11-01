import type { SchemaEntry, SchemaField, SchemaRequest, SchemaResponse } from '../../../shared/schema';
import { abortable, BigQueryError, type BigQueryRequest } from './rest';

interface CacheEntry {
  entries: SchemaEntry[];
  expires: number;
  nextPage?: string;
  loaded: boolean;
  failed: boolean;
  fetching?: Promise<void>;
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new BigQueryError('api', 'Invalid BigQuery metadata response. Refresh Schema Cache and retry.');
  return value as Record<string, unknown>;
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function required(value: unknown): string {
  const result = string(value);
  if (!result) throw new BigQueryError('api', 'Invalid BigQuery metadata identifier. Refresh Schema Cache and retry.');
  return result;
}

function fields(value: unknown): SchemaField[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new BigQueryError('api', 'Invalid BigQuery schema fields. Refresh Schema Cache.');
  return value.map((value: unknown) => {
    const field = object(value);
    return {
      name: required(field.name),
      type: required(field.type),
      mode: string(field.mode) ?? 'NULLABLE',
      description: string(field.description),
      ...(field.fields === undefined ? {} : { fields: fields(field.fields) }),
    };
  });
}

export function parseMetadata(value: unknown, request: SchemaRequest): { entries: SchemaEntry[]; nextPage?: string } {
  const data = object(value);
  if (request.table) {
    const partition = data.timePartitioning ?? data.rangePartitioning;
    const clustering = data.clustering === undefined ? undefined : object(data.clustering).fields;
    return {
      entries: [
        {
          name: request.table,
          type: string(data.type) ?? 'TABLE',
          description: string(data.description),
          fields: data.schema === undefined ? [] : fields(object(data.schema).fields),
          numRows: string(data.numRows),
          numBytes: string(data.numBytes),
          lastModifiedTime: string(data.lastModifiedTime),
          partitioning: partition === undefined ? undefined : JSON.stringify(partition),
          clustering: Array.isArray(clustering) ? clustering.map(required) : undefined,
        },
      ],
    };
  }
  const list = data[request.dataset ? 'tables' : 'datasets'] ?? [];
  if (!Array.isArray(list)) throw new BigQueryError('api', 'Invalid BigQuery metadata list. Refresh Schema Cache.');
  return {
    entries: list.map((value: unknown) => {
      const entry = object(value);
      const reference = object(entry[request.dataset ? 'tableReference' : 'datasetReference']);
      return {
        name: required(reference[request.dataset ? 'tableId' : 'datasetId']),
        type: string(entry.type),
        location: string(entry.location),
        description: string(entry.description),
      };
    }),
    nextPage: string(data.nextPageToken),
  };
}

export interface SchemaHost {
  scope(resource: string): string;
  request(request: BigQueryRequest, resource: string, signal: AbortSignal): Promise<unknown>;
  authorized(request: SchemaRequest): boolean;
  report(error: BigQueryError, resource: string): void;
}

export class SchemaCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly active = new Map<string, number>();
  private readonly queues = new Map<string, (() => void)[]>();
  private controller = new AbortController();

  constructor(
    private readonly host: SchemaHost,
    private readonly waitMs = 500,
    private readonly concurrency = 4,
  ) {}

  clear(): void {
    this.controller.abort(new BigQueryError('cancelled', 'Schema cache refreshed.'));
    this.controller = new AbortController();
    this.cache.clear();
  }

  private async acquire(project: string, signal: AbortSignal): Promise<() => void> {
    const release = () => {
      const next = this.queues.get(project)?.shift();
      if (next) next();
      else this.active.set(project, (this.active.get(project) ?? 1) - 1);
    };
    if ((this.active.get(project) ?? 0) >= this.concurrency) {
      let resume: () => void;
      const queue = this.queues.get(project) ?? [];
      this.queues.set(project, queue);
      try {
        await abortable(
          new Promise<void>((resolve) => {
            resume = resolve;
            queue.push(resolve);
          }),
          signal,
        );
      } catch (error) {
        const index = queue.indexOf(resume!);
        if (index >= 0) queue.splice(index, 1);
        else release();
        throw error;
      }
    } else {
      this.active.set(project, (this.active.get(project) ?? 0) + 1);
    }
    return release;
  }
  async lookup(request: SchemaRequest, ttlMinutes: number, cancellation?: AbortSignal): Promise<SchemaResponse> {
    cancellation?.throwIfAborted();
    const key = JSON.stringify([this.host.scope(request.resource), request.project, request.dataset, request.table]);
    let entry = this.cache.get(key);
    if (!entry || (!entry.fetching && entry.expires <= Date.now())) {
      entry = { entries: [], expires: Infinity, loaded: false, failed: false };
      this.cache.set(key, entry);
    }
    if (!entry.failed && !entry.fetching && (!entry.loaded || entry.nextPage)) {
      const current = entry;
      const signal = this.controller.signal;
      current.fetching = (async () => {
        let release: (() => void) | undefined;
        try {
          release = await this.acquire(request.project ?? '', signal);
          signal.throwIfAborted();
          const operation: BigQueryRequest = request.table
            ? { operation: 'tables.get', project: request.project, dataset: request.dataset, table: request.table }
            : request.dataset
              ? {
                  operation: 'tables.list',
                  project: request.project,
                  dataset: request.dataset,
                  pageToken: current.nextPage,
                }
              : { operation: 'datasets.list', project: request.project, pageToken: current.nextPage };
          const result = parseMetadata(await this.host.request(operation, request.resource, signal), request);
          signal.throwIfAborted();
          const names = new Set(current.entries.map((entry) => entry.name));
          current.entries.push(...result.entries.filter((entry) => !names.has(entry.name)));
          current.nextPage = result.nextPage;
          current.loaded = true;
        } catch (error) {
          current.failed = true;
          const failure =
            error instanceof BigQueryError
              ? error
              : new BigQueryError('api', 'Schema lookup failed. Refresh Schema Cache and retry.');
          this.host.report(failure, request.resource);
        } finally {
          release?.();
          current.fetching = undefined;
          current.expires = Date.now() + ttlMinutes * 60000;
        }
      })();
    }
    if (!this.host.authorized(request)) return { unavailable: true, entries: [] };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const wait = Promise.race([
        entry.fetching,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, this.waitMs);
        }),
      ]);
      await (cancellation ? abortable(wait, cancellation) : wait);
    } finally {
      clearTimeout(timer);
    }
    if (entry.failed || !this.host.authorized(request)) return { unavailable: true, entries: [] };
    return { entries: entry.entries.slice(), pending: Boolean(entry.fetching || entry.nextPage) };
  }
}
