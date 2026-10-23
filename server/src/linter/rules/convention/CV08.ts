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
 * The LeftJoin rule
 * @class LeftJoin
 * @extends Rule
 * @memberof Linter.Rules
 */
export class LeftJoin extends RegexReplaceRule {
  readonly replacement = 'left join';
  readonly name: string = 'left_join';
  readonly code: string = 'CV08';
  readonly message: string = 'Use LEFT JOIN instead of RIGHT JOIN.';
  readonly relatedInformation: string =
    'It is recommended to avoid using RIGHT JOIN and instead use LEFT JOIN for consistency and readability, as it aligns with the natural left-to-right flow of reading SQL queries, making them easier to understand and maintain.';
  readonly pattern: RegExp = /right\s+join/gim;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Replace with `left join`';
}
