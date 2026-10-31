import { TextEdit, type Diagnostic } from 'vscode-languageserver/node';
import { CaseStatementAST } from '../../parser/ast';
import type { DocumentCache } from '../../parser/tokenCache';
import { SourceFixRule, closingBracket, keyword, type SourceToken } from '../source';
import { expressionRange, hasComments, sameExpression, volatileExpression } from './case';

export class NestedCase extends SourceFixRule {
  readonly name = 'nested_case';
  readonly code = 'ST04';
  readonly ruleGroup = 'structure';
  readonly message = 'Nested CASE in ELSE can be flattened.';
  protected readonly fixTitle = 'Flatten nested CASE';

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const expressions = CaseStatementAST.sourceExpressions(tokens);
    for (const outer of expressions) {
      if (!outer.otherwise) continue;
      let start = outer.otherwise.start + 1;
      let end = outer.end - 1;
      while (keyword(tokens[start], '(') && closingBracket(tokens, start) === end - 1) {
        start++;
        end--;
      }
      const inner = expressions.find((candidate) => candidate.start === start && candidate.end === end);
      if (!inner || !sameExpression(outer.operand, inner.operand) || volatileExpression(outer.operand)) continue;
      const range = expressionRange(tokens.slice(outer.start, outer.end));
      if (hasComments(cache, range)) {
        diagnostics.push(this.createDiagnostic(range, uri));
        continue;
      }
      const first = tokens[inner.branches[0].start];
      const last = tokens[inner.end - 1];
      const body = cache.getText({ start: first.range.start, end: last.range.start }).trimEnd();
      const outerWhen = tokens[outer.branches[0].start].range.start;
      const shift = outerWhen.character - first.range.start.character;
      const lines = body.split('\n').map((line, index) => {
        if (
          index === 0 ||
          tokens.some(
            (token) =>
              token.literal &&
              token.range.start.line < first.range.start.line + index &&
              token.range.end.line >= first.range.start.line + index,
          )
        )
          return line;
        const spaces = line.match(/^ */)![0].length;
        return ' '.repeat(Math.max(0, spaces + shift)) + line.slice(spaces);
      });
      const gap = cache.getText({
        start: tokens[outer.end - 2].range.end,
        end: tokens[outer.end - 1].range.start,
      });
      const editRange = { start: tokens[outer.otherwise.start].range.start, end: tokens[outer.end - 1].range.start };
      diagnostics.push(
        this.diagnosticWithFix(range, uri, [
          TextEdit.replace(editRange, (lines.join('\n') + gap).replace(/\n/g, cache.eol)),
        ]),
      );
    }
    return diagnostics;
  }
}
