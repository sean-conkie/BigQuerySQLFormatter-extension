import { ServerSettings } from "../../../settings";
import { Diagnostic, DiagnosticSeverity, TextDocumentIdentifier } from 'vscode-languageserver/node';
import { Rule } from '../base';


/**
 * The AllDistinct rule
 * @class AllDistinct
 * @extends Rule
 * @memberof Linter.Rules
 */
export class AllDistinct extends Rule<string> {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = "all_distinct";
  readonly code: string = "CV12";
  readonly message: string = "Set operators require all|distinct";
	readonly relatedInformation: string = "To ensure better readability and prevent errors, the trailing comma should be omitted in `SELECT` statements.";
  readonly pattern: RegExp = /union\s+(?!all|distinct)|(?:except|intersect)\s+(?!distinct)/gmi;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';

  /**
   * Creates an instance of AllDistinct.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof AllDistinct
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
  
  /**
   * Creates a set of code actions to fix diagnostics.
   *
   * @param textDocument - The identifier of the text document where the diagnostic was reported.
   * @param diagnostic - The diagnostic information about the issue to be fixed.
   * @returns An array of code actions that can be applied to fix the issue.
   */
  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): null { return null; }
}