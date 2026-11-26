import type { Range } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { identifierKey, isIdentifier, type QueryScopeResolver, type QueryScope } from '../../scope';
import { closingBracket, keyword, type SourceToken } from '../source';
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
    if (keyword(first, 'EXCEPT') && keyword(tokens[index + 1], '(') && !keyword(tokens[index + 2], 'SELECT')) {
      const close = closingBracket(tokens, index + 1);
      if (close >= 0) index = close;
      continue;
    }
    if (
      ['AS', 'OVER', 'WINDOW'].some((word) => keyword(tokens[index - 1], word)) ||
      (keyword(tokens[index + 1], 'AS') && keyword(tokens[index + 2], '(')) ||
      (keyword(tokens[index + 1], '=') && keyword(tokens[index + 2], '>'))
    )
      continue;
    if (!first.literal && /^(CURRENT_DATE|CURRENT_TIME|CURRENT_DATETIME|CURRENT_TIMESTAMP)$/i.test(first.value))
      continue;
    if (!columns.has(identifierKey(first)) || keyword(tokens[index - 1], '.') || keyword(tokens[index - 1], '@'))
      continue;
    const scope = resolver.scopeAt(index);
    if (!scope) continue;
    // UNPIVOT takes unqualified input column names and declares output names;
    // neither is an expression to which a table qualifier can be added.
    if (scope.pipe?.kind === 'relation' && scope.pipe.operator === 'UNPIVOT') continue;
    if (
      scope.pipe?.kind === 'relation' &&
      scope.pipe.pivot?.forColumns.some((token) => identifierKey(token) === identifierKey(first))
    )
      continue;
    if (
      scope.pipe?.kind === 'columns' &&
      scope.pipe.items.some((item) => identifierKey(item.expression[0]) === identifierKey(first))
    )
      continue;
    const path = [first];
    while (keyword(tokens[index + 1], '.') && (isIdentifier(tokens[index + 2]) || keyword(tokens[index + 2], '*'))) {
      path.push(tokens[index + 1], tokens[index + 2]);
      index += 2;
    }
    const parts = path.filter((_, offset) => offset % 2 === 0).map((token) => token.value.replace(/^`|`$/g, ''));
    if (parts.some((part) => part.toUpperCase() === 'INFORMATION_SCHEMA')) continue;
    if (scope.usingColumns.some((token) => identifierKey(token) === identifierKey(first))) continue;
    if (scope.visibleAliases?.some((token) => referenceName(token.value) === referenceName(parts[0]))) continue;
    const aliasVisible = scope.clauses.some((clause) => index >= clause.start && index < clause.end);
    if (
      !scope.pipe &&
      aliasVisible &&
      scope.selectAliases.some((token) => referenceName(token.value) === referenceName(parts[0]))
    )
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
