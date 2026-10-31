import type { ServerSettings } from '../../../settings';
import {
  type CodeAction,
  CodeActionKind,
  type Diagnostic,
  DiagnosticSeverity,
  type TextDocumentIdentifier,
  TextEdit,
} from 'vscode-languageserver/node';
import { RegexRule } from '../base';

/**
 * The IsNull rule
 * @class IsNull
 * @extends Rule
 * @memberof Linter.Rules
 */
export class IsNull extends RegexRule {
  readonly name: string = 'is_null';
  readonly code: string = 'CV05';
  readonly message: string = 'Comparisons with NULL should use “IS” or “IS NOT”.';
  readonly relatedInformation: string =
    'Using `=` or `!=` to compare a column with `NULL` is an anti-pattern because these operators do not behave as expected with `NULL` values.';
  readonly pattern: RegExp = /(?<target>!?=)\s*?null\b/gim;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Replace with ';

  /**
   * Creates a set of code actions to fix diagnostics.
   *
   * @param textDocument - The identifier of the text document where the diagnostic was reported.
   * @param diagnostic - The diagnostic information about the issue to be fixed.
   * @returns An array of code actions that can be applied to fix the issue.
   */
  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): CodeAction[] {
    const text = diagnostic.range.end.character - diagnostic.range.start.character === 1 ? 'is' : 'is not';
    const edit = {
      changes: {
        [textDocument.uri]: [TextEdit.replace(diagnostic.range, text)],
      },
    };
    return this.createFixActions(edit, diagnostic, this.codeActionKind, `${this.codeActionTitle}${text}`);
  }
}
