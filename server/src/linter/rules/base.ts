import { CodeAction, Diagnostic, DiagnosticSeverity, DiagnosticTag, Range, TextDocumentIdentifier, URI } from 'vscode-languageserver/node';
import { RuleType } from './enums';
import { ServerSettings } from '../../settings';
import { FileMap } from '../parser';
import packageJson from '../../../package.json';


/**
 * The version of the extension.
 */
const version: string = packageJson.version;


/**
 * Represents a position in a text document with a specific line and character.
 * 
 * @typedef {Object} MatchPosition
 * @property {number} line - The line number in the document (0-based).
 * @property {number} character - The character position within the line (0-based).
 */
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
	readonly diagnosticTags: DiagnosticTag[] = [];
	readonly source: string = 'BigQuery SQL Formatter';
	readonly docsUrl: string = 'https://bigquerysqlformatter.readthedocs.io/en/';
	ruleGroup: string = '';
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

  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): CodeAction[] | null { return null; }

	evaluateMultiRegexTest(test: string, documentUri: string | null = null): Diagnostic[] | null {

		// Reset the regex, regexes are stateful
		this.pattern.lastIndex = 0;

		const diagnostics: Diagnostic[] = [];
		
		let match;
		while ((match = this.pattern.exec(test)) != null) {
				let groupStartIndex: number;
				let groupEndIndex: number;
				if (match.length > 1) {
					[groupStartIndex, groupEndIndex] = this.getCaptureGroupIndices(match, match.slice(1).findIndex((group) => group != null) + 1);
				} else {
					groupStartIndex = match.index;
					groupEndIndex = this.pattern.lastIndex;
				}
				const start: MatchPosition = this.getLineAndCharacter(test, groupStartIndex);
				const end: MatchPosition = this.getLineAndCharacter(test, groupEndIndex);
				const range = {
						start: { line: start.line, character: start.character },
						end: { line: end.line, character: end.character }
				};
		
				diagnostics.push(this.createDiagnostic(range, documentUri));
		}
		
		return diagnostics;
		
	}
		
	getCaptureGroupIndices(match: RegExpExecArray, groupNumber: number): [number, number] {

			if (match[groupNumber] == null) {
				return [match.index, match.index + match[0].length];
			}

			const overallMatchStartIndex = match.index;
			let searchStart = 0;
			for (let i = 1; i <= groupNumber; i++) {
					const groupText = match[i];
					if (groupText == null) {
						continue; // Skip unmatched groups
					}
					const idxInMatch0 = match[0].indexOf(groupText, searchStart);
					if (idxInMatch0 === -1) {
						return [match.index, match.index + match[0].length];
					}
					if (i === groupNumber) {
							const groupStartIndex = overallMatchStartIndex + idxInMatch0;
							const groupEndIndex = groupStartIndex + groupText.length;
							return [groupStartIndex, groupEndIndex];
					}
					searchStart = idxInMatch0 + groupText.length;
			}
			return [match.index, match.index + match[0].length];
	}
	
	getLineAndCharacter(content: string, matchIndex: number): MatchPosition {
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
			code: this.diagnosticCode,
			codeDescription: { href: this.diagnosticCodeDescription },
			severity: this.severity,
			range: range,
			message: this.message,
			source: this.source
		};
		if (this.relatedInformation !== "" && documentUri != null) {
			diagnostic.relatedInformation = [{
				location: {
					uri: documentUri,
					range: range
				},
				message: this.relatedInformation
			}];
		}
		if (this.diagnosticTags.length > 0) {
			diagnostic.tags = this.diagnosticTags;
		}
		return diagnostic;
	}

	/**
	 * Gets the diagnostic code for the rule.
	 * The diagnostic code is a string that combines the rule's code and name.
	 * 
	 * @returns {string} The diagnostic code in the format `${code}: ${name}`.
	 */
	public get diagnosticCode(): string {
		return `${this.code}: ${this.name}`;
	}

	/**
	 * Constructs the URL for the rule documentation based on the version, rule group, and code.
	 *
	 * @returns {string} The URL pointing to the rule documentation.
	 */
	public get ruleUrl(): string {
		return `${version}/rules/${this.ruleGroup}/${this.code}.html`;
	}

	/**
	 * Retrieves the diagnostic code description as a URI.
	 *
	 * @returns {URI} The full URL constructed from the rule URL and documentation URL.
	 */
	public get diagnosticCodeDescription(): URI {
		const url = new URL(this.ruleUrl, this.docsUrl);
		return url.href;
	}

}
