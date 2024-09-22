/**
 * @fileoverview Linter for the server
 * @module linter
 * @requires vscode-languageserver
 * @requires settings
 */


import { ServerSettings } from '../settings';

import { Diagnostic } from 'vscode-languageserver/node';
import { Rule } from './rules/base';
import { initialiseRules } from './rules/rules';
import { RuleType } from './rules/enums';
import { FileMap, Parser, StatementAST } from './parser';



/**
 * Object for linting SQL code
 * @name Linter
 */
export class Linter {

	settings: ServerSettings;
	regexRules: Rule<string | FileMap>[] = [];
	parserRules: Rule<string | FileMap>[] = [];
	problems: number = 0;

	constructor(settings: ServerSettings) {
		this.settings = settings;
		this._initialiseRules();
	}

	/**
	 * Initialise the rules
	 * @memberof Linter
	 * @name initialiseRules
	 */
	_initialiseRules() {
		const rules: Rule<string | FileMap>[] = initialiseRules(this.settings, this.problems);

		this.regexRules = rules.filter(rule => rule.type === RuleType.REGEX);
		this.parserRules = rules.filter(rule => rule.type === RuleType.PARSER);

	}

	/**
	 * Verifies the given source code by evaluating it against a set of regex and parser rules.
	 * 
	 * @param source - The source code to be verified.
	 * @returns A promise that resolves to an array of `Diagnostic` objects representing the issues found in the source code.
	 */
	async verify(source: string): Promise<Diagnostic[]> {

		// Parse the source code
		const parser = new Parser();

		const diagnostics: Diagnostic[] = [];

		for (const rule of this.regexRules) {
			const result = rule.evaluate(source);
			if (result !== null) {
				diagnostics.push(...result);
				this.problems = diagnostics.length;
			}
		}

		const abstractSyntaxTree: { [key: number]: StatementAST } = await parser.parse(source);

		for (const rule of this.parserRules) {
			const result = rule.evaluate(abstractSyntaxTree);
			if (result !== null) {
				diagnostics.push(...result);
				this.problems = diagnostics.length;
			}
		}


		return diagnostics;
		
	}



}
