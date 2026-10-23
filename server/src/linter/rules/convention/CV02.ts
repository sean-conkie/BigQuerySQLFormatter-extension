import type { ServerSettings } from '../../../settings';
import {
  type CodeAction,
  CodeActionKind,
  CodeActionParams,
  type Diagnostic,
  DiagnosticSeverity,
  type TextDocumentIdentifier,
  TextEdit,
} from 'vscode-languageserver/node';
import { RegexReplaceRule } from '../base';

/**
 * The Coalesce rule
 * @class Coalesce
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Coalesce extends RegexReplaceRule {
  readonly replacement = 'coalesce';
  readonly name: string = 'coalesce';
  readonly code: string = 'CV02';
  readonly message: string = 'Use COALESCE instead of IFNULL or NVL.';
  readonly relatedInformation: string =
    'Using `COALESCE` instead of `IFNULL` or `NVL` ensures that SQL queries are portable, consistent, and easier to maintain across different databases.';
  readonly pattern: RegExp = /(?<target>ifnull|nvl)\s*\(/gim;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Replace with `coalesce`';
}
