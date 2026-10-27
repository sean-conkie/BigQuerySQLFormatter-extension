import {
  CodeAction,
  type CodeActionKind,
  type Diagnostic,
  DiagnosticSeverity,
  type DiagnosticTag,
  type Range,
  type TextDocumentIdentifier,
  TextEdit,
  type URI,
  type WorkspaceEdit,
} from 'vscode-languageserver/node';
import { RuleType } from './enums';
import type { ServerSettings } from '../../settings';
import type { FileMap } from '../parser';
import packageJson from '../../../package.json';
import { getRegexMatchRanges } from './regex';
import { globalTokenCache } from '../parser/tokenCache';
import { ruleOptionSchemas, type OptionDefinitions } from '../../ruleOptions';

/**
 * The version of the extension.
 */
const version: string = packageJson.version;

/**
 * Abstract class for a rule
 * @class Rule
 * @memberof Linter.Rules
 */
export abstract class Rule<T extends string | FileMap> {
  readonly is_fix_compatible: boolean = true;
  readonly name: string = '';
  readonly code: string = '';
  readonly type: RuleType = RuleType.REGEX;
  readonly message: string = '';
  readonly relatedInformation: string = '';
  readonly pattern: RegExp = /./;
  readonly rangeGroups: readonly string[] = ['target'];
  readonly diagnosticTags: DiagnosticTag[] = [];
  readonly source: string = 'BigQuery SQL Formatter';
  readonly docsUrl: string = 'https://bigquerysqlformatter.readthedocs.io/en/';
  ruleGroup: string = '';
  severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly defaultEnabled: boolean = true;
  enabled: boolean = true;
  settings: ServerSettings;
  problems: number;

  constructor(settings: ServerSettings, problems: number) {
    this.settings = settings;
    this.problems = problems;
  }

  get optionDefinitions(): OptionDefinitions {
    return ruleOptionSchemas[this.code] ?? {};
  }

  abstract evaluate(test: T, documentUri: string | null): Diagnostic[] | null;

  closeDocument(_uri: string): void {}

  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): CodeAction[] | null {
    return null;
  }

  protected createIndentCodeActions(
    textDocument: TextDocumentIdentifier,
    diagnostic: Diagnostic,
    indentation: number | undefined,
    kinds: CodeActionKind[],
    title: string,
  ): CodeAction[] {
    if (indentation == null) {
      return [];
    }
    const cachedDocument = globalTokenCache.get(textDocument.uri);
    if (cachedDocument && /\S/.test(cachedDocument.getText(diagnostic.range))) {
      return [];
    }
    const edit = {
      changes: {
        [textDocument.uri]: [TextEdit.replace(diagnostic.range, ' '.repeat(indentation))],
      },
    };
    return this.createFixActions(edit, diagnostic, kinds, title);
  }

  protected createFixActions(
    edit: WorkspaceEdit,
    diagnostic: Diagnostic,
    kinds: CodeActionKind[],
    title: string,
  ): CodeAction[] {
    return kinds.map((kind) => {
      const action = CodeAction.create(title, edit, kind);
      action.diagnostics = [diagnostic];
      return action;
    });
  }

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

    getRegexMatchRanges(this.pattern, test, this.rangeGroups)?.forEach((range) => {
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
      source: this.source,
    };
    if (this.relatedInformation !== '' && documentUri != null) {
      diagnostic.relatedInformation = [
        {
          location: {
            uri: documentUri,
            range: range,
          },
          message: this.relatedInformation,
        },
      ];
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

export abstract class RegexRule extends Rule<string> {
  evaluate(test: string, documentUri: string | null = null): Diagnostic[] | null {
    if (!this.enabled) {
      return null;
    }
    const diagnostics = this.evaluateRegexPatterns(test, documentUri);
    return diagnostics?.length ? diagnostics : null;
  }
}

export abstract class RegexReplaceRule extends RegexRule {
  abstract readonly replacement: string;
  abstract readonly codeActionKind: CodeActionKind[];
  abstract readonly codeActionTitle: string;

  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): CodeAction[] {
    return this.createFixActions(
      { changes: { [textDocument.uri]: [TextEdit.replace(diagnostic.range, this.replacement)] } },
      diagnostic,
      this.codeActionKind,
      this.codeActionTitle,
    );
  }
}

export abstract class ParserRule extends Rule<FileMap> {
  readonly type: RuleType = RuleType.PARSER;
}

export type RuleConstructor = new (settings: ServerSettings, problems: number) => Rule<string | FileMap>;

export function instantiateRules(
  classes: readonly RuleConstructor[],
  settings: ServerSettings,
  problems: number,
): Rule<string | FileMap>[] {
  return classes.map((RuleClass) => new RuleClass(settings, problems));
}
