import type { Range } from 'vscode-languageserver/node';
import {
  ArrayAST,
  CaseStatementAST,
  type Column,
  ColumnAST,
  ColumnFunctionAST,
  type ComparisonAST,
  ComparisonGroupAST,
  ObjectAST,
  OrderAST,
  StatementAST,
} from './parser/ast';
import { excludeTokensWithMatchingScopes } from './parser/token';
import { readCtes, type CommonTableExpression } from './rules/queries';
import { closingBracket, keyword, type SourceToken } from './rules/source';
import keywords from './keywords.json';

export const identifierKey = (token: Pick<SourceToken, 'range'>) =>
  `${token.range.start.line}:${token.range.start.character}`;
export const isIdentifier = (token: SourceToken | undefined): token is SourceToken =>
  token !== undefined && (token.literal ? token.value.startsWith('`') : /^[a-z_][\w$]*$/i.test(token.value));
const unquote = (name: string) => name.replace(/^`|`$/g, '');
const normalize = (name: string) => unquote(name).toLowerCase();

export interface CteDefinition extends CommonTableExpression {
  scope: QueryScope;
}

export interface QuerySource {
  kind: 'table' | 'cte' | 'subquery' | 'unnest' | 'tvf' | 'dml-target';
  path: string[];
  alias?: string;
  explicitAlias: boolean;
  offsetAlias?: string;
  start: number;
  end: number;
  range: Range;
  cte?: CteDefinition;
}

export interface QueryClause {
  kind: 'group' | 'order';
  start: number;
  end: number;
}

export interface QueryScope {
  kind: 'query' | 'dml';
  cteBody: boolean;
  start: number;
  end: number;
  parent?: QueryScope;
  sources: QuerySource[];
  ctes: CteDefinition[];
  selectAliases: SourceToken[];
  usingColumns: SourceToken[];
  clauses: QueryClause[];
}

export interface ScopeStatement {
  start: number;
  end: number;
  status: 'supported' | 'unsupported';
  scopes: QueryScope[];
}

export type ReferenceClassification =
  | { kind: 'table-qualified'; source: QuerySource; correlated: boolean }
  | { kind: 'struct-field' }
  | { kind: 'unqualified' };

const clauseBoundary =
  /^(WHERE|GROUP|HAVING|QUALIFY|WINDOW|ORDER|LIMIT|UNION|EXCEPT|INTERSECT|SET|VALUES|WHEN|RETURNING)$/i;
const aliasBoundary =
  /^(AS|ON|USING|WITH|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|OUTER|NATURAL|FOR|TABLESAMPLE|PIVOT|UNPIVOT|FROM|SELECT|BY|ASC|DESC|NULLS|END)$/i;
const reservedKeywords = new Set(keywords.reserved);
const canBeAlias = (token: SourceToken | undefined): token is SourceToken =>
  isIdentifier(token) &&
  (token.literal ||
    (!reservedKeywords.has(normalize(token.value)) &&
      !clauseBoundary.test(token.value) &&
      !aliasBoundary.test(token.value)));

/**
 * Source-level query scopes supplement the SELECT AST without inventing schemas
 * for table columns. In particular, a dotted path is not evidence of a table alias.
 */
export class QueryScopeResolver {
  readonly statements: ScopeStatement[] = [];
  readonly scopes: QueryScope[] = [];
  private readonly cteEnvironments: {
    start: number;
    end: number;
    ctes: CommonTableExpression[];
    recursive: boolean;
  }[] = [];
  private readonly cteDefinitions = new Map<number, CteDefinition>();

