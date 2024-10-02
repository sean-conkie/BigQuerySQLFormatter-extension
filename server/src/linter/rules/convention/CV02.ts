import { ServerSettings } from "../../../settings";
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { Rule } from '../base';


/**
 * The Coalesce rule
 * @class Coalesce
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Coalesce extends Rule<string> {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = "coalesce";
  readonly code: string = "CV02";
  readonly message: string = "Use COALESCE instead of IFNULL or NVL.";
	readonly relatedInformation: string = "Using `COALESCE` instead of `IFNULL` or `NVL` ensures that SQL queries are portable, consistent, and easier to maintain across different databases.";
  readonly pattern: RegExp = /(?:ifnull|nvl)\s*\(/gmi;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';

  /**
   * Creates an instance of Coalesce.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof Coalesce
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
      return this.evaluateMultiRegexTest(test, documentUri);
    }

    return null;

  }
}