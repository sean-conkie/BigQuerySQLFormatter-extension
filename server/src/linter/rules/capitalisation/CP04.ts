import type { ServerSettings } from '../../../settings';
import {
  CodeAction,
  CodeActionKind,
  type Diagnostic,
  type TextDocumentIdentifier,
  TextEdit,
} from 'vscode-languageserver/node';
import { RegexRule } from '../base';
import { globalTokenCache } from '../../parser/tokenCache';

/**
 * The Literals rule
 * @class Literals
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Literals extends RegexRule {
  readonly name: string = 'literals';
  readonly code: string = 'CP04';
  readonly message: string = 'Capitalisation of boolean/null literal';
  readonly relatedInformation: string =
    'To maintain consistency and readability, always write the literals `null`, `true`, and `false` in lowercase.';
  readonly pattern: RegExp = /FALSE|TRUE|NULL/gm;
  readonly ruleGroup: string = 'capitalisation';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Convert to lowercase';

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
        [textDocument.uri]: [TextEdit.replace(diagnostic.range, text)],
      },
    };
    const actions: CodeAction[] = [];

    this.codeActionKind.forEach((kind) => {
      const fix = CodeAction.create(this.codeActionTitle, edit, kind);
      fix.diagnostics = [diagnostic];
      actions.push(fix);
    });

    return actions;
  }
}
