import type { ServerSettings } from '../../../settings';
import type { Diagnostic } from 'vscode-languageserver/node';
import { RegexRule } from '../base';

/**
 * The Distinct rule
 * @class Distinct
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Distinct extends RegexRule {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = 'distinct';
  readonly code: string = 'ST08';
  readonly message: string = 'DISTINCT used with parentheses.';
  readonly relatedInformation: string = 'Remove parentheses to be clear that the DISTINCT applies to all columns.';
  readonly pattern: RegExp = /select\s+(?<target>distinct\s*\((?:\w+\.)?\w+\))/gim;
  readonly ruleGroup: string = 'structure';
}
