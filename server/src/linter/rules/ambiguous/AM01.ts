
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
import { globalTokenCache } from '../../parser/tokenCache';


export class Distinct extends Rule<FileMap>{
  readonly name: string = "column";
  readonly code: string = "AM01";
  readonly message: string = "Ambiguous use of DISTINCT in a SELECT statement with GROUP BY.";
  readonly relatedInformation: string = "When using GROUP BY, a DISTINCT clause should not be necessary as every non-distinct SELECT clause must be included in the GROUP BY clause.";
	readonly type: RuleType = RuleType.PARSER;
  readonly diagnosticTags: DiagnosticTag[] = [DiagnosticTag.Unnecessary];
  readonly ruleGroup: string = 'ambiguous';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];

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

    if (/ distinct(?: |\n)/i.test(text)) {
      // remove the starting space
      startOffset = 1;
    } else if (/distinct /i.test(text)) {
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