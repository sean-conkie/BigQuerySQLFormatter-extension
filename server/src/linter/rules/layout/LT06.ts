
import { ServerSettings } from "../../../settings";
import { RuleType } from '../enums';
import {
  Diagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver/node';
import { Rule } from '../base';
import { FileMap } from '../../parser';
import { ColumnFunctionAST, ComparisonAST, ComparisonGroupAST } from '../../parser/ast';


/**
 * The Functions rule
 * @class Functions
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Functions extends Rule<FileMap> {
  readonly name: string = "functions";
  readonly code: string = "LT06";
  readonly type: RuleType = RuleType.PARSER;
  readonly message: string = "Function name not immediately followed by parenthesis.";
  readonly relatedInformation: string = "Function name not immediately followed by parenthesis.";
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;

  /**
   * Creates an instance of Functions.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof Functions
   */
  constructor(settings: ServerSettings, problems: number) {
    super(settings, problems);
  }

  /**
   * Evaluates the given Abstract Syntax Tree (AST) and returns an array of diagnostics if any issues are found.
   * If the rule is disabled, it returns null.
   *
   * @param ast - The Abstract Syntax Tree (AST) representing the SQL structure.
   * @param documentUri - The URI of the document being evaluated, default is null.
   * @returns An array of `Diagnostic` objects if issues are found, otherwise null.
   */
  evaluate(ast: FileMap, documentUri: string | null = null): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }

    const errors: Diagnostic[] = [];
    for (const i in ast) {
      // check the columns for functions
      for (const column of ast[i].columns) {
        if (column instanceof ColumnFunctionAST) {
          errors.push(...this.validateFunctionSyntax(column, documentUri));
        }
      }

      errors.push(...this.validateComparisonGroupFunctions(ast[i].where, documentUri));

      ast[i].joins.forEach((join) => {
        errors.push(...this.validateComparisonGroupFunctions(join.on, documentUri));
      });

    }

    return errors.length > 0 ? errors : null;
  }

  /**
   * Validates the functions within a comparison group and returns any diagnostics found.
   *
   * @param comparisonGroup - The comparison group or comparison AST node to validate.
   * @param documentUri - The URI of the document being validated.
   * @returns An array of diagnostics indicating any validation errors found.
   */
  private validateComparisonGroupFunctions(comparisonGroup: ComparisonGroupAST | ComparisonAST | null, documentUri: string | null): Diagnostic[] {
    const errors: Diagnostic[] = [];
    if (comparisonGroup === null) {
      return errors;
    }
    else if (comparisonGroup instanceof ComparisonAST) {
      if (comparisonGroup.left instanceof ColumnFunctionAST) {
        errors.push(...this.validateFunctionSyntax(comparisonGroup.left, documentUri));
      }
      if (comparisonGroup.right instanceof ColumnFunctionAST) {
        errors.push(...this.validateFunctionSyntax(comparisonGroup.right, documentUri));
      }
    }
    else if (comparisonGroup instanceof ComparisonGroupAST) {
      comparisonGroup.comparisons.forEach((comparison) => {
        errors.push(...this.validateComparisonGroupFunctions(comparison, documentUri));
      });
    }

    return errors;
  }

  /**
   * Validates the syntax of a function within a column.
   *
   * This method checks if the function is correctly followed by parentheses and recursively validates
   * the syntax of any nested functions within the parameters.
   *
   * @param column - The column containing the function to be validated.
   * @param documentUri - The URI of the document being validated, or null if not applicable.
   * @returns An array of `Diagnostic` objects representing any syntax errors found.
   */
  private validateFunctionSyntax(column: ColumnFunctionAST, documentUri: string | null): Diagnostic[] {
    
    // check the function syntax
    const errors: Diagnostic[] = [];
    for (let i = 0; i < column.tokens.length; i++) {
      if (column.function === column.tokens[i].value) {
        // found function, check if it is followed by parenthesis
        if (column.tokens[i + 1].value !== '(') {
          const range = {
            start: { line: column.tokens[i + 1].lineNumber ?? 0, character: column.tokens[i + 1].startIndex ?? 0 },
            end: { line: column.tokens[i + 1].lineNumber ?? 0, character: column.tokens[i + 1].endIndex ?? 0 }
          };
          errors.push(this.createDiagnostic(range, documentUri));
        }
      }
    }

    // check the functions parameters as some could be functions
    for (const param in column.parameters) {
      if (column.parameters[param] instanceof ColumnFunctionAST) {
        errors.push(...this.validateFunctionSyntax(column.parameters[param], documentUri));
      }
    }

    return errors;

  }
}