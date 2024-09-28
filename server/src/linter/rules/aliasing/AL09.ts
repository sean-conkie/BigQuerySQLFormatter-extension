
import { ServerSettings } from "../../../settings";
import {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticRelatedInformation,
  Location,
  Range,
  DiagnosticTag
} from 'vscode-languageserver/node';
import { RuleType } from '../enums';
import { Rule } from '../base';
import { FileMap } from '../../parser';
import { ColumnAST } from '../../parser/ast';


export class RedundantColumnAlias extends Rule<FileMap>{
  readonly name: string = "redundant_column_alias";
  readonly code: string = "AL09";
  readonly message: string = "Redundant column alias.";
  readonly relatedInformation: string = "Instead of self-aliasing, you should simply reference the columns directly. This keeps the query concise and easy to understand.";
  readonly pattern: RegExp = / +$/gm;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
	readonly type: RuleType = RuleType.PARSER;
  readonly diagnosticTags: DiagnosticTag[] = [DiagnosticTag.Unnecessary];

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
      ast[i].columns.map((column) => {
        // check if the column is ColumnAST
        if (column instanceof ColumnAST) {
          if (column.redundantAlias()) {

            const alias = column.tokens.find((token) => token.scopes.includes('entity.name.tag'));
            let range: Range | undefined = undefined;
            if (!alias) {
              range = {
                start: {
                  line: column.tokens[0].lineNumber??0,
                  character: column.tokens[0].startIndex??0
                },
                end: {
                  line: column.tokens[column.tokens.length -1].lineNumber??0,
                  character: column.tokens[column.tokens.length -1].endIndex??0
                }
              };
            } else {
              range = {
                start: {
                  line: alias.lineNumber??0,
                  character: alias.startIndex??0
                },
                end: {
                  line: alias.lineNumber??0,
                  character: alias.endIndex??0
                }
              };
            }

            errors.push(this.createDiagnostic(range, documentUri));

          }
        }
      });
    }
		
    return errors.length > 0 ? errors : null;
  }
}