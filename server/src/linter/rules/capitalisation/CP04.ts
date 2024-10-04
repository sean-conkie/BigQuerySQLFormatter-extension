import { ServerSettings } from "../../../settings";
import {
  CodeAction,
  CodeActionKind,
  Diagnostic,
  TextDocumentIdentifier,
  TextEdit,
} from 'vscode-languageserver/node';
import { Rule } from '../base';
import { globalTokenCache } from '../../parser/tokenCache';


/**
 * The Literals rule
 * @class Literals
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Literals extends Rule<string> {
  readonly name: string = "literals";
  readonly code: string = "CP04";
  readonly message: string = "Capitalisation of boolean/null literal";
	readonly relatedInformation: string = "To maintain consistency and readability, always write the literals `null`, `true`, and `false` in lowercase.";
  readonly pattern: RegExp = /FALSE|TRUE|NULL/gm;
  readonly ruleGroup: string = 'capitalisation';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Convert to lowercase';

  /**
   * Creates an instance of Literals.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof Literals
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
    const cachedDocument = globalTokenCache.get(textDocument.uri);

    if (!cachedDocument) {
      return [];
    }

    const text = cachedDocument.getText(diagnostic.range).toLowerCase();

    const edit = {
        changes: {
            [textDocument.uri]: [
                TextEdit.replace(diagnostic.range, text)
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