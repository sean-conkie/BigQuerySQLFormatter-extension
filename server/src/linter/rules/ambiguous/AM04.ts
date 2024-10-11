import { ServerSettings } from "../../../settings";
import { Diagnostic } from 'vscode-languageserver/node';
import { Rule } from '../base';


/**
 * The ColumnCount rule
 * @class ColumnCount
 * @extends Rule
 * @memberof Linter.Rules
 */
export class ColumnCount extends Rule<string> {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = "column_count";
  readonly code: string = "AM04";
  readonly message: string = "Query produces an unknown number of result columns.";
	readonly relatedInformation: string = "Querying all columns using * produces a query result where the number or ordering of columns changes if the upstream table’s schema changes. This should be avoided because it can cause slow performance, cause important schema changes to go undetected, or break production code.";
  readonly pattern: RegExp = /select\s+(\*)/gmi;
  readonly ruleGroup: string = 'ambiguous';

  /**
   * Creates an instance of ColumnCount.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof ColumnCount
   */
  constructor(settings: ServerSettings, problems: number) {
    super(settings, problems);
  }

  /**
   * Evaluates the given test string against a pattern and returns diagnostics if the pattern matches.
   *
   * @param test - The string to be tested against the pattern.
   * @param documentUri - The URI of the document being evaluated, optional.
   * @returns An array of diagnostics if the pattern matches, otherwise null.
   */
  evaluate(test: string, documentUri: string | null = null): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }

    if (this.pattern.test(test)) {
      return this.evaluateRegexPatterns(test, documentUri);
    }

    return null;

  }
}