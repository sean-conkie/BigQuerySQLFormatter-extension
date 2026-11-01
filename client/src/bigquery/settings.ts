export type BigQueryFeature = 'dryRun' | 'schema';

export interface QueryParameter {
  type: string;
  value: string | number | boolean | null;
}

export interface BigQuerySettings {
  projectId?: string;
  quotaProjectId?: string;
  location?: string;
  defaultDataset?: string;
  timeoutMs: number;
  dryRun: {
    enabled: boolean;
    trigger: 'onSave' | 'onDemand';
    costPerTiB?: number;
    parameters?: Record<string, QueryParameter>;
  };
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
  const parameters = read('dryRun.parameters');
  let parsedParameters: Record<string, QueryParameter> | undefined;
  if (parameters !== undefined) {
    if (typeof parameters !== 'object' || parameters === null || Array.isArray(parameters))
      throw new Error('Invalid BigQuery setting: dryRun.parameters');
    parsedParameters = {};
    for (const [name, parameter] of Object.entries(parameters)) {
      if (
        !/^[a-z_]\w*$/i.test(name) ||
        typeof parameter !== 'object' ||
        parameter === null ||
        !('type' in parameter) ||
        typeof parameter.type !== 'string' ||
        !/^(STRING|BOOL|BOOLEAN|INT64|INTEGER|FLOAT64|FLOAT|NUMERIC|BIGNUMERIC|BYTES|DATE|DATETIME|TIME|TIMESTAMP|GEOGRAPHY|JSON)$/i.test(
          parameter.type,
        ) ||
        !('value' in parameter) ||
        (parameter.value !== null &&
          typeof parameter.value !== 'string' &&
          typeof parameter.value !== 'boolean' &&
          !(typeof parameter.value === 'number' && Number.isFinite(parameter.value)))
      )
        throw new Error(`Invalid BigQuery setting: dryRun.parameters.${name} (scalar type and value required)`);
      Object.defineProperty(parsedParameters, name, {
        value: { type: parameter.type.toUpperCase(), value: parameter.value },
        enumerable: true,
      });
    }
  }
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
      ...(parsedParameters ? { parameters: parsedParameters } : {}),
    },
    schema: { enabled: enabled('schema.enabled'), cacheTtlMinutes: number('schema.cacheTtlMinutes', 60, 0)! },
  };
}
