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
 * The NotEqual rule
 * @class NotEqual
 * @extends Rule
 * @memberof Linter.Rules
 */
export class NotEqual extends RegexReplaceRule {
  readonly replacement = '!=';
  readonly name: string = 'not_equal';
  readonly code: string = 'CV01';
  readonly message: string = 'Use `!=` instead of `<>.';
  readonly relatedInformation: string = 'For consistency and clarity, it is recommended to use `!=` instead of `<>`.';
  readonly pattern: RegExp = /<>/gim;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Replace with `!=`';
}
