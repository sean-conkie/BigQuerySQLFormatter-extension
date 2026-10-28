import type { Diagnostic } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { closingBracket, keyword, SourceRule, type SourceToken } from '../source';
import { QueryScopeResolver } from '../../scope';

type ReferenceStyle = 'explicit' | 'positional';

export class ColumnReferences extends SourceRule {
  readonly is_fix_compatible = false;
  readonly name = 'column_references';
  readonly code = 'AM06';
  readonly message = 'Use consistent named or positional references in GROUP BY and ORDER BY.';
  readonly ruleGroup = 'ambiguous';

  protected evaluateSource(tokens: SourceToken[], _cache: DocumentCache, uri: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const scope of new QueryScopeResolver(tokens).scopes) {
      let expected: ReferenceStyle | undefined;
      for (const clause of scope.clauses) {
        const expressionStart = clause.expressionStart ?? clause.start + 2;
        const styles = this.referenceStyles(tokens, expressionStart, clause.end);
        expected ??= styles[0];
        if (styles.some((style) => style !== expected)) {
          diagnostics.push(
            this.createDiagnostic(
              { start: tokens[clause.start].range.start, end: tokens[expressionStart - 1].range.end },
              uri,
            ),
          );
        }
      }
    }
    return diagnostics.sort(
      (a, b) => a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character,
    );
  }

  private referenceStyles(tokens: SourceToken[], start: number, end: number): ReferenceStyle[] {
    const styles: ReferenceStyle[] = [];
    let entry: SourceToken[] = [];
    const flush = () => {
      const expression = entry.filter(
        (token) => !['ASC', 'DESC', 'NULLS', 'FIRST', 'LAST'].some((word) => keyword(token, word)),
      );
      if (expression.length) {
        styles.push(
          expression.length === 1 && !expression[0].literal && /^\d+$/.test(expression[0].value)
            ? 'positional'
            : 'explicit',
        );
      }
      entry = [];
    };
    const boundaries = [
      'FROM',
      'WHERE',
      'GROUP',
      'HAVING',
      'QUALIFY',
      'WINDOW',
      'ORDER',
      'LIMIT',
      'UNION',
      'EXCEPT',
      'INTERSECT',
      ';',
      ')',
      ']',
    ];
    for (let i = start; i < end; i++) {
      if (boundaries.some((word) => keyword(tokens[i], word))) break;
      if (keyword(tokens[i], ',')) {
        flush();
      } else if (keyword(tokens[i], '(') || keyword(tokens[i], '[')) {
        const end = closingBracket(tokens, i);
        if (end < 0) break;
        entry.push(...tokens.slice(i, end + 1));
        i = end;
      } else {
        entry.push(tokens[i]);
      }
    }
    flush();
    return styles;
  }
}
