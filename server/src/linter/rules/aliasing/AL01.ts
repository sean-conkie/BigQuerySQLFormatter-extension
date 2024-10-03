
import { ServerSettings } from "../../../settings";
import {
	CodeAction,
  CodeActionKind,
  Diagnostic,
  DiagnosticTag,
	TextDocumentIdentifier,
	TextEdit
} from 'vscode-languageserver/node';
import { RuleType } from '../enums';
import { Rule } from '../base';
import { FileMap } from '../../parser';
import { ObjectAST, StatementAST } from '../../parser/ast';
import { globalTokenCache } from '../../parser/tokenCache';


export class Table extends Rule<FileMap>{
  readonly name: string = "table";
  readonly code: string = "AL01";
  readonly message: string = "Explicit aliasing of tables.";
  readonly relatedInformation: string = "For better readability and cleaner code, implicit aliases should be used when referencing tables.";
	readonly type: RuleType = RuleType.PARSER;
  readonly diagnosticTags: DiagnosticTag[] = [DiagnosticTag.Unnecessary];
  readonly ruleGroup: string = 'aliasing';
	readonly scope = 'keyword.as.sql';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];

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

	/**
	 * Processes explicit aliasing in the given AST object and returns an array of diagnostics.
	 *
	 * @param object - The AST object to process, which can be either an ObjectAST or a StatementAST.
	 * @param documentUri - The URI of the document being processed, or null if not applicable.
	 * @returns An array of Diagnostic objects representing any issues found with explicit aliasing.
	 */
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
  
  /**
   * Creates a set of code actions to fix diagnostics.
   *
   * @param textDocument - The identifier of the text document where the diagnostic was reported.
   * @param diagnostic - The diagnostic information about the issue to be fixed.
   * @returns An array of code actions that can be applied to fix the issue.
   */
  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): CodeAction[] {
    const cachedDocument = globalTokenCache.get(textDocument.uri);
    const extendedRange = {start: {line: diagnostic.range.start.line, character: diagnostic.range.start.character - 1}, end: {line: diagnostic.range.end.line, character: diagnostic.range.end.character + 1}};
    const text = cachedDocument?.getText(extendedRange)??'';
    let startOffset = 0;
    let endOffset = 0;

    if (/ as(?: |\n)/i.test(text)) {
      // remove the starting space
      startOffset = 1;
    } else if (/as /i.test(text)) {
      // remove the ending space
      endOffset = 1;
    }

    diagnostic.range.start.character -= startOffset;
    diagnostic.range.end.character += endOffset;

    const edit = {
        changes: {
            [textDocument.uri]: [
                TextEdit.replace(diagnostic.range, '')
            ]
        }
    };
    const title = 'Remove ambiguous DISTINCT clause';
    const actions: CodeAction[] = [];
    
    this.codeActionKind.map((kind) => {
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