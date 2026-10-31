import type { ServerSettings } from '../../../settings';
import {
  CodeAction,
  CodeActionKind,
  type Diagnostic,
  DiagnosticTag,
  type TextDocumentIdentifier,
} from 'vscode-languageserver/node';
import { ParserRule } from '../base';
import type { FileMap } from '../../parser';
import { excludeTokensWithMatchingScopes, includeTokensWithMatchingScopes } from '../../parser/token';
import { implicitAliasEdit, pipeAliasingDiagnostics } from './pipe';

export class ColumnAlias extends ParserRule {
  readonly name: string = 'column';
  readonly code: string = 'AL02';
  readonly message: string = 'Explicit aliasing of columns.';
  readonly relatedInformation: string =
    'For better readability and cleaner code, implicit aliases should be used when referencing columns.';
  readonly diagnosticTags: DiagnosticTag[] = [DiagnosticTag.Unnecessary];
  readonly ruleGroup: string = 'aliasing';
  readonly scope = 'keyword.as.sql';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Remove explicit alias';

  /**
   * Evaluates the given Abstract Syntax Tree (AST) to identify redundant aliases in column definitions.
   *
   * @param ast - The Abstract Syntax Tree (AST) representing the SQL file structure.
   * @param documentUri - The URI of the document being evaluated, or null if not applicable.
   * @returns An array of Diagnostic objects representing the errors found, or null if no errors are found or the rule is disabled.
   */
  evaluate(ast: FileMap, documentUri: string | null = null): Diagnostic[] | null {
    if (this.enabled === false) {
      return null;
    }
    const errors: Diagnostic[] = pipeAliasingDiagnostics(this, ast, documentUri);
    for (const i in ast) {
      if (ast[i].columns) {
        ast[i].columns.forEach((column) => {
          const filteredTokesn = excludeTokensWithMatchingScopes(column.tokens, [
            'punctuation.whitespace.sql',
            'punctuation.whitespace.leading.sql',
            'punctuation.whitespace.trailing.sql',
          ]);
          // find an 'keyword.as.sql' token that is followed by a 'meta.column.alias.sql'
          const explicitAlias = filteredTokesn.find((token, index, tokens) => {
            return (
              token.scopes.includes('keyword.as.sql') &&
              includeTokensWithMatchingScopes(tokens.slice(index + 1, index + 2), [
                'meta.column.alias.sql',
                'meta.column.explicit.alias.sql',
                'meta.column.explicit.alias.missing.sql',
              ]).length > 0
            );
          });

          if (explicitAlias) {
            errors.push(
              this.createDiagnostic(
                {
                  start: {
                    line: explicitAlias.lineNumber ?? 0,
                    character: explicitAlias.startIndex,
                  },
                  end: {
                    line: explicitAlias.lineNumber ?? 0,
                    character: explicitAlias.endIndex,
                  },
                },
                documentUri,
              ),
            );
          }
        });
      }
    }

    return errors.length > 0 ? errors : null;
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
        [textDocument.uri]: [implicitAliasEdit(textDocument.uri, diagnostic.range)],
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
