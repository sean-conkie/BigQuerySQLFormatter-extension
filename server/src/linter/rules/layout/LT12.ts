/**
 * @fileoverview Rules to enforce end of file checks
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */


import { CodeAction, CodeActionKind, Diagnostic, TextDocumentIdentifier, TextEdit } from 'vscode-languageserver';
import { Rule } from '../base';

export class EndOfFile extends Rule<string> {
	readonly name: string = "end_of_file";
	readonly code: string = "LT12";
	readonly message: string = "Files must end with a single trailing newline.";
	readonly relatedInformation: string = "Ensuring a single trailing newline at the end of files promotes clean and predictable code formatting.";
	readonly pattern: RegExp = /(?:\S(\n{2,}|\n* +\n?)$|\S($))/g;
  readonly ruleGroup: string = 'layout';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Fix trailing newline';


	constructor(settings: any, problems: number) {
		super(settings, problems);
	}

	/**
	 * Evaluates the given test string against a pattern and returns diagnostics if the pattern does not match.
	 *
	 * @param test - The string to be evaluated.
	 * @param documentUri - The URI of the document being evaluated, or null if not applicable.
	 * @returns An array of `Diagnostic` objects if the pattern does not match the test string, or null if the pattern matches or the rule is disabled.
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
  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): CodeAction[] {
    const edit = {
        changes: {
            [textDocument.uri]: [
                TextEdit.replace(diagnostic.range, '\n')
            ]
        }
    };
    const actions: CodeAction[] = [];
    
    this.codeActionKind.map((kind) => {
      const fix = CodeAction.create(
        this.codeActionTitle,
        edit,
        kind
      );
      fix.diagnostics = [diagnostic];
      actions.push(fix);
    });

    return actions;
  }
}