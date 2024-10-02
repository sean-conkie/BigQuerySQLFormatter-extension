import { ServerSettings } from "../../../settings";
import {
  Diagnostic,
  DiagnosticTag,
} from 'vscode-languageserver/node';
import { Rule } from '../base';


/**
 * The ElseNull rule
 * @class ElseNull
 * @extends Rule
 * @memberof Linter.Rules
 */
export class ElseNull extends Rule<string> {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = "else_null";
  readonly code: string = "ST01";
  readonly message: string = "Omit `else null`.";
	readonly relatedInformation: string = "Do not specify redundant `else null` in a case when statement. Including `ELSE NULL` at the end of a `CASE WHEN` statement adds unnecessary complexity to the query.";
  readonly pattern: RegExp = /else\s+null/gmi;
  readonly diagnosticTags: DiagnosticTag[] = [DiagnosticTag.Unnecessary];
  readonly ruleGroup: string = 'layout';

  /**
   * Creates an instance of ElseNull.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof ElseNull
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