/**
 * @fileoverview Base class for a rule
 * @module linter/rules/base
 * @requires vscode-languageserver
 * @requires settings
 * @requires RuleType
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { RuleType } from './enums';
import { ServerSettings } from '../../settings';
import { OnigRegExp } from 'oniguruma';
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

	abstract evaluate(test: T): Diagnostic[] | null;

	evaluateMultiRegexTest(test: string): Diagnostic[] | null {

		// Reset the regex, regexes are stateful
		this.pattern.lastIndex = 0;

		const diagnostics: Diagnostic[] = [];
      
		let match;
		while ((match = this.pattern.exec(test)) !== null) {

			const start: MatchPosition = this.getLineAndCharacter(test, match.index);
			const end: MatchPosition = this.getLineAndCharacter(test, this.pattern.lastIndex);

			const diagnostic: Diagnostic = {
				severity: this.severity,
				range: {
					start: { line: start.line, character: start.character },
					end: { line: end.line, character: end.character }
				},
				message: this.message,
				source: this.code
			};
			diagnostics.push(diagnostic);
		}

		return diagnostics;
		
	}

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

}
