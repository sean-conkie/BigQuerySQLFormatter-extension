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
 * The SpacesNotTabs rule
 * @class SpacesNotTabs
 * @extends Rule
 * @memberof Linter.Rules
 */
export class SpacesNotTabs extends RegexRule {
  readonly name: string = 'spaces_not_tabs';
  readonly code: string = 'CV13';
  readonly message: string = 'Use spaces for indentation instead of tabs.';
  readonly relatedInformation: string =
    'To ensure consistent formatting and readability across different environments, spaces should be used for indentation.';
  readonly pattern: RegExp = /\t+/gim;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Replace with spaces';

  /**
   * Creates a set of code actions to fix diagnostics.
   *
   * @param textDocument - The identifier of the text document where the diagnostic was reported.
   * @param diagnostic - The diagnostic information about the issue to be fixed.
   * @returns An array of code actions that can be applied to fix the issue.
   */
  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): CodeAction[] {
    const count = diagnostic.range.end.character - diagnostic.range.start.character;
    const edit = {
      changes: {
        [textDocument.uri]: [TextEdit.replace(diagnostic.range, ' '.repeat(count * 2))],
      },
    };
    return this.createFixActions(edit, diagnostic, this.codeActionKind, this.codeActionTitle);
  }
}