  constructor(readonly tokens: SourceToken[]) {
    const ends: number[] = [];
    const containers = new Map<number, number>();
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (keyword(tokens[i], ';')) ends.splice(0, ends.length, i);
      if (keyword(tokens[i], ')')) ends.push(i);
      containers.set(i, ends.at(-1) ?? tokens.length);
      if (keyword(tokens[i], '(')) ends.pop();
    }
    for (let i = 0; i < tokens.length; i++) {
      const ctes = readCtes(tokens, i);
      if (ctes.length) {
        this.cteEnvironments.push({
          start: i,
          end: containers.get(i)!,
          ctes,
          recursive: keyword(tokens[i + 1], 'RECURSIVE'),
        });
      }
    }
    let start = 0;
    for (let i = 0; i <= tokens.length; i++) {
      if (i !== tokens.length && !keyword(tokens[i], ';')) continue;
      if (start < i) {
        const statement: ScopeStatement = {
          start,
          end: i,
          status: tokens
            .slice(start, i)
            .some(
              (token, offset) =>
                (['MATCH_RECOGNIZE', 'GRAPH_TABLE'].some((word) => keyword(token, word)) &&
                  keyword(tokens[start + offset + 1], '(')) ||
                (keyword(token, '|') && keyword(tokens[start + offset + 1], '>')) ||
                (keyword(token, 'FOR') && keyword(tokens[start + offset + 1], 'SYSTEM_TIME')),
            )
            ? 'unsupported'
            : 'supported',
          scopes: [],
        };
        this.statements.push(statement);
        if (statement.status === 'supported') this.readRegion(start, i, undefined, statement);
      }
      start = i + 1;
    }
  }

  scopeAt(index: number): QueryScope | undefined {
    return this.scopes
      .filter((scope) => index >= scope.start && index < scope.end)
      .sort((a, b) => a.end - a.start - (b.end - b.start))[0];
  }

  visibleCtes(
    scope: QueryScope,
    index = scope.ctes.length ? scope.ctes[scope.ctes.length - 1].close + 1 : scope.start,
  ): CteDefinition[] {
    return this.visibleCteDefinitions(index).flatMap((cte) => {
      const definition = this.cteDefinitions.get(cte.start);
      return definition ? [definition] : [];
    });
  }

  private visibleCteDefinitions(index: number): CommonTableExpression[] {
    const environments = this.cteEnvironments
      .filter((environment) => index > environment.start && index < environment.end)
      .sort((a, b) => b.start - a.start);
    const definitions = new Map<string, CommonTableExpression>();
    for (const environment of environments) {
      for (const cte of environment.ctes) {
        if ((environment.recursive || index > cte.close) && !definitions.has(normalize(cte.name))) {
          definitions.set(normalize(cte.name), cte);
        }
      }
    }
    return [...definitions.values()];
  }

  resolveSource(scope: QueryScope, name: string): { source: QuerySource; correlated: boolean } | undefined {
    for (
      let current: QueryScope | undefined = scope;
      current;
      current = current.cteBody ? current.parent?.parent : current.parent
    ) {
      const source = current.sources.find(
        (candidate) =>
          (candidate.alias !== undefined && normalize(candidate.alias) === normalize(name)) ||
          (candidate.offsetAlias !== undefined && normalize(candidate.offsetAlias) === normalize(name)),
      );
      if (source) return { source, correlated: current !== scope };
    }
    return undefined;
  }

  classifyReference(scope: QueryScope, parts: readonly string[]): ReferenceClassification {
    if (parts.length < 2) return { kind: 'unqualified' };
    const resolved = this.resolveSource(scope, parts[0]);
    return resolved ? { kind: 'table-qualified', ...resolved } : { kind: 'struct-field' };
  }

  identifierRoles(): {
    excluded: Set<string>;
    ctes: Map<string, SourceToken>;
    tables: Map<string, { token: SourceToken; first: boolean; dashed: boolean }>;
  } {
    const source = this.tokens;
    const excluded = new Set<string>();
    const ctes = new Map<string, SourceToken>();
    const tables = new Map<string, { token: SourceToken; first: boolean; dashed: boolean }>();
    // Identifier casing remains safe for extended queries even though their
    // source scopes are unsupported. Keep lexical CTE visibility available.
    for (const environment of this.cteEnvironments) {
      for (const cte of environment.ctes) ctes.set(identifierKey(source[cte.start]), source[cte.start]);
    }
    const isCte = (index: number, name: string) =>
      this.visibleCteDefinitions(index).some((cte) => normalize(cte.name) === normalize(name));
    for (let i = 0; i < source.length; i++) {
      const start = i;
      if (!isIdentifier(source[i])) continue;
      while (keyword(source[i + 1], '.') && isIdentifier(source[i + 2])) i += 2;
      if (keyword(source[i + 1], '(') && !ctes.has(identifierKey(source[start]))) {
        for (let j = start; j <= i; j++) excluded.add(identifierKey(source[j]));
      }
    }
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
      if (!isIdentifier(source[start])) continue;
      let end = start;
      while ((keyword(source[end + 1], '.') || keyword(source[end + 1], '-')) && isIdentifier(source[end + 2]))
        end += 2;
      if (
        (relation || keyword(token, ',')) &&
        start === end &&
        !keyword(source[end + 1], '(') &&
        isCte(start, source[start].value)
      ) {
        ctes.set(identifierKey(source[start]), source[start]);
      } else {
        for (let j = start; j <= end; j++) {
          excluded.add(identifierKey(source[j]));
          if (isIdentifier(source[j])) {
            tables.set(identifierKey(source[j]), {
              token: source[j],
              first: j === start,
              dashed: relation || keyword(token, ',') || keyword(token, 'TABLE'),
            });
          }
        }
      }
    }
    return { excluded, ctes, tables };
  }

  private readRegion(start: number, end: number, parent: QueryScope | undefined, statement: ScopeStatement): void {
    const tokens = this.tokens;
    const beginsQuery = ['WITH', 'SELECT', 'UPDATE', 'DELETE', 'MERGE', 'INSERT'].some((word) =>
      keyword(tokens[start], word),
    );
    if (!beginsQuery) {
      this.readNested(start, end, parent, statement);
      return;
    }
    const ctes = this.cteEnvironments.find((environment) => environment.start === start)?.ctes ?? [];
    const main = ctes.length ? ctes[ctes.length - 1].close + 1 : start;
    const scope: QueryScope = {
      kind: ['UPDATE', 'DELETE', 'MERGE', 'INSERT'].some((word) => keyword(tokens[start], word)) ? 'dml' : 'query',
      cteBody: parent?.ctes.some((cte) => start > cte.open && end <= cte.close) ?? false,
      start,
      end,
      parent,
      sources: [],
      ctes: [],
      selectAliases: [],
      usingColumns: [],
      clauses: [],
    };
    scope.ctes = ctes.map((cte) => ({ ...cte, scope }));
    for (const cte of scope.ctes) this.cteDefinitions.set(cte.start, cte);
    this.scopes.push(scope);
    statement.scopes.push(scope);
    for (const cte of ctes) this.readRegion(cte.open + 1, cte.close, scope, statement);

    let from = false;
    let caseDepth = 0;
    let selectStart: number | undefined;
    const flushSelect = (stop: number) => {
      if (selectStart !== undefined) this.readSelectAliases(scope, selectStart, stop);
      selectStart = undefined;
    };
    for (let i = main; i < end; i++) {
      const token = tokens[i];
      if (keyword(token, 'CASE')) caseDepth++;
      if (keyword(token, 'END')) caseDepth = Math.max(0, caseDepth - 1);
      const boundary = caseDepth === 0 && !token.literal && clauseBoundary.test(token.value);
      const fromClause = caseDepth === 0 && keyword(token, 'FROM') && !keyword(tokens[i - 1], 'DISTINCT');
      if (scope.kind === 'dml' && keyword(token, 'WITH')) {
        this.readRegion(i, end, scope, statement);
        break;
      }
      if (
        ['UNION', 'EXCEPT', 'INTERSECT'].some((word) => keyword(token, word)) &&
        !(keyword(token, 'EXCEPT') && keyword(tokens[i + 1], '(') && !keyword(tokens[i + 2], 'SELECT'))
      ) {
        flushSelect(i);
        let next = i + 1;
        if (keyword(tokens[next], 'ALL') || keyword(tokens[next], 'DISTINCT')) next++;
        if (keyword(tokens[next], 'BY') && keyword(tokens[next + 1], 'NAME')) {
          next += 2;
          if (keyword(tokens[next], 'ON') && keyword(tokens[next + 1], '(')) {
            const close = closingBracket(tokens, next + 1);
            if (close >= 0) next = close + 1;
          }
        }
        // Set branches share the WITH environment, not each other's sources.
        scope.end = i;
        this.readRegion(next, end, parent, statement);
        return;
      }
      if (keyword(token, 'SELECT')) {
        if (scope.kind === 'dml') {
          this.readRegion(i, end, scope, statement);
          break;
        }
        selectStart = i + 1;
      }
      if (boundary || fromClause) flushSelect(i);
      if (boundary) from = false;
      if (
        (keyword(token, 'GROUP') || keyword(token, 'ORDER')) &&
        keyword(tokens[i + 1], 'BY') &&
        !keyword(tokens[i + 2], 'ALL')
      ) {
        let stop = i + 2;
        while (stop < end) {
          if (!tokens[stop].literal && clauseBoundary.test(tokens[stop].value)) break;
          if (keyword(tokens[stop], '(') || keyword(tokens[stop], '[')) {
            const close = closingBracket(tokens, stop);
            if (close < 0 || close >= end) break;
            stop = close;
          }
          stop++;
        }
        scope.clauses.push({ kind: keyword(token, 'GROUP') ? 'group' : 'order', start: i, end: stop });
      }
      if (keyword(token, 'USING') && keyword(tokens[i + 1], '(')) {
        const close = closingBracket(tokens, i + 1);
        if (close >= 0) scope.usingColumns.push(...tokens.slice(i + 2, close).filter(isIdentifier));
      }
      const relation = fromClause || keyword(token, 'JOIN') || (from && keyword(token, ','));
      const target =
        scope.kind === 'dml' &&
        ((i === start && ['UPDATE', 'DELETE', 'MERGE', 'INSERT'].some((word) => keyword(token, word))) ||
          (keyword(token, 'USING') && !keyword(tokens[i + 1], '(')));
      if (relation || target) {
        if (relation) from = true;
        let first = i + 1;
        if (keyword(tokens[first], 'INTO') || keyword(tokens[first], 'FROM')) first++;
        const source = this.readSource(first, end, scope, target && !keyword(token, 'USING'));
        if (source) {
          // DELETE FROM's target is also its FROM source.
          if (!scope.sources.some((existing) => existing.start === source.start)) scope.sources.push(source);
        }
      }
      if (keyword(token, '(') || keyword(token, '[')) {
        const close = closingBracket(tokens, i);
        if (close < 0 || close >= end) break;
        this.readRegion(i + 1, close, scope, statement);
        i = close;
      }
    }
    flushSelect(end);
  }

  private readNested(start: number, end: number, parent: QueryScope | undefined, statement: ScopeStatement): void {
    for (let i = start; i < end; i++) {
      if (!keyword(this.tokens[i], '(') && !keyword(this.tokens[i], '[')) continue;
      const close = closingBracket(this.tokens, i);
      if (close < 0 || close >= end) continue;
      this.readRegion(i + 1, close, parent, statement);
      i = close;
    }
  }

  private readSource(start: number, end: number, scope: QueryScope, target: boolean): QuerySource | undefined {
    const tokens = this.tokens;
    let cursor = start;
    let kind: QuerySource['kind'] = target ? 'dml-target' : 'table';
    const path: string[] = [];
    if (keyword(tokens[cursor], '(')) {
      const close = closingBracket(tokens, cursor);
      if (close < 0 || close >= end) return undefined;
      kind = 'subquery';
      cursor = close + 1;
    } else {
      if (!isIdentifier(tokens[cursor])) return undefined;
      path.push(...unquote(tokens[cursor++].value).split('.'));
      while (
        cursor + 1 < end &&
        (keyword(tokens[cursor], '.') || keyword(tokens[cursor], '-')) &&
        (isIdentifier(tokens[cursor + 1]) || /^\d+$/.test(tokens[cursor + 1].value))
      ) {
        if (keyword(tokens[cursor], '-')) path[path.length - 1] += `-${unquote(tokens[cursor + 1].value)}`;
        else path.push(unquote(tokens[cursor + 1].value));
        cursor += 2;
      }
      if (!target && keyword(tokens[cursor], '(')) {
        const close = closingBracket(tokens, cursor);
        if (close < 0 || close >= end) return undefined;
        kind = path.length === 1 && normalize(path[0]) === 'unnest' ? 'unnest' : 'tvf';
        cursor = close + 1;
      }
    }
    const explicitAlias = keyword(tokens[cursor], 'AS');
    if (explicitAlias) cursor++;
    const aliasToken = tokens[cursor];
    let alias: string | undefined;
    if (canBeAlias(aliasToken)) {
      alias = unquote(aliasToken.value);
      cursor++;
    } else if (kind === 'table' || kind === 'dml-target' || kind === 'tvf') {
      alias = path.at(-1);
    }
    let offsetAlias: string | undefined;
    if (kind === 'unnest' && keyword(tokens[cursor], 'WITH') && keyword(tokens[cursor + 1], 'OFFSET')) {
      cursor += 2;
      if (keyword(tokens[cursor], 'AS')) cursor++;
      if (canBeAlias(tokens[cursor])) {
        offsetAlias = unquote(tokens[cursor++].value);
      } else offsetAlias = 'offset';
    }
    const cte =
      kind === 'table' && path.length === 1
        ? this.visibleCtes(scope, start).find((definition) => normalize(definition.name) === normalize(path[0]))
        : undefined;
    return {
      kind: cte ? 'cte' : kind,
      path,
      alias,
      explicitAlias,
      offsetAlias,
      start,
      end: cursor,
      range: { start: tokens[start].range.start, end: tokens[cursor - 1].range.end },
      cte,
    };
  }

  private readSelectAliases(scope: QueryScope, start: number, end: number): void {
    let entry = start;
    for (let i = start; i <= end; i++) {
      if (keyword(this.tokens[i], '(') || keyword(this.tokens[i], '[')) {
        const close = closingBracket(this.tokens, i);
        if (close >= 0 && close < end) i = close;
      }
      if (i !== end && !keyword(this.tokens[i], ',')) continue;
      const last = this.tokens[i - 1];
      const path = this.tokens.slice(entry, i);
      if (keyword(path[0], 'DISTINCT') || keyword(path[0], 'ALL')) path.shift();
      const implicitPath =
        path.length % 2 === 1 &&
        path.every((token, index) => (index % 2 === 0 ? isIdentifier(token) : keyword(token, '.')));
      if (
        canBeAlias(last) &&
        (implicitPath ||
          keyword(this.tokens[i - 2], 'AS') ||
          (i - entry > 1 &&
            !['.', '+', '-', '*', '/', '=', '<', '>', '|', '&', '^'].some((word) =>
              keyword(this.tokens[i - 2], word),
            ) &&
            (this.tokens[i - 2].literal ||
              keyword(this.tokens[i - 2], 'END') ||
              !reservedKeywords.has(normalize(this.tokens[i - 2].value)))))
      )
        scope.selectAliases.push(last);
      entry = i + 1;
    }
  }
}

