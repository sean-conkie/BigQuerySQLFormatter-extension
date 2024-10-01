
import { ServerSettings } from "../../../settings";
import {
  Diagnostic,
  DiagnosticTag,
  Range
} from 'vscode-languageserver/node';
import { RuleType } from '../enums';
import { Rule } from '../base';
import { FileMap } from '../../parser';
import { ColumnAST } from '../../parser/ast';


export class UniqueColumn extends Rule<FileMap>{
  readonly name: string = "unique_column";
  readonly code: string = "AL08";
  readonly message: string = "Column names should be unique.";
  readonly relatedInformation: string = "For better readability and cleaner code, implicit aliases should be used when referencing columns.";
	readonly type: RuleType = RuleType.PARSER;
  readonly diagnosticTags: DiagnosticTag[] = [DiagnosticTag.Unnecessary];
  readonly ruleGroup: string = 'aliasing';

  /**
   * Creates an instance of UniqueColumn.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof UniqueColumn
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

			const columnsData: [string, Range][] = ast[i].columns.map((column) => {
        let columnName: string | null = null;
        const range = {
          start: {
            line: column.lineNumber ?? 0,
            character: column.startIndex ?? 0,
          },
          end: {
            line: column.lineNumber ?? 0,
            character: column.endIndex ?? 0,
          },
        };
      
        if (column instanceof ColumnAST) {
          columnName = column.alias == null ? column.column : column.alias;
        } else {
          columnName = column.alias == null ? 'f01' : column.alias;
        }

        if (columnName == null) {
          columnName = 'f01';
        }
      
        return [columnName, range];
      });

      // identify instances of duplicated column names and all the ranges where they appear
      const duplicatedColumns: string[] = [];
      columnsData.forEach((columnData, index) => {
        const [columnName, range] = columnData;
        const columnRanges = columnsData
          .filter((cd) => cd[0] === columnName)
          .map((cd) => cd[1]);
        if (columnRanges.length > 1 && !duplicatedColumns.some((dc) => dc === columnName)) {
          duplicatedColumns.push(columnName);
          columnRanges.map(range => errors.push(this.createDiagnostic(range, documentUri)));
        }
      });

    }

    return errors.length > 0 ? errors : null;
  }
}