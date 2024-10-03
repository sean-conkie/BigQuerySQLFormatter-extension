import { ServerSettings } from "../../../settings";
import { CodeAction, CodeActionKind, Diagnostic, DiagnosticSeverity, TextDocumentIdentifier, TextEdit } from 'vscode-languageserver/node';
import { Rule } from '../base';


/**
 * The LeftJoin rule
 * @class LeftJoin
 * @extends Rule
 * @memberof Linter.Rules
 */
export class LeftJoin extends Rule<string> {
  readonly name: string = "else_null";
  readonly code: string = "CV08";
  readonly message: string = "Use LEFT JOIN instead of RIGHT JOIN.";
	readonly relatedInformation: string = "It is recommended to avoid using RIGHT JOIN and instead use LEFT JOIN for consistency and readability, as it aligns with the natural left-to-right flow of reading SQL queries, making them easier to understand and maintain.";
  readonly pattern: RegExp = /right\s+join/gmi;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];

  /**
   * Creates an instance of LeftJoin.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof LeftJoin
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
                TextEdit.replace(diagnostic.range, 'left join')
            ]
        }
    };
    const title = 'Replace with `left join`';
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