// These AST adapters deliberately retain the historical AL04/AL05 coverage and
// ranges. New reference rules use the richer source-level scopes above.
export function legacyTableSources(statement: StatementAST): { alias: string; range: Range }[] {
  return [statement.from, ...statement.joins.map((join) => join.source)].flatMap((source) => {
    if (!(source instanceof ObjectAST)) return [];
    const tokens = excludeTokensWithMatchingScopes(source.tokens, [
      'punctuation.whitespace.sql',
      'punctuation.whitespace.leading.sql',
      'punctuation.whitespace.trailing.sql',
      'keyword.from.sql',
      'keyword.join.sql',
    ]);
    if (!tokens.length) return [];
    return [
      {
        alias: source.alias ?? source.object ?? '',
        range: {
          start: { line: tokens[0].lineNumber ?? 0, character: tokens[0].startIndex ?? 0 },
          end: { line: tokens[tokens.length - 1].lineNumber ?? 0, character: tokens[tokens.length - 1].endIndex ?? 0 },
        },
      },
    ];
  });
}

export function* legacyColumnReferences(statement: StatementAST): Iterable<ColumnAST> {
  function* columnReferences(column: Column | OrderAST): Iterable<ColumnAST> {
    if (column instanceof ColumnAST) yield column;
    else if (column instanceof ColumnFunctionAST) {
      for (const parameter of column.parameters) yield* columnReferences(parameter);
      for (const partition of column.over?.partition ?? []) yield* columnReferences(partition);
      for (const order of column.over?.order ?? []) yield* columnReferences(order);
    } else if (column instanceof OrderAST && column.column) yield* columnReferences(column.column);
    else if (column instanceof CaseStatementAST) {
      for (const when of column.when) {
        if (when.when) yield* comparisonReferences(when.when);
        if (when.then) yield* columnReferences(when.then);
      }
      if (column.else) yield* columnReferences(column.else);
    }
  }
  function* comparisonReferences(comparison: ComparisonGroupAST | ComparisonAST): Iterable<ColumnAST> {
    if (comparison instanceof ComparisonGroupAST) {
      for (const child of comparison.comparisons) yield* comparisonReferences(child);
    } else {
      if (comparison.left && !(comparison.left instanceof ArrayAST)) yield* columnReferences(comparison.left);
      if (comparison.right && !(comparison.right instanceof ArrayAST)) yield* columnReferences(comparison.right);
    }
  }
  for (const column of statement.columns) yield* columnReferences(column);
  if (statement.from instanceof StatementAST) yield* legacyColumnReferences(statement.from);
  for (const join of statement.joins) {
    for (const comparison of join.on?.comparisons ?? []) yield* comparisonReferences(comparison);
  }
  for (const comparison of statement.where?.comparisons ?? []) yield* comparisonReferences(comparison);
  for (const column of statement.groupby) yield* columnReferences(column);
  for (const column of statement.orderby) yield* columnReferences(column);
}
