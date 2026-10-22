import { ServerSettings } from "../../../settings";
import { CodeAction, CodeActionKind, Diagnostic, DiagnosticSeverity, TextDocumentIdentifier, TextEdit } from 'vscode-languageserver/node';
import { Rule } from '../base';


/**
 * The SelectTrailingComma rule
 * @class SelectTrailingComma
 * @extends Rule
 * @memberof Linter.Rules
 */
export class SelectTrailingComma extends Rule<string> {
  readonly name: string = "select_trailing_comma";
  readonly code: string = "CV03";
  readonly message: string = "Trailing comma within select clause.";
	readonly relatedInformation: string = "To ensure better readability and prevent errors, the trailing comma should be omitted in `SELECT` statements.";
  readonly pattern: RegExp = /(,)\s*from/gmi;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Remove trailing comma';

  /**
   * Creates an instance of SelectTrailingComma.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof SelectTrailingComma
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