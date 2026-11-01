import type { QueryParameter } from './settings';

export interface SqlToken {
  value: string;
  literal: boolean;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
}

export type TokenizeSql = (text: string) => Promise<SqlToken[]>;

export function queryFeatures(tokens: SqlToken[], parameters?: Record<string, QueryParameter>) {
  const code = tokens.filter((token) => !token.literal);
  const adjacent = (a: SqlToken, b: SqlToken | undefined) =>
    b && a.range.end.line === b.range.start.line && a.range.end.character === b.range.start.character;
  let assumedNull = false;
  let templated = false;
  for (let i = 0; i < code.length; i++) {
    const token = code[i];
    const next = code[i + 1];
    if (token.value === '?' || (token.value === '@' && next?.value !== '@' && code[i - 1]?.value !== '@')) {
      if (token.value === '?' || !parameters || !Object.keys(parameters).includes(next?.value ?? ''))
        assumedNull = true;
    }
    if (
      adjacent(token, next) &&
      ((token.value === '{' && ['{', '%'].includes(next.value)) || (token.value === '$' && next.value === '{'))
    )
      templated = true;
    if (['config', 'js'].includes(token.value.toLowerCase()) && next?.value === '{') templated = true;
  }
  return { assumedNull, templated };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function dryRunResult(response: unknown, assumedNull: boolean, costPerTiB?: number) {
  const root = record(response);
  const statistics = record(root?.statistics);
  const query = record(statistics?.query);
  const bytes = statistics?.totalBytesProcessed ?? query?.totalBytesProcessed;
  if (typeof bytes !== 'string' || !/^\d+$/.test(bytes) || !Number.isFinite(Number(bytes)))
    throw new Error('BigQuery dry run returned invalid bytes processed.');
  const size = Number(bytes);
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const unit = size === 0 ? 0 : Math.min(Math.floor(Math.log(size) / Math.log(1000)), units.length - 1);
  let label = `≈ ${(size / 1000 ** unit).toFixed(unit === 0 ? 0 : 2)} ${units[unit]} processed`;
  if (costPerTiB !== undefined) label += `; estimated cost ${((size / 2 ** 40) * costPerTiB).toFixed(2)}`;
  if (query?.statementType === 'SCRIPT') label += " (script; statements inside IF/LOOP/BEGIN blocks aren't estimated)";
  if (assumedNull) label += '; parameters assumed NULL; estimate may be low';
  const tables = Array.isArray(query?.referencedTables)
    ? query.referencedTables.map((entry: unknown) => {
        const table = record(entry);
        if (![table?.projectId, table?.datasetId, table?.tableId].every((value) => typeof value === 'string'))
          throw new Error('BigQuery dry run returned an invalid referenced table.');
        return `${table.projectId}.${table.datasetId}.${String(table.tableId).replace(/@.*$/, '')}`;
      })
    : [];
  return { label, tables };
}

export function errorOffsets(query: string, message: string, tokens: SqlToken[]): [number, number] {
  const lines = query.split(/\r\n|\r|\n/);
  const lineStart = (line: number) => {
    const breaks = [...query.matchAll(/\r\n|\r|\n/g)];
    return line === 0 ? 0 : breaks[line - 1].index + breaks[line - 1][0].length;
  };
  const position = /\[(\d+):(\d+)\]/.exec(message);
  if (position) {
    const line = Math.max(0, Math.min(Number(position[1]) - 1, lines.length - 1));
    const column = Math.max(0, Number(position[2]) - 1);
    const start = lineStart(line) + Array.from(lines[line]).slice(0, column).join('').length;
    return [start, Math.min(query.length, start + 1)];
  }
  const table = /\btable\s+[`'"]?([a-z0-9_.:-]+)/i.exec(message)?.[1]?.replace(':', '.');
  if (table) {
    const normalized = query.replace(/:/g, '.');
    const start = normalized.indexOf(table);
    if (start !== -1) return [start, start + table.length];
  }
  const firstLine = tokens[0]?.range.start.line ?? 0;
  const start = lineStart(firstLine);
  return [start, start + lines[firstLine].length];
}
