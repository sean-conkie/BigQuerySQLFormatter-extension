import { isRuleEnabled, type ServerSettings, type RuleCode } from '../settings';
import {
  type Diagnostic,
  type DidChangeTextDocumentParams,
  type TextDocumentItem,
  type CodeActionParams,
  type CodeAction,
  CodeActionKind,
  type Position,
  type TextEdit,
  type Range,
  CancellationToken,
  DiagnosticSeverity,
} from 'vscode-languageserver/node';
import type { Rule } from './rules/base';
import { initialiseRules } from './rules/rules';
import { RuleType } from './rules/enums';
import { type FileMap, Parser } from './parser';
import type { StatementAST } from './parser/ast';
import { globalTokenCache } from './parser/tokenCache';
import { checkCancellation, yieldToEventLoop } from '../cancellation';

interface Directive extends Range {
  code: string;
  action?: 'disable' | 'enable';
}

export const sourceFixAllKind = `${CodeActionKind.SourceFixAll}.bigquerySQLFormatter`;

// Clause/SELECT-based rules must opt in once they understand pipe, graph and pattern queries.
const extendedQuerySafeRules = new Set([
  'CP01',
  'CP04',
  'CV01',
  'CV02',
  'CV04',
  'CV05',
  'CV13',
  'LT01',
  'LT12',
  'LT13',
]);

function comparePositions(a: Position, b: Position): number {
  return a.line - b.line || a.character - b.character;
}

