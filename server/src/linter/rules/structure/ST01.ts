import { ServerSettings } from "../../../settings";
import {
  CodeAction,
  CodeActionKind,
  Diagnostic,
  DiagnosticTag,
  TextDocumentIdentifier,
  TextEdit,
} from 'vscode-languageserver/node';
import { Rule } from '../base';


/**
 * The ElseNull rule
 * @class ElseNull
 * @extends Rule
 * @memberof Linter.Rules
 */
export class ElseNull extends Rule<string> {
  readonly name: string = "else_null";
  readonly code: string = "ST01";
  readonly message: string = "Omit `else null`.";
	readonly relatedInformation: string = "Do not specify redundant `else null` in a case when statement. Including `ELSE NULL` at the end of a `CASE WHEN` statement adds unnecessary complexity to the query.";
  readonly pattern: RegExp = /(?<=\S)\s+else\s+null */gmi;
  readonly diagnosticTags: DiagnosticTag[] = [DiagnosticTag.Unnecessary];
  readonly ruleGroup: string = 'layout';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Remove redundant `else null`';

  /**
   * Creates an instance of ElseNull.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof ElseNull
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
    const actions: CodeAction[] = [];
    
    this.codeActionKind.map((kind) => {
      const fix = CodeAction.create(
        this.codeActionTitle,
        edit,
        kind
      );
      fix.diagnostics = [diagnostic];
      actions.push(fix);
    });

    return actions;
  }
}