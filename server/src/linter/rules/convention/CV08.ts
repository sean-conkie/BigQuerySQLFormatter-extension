import { ServerSettings } from "../../../settings";
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { Rule } from '../base';


/**
 * The LeftJoin rule
 * @class LeftJoin
 * @extends Rule
 * @memberof Linter.Rules
 */
export class LeftJoin extends Rule<string> {
  readonly name: string = "else_null";
  readonly code: string = "CV08";
  readonly message: string = "Use LEFT JOIN instead of RIGHT JOIN.";
	readonly relatedInformation: string = "It is recommended to avoid using RIGHT JOIN and instead use LEFT JOIN for consistency and readability, as it aligns with the natural left-to-right flow of reading SQL queries, making them easier to understand and maintain.";
  readonly pattern: RegExp = /right\s+join/gmi;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;

  /**
   * Creates an instance of LeftJoin.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof LeftJoin
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