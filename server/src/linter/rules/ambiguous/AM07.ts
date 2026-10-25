import type { Diagnostic } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { readCtes } from '../queries';
import { closingBracket, keyword, SourceRule, type SourceToken } from '../source';

export class SetColumns extends SourceRule {
  readonly is_fix_compatible = false;
  readonly name = 'set_columns';
  readonly code = 'AM07';
  readonly message = 'Set query branches must select the same number of columns.';
  readonly ruleGroup = 'ambiguous';

  protected evaluateSource(tokens: SourceToken[], _cache: DocumentCache, uri: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    type Counts = Map<string, number | null>;

    const analyze = (start: number, end: number, inherited: Counts): number | null => {
      while (keyword(tokens[start], '(') && closingBracket(tokens, start) === end - 1) {
        start++;
        end--;
      }
      const ctes = new Map(inherited);
      const definitions = readCtes(tokens, start);
      for (const cte of definitions) {
        const count = analyze(cte.open + 1, cte.close, ctes);
        ctes.set(cte.name, cte.columns ?? count);
      }
      if (definitions.length) start = definitions[definitions.length - 1].close + 1;

      const branches: [number, number][] = [];
      const operators: number[] = [];
      let branchStart = start;
      let byName = false;
      for (let i = start; i < end; i++) {
        if (keyword(tokens[i], '(') || keyword(tokens[i], '[')) {
          const close = closingBracket(tokens, i);
          if (close < 0) return null;
          i = close;
        } else if (
          keyword(tokens[i], 'UNION') ||
          keyword(tokens[i], 'INTERSECT') ||
          (keyword(tokens[i], 'EXCEPT') && !keyword(tokens[i + 1], '('))
        ) {
          branches.push([branchStart, i]);
          operators.push(i);
          i++;
          if (keyword(tokens[i], 'ALL') || keyword(tokens[i], 'DISTINCT')) i++;
          // BY NAME/CORRESPONDING aligns columns by name, not position.
          while (i < end && !keyword(tokens[i], 'SELECT') && !keyword(tokens[i], 'WITH') && !keyword(tokens[i], '(')) {
            if (keyword(tokens[i], 'NAME') || keyword(tokens[i], 'CORRESPONDING')) byName = true;
            i++;
          }
          branchStart = i;
          i--;
        }
      }
      branches.push([branchStart, end]);
      const counts = branches.map(([begin, finish]) => projectionCount(begin, finish, ctes));
      let expected: number | null = null;
      for (let i = 0; i < counts.length; i++) {
        const count = counts[i];
        if (count === null) continue;
        if (!byName && expected !== null && count !== expected) {
          diagnostics.push(this.createDiagnostic(tokens[operators[i - 1]].range, uri));
        }
        expected ??= count;
      }
      return counts[0];
    };

    const projectionCount = (start: number, end: number, ctes: Counts): number | null => {
      if (keyword(tokens[start], '(')) {
        const close = closingBracket(tokens, start);
        return close < 0 ? null : analyze(start + 1, close, ctes);
      }
      if (keyword(tokens[start], 'WITH')) return analyze(start, end, ctes);
      if (!keyword(tokens[start], 'SELECT')) return null;
      let i = start + 1;
      if (keyword(tokens[i], 'ALL') || keyword(tokens[i], 'DISTINCT')) i++;
      const valueTable =
        keyword(tokens[i], 'AS') && (keyword(tokens[i + 1], 'STRUCT') || keyword(tokens[i + 1], 'VALUE'));
      if (valueTable) i += 2;
      const entries: SourceToken[][] = [[]];
      let from = -1;
      let inProjection = true;
      const boundaries = ['FROM', 'WHERE', 'GROUP', 'HAVING', 'QUALIFY', 'WINDOW', 'ORDER', 'LIMIT', ';'];
      for (; i < end; i++) {
        const token = tokens[i];
        if (keyword(token, '(') || keyword(token, '[')) {
          const close = closingBracket(tokens, i);
          if (close < 0) return null;
          if (keyword(tokens[i + 1], 'SELECT') || keyword(tokens[i + 1], 'WITH') || keyword(tokens[i + 1], '(')) {
            analyze(i + 1, close, ctes);
          } else {
            // Inspect subqueries inside function arguments and array literals too.
            for (let j = i + 1; j < close; j++) {
              if (keyword(tokens[j], '(') && (keyword(tokens[j + 1], 'SELECT') || keyword(tokens[j + 1], 'WITH'))) {
                const nestedClose = closingBracket(tokens, j);
                if (nestedClose < 0) break;
                analyze(j + 1, nestedClose, ctes);
                j = nestedClose;
              }
            }
          }
          if (inProjection) entries[entries.length - 1].push(...tokens.slice(i, close + 1));
          i = close;
        } else if (
          inProjection &&
          keyword(token, '<') &&
          (keyword(tokens[i - 1], 'STRUCT') || keyword(tokens[i - 1], 'ARRAY'))
        ) {
          let depth = 1;
          entries[entries.length - 1].push(token);
          while (++i < end && depth > 0) {
            if (keyword(tokens[i], '<')) depth++;
            if (keyword(tokens[i], '>')) depth--;
            entries[entries.length - 1].push(tokens[i]);
          }
          i--;
        } else if (boundaries.some((word) => keyword(token, word))) {
          if (keyword(token, 'FROM') && from < 0) from = i;
          inProjection = false;
        } else if (inProjection) {
          if (keyword(token, ',')) entries.push([]);
          else entries[entries.length - 1].push(token);
        }
      }
      if (valueTable) return 1;
      let count = 0;
      for (const entry of entries.filter((entry) => entry.length)) {
        const star = entry.findIndex((token) => keyword(token, '*'));
        const wildcard =
          star === 0 ||
          (star > 0 &&
            keyword(entry[star - 1], '.') &&
            entry.slice(0, star - 1).every((token) => token.literal || /^[\w$]+$/.test(token.value)));
        if (!wildcard) {
          count++;
          continue;
        }
        // A single CTE source has a statically known schema; external schemas do not.
        if (from < 0) return null;
        const sourceName = tokens[from + 1]?.value.toLowerCase();
        if (!sourceName) return null;
        const j = from + 2;
        if (keyword(tokens[j], '.')) return null;
        if (star > 0) {
          const qualifier = entry
            .slice(0, star - 1)
            .map((token) => token.value)
            .join('')
            .toLowerCase();
          const alias = tokens[j + (keyword(tokens[j], 'AS') ? 1 : 0)]?.value.toLowerCase();
          if (qualifier !== sourceName && qualifier !== alias) return null;
        }
        if (tokens.slice(j, end).some((token) => keyword(token, 'JOIN') || keyword(token, ','))) return null;
        const width = ctes.get(sourceName);
        if (width == null) return null;
        const except = entry.findIndex((token) => keyword(token, 'EXCEPT'));
        const removed =
          except < 0
            ? 0
            : 1 +
              entry.slice(except + 2, closingBracket(entry, except + 1)).filter((token) => keyword(token, ',')).length;
        count += width - removed;
      }
      return count || null;
    };

    let start = 0;
    for (let i = 0; i <= tokens.length; i++) {
      if (i === tokens.length || keyword(tokens[i], ';')) {
        if (start < i) analyze(start, i, new Map());
        start = i + 1;
      }
    }
    return diagnostics;
  }
}
