import { ServerSettings } from "../../../settings";
import {
  Diagnostic,
} from 'vscode-languageserver/node';
import { Rule } from '../base';


/**
 * The Literals rule
 * @class Literals
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Literals extends Rule<string> {
  readonly name: string = "literals";
  readonly code: string = "CP04";
  readonly message: string = "Capitalisation of boolean/null literal";
	readonly relatedInformation: string = "To maintain consistency and readability, always write the literals `null`, `true`, and `false` in lowercase.";
  readonly pattern: RegExp = /FALSE|TRUE|NULL/gm;
  readonly ruleGroup: string = 'capitalisation';

  /**
   * Creates an instance of Literals.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof Literals
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