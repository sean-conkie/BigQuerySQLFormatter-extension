import type { DocumentCache } from '../../parser/tokenCache';
import { identifierKey, isIdentifier, QueryScopeResolver } from '../../scope';
import { keyword, type SourceToken } from '../source';
import type { IdentifierPolicy } from '../../../ruleOptions';
import keywords from '../../keywords.json';

const syntaxWords = new Set([...keywords.reserved, ...keywords.nonReserved]);

export interface Identifier {
  token: SourceToken;
  name: string;
  quoted: boolean;
  role: 'column' | 'column_alias' | 'table_alias' | 'table' | 'cte';
  first: boolean;
  dashed: boolean;
}

export function identifiers(tokens: SourceToken[], cache: DocumentCache): Identifier[] {
  const resolver = new QueryScopeResolver(tokens);
  const { excluded, ctes, tables } = resolver.identifierRoles();
  const aliases = new Map<string, Identifier['role']>();
  const positions = new Map(tokens.map((token, index) => [identifierKey(token), index]));
  for (const scope of resolver.scopes) {
    if (scope.pipe?.kind === 'alias' && scope.pipe.alias) aliases.set(identifierKey(scope.pipe.alias), 'table_alias');
    if (scope.pipe?.kind === 'relation') {
      if (scope.pipe.alias) aliases.set(identifierKey(scope.pipe.alias), 'table_alias');
      const pivot = scope.pipe.pivot;
      const unpivot = scope.pipe.unpivot;
      for (const item of [...(pivot?.aggregates ?? []), ...(pivot?.values ?? []), ...(unpivot?.values ?? [])]) {
        if (item.alias) aliases.set(identifierKey(item.alias), 'column_alias');
      }
      for (const token of [...(unpivot?.columns ?? []), ...(unpivot?.forColumn ?? [])].filter(isIdentifier)) {
        aliases.set(identifierKey(token), 'column_alias');
      }
    }
    if (scope.pipe?.kind === 'columns' && scope.pipe.operator === 'RENAME') {
      for (const item of scope.pipe.items) if (item.alias) aliases.set(identifierKey(item.alias), 'column_alias');
    }
    for (const token of scope.selectAliases) {
      const index = positions.get(identifierKey(token))!;
      const previous = tokens[index - 1];
      if (
        keyword(previous, 'AS') ||
        (previous && !['SELECT', 'DISTINCT', 'ALL', ',', '.'].some((word) => keyword(previous, word)))
      )
        aliases.set(identifierKey(token), 'column_alias');
    }
    for (const source of scope.sources) {
      const offset = tokens.findIndex(
        (token, index) =>
          index >= source.start && index < source.end && keyword(token, 'WITH') && keyword(tokens[index + 1], 'OFFSET'),
      );
      for (const index of [source.end - 1, offset - 1]) {
        const token = tokens[index];
        if (
          index >= source.start &&
          isIdentifier(token) &&
          !tables.has(identifierKey(token)) &&
          !ctes.has(identifierKey(token)) &&
          (token.value.replace(/^`|`$/g, '') === source.alias ||
            token.value.replace(/^`|`$/g, '') === source.offsetAlias)
        )
          aliases.set(identifierKey(token), 'table_alias');
      }
    }
  }
  const result: Identifier[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!isIdentifier(token)) continue;
    const key = identifierKey(token);
    const quoted = token.literal && token.value.endsWith('`') && token.value.length > 2;
    if (token.literal && !quoted) continue;
    const table = tables.get(key);
    const role = aliases.get(key) ?? (ctes.has(key) ? 'cte' : table ? 'table' : 'column');
    if (role === 'column') {
      if (excluded.has(key)) continue;
      const highlighted = cache
        .get(token.range.start.line)
        ?.tokens.some(
          (part) =>
            part.startIndex < token.range.end.character &&
            part.endIndex > token.range.start.character &&
            part.scopes.some(
              (scope) =>
                ['entity.other.column.sql', 'entity.name.alias.sql', 'entity.name.tag'].includes(scope) ||
                (scope === 'storage.type.sql' &&
                  ['SELECT', ',', '.', '=', 'WHERE', 'AND', 'OR'].some((word) => keyword(tokens[index - 1], word)) &&
                  !keyword(tokens[index + 1], '(')),
            ),
        );
      const pipeColumn = resolver.scopeAt(index)?.pipe && !syntaxWords.has(token.value.toLowerCase());
      if (!quoted && !highlighted && !pipeColumn) continue;
    }
    result.push({
      token,
      name: quoted ? token.value.slice(1, -1) : token.value,
      quoted,
      role,
      first: table?.first ?? !keyword(tokens[index - 1], '.'),
      dashed: table?.dashed ?? false,
    });
  }
  return result;
}

export function matchesPolicy(identifier: Identifier, policy: IdentifierPolicy): boolean {
  return (
    policy === 'all' ||
    (policy === 'aliases' && ['column_alias', 'table_alias', 'cte'].includes(identifier.role)) ||
    (policy === 'column_aliases' && identifier.role === 'column_alias') ||
    (policy === 'table_aliases' && ['table_alias', 'cte'].includes(identifier.role))
  );
}

export function ignoredIdentifier(name: string, words: readonly string[]): boolean {
  return words.some((word) => word.toLowerCase() === name.toLowerCase());
}
