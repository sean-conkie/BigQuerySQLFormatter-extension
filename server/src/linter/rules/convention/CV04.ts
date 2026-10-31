import type { ServerSettings } from '../../../settings';
import {
  type CodeAction,
  CodeActionKind,
  type Diagnostic,
  DiagnosticSeverity,
  type TextDocumentIdentifier,
  TextEdit,
} from 'vscode-languageserver/node';
import { RegexReplaceRule } from '../base';

/**
 * The Count rule
 * @class Count
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Count extends RegexReplaceRule {
  readonly replacement = '1';
  readonly name: string = 'count_rows';
  readonly code: string = 'CV04';
  readonly message: string = 'Use COUNT(1) to express “count number of rows”.';
  readonly relatedInformation: string =
    'For clarity and to follow best practices, it is recommended to use `COUNT(1)` when counting rows.';
  readonly pattern: RegExp = /count\s*?\(\s*?(?:distinct\s*?)?(?<target>\*)\s*?\)/gim;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Replace with `1`';
}
