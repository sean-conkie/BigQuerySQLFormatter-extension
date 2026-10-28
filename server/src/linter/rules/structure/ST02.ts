import { TextEdit, type Diagnostic } from 'vscode-languageserver/node';
import { CaseStatementAST } from '../../parser/ast';
import type { DocumentCache } from '../../parser/tokenCache';
import { SourceFixRule, keyword, type SourceToken } from '../source';
import { caseWord, expressionRange, expressionText, hasComments, sameExpression, volatileExpression } from './case';

export class SimpleCase extends SourceFixRule {
  readonly name = 'simple_case';
  readonly code = 'ST02';
  readonly ruleGroup = 'structure';
  readonly message = 'CASE expression can be simplified.';
  protected readonly fixTitle = 'Simplify CASE expression';

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const coalesce = caseWord('coalesce', 'CP03', cache, this.settings);
    const not = caseWord('not', 'CP01', cache, this.settings);
    for (const expression of CaseStatementAST.sourceExpressions(tokens)) {
      if (expression.operand.length || expression.branches.length !== 1 || !expression.otherwise) continue;
      const all = tokens.slice(expression.start, expression.end);
      if (volatileExpression(all)) continue;
      const { condition, result } = expression.branches[0];
      const other = expression.otherwise.tokens;
      const text = (part: SourceToken[]) => expressionText(cache, part);
      const literal = (part: SourceToken[], value: string) => part.length === 1 && keyword(part[0], value);
      let replacement: string | undefined;
      if (literal(result, 'TRUE') && literal(other, 'FALSE')) replacement = `${coalesce}(${text(condition)}, false)`;
      else if (literal(result, 'FALSE') && literal(other, 'TRUE'))
        replacement = `${not} ${coalesce}(${text(condition)}, false)`;
      else {
        const isNot = keyword(condition.at(-2), 'NOT');
        const is = condition.length - (isNot ? 3 : 2);
        if (is <= 0 || !keyword(condition[is], 'IS') || !keyword(condition.at(-1), 'NULL')) continue;
        const value = condition.slice(0, is);
        let nesting = 0;
        if (
          value.some((token) => {
            if (keyword(token, '(') || keyword(token, '[')) nesting++;
            if (keyword(token, ')') || keyword(token, ']')) nesting--;
            return (
              nesting === 0 && ['AND', 'OR', 'NOT', 'IS', 'IN', 'LIKE', 'BETWEEN'].some((word) => keyword(token, word))
            );
          })
        )
          continue;
        const matching = isNot ? result : other;
        const fallback = isNot ? other : result;
        if (!sameExpression(value, matching)) continue;
        if (literal(fallback, 'NULL')) {
          let depth = 0;
          const compound = value.some((token) => {
            if (keyword(token, '(') || keyword(token, '[')) depth++;
            if (keyword(token, ')') || keyword(token, ']')) depth--;
            return (
              depth === 0 && !token.literal && /^(NOT|AND|OR|IS|IN|LIKE|BETWEEN|[+\-*/=<>!|&^])$/i.test(token.value)
            );
          });
          replacement = compound ? `(${text(value)})` : text(value);
        } else replacement = `${coalesce}(${text(value)}, ${text(fallback)})`;
      }
      if (
        replacement.startsWith(`${not} `) &&
        (!['SELECT', 'THEN', 'ELSE', '(', ','].some((word) => keyword(tokens[expression.start - 1], word)) ||
          !['AS', 'FROM', 'END', 'WHEN', 'ELSE', ',', ')', ';'].some((word) => keyword(tokens[expression.end], word)))
      ) {
        replacement = `(${replacement})`;
      }
      const range = expressionRange(all);
      diagnostics.push(
        hasComments(cache, range)
          ? this.createDiagnostic(range, uri)
          : this.diagnosticWithFix(range, uri, [TextEdit.replace(range, replacement)]),
      );
    }
    return diagnostics;
  }
}
