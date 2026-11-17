import { closingBracket, keyword, type SourceToken } from '../rules/source';
import { pipeItems, topLevel, type PipeItem } from './pipe';
import keywords from '../keywords.json';

interface SpecialSource {
  start: number;
  end: number;
  close: number;
  alias?: SourceToken;
  as?: SourceToken;
  outputColumns: SourceToken[];
}

export interface MatchRecognize extends SpecialSource {
  kind: 'match-recognize';
  partitionBy: PipeItem[];
  orderBy: PipeItem[];
  measures: PipeItem[];
  afterMatchSkip: SourceToken[];
  pattern: SourceToken[];
  definitions: { variable: SourceToken; condition: SourceToken[] }[];
}

export interface GraphTable extends SpecialSource {
  kind: 'graph-table';
  graphName: SourceToken[];
  pattern: SourceToken[];
  variables: SourceToken[];
  columns: PipeItem[];
}

export type SpecialTable = MatchRecognize | GraphTable;

const reserved = new Set(keywords.reserved);
const identifier = (token: SourceToken | undefined): token is SourceToken =>
  token !== undefined &&
  (token.value.startsWith('`') ||
    (!token.literal && /^[a-z_][\w$]*$/i.test(token.value) && !reserved.has(token.value.toLowerCase())));
const outputColumns = (items: PipeItem[]) =>
  items.flatMap((item) => item.alias ?? (identifier(item.expression.at(-1)) ? item.expression.at(-1)! : []));

export function specialSource(tokens: SourceToken[], start: number, end = tokens.length): SpecialTable | undefined {
  const graph = keyword(tokens[start], 'GRAPH_TABLE');
  if ((!graph && !keyword(tokens[start], 'MATCH_RECOGNIZE')) || !keyword(tokens[start + 1], '(')) return undefined;
  const close = closingBracket(tokens, start + 1);
  if (close < 0 || close >= end) return undefined;
  const as = keyword(tokens[close + 1], 'AS') ? tokens[close + 1] : undefined;
  const alias = identifier(tokens[close + (as ? 2 : 1)]) ? tokens[close + (as ? 2 : 1)] : undefined;
  const base = { start, close, end: close + 1 + (alias ? (as ? 2 : 1) : 0), alias, as };
  const indices = topLevel(tokens, start + 2, close);
  if (graph) {
    const match = indices.find((i) => keyword(tokens[i], 'MATCH'));
    const columns = [...indices].reverse().find((i) => keyword(tokens[i], 'COLUMNS') && keyword(tokens[i + 1], '('));
    if (match === undefined || match === start + 2 || columns === undefined) return undefined;
    const columnClose = closingBracket(tokens, columns + 1);
    if (columnClose < 0 || columnClose >= close) return undefined;
    const items = pipeItems(tokens, columns + 2, columnClose);
    const variables: SourceToken[] = [];
    for (let i = match + 1; i < columns; i++) {
      if (
        (keyword(tokens[i], '(') || keyword(tokens[i], '[')) &&
        identifier(tokens[i + 1]) &&
        [':', ')', ']', 'IS', 'WHERE'].some((word) => keyword(tokens[i + 2], word))
      )
        variables.push(tokens[i + 1]);
    }
    return {
      ...base,
      kind: 'graph-table',
      graphName: tokens.slice(start + 2, match),
      pattern: tokens.slice(match, columns),
      variables,
      columns: items,
      outputColumns: outputColumns(items),
    };
  }
  const sections = indices.filter((i) =>
    ['PARTITION', 'ORDER', 'MEASURES', 'ONE', 'AFTER', 'PATTERN', 'DEFINE', 'OPTIONS'].some((word) =>
      keyword(tokens[i], word),
    ),
  );
  const section = (name: string, offset = 1): SourceToken[] => {
    const position = sections.findIndex((i) => keyword(tokens[i], name));
    return position < 0 ? [] : tokens.slice(sections[position] + offset, sections[position + 1] ?? close);
  };
  const items = (name: string, offset = 1) => {
    const body = section(name, offset);
    return pipeItems(body, 0, body.length);
  };
  const pattern = section('PATTERN');
  const orderBy = items('ORDER', 2);
  const measures = items('MEASURES');
  const definitions = items('DEFINE').flatMap((item) => {
    const as = item.tokens.findIndex((token) => keyword(token, 'AS'));
    return as === 1 && identifier(item.tokens[0])
      ? [{ variable: item.tokens[0], condition: item.tokens.slice(2) }]
      : [];
  });
  if (!pattern.length || !orderBy.length || !measures.length || !definitions.length) return undefined;
  const partitionBy = items('PARTITION', 2);
  return {
    ...base,
    kind: 'match-recognize',
    partitionBy,
    orderBy,
    measures,
    afterMatchSkip: section('AFTER'),
    pattern,
    definitions,
    outputColumns: outputColumns([...partitionBy, ...measures]),
  };
}

export function specialSources(tokens: SourceToken[], start = 0, end = tokens.length): SpecialTable[] {
  return topLevel(tokens, start, end).flatMap((i) => specialSource(tokens, i, end) ?? []);
}
