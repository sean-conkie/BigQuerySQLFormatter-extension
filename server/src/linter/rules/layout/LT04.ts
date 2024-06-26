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
  Diagnostic,
} from 'vscode-languageserver/node';
import { Rule } from '../base';
import { FileMap } from '../../parser';


/**
 * The TrailingComma rule
 * @class TrailingComma
 * @extends Rule
 * @memberof Linter.Rules
 */
export class TrailingComma extends Rule<FileMap>{
  readonly name: string = "trailing_commas";
  readonly code: string = "LT04";
	readonly type: RuleType = RuleType.PARSER;
  readonly message: string = "Commas should be at the end of the line.";

  /**
   * Creates an instance of TrailingComma.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof TrailingComma
   */
  constructor(settings: ServerSettings, problems: number) {
      super(settings, problems);
  }

  evaluate(ast: FileMap): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }

		const errors: Diagnostic[] = [];
    for (const i in ast) {
      for (const column of ast[i].columns) {
        const filteredTokens = column.tokens.filter((token) => !token.scopes.includes("punctuation.whitespace.leading.sql"));
        if ((filteredTokens[0].value??'') === ',') {
          errors.push({
            message: this.message,
            severity: this.severity,
            range: {
              start: { line: filteredTokens[0].line??0, character: filteredTokens[0].start??0 },
              end: { line: filteredTokens[0].line??0, character: filteredTokens[0].end??0 }
            },
            source: this.name
          });
        } else if ((filteredTokens.find((token) => token.value === ',')?.line??0) > (filteredTokens[0].line??0)) {
          const commaToken = filteredTokens.find((token) => token.value === ',');
          errors.push({
            message: this.message,
            severity: this.severity,
            range: {
              start: { line: commaToken?.line??0, character: commaToken?.start??0 },
              end: { line: commaToken?.line??0, character: commaToken?.end??0 }
            },
            source: this.name
          });
        }
      }
    }
		
    return errors.length > 0 ? errors : null;
  }
}