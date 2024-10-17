import { ServerSettings } from '../settings';
import { Diagnostic, DidChangeTextDocumentParams, TextDocumentItem, CodeActionParams, CodeAction, CodeActionKind, Range } from 'vscode-languageserver/node';
import { Rule } from './rules/base';
import { initialiseRules } from './rules/rules';
import { RuleType } from './rules/enums';
import { FileMap, Parser } from './parser';
import { StatementAST } from './parser/ast';
import { globalTokenCache } from './parser/tokenCache';
import { getRegexMatchRanges } from './rules/regex';

interface Directive extends Range {
	code: string
}

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
			if (diagnostics.length >= this.settings.maxNumberOfProblems) {
				break;
			}
			const result = rule.evaluate(abstractSyntaxTree, textDocument.uri);
			if (result != null) {
				diagnostics.push(...result);
			}
		}

		for (const rule of this.regexRules) {
			if (diagnostics.length >= this.settings.maxNumberOfProblems) {
				break;
			}
			const result = rule.evaluate(textDocument.text, textDocument.uri);
			if (result != null) {
				diagnostics.push(...result);
			}
		}

		this.problems = diagnostics.length;

		return this.filterDiagnostics(diagnostics, this.createDirectives(textDocument.uri));
	}

	/**
	 * Verifies changes in the text document and returns a list of diagnostics.
	 *
	 * @param textDocumentChangeParams - The parameters containing details of the text document change.
	 * @returns A promise that resolves to an array of `Diagnostic` objects.
	 *
	 * The function performs the following steps:
	 * 1. Parses the changes in the text document to generate an abstract syntax tree (AST).
	 * 2. Evaluates the AST against a set of parser rules and collects diagnostics.
	 * 3. Retrieves the text of the document and evaluates it against a set of regex rules, collecting additional diagnostics.
	 * 4. Filters out diagnostics that are on lines with `-- noqa` directives.
	 */
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

		return this.filterDiagnostics(diagnostics, this.createDirectives(textDocumentChangeParams.textDocument.uri));
	}

	/**
	 * Filters the diagnostics based on the provided directives.
	 * 
	 * @param diagnostics - An array of `Diagnostic` objects to be filtered.
	 * @param directives - An array of `Directive` objects that specify the filtering criteria.
	 * @returns An array of `Diagnostic` objects that have been filtered according to the directives.
	 * 
	 * The function iterates over each directive and filters out diagnostics that match the directive's criteria.
	 * If the directive's code is not 'noqa', it checks if the diagnostic's line and code match the directive's line and code.
	 * If they match, the diagnostic is filtered out. If the directive's code is 'noqa', it filters out diagnostics that match the directive's line.
	 */
	private filterDiagnostics(diagnostics: Diagnostic[], directives: Directive[]): Diagnostic[] {
		directives.map((directive) => {
			diagnostics = diagnostics.filter((diagnostic) => {

				if (directive.code !== 'noqa') {

					const lineMatch = diagnostic.range.start.line === directive.start.line;
					const codeMatch = `${diagnostic.code}`.includes(directive.code);

					return lineMatch && codeMatch ? false : true;
				}

				return diagnostic.range.start.line !== directive.start.line;
			});
		});
		
		return diagnostics;
	}

	/**
	 * Creates an array of directives from the given document URI.
	 * 
	 * This function searches for directive strings in the document text and extracts their ranges.
	 * It supports directives in the format `-- noqa` followed by optional codes.
	 * 
	 * @param documentUri - The URI of the document to search for directives.
	 * @returns An array of `Directive` objects, each containing the start and end positions of the directive and the associated code.
	 */
	private createDirectives(documentUri: string): Directive[] {
		// find all the directive strings and their ranges
		const baseRe = /-- +noqa(?:: +(?:(?:\w+)[ ,]*)+)?/gmi;
		const directives: Directive[] = [];
		const ranges: Range[] | null = getRegexMatchRanges(baseRe, globalTokenCache.get(documentUri)!.getText());

		if (ranges != null) {
			ranges.map((range) => {
				const text = globalTokenCache.get(documentUri)!.getText(range).replace('-- noqa', '');
				const subRanges = getRegexMatchRanges(/\w+/gmi, text);

				if (subRanges == null || subRanges.length === 0) {
					// no codes so just add the range
					directives.push({start: range.start, end: range.end, code: 'noqa'});
				} else {
					// add each code
					subRanges.map((subRange) => {
						const code = text.substring(subRange.start.character, subRange.end.character);
						directives.push({start: range.start, end: range.end, code: code});
					});
				}
			});
		}

		return directives;
	}

	/**
	 * Creates code actions based on the provided diagnostics and rules.
	 * 
	 * @param params - The parameters for the code action request, including the text document and diagnostics.
	 * @returns A promise that resolves to an array of code actions.
	 * 
	 * The function performs the following steps:
	 * 1. Iterates over the diagnostics and applies regex and parser rules to generate initial code actions.
	 * 2. Splits the generated code actions into two arrays: `textEdits` for SourceFixAll actions and `quickFixes` for QuickFix actions.
	 * 3. Sorts the `textEdits` by their start positions in reverse order to ensure later edits are applied first.
	 * 4. Removes overlapping edits from the `textEdits` array.
	 * 5. Combines the non-overlapping `textEdits` with the `quickFixes` and returns the result.
	 */
	async createCodeActions(params: CodeActionParams): Promise<CodeAction[]> {
		const codeActions: CodeAction[] = [];

		params.context.diagnostics.map((diagnostic) => {
			this.regexRules.map((rule) => {if (rule.diagnosticCode === diagnostic.code && rule.is_fix_compatible) {
				const action = rule.createCodeAction(params.textDocument, diagnostic);
				if (action) {
					codeActions.push(...action);}
			}});
			this.parserRules.map((rule) => {if (rule.diagnosticCode === diagnostic.code && rule.is_fix_compatible) {
				const action = rule.createCodeAction(params.textDocument, diagnostic);
				if (action) {
					codeActions.push(...action);}
			}});
		});


		// split codeActions into two arrays `textEdits` where the code action is SourceFixAll and `quickFixes` where the code action is QuickFix
		const textEdits: CodeAction[] = [];
		const quickFixes: CodeAction[] = [];
		codeActions.map((action) => {
			if (action.kind === CodeActionKind.SourceFixAll) {
				textEdits.push(action);
			} else if (action.kind === CodeActionKind.QuickFix) {
				quickFixes.push(action);
			}
		});

		// Sort the TextEdits by their start positions in reverse order. This way, edits later in the document are applied first, preventing earlier
		// edits from shifting the positions of later ones.
		textEdits.sort((a, b) => {
			const aStart = a.diagnostics![0].range.start;
			const bStart = b.diagnostics![0].range.start;
	
			if (aStart.line !== bStart.line) {
					return bStart.line - aStart.line;
			}
			return bStart.character - aStart.character;
		});

		// Remove overlapping edits
		const nonOverlappingEdits: CodeAction[] = [];
		let lastRange: Range | null = null;

		for (const edit of textEdits) {
				if (lastRange && this.areRangesOverlapping(edit.diagnostics![0].range, lastRange)) {
						// Skip this edit or adjust the range
						continue;
				}
				nonOverlappingEdits.push(edit);
				lastRange = edit.diagnostics![0].range;
		}

		return [...nonOverlappingEdits, ...quickFixes];
	}

	/**
	 * Determines if two ranges are overlapping.
	 *
	 * @param range1 - The first range to compare.
	 * @param range2 - The second range to compare.
	 * @returns `true` if the ranges overlap, otherwise `false`.
	 */
	private areRangesOverlapping(range1: Range, range2: Range): boolean {
    const range1End = range1.end;
    const range2Start = range2.start;

    if (range1End.line < range2Start.line) return false;
    if (range1End.line === range2Start.line && range1End.character <= range2Start.character)
        return false;

    return true;
	}
}