function rangesConflict(a: Range, b: Range): boolean {
  if (comparePositions(a.start, b.start) === 0) return true;
  return comparePositions(a.start, b.end) < 0 && comparePositions(b.start, a.end) < 0;
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
  private readonly parser = new Parser();

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

    this.regexRules = rules.filter((rule) => rule.type === RuleType.REGEX);
    this.parserRules = rules.filter((rule) => rule.type === RuleType.PARSER);
  }

  /**
   * Verifies the given source code by evaluating it against a set of regex and parser rules.
   *
   * @param source - The source code to be verified.
   * @returns A promise that resolves to an array of `Diagnostic` objects representing the issues found in the source code.
   */
  async verify(
    textDocument: TextDocumentItem,
    token: CancellationToken = CancellationToken.None,
  ): Promise<Diagnostic[]> {
    const ast = await this.parser.parse(textDocument, token);
    return this.evaluateRules(ast, textDocument.uri, token);
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
  async verifyChanges(
    textDocumentChangeParams: DidChangeTextDocumentParams,
    token: CancellationToken = CancellationToken.None,
  ): Promise<Diagnostic[]> {
    const ast = await this.parser.parseChange(textDocumentChangeParams, token);
    return this.evaluateRules(ast, textDocumentChangeParams.textDocument.uri, token);
  }

  private async evaluateRules(ast: FileMap, uri: string, token: CancellationToken): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const cache = globalTokenCache.get(uri)!;
    const text = cache.getText();
    const extendedQueries = Object.values(ast).filter((statement) => statement.hasExtendedQuerySyntax);
    const traditionalAst = Object.fromEntries(
      Object.entries(ast).filter(([, statement]) => !statement.hasExtendedQuerySyntax),
    );
    for (const rule of [...this.parserRules, ...this.regexRules]) {
      await yieldToEventLoop(token);
      if (!this.isRuleEnabled(rule)) continue;
      const result = rule.evaluate(rule.type === RuleType.PARSER ? traditionalAst : text, uri);
      if (result) {
        const severity = this.settings.rules?.[rule.code as RuleCode]?.severity;
        const severities = {
          error: DiagnosticSeverity.Error,
          warning: DiagnosticSeverity.Warning,
          information: DiagnosticSeverity.Information,
          hint: DiagnosticSeverity.Hint,
        };
        diagnostics.push(
          ...result
            .filter((diagnostic) => {
              if (rule.type !== RuleType.PARSER && !cache.isCodeRange(diagnostic.range)) return false;
              if (extendedQuerySafeRules.has(rule.code)) return true;
              return !extendedQueries.some((statement) => {
                const first = statement.tokens[0];
                const last = statement.tokens[statement.tokens.length - 1];
                if (first.lineNumber === null || last.lineNumber === null) {
                  throw new Error('Extended query tokens have no line number');
                }
                const start = { line: first.lineNumber, character: first.startIndex };
                const end = { line: last.lineNumber, character: last.endIndex };
                return (
                  comparePositions(diagnostic.range.start, end) <= 0 &&
                  comparePositions(diagnostic.range.end, start) >= 0
                );
              });
            })
            .map((diagnostic) => ({
              ...diagnostic,
              severity: severity && severity !== 'off' ? severities[severity] : diagnostic.severity,
            })),
        );
      }
    }
    checkCancellation(token);
    return this.limitDiagnostics(diagnostics, uri);
  }

  private isRuleEnabled(rule: Rule<string | FileMap>): boolean {
    return rule.enabled && isRuleEnabled(this.settings, rule.code, rule.ruleGroup);
  }

  closeDocument(uri: string): void {
    for (const rule of [...this.parserRules, ...this.regexRules]) {
      rule.closeDocument(uri);
    }
  }

  private limitDiagnostics(diagnostics: Diagnostic[], uri: string): Diagnostic[] {
    const limited = this.filterDiagnostics(diagnostics, this.createDirectives(uri)).slice(
      0,
      Math.max(0, this.settings.maxNumberOfProblems),
    );
    this.problems = limited.length;
    return limited;
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
    return diagnostics.filter((diagnostic) => {
      const code = String(diagnostic.code).split(':', 1)[0].toUpperCase();
      let disabled = false;
      for (const directive of directives) {
        if (directive.start.line > diagnostic.range.start.line) break;
        if (directive.code !== code && directive.code !== 'noqa') continue;
        if (directive.action) {
          disabled = directive.action === 'disable';
        } else if (directive.start.line === diagnostic.range.start.line) {
          return false;
        }
      }
      return !disabled;
    });
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
    const directives: Directive[] = [];
    for (const [lineNumber, line] of globalTokenCache.get(documentUri)!.entries()) {
      const comment = line.tokens.find((token) => token.scopes.some((scope) => scope.startsWith('comment.line')));
      if (!comment) {
        continue;
      }
      const match = /^--[ \t]*noqa\b(?:[ \t]*:[ \t]*(.*))?/i.exec(line.value.substring(comment.startIndex));
      if (!match) {
        continue;
      }
      const actionMatch = /^(disable|enable)[ \t]*=[ \t]*(.*)$/i.exec(match[1] ?? '');
      const action = actionMatch?.[1].toLowerCase() as 'disable' | 'enable' | undefined;
      const codes =
        match[1] === undefined
          ? ['noqa']
          : (actionMatch?.[2] ?? match[1])
              .split(',')
              .map((code) => code.trim().toUpperCase())
              .map((code) => (code === 'ALL' ? 'noqa' : code))
              .filter(Boolean);
      for (const code of codes) {
        directives.push({
          start: { line: lineNumber, character: comment.startIndex },
          end: { line: lineNumber, character: line.value.length },
          code,
          ...(action ? { action } : {}),
        });
      }
    }

    return directives;
  }

  /**
   * Creates code actions based on the provided diagnostics and rules.
   *
   * @param params - The parameters for the code action request, including the text document and diagnostics.
   * @returns A promise that resolves to an array of code actions.
   *
   * Fix-all actions are combined atomically using actual edit ranges, not diagnostic ranges.
   * An optional fix range restricts every edit of an accepted fix to the selection.
   */
  async createCodeActions(params: CodeActionParams, fixRange?: Range): Promise<CodeAction[]> {
    const codeActions: CodeAction[] = [];

    const directives = globalTokenCache.get(params.textDocument.uri)
      ? this.createDirectives(params.textDocument.uri)
      : [];
    this.filterDiagnostics(params.context.diagnostics, directives).forEach((diagnostic) => {
      this.regexRules.forEach((rule) => {
        if (this.isRuleEnabled(rule) && rule.diagnosticCode === diagnostic.code && rule.is_fix_compatible) {
          const action = rule.createCodeAction(params.textDocument, structuredClone(diagnostic));
          if (action) {
            codeActions.push(...action);
          }
        }
      });
      this.parserRules.forEach((rule) => {
        if (this.isRuleEnabled(rule) && rule.diagnosticCode === diagnostic.code && rule.is_fix_compatible) {
          const action = rule.createCodeAction(params.textDocument, structuredClone(diagnostic));
          if (action) {
            codeActions.push(...action);
          }
        }
      });
    });

    const cache = globalTokenCache.get(params.textDocument.uri);
    if (cache && cache.eol !== '\n') {
      for (const action of codeActions) {
        for (const edit of action.edit?.changes?.[params.textDocument.uri] ?? []) {
          edit.newText = edit.newText.replace(/\r\n?|\n/g, cache.eol);
        }
      }
    }

    const editsFor = (action: CodeAction) => action.edit?.changes?.[params.textDocument.uri] ?? [];
    const candidates = codeActions
      .filter((action) => action.kind === CodeActionKind.SourceFixAll && editsFor(action).length > 0)
      .sort((a, b) => comparePositions(editsFor(b)[0].range.start, editsFor(a)[0].range.start));
    const edits: TextEdit[] = [];
    const diagnostics: Diagnostic[] = [];
    for (const action of candidates) {
      const pending: TextEdit[] = [];
      for (const edit of editsFor(action)) {
        if (
          (fixRange &&
            (comparePositions(edit.range.start, fixRange.start) < 0 ||
              comparePositions(edit.range.end, fixRange.end) > 0)) ||
          [...edits, ...pending].some((accepted) => rangesConflict(edit.range, accepted.range))
        ) {
          break;
        }
        pending.push(edit);
      }
      if (pending.length !== editsFor(action).length) continue;
      edits.push(...pending);
      diagnostics.push(...(action.diagnostics ?? []));
    }

    const combined: CodeAction[] = edits.length
      ? [
          {
            title: 'Fix all BigQuery SQL Formatter issues',
            kind: sourceFixAllKind,
            diagnostics,
            edit: { changes: { [params.textDocument.uri]: edits } },
          },
        ]
      : [];
    const actions = [...combined, ...codeActions.filter((action) => action.kind === CodeActionKind.QuickFix)];
    return actions.filter(
      (action) =>
        !params.context.only ||
        params.context.only.some((kind) => action.kind === kind || action.kind?.startsWith(`${kind}.`)),
    );
  }
}
