/**
 * @fileoverview Rules to enforce trailing comma checks
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */


import { ServerSettings } from "../../../settings";
import {
  CodeAction,
  CodeActionKind,
  Diagnostic,
  DiagnosticSeverity,
  TextDocumentIdentifier,
  TextEdit
} from 'vscode-languageserver/node';
import { MatchPosition, Rule } from '../base';


/**
 * The TrailingSpaces rule
 * @class TrailingSpaces
 * @extends Rule
 * @memberof Linter.Rules
 */
export class TrailingSpaces extends Rule<string> {
  readonly name: string = "trailing_sapces";
  readonly code: string = "LT01";
  readonly message: string = "Trailing whitespace.";
  readonly pattern: RegExp = /(?<=\S)( +)(?:,|$)|^ +$/gm;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'layout';

  /**
   * Creates an instance of TrailingSpaces.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof TrailingSpaces
   */
  constructor(settings: ServerSettings, problems: number) {
    super(settings, problems);
  }

  /**
   * Evaluates the given test string against a pattern and returns diagnostics if the pattern matches.
   *
   * @param test - The string to be tested against the pattern.
   * @param documentUri - The URI of the document being evaluated, optional.
   * @returns An array of diagnostics if the pattern matches, otherwise null.
   */
  evaluate(test: string, documentUri: string | null = null): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }

    if (this.pattern.test(test)) {
      return this.evaluateMultiRegexTest(test, documentUri);
    }

    return null;

  }
  
  /**
   * Creates a CodeAction to resolve the rule
   * @param textDocument 
   * @param diagnostic 
   * @returns CodeAction
   */
  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): CodeAction {
    // Create a TextEdit to remove the trailing whitespace
    const fix = CodeAction.create(
        'Remove trailing whitespace',
        {
            changes: {
                [textDocument.uri]: [
                    TextEdit.replace(diagnostic.range, '')
                ]
            }
        },
        CodeActionKind.QuickFix
    );

    // Associate the fix with the diagnostic
    fix.diagnostics = [diagnostic];
    return fix;
  }
}