
import { ServerSettings } from "../../../settings";
import {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  CodeAction,
  TextEdit,
  TextDocumentIdentifier,
  CodeActionKind
} from 'vscode-languageserver/node';
import { RuleType } from '../enums';
import { Rule } from '../base';
import { FileMap } from '../../parser';
import { ColumnAST } from '../../parser/ast';
import { includeTokensWithMatchingScopes } from '../../parser/token';


export class RedundantColumnAlias extends Rule<FileMap>{
  readonly name: string = "redundant_column_alias";
  readonly code: string = "AL09";
  readonly message: string = "Redundant column alias.";
  readonly relatedInformation: string = "Instead of self-aliasing, you should simply reference the columns directly. This keeps the query concise and easy to understand.";
  readonly pattern: RegExp = / +$/gm;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
	readonly type: RuleType = RuleType.PARSER;
  readonly diagnosticTags: DiagnosticTag[] = [DiagnosticTag.Unnecessary];
  readonly ruleGroup: string = 'aliasing';

  /**
   * Creates an instance of RedundantColumnAlias.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof RedundantColumnAlias
   */
  constructor(settings: ServerSettings, problems: number) {
      super(settings, problems);
  }

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

		const errors: Diagnostic[] = [];
    for (const i in ast) {

      if (!ast[i].columns) { continue; }

      ast[i].columns.map((column) => {
        // check if the column is ColumnAST
        if (column instanceof ColumnAST) {
          const redundantAliasTokens = includeTokensWithMatchingScopes(
            column.tokens,
            [
              'meta.column.explicit.alias.redundant.sql',
              'meta.column.implicit.alias.redundant.sql'
            ]);

          if (redundantAliasTokens.length > 0) {
            const alias = includeTokensWithMatchingScopes(
              column.tokens,
              [
                'entity.other.column.sql',
                'entity.name.tag',
              ]);

            const range = {
              start: {
                line: alias[0].lineNumber??0,
                character: alias[0].endIndex??0
              },
              end: {
                line: alias[alias.length -1].lineNumber??0,
                character: alias[alias.length -1].endIndex??0
              }
            };
            errors.push(this.createDiagnostic(range, documentUri));

          }
        }
      });
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
            [textDocument.uri]: [
                TextEdit.replace(diagnostic.range, '')
            ]
        }
    };
    const title = 'Remove redundant column alias';
    const actions: CodeAction[] = [];
    
    [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix].map((kind) => {
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