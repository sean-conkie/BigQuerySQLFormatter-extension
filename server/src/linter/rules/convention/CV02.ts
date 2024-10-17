import { ServerSettings } from "../../../settings";
import { CodeAction, CodeActionKind, CodeActionParams, Diagnostic, DiagnosticSeverity, TextDocumentIdentifier, TextEdit } from 'vscode-languageserver/node';
import { Rule } from '../base';


/**
 * The Coalesce rule
 * @class Coalesce
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Coalesce extends Rule<string> {
  readonly name: string = "coalesce";
  readonly code: string = "CV02";
  readonly message: string = "Use COALESCE instead of IFNULL or NVL.";
	readonly relatedInformation: string = "Using `COALESCE` instead of `IFNULL` or `NVL` ensures that SQL queries are portable, consistent, and easier to maintain across different databases.";
  readonly pattern: RegExp = /(ifnull|nvl)\s*\(/gmi;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Replace with `coalesce`';

  /**
   * Creates an instance of Coalesce.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof Coalesce
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
      return this.evaluateRegexPatterns(test, documentUri);
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
                TextEdit.replace(diagnostic.range, 'coalesce')
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