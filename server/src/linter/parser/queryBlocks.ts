import type { Position, Range } from 'vscode-languageserver/node';
import type { FileMap } from './index';
import type { StatementAST } from './ast';
import type { Token } from './token';

export function comparePositions(a: Position, b: Position): number {
  return a.line - b.line || a.character - b.character;
}

export function tokenRange(tokens: Token[]): Range {
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  if (first?.lineNumber == null || last?.lineNumber == null) {
    throw new Error('Query tokens have no line number');
  }
  return {
    start: { line: first.lineNumber, character: first.startIndex },
    end: { line: last.lineNumber, character: last.endIndex },
  };
}

export function queryRange(statement: StatementAST): Range {
  return statement.sourceRange ?? tokenRange(statement.tokens);
}

export function rangesOverlap(a: Range, b: Range): boolean {
  return (
    comparePositions(a.start, b.end) < 0 &&
    (comparePositions(b.start, a.end) < 0 ||
      (comparePositions(a.start, a.end) === 0 && comparePositions(a.start, b.start) >= 0))
  );
}

export function isCode(token: Token): boolean {
  return Boolean(token.value.trim()) && !token.scopes.some((scope) => scope.startsWith('comment.'));
}

export function hasExtendedSyntax(tokens: Token[]): boolean {
  return (
    (tokens.find(isCode)?.value.toUpperCase() === 'FROM' &&
      tokens.find(isCode)?.scopes.some((scope) => scope.startsWith('keyword.')) === true) ||
    tokens.some((token) =>
      token.scopes.some((scope) =>
        ['keyword.operator.pipe.sql', 'keyword.control.query.sql', 'keyword.control.temporal.sql'].includes(scope),
      ),
    )
  );
}

export function containsExtendedSyntax(tokens: Token[]): boolean {
  return (
    hasExtendedSyntax(tokens) ||
    nestedQuerySlices(tokens).some(({ start, end }) => containsExtendedSyntax(tokens.slice(start, end)))
  );
}

export function nestedQuerySlices(tokens: Token[]): { start: number; end: number }[] {
  const slices: { start: number; end: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!tokens[i].scopes.includes('punctuation.definition.section.bracket.round.begin.sql')) continue;
    const first = tokens.slice(i + 1).find(isCode);
    if (
      !first ||
      !/^(SELECT|WITH|FROM)$/i.test(first.value) ||
      !first.scopes.some((scope) => scope.startsWith('keyword.'))
    )
      continue;
    let depth = 1;
    let end = i + 1;
    for (; end < tokens.length; end++) {
      if (tokens[end].scopes.includes('punctuation.definition.section.bracket.round.begin.sql')) depth++;
      if (
        tokens[end].scopes.includes('punctuation.definition.section.bracket.round.end.sql') ||
        tokens[end].scopes.includes('punctuation.unmatched.bracket.round.end.sql')
      ) {
        if (--depth === 0) break;
      }
    }
    slices.push({ start: i + 1, end });
    i = end;
  }
  return slices;
}

export const pipeQueryRules = new Set([
  'RF01',
  'RF02',
  'RF03',
  'RF04',
  'RF05',
  'RF06',
  'AL01',
  'AL02',
  'AL04',
  'AL05',
  'AL06',
  'AL08',
  'AL09',
  'AM04',
  'AM05',
  'AM06',
  'AM07',
]);

export function queryBlocks(ast: FileMap, supportsPipe = false): StatementAST[] {
  const visit = (statement: StatementAST): StatementAST[] => [
    statement,
    ...((supportsPipe ? statement.hasUnsupportedQuerySyntax : statement.hasExtendedQuerySyntax)
      ? []
      : statement.queryBlocks.flatMap(visit)),
  ];
  return Object.values(ast).flatMap(visit);
}

export function extendedQueryRanges(ast: FileMap, supportsPipe = false): Range[] {
  return queryBlocks(ast, supportsPipe).flatMap((statement) => {
    if (
      !(supportsPipe ? statement.hasUnsupportedQuerySyntax : statement.hasExtendedQuerySyntax) ||
      !statement.tokens.length
    )
      return [];
    return [tokenRange(statement.tokens)];
  });
}
