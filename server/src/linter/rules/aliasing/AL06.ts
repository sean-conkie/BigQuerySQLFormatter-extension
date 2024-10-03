
import { ServerSettings } from "../../../settings";
import { Diagnostic } from 'vscode-languageserver/node';
import { RuleType } from '../enums';
import { Rule } from '../base';
import { FileMap } from '../../parser';
import { StatementAST } from '../../parser/ast';
import { excludeTokensWithMatchingScopes, includeTokensWithMatchingScopes } from '../../parser/token';


export class TableAlias extends Rule<FileMap>{
  readonly is_fix_compatible: boolean = false;
  readonly name: string = "table_alias";
  readonly code: string = "AL06";
  readonly message: string = "Tables must use an alias.";
  readonly relatedInformation: string = ".";
	readonly type: RuleType = RuleType.PARSER;
  readonly ruleGroup: string = 'aliasing';

  /**
   * Creates an instance of TableAlias.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof TableAlias
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
        if (ast[i].from.alias == null) {

          const fromTokens = excludeTokensWithMatchingScopes(
            ast[i].from.tokens,
            [
              'punctuation.whitespace.sql',
              'punctuation.whitespace.leading.sql',
              'punctuation.whitespace.trailing.sql',
              'keyword.join.sql'
            ]);

          errors.push(this.createDiagnostic({
            start: {
              line: fromTokens[0].lineNumber??0,
              character: fromTokens[0].startIndex
            },
            end: {
              line: fromTokens[fromTokens.length - 1].lineNumber??0,
              character: fromTokens[fromTokens.length - 1].endIndex
            }
          }, documentUri));
        }
      }

      if (ast[i].joins) {
        ast[i].joins.map(join => {
          if (join.source) {
            if (join.source.alias == null) {

              const joinTokens = includeTokensWithMatchingScopes(
                join.source.tokens,
                [
                  'entity.name.project.sql',
                  'entity.name.dataset.sql',
                  'entity.name.object.sql'
                ]);
              errors.push(this.createDiagnostic({
                start: {
                  line: joinTokens[0].lineNumber??0,
                  character: joinTokens[0].startIndex
                },
                end: {
                  line: joinTokens[joinTokens.length - 1].lineNumber??0,
                  character: joinTokens[joinTokens.length - 1].endIndex
                }
              }, documentUri));
            }
          }
        });
      }

    }

    return errors.length > 0 ? errors : null;
  }

}