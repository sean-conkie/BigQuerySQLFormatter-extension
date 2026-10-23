import type { ServerSettings } from '../../../settings';
import { type Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { RegexRule } from '../base';

/**
 * The Using rule
 * @class Using
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Using extends RegexRule {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = 'using';
  readonly code: string = 'ST07';
  readonly message: string = 'Specify join keys instead of using USING.';
  readonly relatedInformation: string = 'Specify the keys directly.';
  readonly pattern: RegExp =
    /join(?:\s+`?(?:[\w_]+\.)?(?:[\w_]+\.[\w_]+)`?(?:\s+(?:as\s+)?[\w_]+)?)\s+(?<target>using)/gim;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'structure';
}
