/**
 * @fileoverview Base class for a rule
 * @module linter/rules/base
 * @requires vscode-languageserver
 * @requires settings
 * @requires RuleType
 */

import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { RuleType } from './enums';
import { ServerSettings } from '../../settings';
import { FileMap } from '../parser';


export type MatchPosition = { line: number, character: number }

/**
 * Abstract class for a rule
 * @class Rule
 * @memberof Linter.Rules
 */
export abstract class Rule<T extends string | FileMap>{
	readonly is_fix_compatible: boolean = true;
	readonly name: string = "";
	readonly code: string = "";
	readonly type: RuleType = RuleType.REGEX;
	readonly message: string = "";
	readonly relatedInformation: string = "";
	readonly pattern: RegExp = /./;
	severity: DiagnosticSeverity = DiagnosticSeverity.Error;
	enabled: boolean = true;
	settings: ServerSettings;
	problems: number;

	
	constructor(settings: ServerSettings, problems: number) {

		this.settings = settings;
		this.problems = problems;

		if (this.problems >= this.settings.maxNumberOfProblems) {
			console.log(`${this.name}: Too many problems, disabling.`);
			this.enabled = false;
		}

	}

	abstract evaluate(test: T, documentUri: string | null): Diagnostic[] | null;

	evaluateMultiRegexTest(test: string, documentUri: string | null = null): Diagnostic[] | null {

		// Reset the regex, regexes are stateful
		this.pattern.lastIndex = 0;

		const diagnostics: Diagnostic[] = [];
      
		let match;
		while ((match = this.pattern.exec(test)) !== null) {

			const start: MatchPosition = this.getLineAndCharacter(test, match.index);
			const end: MatchPosition = this.getLineAndCharacter(test, this.pattern.lastIndex);
			const range = {
				start: { line: start.line, character: start.character },
				end: { line: end.line, character: end.character }
			};

			diagnostics.push(this.createDiagnostic(range, documentUri));
		}

		return diagnostics;
		
	}

	/**
	 * Calculates the line and character position of a given index within a string.
	 *
	 * @param content - The string content to search within.
	 * @param matchIndex - The index within the string for which to find the line and character position.
	 * @returns An object containing the line and character position corresponding to the given index.
	 * @throws Will throw an error if the match index is out of range of the content.
	 */
	getLineAndCharacter(content: string, matchIndex: number):  MatchPosition{
			const lines = content.split('\n');
			let runningTotal = 0;
			for (let i = 0; i < lines.length; i++) {
					if (runningTotal + lines[i].length + 1 > matchIndex) {
							return { line: i, character: matchIndex - runningTotal };
					}
					runningTotal += lines[i].length + 1;
			}
			throw new Error('Match index out of range');
	}

	/**
	 * Creates a diagnostic object for reporting issues in the code.
	 *
	 * @param range - The range within the document where the issue is located.
	 * @param documentUri - The URI of the document where the issue is found. Defaults to null.
	 * @returns A `Diagnostic` object containing details about the issue.
	 */
	createDiagnostic(range: Range, documentUri: string | null = null): Diagnostic {
		const diagnostic: Diagnostic = {
			code: this.code,
			severity: this.severity,
			range: range,
			message: this.message,
			source: this.source()
		};
		if (this.relatedInformation !== "" && documentUri !== null) {
			diagnostic.relatedInformation = [{
				location: {
					uri: documentUri,
					range: range
				},
				message: this.relatedInformation
			}];
		}
		return diagnostic;
	}

	source(): string {
		return `${this.code} (${this.name})`;
	}

}
