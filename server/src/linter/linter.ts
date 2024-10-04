import { ServerSettings } from '../settings';
import { Diagnostic, DidChangeTextDocumentParams, TextDocumentItem, CodeActionParams, CodeAction, CodeActionKind, Range, TextEdit } from 'vscode-languageserver/node';
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

	private areRangesOverlapping(range1: Range, range2: Range): boolean {
    const range1End = range1.end;
    const range2Start = range2.start;

    if (range1End.line < range2Start.line) return false;
    if (range1End.line === range2Start.line && range1End.character <= range2Start.character)
        return false;

    return true;
}


}
