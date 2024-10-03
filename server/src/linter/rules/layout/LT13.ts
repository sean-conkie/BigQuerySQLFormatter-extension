/**
 * @fileoverview Rules to enforce start of file checks
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
  TextDocumentIdentifier,
  TextEdit,
} from 'vscode-languageserver/node';
import { Rule } from '../base';

/**
 * The StartOfFile rule
 * @class StartOfFile
 * @extends Rule
 * @memberof Linter.Rules
 */
export class StartOfFile extends Rule<string> {
  readonly name: string = "start_of_file";
  readonly code: string = "LT13";
  readonly message: string = "Files must not begin with newlines or whitespace.";
  readonly relatedInformation: string = "Ensuring files do not begin with newlines or whitespace promotes clean and predictable code formatting.";
  readonly pattern: RegExp = /^[\s]/;
  readonly ruleGroup: string = 'layout';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];


  /**
   * Creates an instance of StartOfFile.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof StartOfFile
   */
  constructor(settings: ServerSettings, problems: number) {
    super(settings, problems);
  }

  /**
   * Evaluates the given test string against a specific pattern and returns diagnostics if the pattern matches.
   *
   * @param test - The string to be evaluated.
   * @param documentUri - The URI of the document being evaluated. Defaults to null.
   * @returns An array of `Diagnostic` objects if the pattern matches, otherwise null.
   */
  evaluate(test: string, documentUri: string | null = null): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }

    if (this.pattern.test(test.substring(0, 1))) {
      return [this.createDiagnostic({
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 }
      }, documentUri)];
    }

    return null;

  }
  
  /**
   * Creates a set of code actions to fix diagnostics.
   *
   * @param textDocument - The identifier of the text document where the diagnostic was reported.
   * @param diagnostic - The diagnostic information about the issue to be fixed.
   * @returns An array of code actions that can be applied to fix the issue.
   */
  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): CodeAction[] {
    const edit = {
        changes: {
            [textDocument.uri]: [
                TextEdit.replace(diagnostic.range, '')
            ]
        }
    };
    const title = 'Remove trailing whitespace';
    const actions: CodeAction[] = [];
    
    this.codeActionKind.map((kind) => {
      const fix = CodeAction.create(
        title,
        edit,
        kind
      );
      fix.diagnostics = [diagnostic];
      actions.push(fix);
    });

    return actions;
  }
}