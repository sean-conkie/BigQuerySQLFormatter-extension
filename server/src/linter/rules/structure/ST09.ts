import { TextEdit, type Diagnostic } from 'vscode-languageserver/node';
import { joinConditions } from '../../joins';
import type { DocumentCache } from '../../parser/tokenCache';
import { joinOrderOptions, resolveOption } from '../../../ruleOptions';
import { SourceFixRule, type SourceToken } from '../source';
import { expressionText, hasComments } from './case';

const mirrored: Readonly<Record<string, string>> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };

export class JoinConditionOrder extends SourceFixRule {
  readonly name = 'join_condition_order';
  readonly code = 'ST09';
  readonly ruleGroup = 'structure';
  readonly message = 'JOIN comparison operands are in the wrong source order.';
  protected readonly fixTitle = 'Reorder JOIN comparison';

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const policy = resolveOption(
      joinOrderOptions.preferred_first_table_in_join_clause,
      this.settings.rules?.ST09?.options?.preferred_first_table_in_join_clause,
    );
    const diagnostics: Diagnostic[] = [];
    for (const condition of joinConditions(tokens, cache)) {
      for (const comparison of condition.comparisons) {
        const { left, right, operatorStart, operatorEnd, operator, range } = comparison;
        if (
          !left.safe ||
          !right.safe ||
          left.sources.length !== 1 ||
          right.sources.length !== 1 ||
          left.sources[0] === right.sources[0]
        )
          continue;
        const before =
          condition.scope.sources.indexOf(left.sources[0]) < condition.scope.sources.indexOf(right.sources[0]);
        if (before === (policy === 'earlier')) continue;
        if (hasComments(cache, range)) {
          diagnostics.push(this.createDiagnostic(range, uri));
          continue;
        }
        const edits = [
          TextEdit.replace(left.range, expressionText(cache, tokens.slice(right.start, right.end))),
          TextEdit.replace(right.range, expressionText(cache, tokens.slice(left.start, left.end))),
        ];
        if (mirrored[operator])
          edits.push(
            TextEdit.replace(
              {
                start: tokens[operatorStart].range.start,
                end: tokens[operatorEnd - 1].range.end,
              },
              mirrored[operator],
            ),
          );
        diagnostics.push(this.diagnosticWithFix(range, uri, edits));
      }
    }
    return diagnostics;
  }
}
