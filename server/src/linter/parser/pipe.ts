import { closingBracket, keyword, type SourceToken } from '../rules/source';
import type { QuerySource } from '../scope';
import keywords from '../keywords.json';

const reserved = new Set(keywords.reserved);

export interface PipeItem {
  tokens: SourceToken[];
  expression: SourceToken[];
  alias?: SourceToken;
  as?: SourceToken;
  ordering: SourceToken[];
}

interface Stage {
  operator: string;
  start: number;
  body: number;
  end: number;
}

export type PipeClause = Stage &
  (
    | {
        kind: 'projection';
        items: PipeItem[];
        groupBy: PipeItem[];
        groupStart?: number;
        groupExpressionStart?: number;
        windows: PipeItem[];
        output: 'columns' | 'struct' | 'value';
      }
    | { kind: 'filter'; condition: SourceToken[] }
    | { kind: 'columns'; items: PipeItem[] }
    | { kind: 'alias'; alias?: SourceToken }
    | { kind: 'source'; source: SourceToken[]; relation?: QuerySource; condition: SourceToken[]; using: SourceToken[] }
    | { kind: 'order'; items: PipeItem[] }
    | { kind: 'limit'; limit: SourceToken[]; offset: SourceToken[] }
    | { kind: 'set'; operands: SourceToken[][]; modifier?: SourceToken; byName: boolean }
    | {
        kind: 'relation';
        operands: PipeItem[];
        alias?: SourceToken;
        pivot?: { aggregates: PipeItem[]; forColumns: SourceToken[]; values: PipeItem[] };
        unpivot?: { columns: SourceToken[]; forColumn: SourceToken[]; values: PipeItem[] };
        sample?: { method?: SourceToken; size: SourceToken[] };
      }
    | { kind: 'distinct' }
    | { kind: 'unsupported'; reason: string }
  );

export function topLevel(tokens: SourceToken[], start: number, end: number): number[] {
  const result: number[] = [];
  for (let i = start; i < end; i++) {
    result.push(i);
    if (keyword(tokens[i], '(') || keyword(tokens[i], '[')) {
      const close = closingBracket(tokens, i);
      if (close < 0 || close >= end) break;
      i = close;
    }
  }
  return result;
}

const identifier = (token: SourceToken | undefined) =>
  token !== undefined &&
  (token.value.startsWith('`') ||
    (!token.literal && /^[a-z_][\w$]*$/i.test(token.value) && !reserved.has(token.value.toLowerCase())));

export function pipeItems(tokens: SourceToken[], start: number, end: number, literalAliases = false): PipeItem[] {
  const boundaries = [...topLevel(tokens, start, end).filter((i) => keyword(tokens[i], ',')), end];
  const items: PipeItem[] = [];
  for (const stop of boundaries) {
    const item = tokens.slice(start, stop);
    start = stop + 1;
    if (!item.length) continue;
    let tail = item.length;
    while (tail && /^(ASC|DESC|NULLS|FIRST|LAST)$/i.test(item[tail - 1].value) && !item[tail - 1].literal) tail--;
    const indices = topLevel(item, 0, tail);
    const as = [...indices].reverse().find((i) => keyword(item[i], 'AS'));
    let alias =
      as !== undefined &&
      as === tail - 2 &&
      (identifier(item[tail - 1]) || (literalAliases && (item[tail - 1].literal || /^\d+$/.test(item[tail - 1].value))))
        ? item[tail - 1]
        : undefined;
    let expressionEnd = alias ? as! : tail;
    if (
      !alias &&
      tail > 1 &&
      identifier(item[tail - 1]) &&
      indices.includes(tail - 1) &&
      (keyword(item[tail - 2], ')') ||
        keyword(item[tail - 2], ']') ||
        item[tail - 2].literal ||
        /^[\w$]+$/.test(item[tail - 2].value)) &&
      !keyword(item[tail - 2], 'COLLATE')
    ) {
      alias = item[tail - 1];
      expressionEnd = tail - 1;
    }
    items.push({
      tokens: item,
      expression: item.slice(0, expressionEnd),
      alias,
      as: alias && as !== undefined ? item[as] : undefined,
      ordering: item.slice(tail),
    });
  }
  return items;
}

