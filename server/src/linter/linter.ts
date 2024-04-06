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
import { Parser, StatementAST } from './parser';



/**
 * Object for linting SQL code
 * @name Linter
 */
export class Linter {

	settings: ServerSettings;
	regexRules: Rule[] = [];
	parserRules: Rule[] = [];
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
		const rules: Rule[] = initialiseRules(this.settings, this.problems);

		this.regexRules = rules.filter(rule => rule.type === RuleType.REGEX);
		this.parserRules = rules.filter(rule => rule.type === RuleType.PARSER);

	}

	/**
	 * Lint the source code
	 * @param {string} source The source code to lint
	 * @returns {Diagnostic[]} The diagnostics found in the source code
	 * @memberof Linter
	 */
	verify(source: string): Diagnostic[] {

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

		const abstractSyntaxTree: { [key: number]: StatementAST } = parser.parse(source);

		for (const rule of this.parserRules) {
			const result = rule.evaluateAst(abstractSyntaxTree);
			if (result !== null) {
				diagnostics.push(...result);
				this.problems = diagnostics.length;
			}
		}


		return diagnostics;
		
	}



}
