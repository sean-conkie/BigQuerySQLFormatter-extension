import { isRuleEnabled } from '../../../settings';
import {
  CodeAction,
  CodeActionKind,
  type Diagnostic,
  DiagnosticTag,
  type TextDocumentIdentifier,
  TextEdit,
} from 'vscode-languageserver/node';
import { RegexReplaceRule } from '../base';
import { SimpleCase } from './ST02';
import { comparePositions } from '../../parser/queryBlocks';

/**
 * The ElseNull rule
 * @class ElseNull
 * @extends Rule
 * @memberof Linter.Rules
 */
export class ElseNull extends RegexReplaceRule {
  readonly replacement = '';
  readonly name: string = 'else_null';
  readonly code: string = 'ST01';
  readonly message: string = 'Omit `else null`.';
  readonly relatedInformation: string =
    'Do not specify redundant `else null` in a case when statement. Including `ELSE NULL` at the end of a `CASE WHEN` statement adds unnecessary complexity to the query.';
  readonly pattern: RegExp = /(?<=\S)\s*else\s+null(?: *?$)?/gim;
  readonly diagnosticTags: DiagnosticTag[] = [DiagnosticTag.Unnecessary];
  readonly ruleGroup: string = 'structure';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Remove redundant `else null`';

  evaluate(text: string, uri: string | null = null): Diagnostic[] | null {
    const diagnostics = super.evaluate(text, uri);
    if (!diagnostics?.length || uri === null || !isRuleEnabled(this.settings, 'ST02', 'structure')) return diagnostics;
    const simplifications = new SimpleCase(this.settings, this.problems).evaluate({}, uri) ?? [];
    const remaining = diagnostics.filter(
      ({ range }) =>
        !simplifications.some(
          ({ range: whole }) =>
            comparePositions(range.start, whole.start) >= 0 && comparePositions(range.end, whole.end) <= 0,
        ),
    );
    return remaining.length ? remaining : null;
  }
}
