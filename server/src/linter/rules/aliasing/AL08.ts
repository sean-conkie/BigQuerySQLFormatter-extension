
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
import { excludeTokensWithMatchingScopes } from '../../parser/token';
import { sortTokens } from '../../parser/utils';


export class UniqueColumn extends Rule<FileMap>{
  readonly name: string = "unique_column";
  readonly code: string = "AL08";
  readonly message: string = "Column names should be unique.";
  readonly relatedInformation: string = "To avoid ambiguity, ensure that each column in the result set has a unique name.";
	readonly type: RuleType = RuleType.PARSER;
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
      if (!ast[i].columns) { continue; }
      const columnsData: [string, Range][] = [];
      
      ast[i].columns.map((column) => {
        let columnName: string | null = null;
        const columnTokens = sortTokens(excludeTokensWithMatchingScopes(column.tokens, ['punctuation.whitespace.leading.sql', 'punctuation.separator.comma.sql']));
        const range = {
          start: {
            line: columnTokens[0].lineNumber ?? 0,
            character: columnTokens[0].startIndex ?? 0,
          },
          end: {
            line: columnTokens[columnTokens.length - 1].lineNumber ?? 0,
            character: columnTokens[columnTokens.length - 1].endIndex ?? 0,
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
      
        columnsData.push([columnName, range]);
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