
import { ServerSettings } from "../../../settings";
import {
  Diagnostic,
  DiagnosticTag
} from 'vscode-languageserver/node';
import { RuleType } from '../enums';
import { Rule } from '../base';
import { FileMap } from '../../parser';
import { excludeTokensWithMatchingScopes, includeTokensWithMatchingScopes } from '../../parser/token';
import { ArrayAST, Column, ColumnAST, ColumnFunctionAST, ComparisonAST, ComparisonGroupAST, StatementAST } from '../../parser/ast';


export class UnusedAlias extends Rule<FileMap>{
  readonly is_fix_compatible: boolean = false;
  readonly name: string = "unused_alias";
  readonly code: string = "AL05";
  readonly message: string = "Columns must use table alias.";
  readonly relatedInformation: string = "All columns should be referenced using the table alias when an alias is defined.";
	readonly type: RuleType = RuleType.PARSER;
  readonly ruleGroup: string = 'aliasing';

  /**
   * Creates an instance of UnusedAlias.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof UnusedAlias
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
      errors.push(...this.processStatement(ast[i], documentUri));
    }

    return errors.length > 0 ? errors : null;
  }

  private processStatement(statement: StatementAST, documentUri: string | null = null): Diagnostic[] {
    const errors: Diagnostic[] = [];

    if (statement.columns) {
      statement.columns.map(column => {
        errors.push(...this.processColumn(column, documentUri));
      });
    }
    
    if (statement.from instanceof StatementAST) {
      errors.push(...this.processStatement(statement.from, documentUri));
    }

    if (statement.joins) {
      statement.joins.map(join => join.on?.comparisons.map(comparison => errors.push(...this.processComparison(comparison, documentUri))));
    }

    if (statement.where) {
      statement.where?.comparisons.map(comparison => errors.push(...this.processComparison(comparison, documentUri)));
    }

    if (statement.groupby) {
      statement.groupby.map(group => errors.push(...this.processColumn(group, documentUri)));
    }

    if (statement.orderby) {
      statement.orderby.map(order => errors.push(...this.processColumn(order, documentUri)));
    }
    
    return errors;

  }

  private processColumn(column: Column, documentUri: string | null = null): Diagnostic[] {
    const errors: Diagnostic[] = [];

    if (column instanceof ColumnAST) {
      if (column.source == null) {
        const columnToken = column.tokens.find(token => token.scopes.includes("meta.column.sql"));
        if (columnToken) {
          errors.push(this.createDiagnostic({start: {line: columnToken.lineNumber ?? 0, character: columnToken.startIndex ?? 0}, end: {line: columnToken.lineNumber ?? 0, character: columnToken.endIndex ?? 0}}, documentUri));
        } else {
          errors.push(this.createDiagnostic({start: {line: column.lineNumber ?? 0, character: column.startIndex ?? 0}, end: {line: column.lineNumber ?? 0, character: column.endIndex ?? 0}}, documentUri));
        }
      }
    } else if (column instanceof ColumnFunctionAST) {
      column.parameters.map(parameter => errors.push(...this.processColumn(parameter, documentUri)));
    }

    return errors;
  }

  private processComparison(comparison: ComparisonGroupAST | ComparisonAST, documentUri: string | null = null): Diagnostic[] {
    const errors: Diagnostic[] = [];

    if (comparison instanceof ComparisonGroupAST) {
      comparison.comparisons.map(comparison => errors.push(...this.processComparison(comparison, documentUri)));
    } else {
      if (!(comparison.left instanceof ArrayAST) && comparison.left != null) {
        errors.push(...this.processColumn(comparison.left, documentUri));
      }
      if (!(comparison.right instanceof ArrayAST) && comparison.right != null) {
        errors.push(...this.processColumn(comparison.right, documentUri));
      }
    }

    return errors;
  }

}