/**
 * @fileoverview Rules to enforce trailing comma checks
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */


import { ServerSettings } from "../../../settings";
import { RuleType } from '../enums';
import {
  CodeAction,
  CodeActionKind,
  Diagnostic,
  DiagnosticSeverity,
  DocumentUri,
  TextDocumentIdentifier,
  TextEdit,
} from 'vscode-languageserver/node';
import { Rule } from '../base';
import { FileMap } from '../../parser';

type RangeCache = Map<string, number>
const documentCache: Map<DocumentUri, RangeCache> = new Map<DocumentUri, RangeCache>();

/**
 * The IndentSelect rule
 * @class IndentSelect
 * @extends Rule
 * @memberof Linter.Rules
 */
export class IndentSelect extends Rule<FileMap> {
  readonly name: string = "indent_select";
  readonly code: string = "LT02";
  readonly type: RuleType = RuleType.PARSER;
  readonly message: string = "Incorrect Indentation.";
  readonly relatedInformation: string = "";
  readonly ruleGroup: string = 'layout';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Update Indentation';
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;

  /**
   * Creates an instance of IndentSelect.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof IndentSelect
   */
  constructor(settings: ServerSettings, problems: number) {
    super(settings, problems);
  }

  /**
   * Evaluates the provided Abstract Syntax Tree (AST) to identify and return diagnostics for layout issues.
   * Specifically, it checks for misplaced commas in the SQL code represented by the AST.
   *
   * @param ast - The Abstract Syntax Tree (AST) representing the SQL code to be evaluated.
   * @param documentUri - The URI of the document being evaluated. This parameter is optional and defaults to null.
   * @returns An array of `Diagnostic` objects representing the layout issues found, or null if no issues are found or the rule is disabled.
   */
  evaluate(ast: FileMap, documentUri: string | null = null): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }

    const errors: Diagnostic[] = [];
    let cache = documentCache.get(documentUri!);
    if (!cache) {
      cache = new Map<string, number>();
    }

    for (const i in ast) {
      const offset = (ast[i].startIndex??0) + 7;
      const columns = ast[i].columns;

      columns.map((column) => {
        if (column.startIndex !== offset) {

          const errorOffset = offset - (column.startIndex??0);
          let additionalIdentNumber = 0;
          const errorRange = {
            start: {
              line: column.startLine??0,
              character: column.startIndex??0
            },
            end: {
              line: column.startLine??0,
              character: column.startIndex??0
            }
          }

          if (errorOffset > 0) {
            // if error offset is greater than 0 then
            // the column is indented too far to the left
            // and needs to be moved to the right
            additionalIdentNumber = errorOffset;

          } else if (errorOffset < 0) {
            // if error offset is less than 0 then
            // the column is indented too far to the right
            // and needs to be moved to the left

            errorRange.start.character = offset;

          }

          errors.push(this.createDiagnostic(
            errorRange,
            documentUri
          ));
          cache.set(this.createCacheKey(errorRange), additionalIdentNumber);
        }
      });
    }

    documentCache.set(documentUri!, cache);

    return errors.length > 0 ? errors : null;
  }

  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): CodeAction[] {
    const cachedDocument = documentCache.get(textDocument.uri);
    let text = '';
    if (!cachedDocument) {
      return [];
    }

    const additionalIdentNumber = cachedDocument.get(this.createCacheKey(diagnostic.range));
    if (additionalIdentNumber == null) {
      return [];
    }

    text = ' '.repeat(additionalIdentNumber) + text;
  
    const edit = {
        changes: {
            [textDocument.uri]: [
                TextEdit.replace(diagnostic.range, text)
            ]
        }
    };
    const actions: CodeAction[] = [];
    
    this.codeActionKind.map((kind) => {
      const fix = CodeAction.create(
        this.codeActionTitle,
        edit,
        kind
      );
      fix.diagnostics = [diagnostic];
      actions.push(fix);
    });

    return actions;
  }

}