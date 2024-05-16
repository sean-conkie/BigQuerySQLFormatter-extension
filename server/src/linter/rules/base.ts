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
	readonly pattern: RegExp | OnigRegExp = /./;
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
