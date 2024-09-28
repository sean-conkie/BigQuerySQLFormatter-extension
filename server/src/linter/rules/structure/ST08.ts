import { ServerSettings } from "../../../settings";
import {
  Diagnostic,
} from 'vscode-languageserver/node';
import { Rule } from '../base';


/**
 * The Distinct rule
 * @class Distinct
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Distinct extends Rule<string> {
  readonly name: string = "distinct";
  readonly code: string = "ST08";
  readonly message: string = "DISTINCT used with parentheses.";
	readonly relatedInformation: string = "Remove parentheses to be clear that the DISTINCT applies to all columns.";
  readonly pattern: RegExp = /select\s+(distinct\s*\((?:\w+\.)?\w+\))/gmi;
  readonly ruleGroup: string = 'layout';

  /**
   * Creates an instance of Distinct.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof Distinct
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