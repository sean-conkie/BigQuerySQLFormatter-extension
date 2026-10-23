import type { ServerSettings } from '../../../settings';
import type { Diagnostic } from 'vscode-languageserver/node';
import { RegexRule } from '../base';

/**
 * The ColumnCount rule
 * @class ColumnCount
 * @extends Rule
 * @memberof Linter.Rules
 */
export class ColumnCount extends RegexRule {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = 'column_count';
  readonly code: string = 'AM04';
  readonly message: string = 'Query produces an unknown number of result columns.';
  readonly relatedInformation: string =
    'Querying all columns using * produces a query result where the number or ordering of columns changes if the upstream table’s schema changes. This should be avoided because it can cause slow performance, cause important schema changes to go undetected, or break production code.';
  readonly pattern: RegExp = /(?<target>(?:[\w_]+\.)?\*)/gim;
  readonly ruleGroup: string = 'ambiguous';
}
