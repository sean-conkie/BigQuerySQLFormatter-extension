import { ServerSettings } from "../../../settings";
import {
  Diagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver/node';
import { Rule } from '../base';


/**
 * The Using rule
 * @class Using
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Using extends Rule<string> {
  readonly name: string = "using";
  readonly code: string = "ST07";
  readonly message: string = "Specify join keys instead of using USING.";
	readonly relatedInformation: string = "Specify the keys directly.";
  readonly pattern: RegExp = /join(?:\s+`?(?:[\w_]+\.)?(?:[\w_]+\.[\w_]+)`?(?:\s+(?:as\s+)?[\w_]+)?)\s+(using)/gmi;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'layout';

  /**
   * Creates an instance of Using.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof Using
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