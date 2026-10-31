import type { ServerSettings } from '../../../settings';
import { type Diagnostic, DiagnosticSeverity, type TextDocumentIdentifier } from 'vscode-languageserver/node';
import { RegexRule } from '../base';

/**
 * The AllDistinct rule
 * @class AllDistinct
 * @extends Rule
 * @memberof Linter.Rules
 */
export class AllDistinct extends RegexRule {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = 'all_distinct';
  readonly code: string = 'CV12';
  readonly message: string = 'EXCEPT and INTERSECT require DISTINCT.';
  readonly relatedInformation: string =
    'UNION modifiers are checked by AM02; EXCEPT and INTERSECT require DISTINCT in GoogleSQL.';
  readonly pattern: RegExp = /\b(?<target>except|intersect)\b(?!\s+distinct\b)/gim;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';

  /**
   * Creates a set of code actions to fix diagnostics.
   *
   * @param textDocument - The identifier of the text document where the diagnostic was reported.
   * @param diagnostic - The diagnostic information about the issue to be fixed.
   * @returns An array of code actions that can be applied to fix the issue.
   */
  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): null {
    return null;
  }
}
