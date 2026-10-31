import { closingBracket, keyword, type SourceToken } from './source';

export interface CommonTableExpression {
  name: string;
  start: number;
  open: number;
  close: number;
  columns?: number;
}

export function readCtes(tokens: SourceToken[], start: number): CommonTableExpression[] {
  if (!keyword(tokens[start], 'WITH')) return [];
  const ctes: CommonTableExpression[] = [];
  let i = start + (keyword(tokens[start + 1], 'RECURSIVE') ? 2 : 1);
  while (i < tokens.length) {
    const nameStart = i;
    while (i < tokens.length && !keyword(tokens[i], 'AS') && !keyword(tokens[i], '(')) i++;
    const name = tokens
      .slice(nameStart, i)
      .map((token) => token.value)
      .join('')
      .toLowerCase();
    let columns: number | undefined;
    if (keyword(tokens[i], '(')) {
      const end = closingBracket(tokens, i);
      if (end < 0) break;
      columns = 1 + tokens.slice(i + 1, end).filter((token) => keyword(token, ',')).length;
      i = end + 1;
    }
    if (!name || !keyword(tokens[i], 'AS') || !keyword(tokens[i + 1], '(')) break;
    const open = i + 1;
    const close = closingBracket(tokens, open);
    if (close < 0) break;
    ctes.push({ name, start: nameStart, open, close, columns });
    i = close + 1;
    if (!keyword(tokens[i], ',')) break;
    i++;
  }
  return ctes;
}
