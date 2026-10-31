import { CapitalisationRule } from './base';
import type { DocumentCache } from '../../parser/tokenCache';
import { identifierKey, QueryScopeResolver } from '../../scope';
import { sourceTokens } from '../source';

export class Identifiers extends CapitalisationRule {
  readonly name = 'identifiers';
  readonly code = 'CP02';
  readonly message = 'Capitalisation of unquoted identifier';
  readonly scopes = ['entity.other.column.sql', 'entity.name.alias.sql', 'entity.name.tag'];

  protected *tokens(cache: DocumentCache) {
    const { excluded, ctes } = new QueryScopeResolver(sourceTokens(cache)).identifierRoles();
    const targets = new Map([...super.tokens(cache)].map((token) => [identifierKey(token), token]));
    for (const [position, token] of ctes) targets.set(position, token);
    yield* [...targets.values()]
      .filter((token) => !excluded.has(identifierKey(token)))
      .sort((a, b) => a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character);
  }
}
