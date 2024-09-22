
import { ServerSettings } from "../../../settings";
import {
  Diagnostic,
  DiagnosticSeverity,
  Range
} from 'vscode-languageserver/node';
import { RuleType } from '../enums';
import { Rule } from '../base';
import { ColumnAST, FileMap } from '../../parser';


export class RedundantColumnAlias extends Rule<FileMap>{
  readonly name: string = "redundant_column_alias";
  readonly code: string = "AL09";
  readonly message: string = "Redundant column alias.";
  readonly pattern: RegExp = / +$/gm;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
	readonly type: RuleType = RuleType.PARSER;

  /**
   * Creates an instance of RedundantColumnAlias.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof RedundantColumnAlias
   */
  constructor(settings: ServerSettings, problems: number) {
      super(settings, problems);
  }

  evaluate(ast: FileMap): Diagnostic[] | null {

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

            errors.push({
              code: this.code,
              message: this.message,
              source: this.name,
              severity: this.severity,
              range: range
            });

            
          }
        }
      });
    }
		
    return errors.length > 0 ? errors : null;
  }
}