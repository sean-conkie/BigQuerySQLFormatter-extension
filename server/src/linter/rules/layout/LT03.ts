import { TextEdit, type Diagnostic } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { operatorLayoutOptions, resolveOption } from '../../../ruleOptions';
import { SourceFixRule, type SourceToken } from '../source';

const operators = new Set(['+', '-', '*', '/', '||', '=', '!=', '<>', '<', '>', '<=', '>=', 'AND', 'OR']);
const compoundOperators = new Set(['||', '!=', '<>', '<=', '>=', '|>', '=>']);
const expressionPrefixes =
  /^(?:SELECT|DISTINCT|ALL|FROM|WHERE|JOIN|ON|USING|HAVING|QUALIFY|BY|AS|WHEN|THEN|ELSE|CASE|AND|OR|NOT|BETWEEN|IN|IS|LIKE|LIMIT|OFFSET|INTERVAL|SET|RETURNING|UNION|EXCEPT|REPLACE|WITH|OVER)$/i;

function operand(token: SourceToken | undefined, start: boolean, qualified = false): boolean {
  if (!token) return false;
  if (token.literal) return true;
  if (/^[\w$]+(?:\.\d+)?$/.test(token.value)) return qualified || !expressionPrefixes.test(token.value);
  return (start ? ['(', '[', '+', '-', '?', '@'] : [')', ']', '?']).includes(token.value);
}

export class OperatorLayout extends SourceFixRule {
  readonly name = 'operators';
  readonly code = 'LT03';
  readonly ruleGroup = 'layout';
  readonly message = 'Place operators consistently before or after line breaks.';
  protected readonly fixTitle = 'Move operator across line break';

  protected evaluateSource(source: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const position = resolveOption(
      operatorLayoutOptions.line_position,
      this.settings.rules?.LT03?.options?.line_position,
    );
    const tokens: SourceToken[] = [];
    for (let i = 0; i < source.length; i++) {
      const token = source[i];
      const next = source[i + 1];
      if (
        !token.literal &&
        next &&
        !next.literal &&
        token.range.end.line === next.range.start.line &&
        token.range.end.character === next.range.start.character &&
        compoundOperators.has(token.value + next.value)
      ) {
        tokens.push({
          ...token,
          value: token.value + next.value,
          range: { start: token.range.start, end: next.range.end },
        });
        i++;
      } else {
        tokens.push(token);
      }
    }

    const diagnostics: Diagnostic[] = [];
    let typeDepth = 0;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const previous = tokens[i - 1];
      const next = tokens[i + 1];
      if (token.literal) continue;
      // Angle brackets in ARRAY/STRUCT/RANGE types are not comparisons.
      if (token.value === '<' && (typeDepth > 0 || /^(?:ARRAY|STRUCT|RANGE)$/i.test(previous?.value ?? ''))) {
        typeDepth++;
        continue;
      }
      if (typeDepth > 0) {
        if (token.value === '>') typeDepth--;
        continue;
      }
      if (
        !operators.has(token.value.toUpperCase()) ||
        !operand(previous, false, ['.', '@'].includes(tokens[i - 2]?.value ?? '')) ||
        !operand(next, true)
      )
        continue;
      const leading = previous.range.end.line < token.range.start.line;
      const trailing = token.range.end.line < next.range.start.line;
      if (position === 'leading' ? !trailing || leading : !leading || trailing) continue;

      const line = cache.get(token.range.start.line)!.value;
      if (position === 'leading') {
        const spaces = line.slice(0, token.range.start.character).match(/[ \t]*$/)![0].length;
        diagnostics.push(
          this.diagnosticWithFix(token.range, uri, [
            TextEdit.del({
              start: { ...token.range.start, character: token.range.start.character - spaces },
              end: token.range.end,
            }),
            TextEdit.insert(next.range.start, `${token.value} `),
          ]),
        );
      } else {
        const spaces = line.slice(token.range.end.character).match(/^[ \t]*/)![0].length;
        diagnostics.push(
          this.diagnosticWithFix(token.range, uri, [
            TextEdit.insert(previous.range.end, ` ${token.value}`),
            TextEdit.del({
              start: token.range.start,
              end: { ...token.range.end, character: token.range.end.character + spaces },
            }),
          ]),
        );
      }
    }
    return diagnostics;
  }
}
