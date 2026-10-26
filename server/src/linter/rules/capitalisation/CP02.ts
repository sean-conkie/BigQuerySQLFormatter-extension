import { CapitalisationRule } from './base';
import type { DocumentCache } from '../../parser/tokenCache';
import { readCtes } from '../queries';
import { keyword, sourceTokens, type SourceToken } from '../source';

const key = (token: Pick<SourceToken, 'range'>) => `${token.range.start.line}:${token.range.start.character}`;
const identifier = (token: SourceToken | undefined) =>
  token !== undefined && (token.literal ? token.value.startsWith('`') : /^[a-z_][\w$]*$/i.test(token.value));

export class Identifiers extends CapitalisationRule {
  readonly name = 'identifiers';
  readonly code = 'CP02';
  readonly message = 'Capitalisation of unquoted identifier';
  readonly scopes = ['entity.other.column.sql', 'entity.name.alias.sql', 'entity.name.tag'];

  protected *tokens(cache: DocumentCache) {
    const source = sourceTokens(cache);
    const excluded = new Set<string>();
    const cteTokens = new Map<string, SourceToken>();
    const scopes: { start: number; end: number; ctes: ReturnType<typeof readCtes>; recursive: boolean }[] = [];
    const ends: number[] = [];
    const containers = new Map<number, number>();
    for (let i = source.length - 1; i >= 0; i--) {
      if (keyword(source[i], ';')) ends.splice(0, ends.length, i);
      if (keyword(source[i], ')')) ends.push(i);
      containers.set(i, ends.at(-1) ?? source.length);
      if (keyword(source[i], '(')) ends.pop();
    }
    for (let i = 0; i < source.length; i++) {
      const ctes = readCtes(source, i);
      if (!ctes.length) continue;
      scopes.push({ start: i, end: containers.get(i)!, ctes, recursive: keyword(source[i + 1], 'RECURSIVE') });
      for (const cte of ctes) cteTokens.set(key(source[cte.start]), source[cte.start]);
    }
    const isCte = (index: number, name: string) =>
      scopes.some(
        (scope) =>
          index > scope.start &&
          index < scope.end &&
          scope.ctes.some(
            (cte) => cte.name.replace(/^`|`$/g, '') === name.toLowerCase() && (scope.recursive || index > cte.close),
          ),
      );

    for (let i = 0; i < source.length; i++) {
      const start = i;
      if (!identifier(source[i])) continue;
      while (keyword(source[i + 1], '.') && identifier(source[i + 2])) i += 2;
      if (keyword(source[i + 1], '(') && !cteTokens.has(key(source[start]))) {
        for (let j = start; j <= i; j++) excluded.add(key(source[j]));
      }
    }

    // Grammar scopes alone cannot distinguish table paths from column paths,
    // especially after DML keywords or in comma-separated FROM lists.
    const contexts = [{ from: false, extract: false }];
    let tableDefinition = false;
    for (let i = 0; i < source.length; i++) {
      const token = source[i];
      if (keyword(token, 'SELECT') || keyword(token, ';')) tableDefinition = false;
      if (keyword(token, 'TABLE')) tableDefinition = true;
      if (keyword(token, '(')) contexts.push({ from: false, extract: keyword(source[i - 1], 'EXTRACT') });
      if (keyword(token, ')') && contexts.length > 1) contexts.pop();
      const context = contexts[contexts.length - 1];
      if (
        /^(SELECT|WHERE|GROUP|HAVING|QUALIFY|ORDER|LIMIT|WINDOW|UNION|EXCEPT|INTERSECT|SET|VALUES|WHEN|;|\|)$/i.test(
          token.value,
        ) &&
        !token.literal
      )
        context.from = false;
      const relation =
        (keyword(token, 'FROM') && !context.extract && !keyword(source[i - 1], 'DISTINCT')) || keyword(token, 'JOIN');
      const target =
        /^(TABLE|VIEW|SCHEMA|DATABASE|MODEL|FUNCTION|PROCEDURE|INTO|INSERT|DELETE|MERGE|USING|REFERENCES)$/i.test(
          token.value,
        ) ||
        (tableDefinition && contexts.length === 1 && /^(CLONE|COPY|LIKE)$/i.test(token.value)) ||
        (keyword(token, 'TO') && keyword(source[i - 1], 'RENAME')) ||
        (keyword(token, 'UPDATE') && !keyword(source[i + 1], 'SET'));
      if (relation) context.from = true;
      if (token.literal || !(relation || target || (keyword(token, ',') && context.from))) continue;
      let start = i + 1;
      while (['IF', 'NOT', 'EXISTS'].some((word) => keyword(source[start], word))) start++;
      if (!identifier(source[start])) continue;
      let end = start;
      while ((keyword(source[end + 1], '.') || keyword(source[end + 1], '-')) && identifier(source[end + 2])) end += 2;
      if (
        (relation || keyword(token, ',')) &&
        start === end &&
        !keyword(source[end + 1], '(') &&
        isCte(start, source[start].value)
      ) {
        cteTokens.set(key(source[start]), source[start]);
      } else {
        for (let j = start; j <= end; j++) excluded.add(key(source[j]));
      }
    }
    const targets = new Map([...super.tokens(cache)].map((token) => [key(token), token]));
    for (const [position, token] of cteTokens) targets.set(position, token);
    yield* [...targets.values()]
      .filter((token) => !excluded.has(key(token)))
      .sort((a, b) => a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character);
  }
}
