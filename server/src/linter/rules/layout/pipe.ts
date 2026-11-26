import { pipeItems, topLevel, type PipeClause, type PipeItem } from '../../parser/pipe';
import type { StatementAST } from '../../parser/ast';
import { QueryScopeResolver } from '../../scope';
import { keyword, type SourceToken } from '../source';

export function projectionLists(tokens: SourceToken[]): PipeItem[][] {
  const resolver = new QueryScopeResolver(tokens);
  return resolver.scopes.flatMap((scope) => {
    if (scope.special || scope.kind !== 'query') return [];
    if (scope.pipe) return scope.pipe.kind === 'projection' ? [scope.pipe.items, scope.pipe.groupBy] : [];
    const indices = topLevel(tokens, scope.start, scope.end);
    const select = indices.find((i) => keyword(tokens[i], 'SELECT'));
    if (select === undefined) return [];
    let start = select + 1;
    if (keyword(tokens[start], 'DISTINCT') || keyword(tokens[start], 'ALL')) start++;
    if (keyword(tokens[start], 'AS') && ['STRUCT', 'VALUE'].some((word) => keyword(tokens[start + 1], word)))
      start += 2;
    const end =
      indices.find(
        (i) =>
          i >= start &&
          ['FROM', 'WHERE', 'GROUP', 'HAVING', 'QUALIFY', 'WINDOW', 'ORDER', 'LIMIT', ';'].some((word) =>
            keyword(tokens[i], word),
          ),
      ) ?? scope.end;
    return [pipeItems(tokens, start, end)];
  });
}

export function pipeProjectionLists(statement: StatementAST): PipeItem[][] {
  return statement.pipeClauses.flatMap((stage) => (stage.kind === 'projection' ? [stage.items, stage.groupBy] : []));
}

export function pipeLayouts(tokens: SourceToken[]): { input: SourceToken; stages: PipeClause[] }[] {
  const resolver = new QueryScopeResolver(tokens);
  return resolver.scopes
    .filter((scope) => scope.kind === 'query' && !scope.pipe)
    .flatMap((input) => {
      const stages = resolver.scopes
        .filter((scope) => scope.pipe && scope.parent === input.parent && scope.ctes === input.ctes)
        .map((scope) => scope.pipe!);
      // WITH is an environment, not the opening token of the pipeline's input.
      const start = input.ctes.at(-1)?.close;
      return stages.length ? [{ input: tokens[start === undefined ? input.start : start + 1], stages }] : [];
    });
}
