export type BigQueryFeature = 'dryRun' | 'schema';

export interface BigQuerySettings {
  projectId?: string;
  quotaProjectId?: string;
  location?: string;
  defaultDataset?: string;
  timeoutMs: number;
  dryRun: { enabled: boolean; trigger: 'onSave' | 'onDemand'; costPerTiB?: number };
  schema: { enabled: boolean; cacheTtlMinutes: number };
}

export function parseBigQuerySettings(read: (key: string) => unknown): BigQuerySettings {
  const optionalString = (key: string, pattern: RegExp) => {
    const value = read(key);
    if (value === undefined || value === '') return undefined;
    if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`Invalid BigQuery setting: ${key}`);
    return value;
  };
  const number = (key: string, fallback: number | undefined, minimum: number, integer = false) => {
    const value = read(key) ?? fallback;
    if (value === undefined) return undefined;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < minimum ||
      (integer && !Number.isInteger(value))
    ) {
      throw new Error(`Invalid BigQuery setting: ${key}`);
    }
    return value;
  };
  const enabled = (key: string) => {
    const value = read(key) ?? false;
    if (typeof value !== 'boolean') throw new Error(`Invalid BigQuery setting: ${key}`);
    return value;
  };
  const trigger = read('dryRun.trigger') ?? 'onSave';
  if (trigger !== 'onSave' && trigger !== 'onDemand') throw new Error('Invalid BigQuery setting: dryRun.trigger');
  const timeoutMs = number('timeoutMs', 10000, 1, true)!;
  if (timeoutMs > 2147483647) throw new Error('Invalid BigQuery setting: timeoutMs');
  return {
    projectId: optionalString('projectId', /^[a-zA-Z0-9][a-zA-Z0-9.:-]*$/),
    quotaProjectId: optionalString('quotaProjectId', /^[a-zA-Z0-9][a-zA-Z0-9.:-]*$/),
    location: optionalString('location', /^[a-zA-Z0-9-]+$/),
    defaultDataset: optionalString('defaultDataset', /^[a-zA-Z0-9_]+$/),
    timeoutMs,
    dryRun: {
      enabled: enabled('dryRun.enabled'),
      trigger,
      costPerTiB: number('dryRun.costPerTiB', undefined, 0),
    },
    schema: { enabled: enabled('schema.enabled'), cacheTtlMinutes: number('schema.cacheTtlMinutes', 60, 0)! },
  };
}
