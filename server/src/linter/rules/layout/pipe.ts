import type { PipeClause } from '../../parser/pipe';
import { QueryScopeResolver } from '../../scope';
import type { SourceToken } from '../source';

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
