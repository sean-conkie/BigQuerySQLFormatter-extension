import { TextEdit, type Diagnostic } from 'vscode-languageserver/node';
import { joinConditions } from '../../joins';
import type { DocumentCache } from '../../parser/tokenCache';
import { joinParenthesesOptions, resolveOption } from '../../../ruleOptions';
import { SourceFixRule, type SourceToken } from '../source';

export class JoinConditionParentheses extends SourceFixRule {
  readonly defaultEnabled = false;
  readonly name = 'join_condition_parentheses';
  readonly code = 'LT90';
  readonly ruleGroup = 'layout';
  readonly message = 'Wrap multiple JOIN ON conditions in parentheses.';
  protected readonly fixTitle = 'Wrap JOIN condition in parentheses';

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const policy = resolveOption(
      joinParenthesesOptions.condition_policy,
      this.settings.rules?.LT90?.options?.condition_policy,
    );
    const diagnostics: Diagnostic[] = [];
    for (const condition of joinConditions(tokens, cache)) {
      const { expression, range } = condition;
      if (expression.kind !== 'boolean') continue;
      if (policy === 'mixed' && new Set(expression.operators).size < 2) continue;
      diagnostics.push(
        this.diagnosticWithFix(range, uri, [TextEdit.insert(range.start, '('), TextEdit.insert(range.end, ')')]),
      );
    }
    return diagnostics;
  }
}
