import { ServerSettings } from "../../../settings";
import { CodeAction, CodeActionKind, Diagnostic, DiagnosticSeverity, TextDocumentIdentifier, TextEdit } from 'vscode-languageserver/node';
import { Rule } from '../base';


/**
 * The NotEqual rule
 * @class NotEqual
 * @extends Rule
 * @memberof Linter.Rules
 */
export class NotEqual extends Rule<string> {
  readonly name: string = "not_equal";
  readonly code: string = "CV01";
  readonly message: string = "Use `!=` instead of `<>.";
	readonly relatedInformation: string = "For consistency and clarity, it is recommended to use `!=` instead of `<>`.";
  readonly pattern: RegExp = /<>/gmi;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Replace with `!=`';

  /**
   * Creates an instance of NotEqual.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof NotEqual
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
                TextEdit.replace(diagnostic.range, '!=')
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