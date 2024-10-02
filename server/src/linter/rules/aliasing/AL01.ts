
import { ServerSettings } from "../../../settings";
import {
  Diagnostic,
  DiagnosticTag
} from 'vscode-languageserver/node';
import { RuleType } from '../enums';
import { Rule } from '../base';
import { FileMap } from '../../parser';
import { ObjectAST, StatementAST } from '../../parser/ast';


export class Table extends Rule<FileMap>{
  readonly is_fix_compatible: boolean = false;
  readonly name: string = "table";
  readonly code: string = "AL01";
  readonly message: string = "Explicit aliasing of tables.";
  readonly relatedInformation: string = "For better readability and cleaner code, implicit aliases should be used when referencing tables.";
	readonly type: RuleType = RuleType.PARSER;
  readonly diagnosticTags: DiagnosticTag[] = [DiagnosticTag.Unnecessary];
  readonly ruleGroup: string = 'aliasing';
	readonly scope = 'keyword.as.sql';

  /**
   * Creates an instance of Table.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof Table
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
			if (ast[i].from) {
				errors.push(...this.processExplicitAlias(ast[i].from, documentUri));
			}

			if (ast[i].joins) {
				ast[i].joins.map(join => {
					if (join.source) {
						errors.push(...this.processExplicitAlias(join.source, documentUri));
					}
				});
			}
    }

    return errors.length > 0 ? errors : null;
  }

	private processExplicitAlias(object: ObjectAST | StatementAST, documentUri: string | null): Diagnostic[] {

		const errors: Diagnostic[] = [];

		if (object instanceof StatementAST) {
			if (object.from) {
				errors.push(...this.processExplicitAlias(object.from, documentUri));
			}
		} else {
			const explicitAlias = object.tokens.filter(token => token.scopes.includes(this.scope))[0];

			if (explicitAlias) {
				errors.push(this.createDiagnostic(
					{start: {
						line: explicitAlias.lineNumber??0,
						character: explicitAlias.startIndex
					}, end: {
						line: explicitAlias.lineNumber??0,
						character: explicitAlias.endIndex
					}}, documentUri));
			}
		}
		return errors;
	}
}