import type { ServerSettings } from '../../../settings';
import {
  CodeAction,
  CodeActionKind,
  type Diagnostic,
  DiagnosticTag,
  type TextDocumentIdentifier,
  TextEdit,
} from 'vscode-languageserver/node';
import { RegexReplaceRule } from '../base';

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
}
