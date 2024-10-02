
import { ServerSettings } from "../../../settings";
import {
  Diagnostic,
  DiagnosticTag
} from 'vscode-languageserver/node';
import { RuleType } from '../enums';
import { Rule } from '../base';
import { FileMap } from '../../parser';


export class Distinct extends Rule<FileMap>{
  readonly name: string = "column";
  readonly code: string = "AM01";
  readonly message: string = "Ambiguous use of DISTINCT in a SELECT statement with GROUP BY.";
  readonly relatedInformation: string = "When using GROUP BY, a DISTINCT clause should not be necessary as every non-distinct SELECT clause must be included in the GROUP BY clause.";
	readonly type: RuleType = RuleType.PARSER;
  readonly diagnosticTags: DiagnosticTag[] = [DiagnosticTag.Unnecessary];
  readonly ruleGroup: string = 'ambiguous';

  /**
   * Creates an instance of Distinct.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof Distinct
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
      if (ast[i].distinct === true && ast[i].groupby.length > 0) {
        // find the distinct
        const distinctToken = ast[i].tokens.find(token => token.scopes.includes('keyword.select.distinct.sql'));
        errors.push(this.createDiagnostic({start: {line: distinctToken?.lineNumber??0, character: distinctToken?.startIndex??0}, end: {line: distinctToken?.lineNumber??0, character: distinctToken?.endIndex??0}}, documentUri));
      } 
    }
    return errors.length > 0 ? errors : null;
  }
}