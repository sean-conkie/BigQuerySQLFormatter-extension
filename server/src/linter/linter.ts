import { ServerSettings } from '../settings';
import { Diagnostic, DidChangeTextDocumentParams, TextDocumentItem } from 'vscode-languageserver/node';
import { Rule } from './rules/base';
import { initialiseRules } from './rules/rules';
import { RuleType } from './rules/enums';
import { FileMap, Parser } from './parser';
import { StatementAST } from './parser/ast';
import { globalTokenCache } from './parser/tokenCache';

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
	async verify(textDocument: TextDocumentItem): Promise<Diagnostic[]> {

		// Parse the source code
		const parser = new Parser();

		const diagnostics: Diagnostic[] = [];

		const abstractSyntaxTree: { [key: number]: StatementAST } = await parser.parse(textDocument);

		for (const rule of this.parserRules) {
			const result = rule.evaluate(abstractSyntaxTree, textDocument.uri);
			if (result != null) {
				diagnostics.push(...result);
				this.problems = diagnostics.length;
			}
		}

		for (const rule of this.regexRules) {
			const result = rule.evaluate(textDocument.text, textDocument.uri);
			if (result != null) {
				diagnostics.push(...result);
				this.problems = diagnostics.length;
			}
		}

		return diagnostics;
		
	}

	async verifyChanges(textDocumentChangeParams: DidChangeTextDocumentParams): Promise<Diagnostic[]> {

		const parser = new Parser();

		const diagnostics: Diagnostic[] = [];

		const abstractSyntaxTree: { [key: number]: StatementAST } = await parser.parseChange(textDocumentChangeParams);

		for (const rule of this.parserRules) {
			const result = rule.evaluate(abstractSyntaxTree, textDocumentChangeParams.textDocument.uri);
			if (result != null) {
				diagnostics.push(...result);
				this.problems = diagnostics.length;
			}
		}

		for (const rule of this.regexRules) {
			const result = rule.evaluate(globalTokenCache.get(textDocumentChangeParams.textDocument.uri)!.getText(), textDocumentChangeParams.textDocument.uri);
			if (result != null) {
				diagnostics.push(...result);
				this.problems = diagnostics.length;
			}
		}

		return diagnostics;

	}

}
