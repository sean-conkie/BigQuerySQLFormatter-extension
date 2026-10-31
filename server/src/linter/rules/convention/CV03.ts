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
 * The SelectTrailingComma rule
 * @class SelectTrailingComma
 * @extends Rule
 * @memberof Linter.Rules
 */
export class SelectTrailingComma extends RegexReplaceRule {
  readonly replacement = '';
  readonly name: string = 'select_trailing_comma';
  readonly code: string = 'CV03';
  readonly message: string = 'Trailing comma within select clause.';
  readonly relatedInformation: string =
    'To ensure better readability and prevent errors, the trailing comma should be omitted in `SELECT` statements.';
  readonly pattern: RegExp = /(?<target>,)\s*from/gim;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Remove trailing comma';
}