export function pipeClauses(
  tokens: SourceToken[],
  start = 0,
  end = tokens.length,
  allowIncomplete = false,
): PipeClause[] {
  if (keyword(tokens[end - 1], ';')) end--;
  const separators = topLevel(tokens, start, end).filter((i) => keyword(tokens[i], '|') && keyword(tokens[i + 1], '>'));
  return separators.map((position, index): PipeClause => {
    const stop = separators[index + 1] ?? end;
    let body = position + 3;
    let operator = tokens[position + 2]?.value.toUpperCase() ?? '';
    if (/^(INNER|LEFT|RIGHT|FULL|CROSS)$/.test(operator)) {
      if (keyword(tokens[body], 'OUTER')) operator += ` ${tokens[body++].value.toUpperCase()}`;
      if (keyword(tokens[body], 'JOIN')) operator += ` ${tokens[body++].value.toUpperCase()}`;
    } else if (operator === 'ORDER' && keyword(tokens[body], 'BY')) {
      operator = 'ORDER BY';
      body++;
    }
    const stage = { operator, start: position, body, end: stop };
    if (body >= stop && operator !== 'DISTINCT' && !(allowIncomplete && index === separators.length - 1)) {
      return { ...stage, kind: 'unsupported', reason: `Incomplete pipe operator: ${operator}` };
    }
    const indices = topLevel(tokens, body, stop);
    if (['SELECT', 'EXTEND', 'AGGREGATE'].includes(operator)) {
      const group = indices.find((i) => keyword(tokens[i], 'GROUP'));
      const groupBy = group === undefined ? undefined : indices.find((i) => i > group && keyword(tokens[i], 'BY'));
      const window = indices.find((i) => keyword(tokens[i], 'WINDOW'));
      let first = body;
      if (keyword(tokens[first], 'DISTINCT') || keyword(tokens[first], 'ALL')) first++;
      const output =
        keyword(tokens[first], 'AS') && keyword(tokens[first + 1], 'STRUCT')
          ? 'struct'
          : keyword(tokens[first], 'AS') && keyword(tokens[first + 1], 'VALUE')
            ? 'value'
            : 'columns';
      if (output !== 'columns') first += 2;
      return {
        ...stage,
        kind: 'projection',
        items: pipeItems(tokens, first, group ?? window ?? stop),
        groupBy: groupBy === undefined ? [] : pipeItems(tokens, groupBy + 1, window ?? stop),
        groupStart: groupBy === undefined ? undefined : group,
        groupExpressionStart: groupBy === undefined ? undefined : groupBy + 1,
        windows: window === undefined ? [] : pipeItems(tokens, window + 1, stop),
        output,
      };
    }
    if (operator === 'WHERE') return { ...stage, kind: 'filter', condition: tokens.slice(body, stop) };
    if (['SET', 'DROP', 'RENAME'].includes(operator))
      return { ...stage, kind: 'columns', items: pipeItems(tokens, body, stop) };
    if (operator === 'AS') return { ...stage, kind: 'alias', alias: tokens[body] };
    if (operator.endsWith('JOIN') || operator === 'CALL') {
      const on = indices.find((i) => keyword(tokens[i], 'ON') || keyword(tokens[i], 'USING'));
      const using = on !== undefined && keyword(tokens[on], 'USING');
      return {
        ...stage,
        kind: 'source',
        source: tokens.slice(body, on ?? stop),
        condition: on === undefined || using ? [] : tokens.slice(on + 1, stop),
        using: using ? tokens.slice(on + 2, stop - 1).filter(identifier) : [],
      };
    }
    if (operator === 'ORDER BY') return { ...stage, kind: 'order', items: pipeItems(tokens, body, stop) };
    if (operator === 'LIMIT') {
      const offset = indices.find((i) => keyword(tokens[i], 'OFFSET'));
      return {
        ...stage,
        kind: 'limit',
        limit: tokens.slice(body, offset ?? stop),
        offset: offset === undefined ? [] : tokens.slice(offset + 1, stop),
      };
    }
    if (['UNION', 'INTERSECT', 'EXCEPT'].includes(operator)) {
      return {
        ...stage,
        kind: 'set',
        modifier: tokens[body],
        byName: indices.some((i) => keyword(tokens[i], 'NAME') || keyword(tokens[i], 'CORRESPONDING')),
        operands: indices
          .filter((i) => keyword(tokens[i], '('))
          .map((i) => tokens.slice(i + 1, closingBracket(tokens, i))),
      };
    }
    if (['PIVOT', 'UNPIVOT', 'TABLESAMPLE', 'WINDOW'].includes(operator)) {
      const open = indices.find((i) => keyword(tokens[i], '('));
      const close = open === undefined ? -1 : closingBracket(tokens, open);
      const inner = open === undefined ? [] : topLevel(tokens, open + 1, close);
      const forIndex = inner.find((i) => keyword(tokens[i], 'FOR'));
      const inIndex = inner.find((i) => keyword(tokens[i], 'IN'));
      const values =
        inIndex === undefined ? [] : pipeItems(tokens, inIndex + 2, closingBracket(tokens, inIndex + 1), true);
      return {
        ...stage,
        kind: 'relation',
        operands: pipeItems(tokens, open === undefined ? body : open + 1, close >= 0 ? close : stop),
        alias:
          close >= 0 && identifier(tokens[close + (keyword(tokens[close + 1], 'AS') ? 2 : 1)])
            ? tokens[close + (keyword(tokens[close + 1], 'AS') ? 2 : 1)]
            : undefined,
        pivot:
          operator === 'PIVOT' && open !== undefined && forIndex !== undefined && inIndex !== undefined
            ? {
                aggregates: pipeItems(tokens, open + 1, forIndex),
                forColumns: tokens.slice(forIndex + 1, inIndex),
                values,
              }
            : undefined,
        unpivot:
          operator === 'UNPIVOT' && open !== undefined && forIndex !== undefined && inIndex !== undefined
            ? { columns: tokens.slice(open + 1, forIndex), forColumn: tokens.slice(forIndex + 1, inIndex), values }
            : undefined,
        sample:
          operator === 'TABLESAMPLE'
            ? { method: tokens[body], size: open === undefined ? [] : tokens.slice(open + 1, close) }
            : undefined,
      };
    }
    if (operator === 'DISTINCT') return { ...stage, kind: 'distinct' };
    return { ...stage, kind: 'unsupported', reason: `Unmodelled pipe operator: ${operator || '(missing)'}` };
  });
}

export function unsupportedQuery(
  tokens: SourceToken[],
  start = 0,
  end = tokens.length,
  allowIncomplete = false,
): boolean {
  return (
    topLevel(tokens, start, end).some(
      (i) => ['MATCH_RECOGNIZE', 'GRAPH_TABLE'].some((word) => keyword(tokens[i], word)) && keyword(tokens[i + 1], '('),
    ) || pipeClauses(tokens, start, end, allowIncomplete).some((stage) => stage.kind === 'unsupported')
  );
}
