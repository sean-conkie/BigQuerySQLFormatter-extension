import type { Range } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { identifierKey, isIdentifier, type QueryScopeResolver, type QueryScope } from '../../scope';
import { keyword, type SourceToken } from '../source';
import { identifiers } from './identifiers';

export interface ColumnReference {
  scope: QueryScope;
  parts: string[];
  tokens: SourceToken[];
  range: Range;
  wildcard: boolean;
}

export const referenceName = (name: string) => name.replace(/^`|`$/g, '').toLowerCase();

export function columnReferences(
  tokens: SourceToken[],
  cache: DocumentCache,
  resolver: QueryScopeResolver,
): ColumnReference[] {
  const columns = new Set(
    identifiers(tokens, cache)
      .filter(({ role }) => role === 'column')
      .map(({ token }) => identifierKey(token)),
  );
  const result: ColumnReference[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const first = tokens[index];
    if (!columns.has(identifierKey(first)) || keyword(tokens[index - 1], '.') || keyword(tokens[index - 1], '@'))
      continue;
    const scope = resolver.scopeAt(index);
    if (!scope) continue;
    const path = [first];
    while (keyword(tokens[index + 1], '.') && (isIdentifier(tokens[index + 2]) || keyword(tokens[index + 2], '*'))) {
      path.push(tokens[index + 1], tokens[index + 2]);
      index += 2;
    }
    const parts = path.filter((_, offset) => offset % 2 === 0).map((token) => token.value.replace(/^`|`$/g, ''));
    if (parts.some((part) => part.toUpperCase() === 'INFORMATION_SCHEMA')) continue;
    if (scope.usingColumns.some((token) => identifierKey(token) === identifierKey(first))) continue;
    const aliasVisible = scope.clauses.some((clause) => index >= clause.start && index < clause.end);
    if (aliasVisible && scope.selectAliases.some((token) => referenceName(token.value) === referenceName(parts[0])))
      continue;
    result.push({
      scope,
      parts,
      tokens: path,
      range: { start: first.range.start, end: path[path.length - 1].range.end },
      wildcard: parts.at(-1) === '*',
    });
  }
  return result;
}
