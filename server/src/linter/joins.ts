import type { Range } from 'vscode-languageserver/node';
import type { DocumentCache } from './parser/tokenCache';
import { QueryScopeResolver, type QueryScope, type QuerySource, identifierKey } from './scope';
import { closingBracket, keyword, type SourceToken } from './rules/source';
import { columnReferences, type ColumnReference } from './rules/references/columns';

export interface JoinOperand {
  start: number;
  end: number;
  range: Range;
  references: ColumnReference[];
  sources: QuerySource[];
  safe: boolean;
}

export interface JoinComparison {
  start: number;
  end: number;
  range: Range;
  left: JoinOperand;
  right: JoinOperand;
  operator: string;
  operatorStart: number;
  operatorEnd: number;
}

export type JoinExpression =
  | { kind: 'boolean'; start: number; end: number; operators: ('AND' | 'OR')[]; children: JoinExpression[] }
  | { kind: 'group'; start: number; end: number; expression: JoinExpression }
  | { kind: 'predicate'; start: number; end: number; comparison?: JoinComparison };

export interface JoinCondition {
  scope: QueryScope;
  source: QuerySource;
  on: number;
  start: number;
  end: number;
  range: Range;
  expression: JoinExpression;
  comparisons: JoinComparison[];
}

export function joinConditions(
  tokens: SourceToken[],
  cache: DocumentCache,
  resolver = new QueryScopeResolver(tokens),
): JoinCondition[] {
  const references = columnReferences(tokens, cache, resolver);
  const indexes = new Map(tokens.map((token, index) => [identifierKey(token), index]));
  const range = (start: number, end: number): Range => ({
    start: tokens[start].range.start,
    end: tokens[end - 1].range.end,
  });
  const result: JoinCondition[] = [];
  for (const scope of resolver.scopes) {
    if (scope.kind !== 'query' || scope.pipe) continue;
    for (const source of scope.sources) {
      if (!keyword(tokens[source.start - 1], 'JOIN') || !keyword(tokens[source.end], 'ON')) continue;
      const start = source.end + 1;
      let end = start;
      let caseDepth = 0;
      for (; end < scope.end; end++) {
        const token = tokens[end];
        if (keyword(token, 'CASE')) caseDepth++;
        if (keyword(token, 'END')) caseDepth--;
        if (
          caseDepth === 0 &&
          !token.literal &&
          /^(JOIN|INNER|LEFT|RIGHT|FULL|CROSS|NATURAL|WHERE|GROUP|HAVING|QUALIFY|WINDOW|ORDER|LIMIT|UNION|EXCEPT|INTERSECT|;|,|\|)$/i.test(
            token.value,
          )
        )
          break;
        if (keyword(token, '(') || keyword(token, '[')) {
          const close = closingBracket(tokens, end);
          if (close < 0 || close >= scope.end) break;
          end = close;
        }
      }
      if (end <= start) continue;
      const comparisons: JoinComparison[] = [];
      const operand = (start: number, end: number): JoinOperand => {
        const refs = references.filter((reference) => {
          const index = indexes.get(identifierKey(reference.tokens[0]))!;
          return index >= start && index < end;
        });
        const sources = new Set<QuerySource>();
        let safe =
          refs.length > 0 &&
          !tokens.slice(start, end).some((token) => keyword(token, 'SELECT') || keyword(token, 'WITH'));
        for (const reference of refs) {
          const classification = resolver.classifyReference(scope, reference.parts);
          if (reference.scope !== scope || classification.kind !== 'table-qualified' || classification.correlated)
            safe = false;
          else {
            sources.add(classification.source);
            if (scope.sources.indexOf(classification.source) > scope.sources.indexOf(source)) safe = false;
          }
        }
        return { start, end, range: range(start, end), references: refs, sources: [...sources], safe };
      };
      const parse = (start: number, end: number): JoinExpression => {
        if (keyword(tokens[start], '(') && closingBracket(tokens, start) === end - 1 && end > start + 2)
          return { kind: 'group', start, end, expression: parse(start + 1, end - 1) };
        const splits: number[] = [];
        const operators: ('AND' | 'OR')[] = [];
        const candidates: { start: number; end: number; operator: string }[] = [];
        let between = false;
        let caseDepth = 0;
        let unsupported = false;
        for (let i = start; i < end; i++) {
          if (keyword(tokens[i], 'CASE')) caseDepth++;
          if (keyword(tokens[i], 'END')) caseDepth--;
          if (keyword(tokens[i], '(') || keyword(tokens[i], '[')) {
            const close = closingBracket(tokens, i);
            if (close < 0 || close >= end) {
              unsupported = true;
              break;
            }
            i = close;
            continue;
          }
          if (caseDepth) continue;
          if (keyword(tokens[i], 'BETWEEN')) {
            between = true;
            unsupported = true;
          }
          if (keyword(tokens[i], 'AND') && between) {
            between = false;
            continue;
          }
          if (keyword(tokens[i], 'AND') || keyword(tokens[i], 'OR')) {
            splits.push(i);
            operators.push(keyword(tokens[i], 'AND') ? 'AND' : 'OR');
          }
          if (keyword(tokens[i], 'LIKE') || keyword(tokens[i], 'IN') || keyword(tokens[i], 'NOT')) unsupported = true;
          if (keyword(tokens[i], 'IS')) {
            const stop = i + (keyword(tokens[i + 1], 'NOT') ? 4 : 3);
            if (keyword(tokens[stop - 2], 'DISTINCT') && keyword(tokens[stop - 1], 'FROM')) {
              candidates.push({
                start: i,
                end: stop,
                operator: tokens
                  .slice(i, stop)
                  .map((token) => token.value.toUpperCase())
                  .join(' '),
              });
              i = stop - 1;
            } else unsupported = true;
          } else if (!tokens[i].literal && /^[=!<>]$/.test(tokens[i].value)) {
            const first = i;
            if (i + 1 < end && keyword(tokens[i + 1], '=') && tokens[i].value !== '=') i++;
            else if (keyword(tokens[i], '<') && keyword(tokens[i + 1], '>')) i++;
            const operator = tokens
              .slice(first, i + 1)
              .map((token) => token.value)
              .join('');
            if (['=', '!=', '<>', '<', '>', '<=', '>='].includes(operator))
              candidates.push({ start: first, end: i + 1, operator });
          }
        }
        if (splits.length && splits[0] > start && splits.at(-1)! < end - 1) {
          const bounds = [start - 1, ...splits, end];
          return {
            kind: 'boolean',
            start,
            end,
            operators,
            children: bounds.slice(0, -1).map((bound, i) => parse(bound + 1, bounds[i + 1])),
          };
        }
        const node: JoinExpression = { kind: 'predicate', start, end };
        const candidate = candidates[0];
        if (!unsupported && candidates.length === 1 && candidate.start > start && candidate.end < end) {
          node.comparison = {
            start,
            end,
            range: range(start, end),
            left: operand(start, candidate.start),
            right: operand(candidate.end, end),
            operator: candidate.operator,
            operatorStart: candidate.start,
            operatorEnd: candidate.end,
          };
          comparisons.push(node.comparison);
        }
        return node;
      };
      result.push({
        scope,
        source,
        on: source.end,
        start,
        end,
        range: range(start, end),
        expression: parse(start, end),
        comparisons,
      });
    }
  }
  return result;
}
