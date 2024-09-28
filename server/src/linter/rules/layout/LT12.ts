/**
 * @fileoverview Rules to enforce end of file checks
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */


import { Diagnostic } from 'vscode-languageserver';
import { Rule } from '../base';

export class EndofFile extends Rule<string> {
	readonly name: string = "end_of_file";
	readonly code: string = "LT12";
	readonly message: string = "Files must end with a single trailing newline.";
	readonly relatedInformation: string = "Ensuring a single trailing newline at the end of files promotes clean and predictable code formatting.";
	readonly pattern: RegExp = /\S\n$/;


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

		if (this.pattern.test(test) === false) {

			const sourceLines: string[] = test.split(/\n|\r\n|\r/);

			return [
				this.createDiagnostic(
					{
						start: { line: sourceLines.length, character: sourceLines[sourceLines.length - 1].length },
						end: { line: sourceLines.length, character: sourceLines[sourceLines.length - 1].length },
					},
					documentUri)
			];
		}

		return null;
	}
}