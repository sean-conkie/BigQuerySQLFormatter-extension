import { CodeAction, Diagnostic, DiagnosticSeverity, DiagnosticTag, Range, TextDocumentIdentifier, URI } from 'vscode-languageserver/node';
import { RuleType } from './enums';
import { ServerSettings } from '../../settings';
import { FileMap } from '../parser';
import packageJson from '../../../package.json';
import { getRegexMatchRanges } from './regex';


/**
 * The version of the extension.
 */
const version: string = packageJson.version;

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

	/**
	 * Evaluates the given test string against a predefined regex pattern and returns an array of diagnostics.
	 * Each diagnostic represents a match found in the test string.
	 *
	 * @param test - The string to be tested against the regex pattern.
	 * @param documentUri - An optional URI of the document being evaluated. Defaults to null.
	 * @returns An array of `Diagnostic` objects representing the matches found, or null if no matches are found.
	 */
	evaluateRegexPatterns(test: string, documentUri: string | null = null): Diagnostic[] | null {
		const diagnostics: Diagnostic[] = [];

		getRegexMatchRanges(this.pattern, test)?.map((range) => {
			diagnostics.push(this.createDiagnostic(range, documentUri));
		});

		return diagnostics;
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


  /**
   * Generates a unique cache key based on the provided range.
   *
   * @param range - The range object containing start and end positions.
   * @returns A string that uniquely identifies the range.
   */
  createCacheKey(range: Range): string {
    return `${range.start.line}|${range.start.character}|${range.end.line}|${range.end.character}`;
  }



  /**
   * Creates error outputs for indentation issues.
   *
   * @param offset - The current offset of the indentation.
   * @param errorOffset - The offset indicating how much the indentation is off by.
   * @param errorRange - The range object representing the start and end positions of the error.
   * @returns A tuple containing the additional indent number and the updated error range.
   */
  createIndentErrorOutputs(errorOffset: number, errorRange: Range): [number, Range] {
    let additionalIdentNumber = 0;

    if (errorOffset > 0) {
      // if error offset is greater than 0 then
      // the column is indented too far to the left
      // and needs to be moved to the right
      additionalIdentNumber = errorOffset;

    } else if (errorOffset < 0) {
      // if error offset is less than 0 then
      // the column is indented too far to the right
      // and needs to be moved to the left

      // errorRange.start.character = offset;
			errorRange.start.character = errorRange.start.character + errorOffset;

    }

    return [additionalIdentNumber, errorRange];
  }

}
