import type { ServerSettings } from '../settings';
import {
  type Diagnostic,
  type DidChangeTextDocumentParams,
  type TextDocumentItem,
  type CodeActionParams,
  type CodeAction,
  CodeActionKind,
  type Range,
} from 'vscode-languageserver/node';
import type { Rule } from './rules/base';
import { initialiseRules } from './rules/rules';
import { RuleType } from './rules/enums';
import { type FileMap, Parser } from './parser';
import type { StatementAST } from './parser/ast';
import { globalTokenCache } from './parser/tokenCache';

interface Directive extends Range {
  code: string;
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

    this.regexRules = rules.filter((rule) => rule.type === RuleType.REGEX);
    this.parserRules = rules.filter((rule) => rule.type === RuleType.PARSER);
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
      }
    }

    for (const rule of this.regexRules) {
      const result = rule.evaluate(globalTokenCache.get(textDocument.uri)!.getText(), textDocument.uri);
      if (result != null) {
        diagnostics.push(
          ...result.filter((diagnostic) => globalTokenCache.get(textDocument.uri)!.isCodeRange(diagnostic.range)),
        );
      }
    }

    return this.limitDiagnostics(diagnostics, textDocument.uri);
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
      }
    }
    for (const rule of this.regexRules) {
      const result = rule.evaluate(
        globalTokenCache.get(textDocumentChangeParams.textDocument.uri)!.getText(),
        textDocumentChangeParams.textDocument.uri,
      );
      if (result != null) {
        diagnostics.push(
          ...result.filter((diagnostic) =>
            globalTokenCache.get(textDocumentChangeParams.textDocument.uri)!.isCodeRange(diagnostic.range),
          ),
        );
      }
    }

    return this.limitDiagnostics(diagnostics, textDocumentChangeParams.textDocument.uri);
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
    directives.forEach((directive) => {
      diagnostics = diagnostics.filter((diagnostic) => {
        if (directive.code !== 'noqa') {
          const lineMatch = diagnostic.range.start.line === directive.start.line;
          const codeMatch = String(diagnostic.code).split(':', 1)[0].toUpperCase() === directive.code;

          return !(lineMatch && codeMatch);
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
      const codes =
        match[1] === undefined
          ? ['noqa']
          : match[1]
              .split(',')
              .map((code) => code.trim().toUpperCase())
              .filter(Boolean);
      for (const code of codes) {
        directives.push({
          start: { line: lineNumber, character: comment.startIndex },
          end: { line: lineNumber, character: line.value.length },
          code,
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
   * The function performs the following steps:
   * 1. Iterates over the diagnostics and applies regex and parser rules to generate initial code actions.
   * 2. Splits the generated code actions into two arrays: `textEdits` for SourceFixAll actions and `quickFixes` for QuickFix actions.
   * 3. Sorts the `textEdits` by their start positions in reverse order to ensure later edits are applied first.
   * 4. Removes overlapping edits from the `textEdits` array.
   * 5. Combines the non-overlapping `textEdits` with the `quickFixes` and returns the result.
   */
  async createCodeActions(params: CodeActionParams): Promise<CodeAction[]> {
    const codeActions: CodeAction[] = [];

    params.context.diagnostics.forEach((diagnostic) => {
      this.regexRules.forEach((rule) => {
        if (rule.diagnosticCode === diagnostic.code && rule.is_fix_compatible) {
          const action = rule.createCodeAction(params.textDocument, diagnostic);
          if (action) {
            codeActions.push(...action);
          }
        }
      });
      this.parserRules.forEach((rule) => {
        if (rule.diagnosticCode === diagnostic.code && rule.is_fix_compatible) {
          const action = rule.createCodeAction(params.textDocument, diagnostic);
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

    // split codeActions into two arrays `textEdits` where the code action is SourceFixAll and `quickFixes` where the code action is QuickFix
    const textEdits: CodeAction[] = [];
    const quickFixes: CodeAction[] = [];
    codeActions.forEach((action) => {
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
    if (range1End.line === range2Start.line && range1End.character <= range2Start.character) return false;

    return true;
  }
}
