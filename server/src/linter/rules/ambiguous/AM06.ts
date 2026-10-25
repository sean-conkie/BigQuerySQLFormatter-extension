import type { Diagnostic } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { closingBracket, keyword, SourceRule, type SourceToken } from '../source';

type ReferenceStyle = 'explicit' | 'positional';

export class ColumnReferences extends SourceRule {
  readonly is_fix_compatible = false;
  readonly name = 'column_references';
  readonly code = 'AM06';
  readonly message = 'Use consistent named or positional references in GROUP BY and ORDER BY.';
  readonly ruleGroup = 'ambiguous';

  protected evaluateSource(tokens: SourceToken[], _cache: DocumentCache, uri: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const frames: { query: boolean; style?: ReferenceStyle }[] = [{ query: false }];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (keyword(token, '(') || keyword(token, '[')) frames.push({ query: false });
      if ((keyword(token, ')') || keyword(token, ']')) && frames.length > 1) frames.pop();
      const frame = frames[frames.length - 1];
      if (keyword(token, 'SELECT') || keyword(token, ';')) {
        frame.query = keyword(token, 'SELECT');
        frame.style = undefined;
      }
      if (
        !frame.query ||
        !(keyword(token, 'GROUP') || keyword(token, 'ORDER')) ||
        !keyword(tokens[i + 1], 'BY') ||
        keyword(tokens[i + 2], 'ALL')
      )
        continue;

      const styles = this.referenceStyles(tokens, i + 2);
      const expected = frame.style ?? styles[0];
      if (styles.some((style) => style !== expected)) {
        diagnostics.push(this.createDiagnostic({ start: token.range.start, end: tokens[i + 1].range.end }, uri));
      }
      frame.style = expected;
    }
    return diagnostics;
  }

  private referenceStyles(tokens: SourceToken[], start: number): ReferenceStyle[] {
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
    for (let i = start; i < tokens.length; i++) {
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
