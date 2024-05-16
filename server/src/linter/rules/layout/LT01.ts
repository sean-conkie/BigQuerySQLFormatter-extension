/**
 * @fileoverview Rules to enforce trailing comma checks
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */


import { ServerSettings } from "../../../settings";
import {
  Diagnostic,
  DiagnosticSeverity
} from 'vscode-languageserver/node';
import { MatchPosition, Rule } from '../base';


/**
 * The TrailingSpaces rule
 * @class TrailingSpaces
 * @extends Rule
 * @memberof Linter.Rules
 */
export class TrailingSpaces extends Rule<string>{
  readonly name: string = "trailing_sapces";
  readonly code: string = "LT01";
  readonly message: string = "Trailing whitespace.";
  readonly pattern: RegExp = / +$/gm;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;

  /**
   * Creates an instance of TrailingSpaces.
   * @param {ServerSettings} settings The server settings
   * @param {number} problems The number of problems identified in the source code
   * @memberof TrailingSpaces
   */
  constructor(settings: ServerSettings, problems: number) {
      super(settings, problems);
  }

  evaluate(test: string): Diagnostic[] | null {

    if (this.enabled === false) {
      return null;
    }

    if (this.pattern.test(test)) {
      const diagnostics: Diagnostic[] = [];
      
      let match;
      while ((match = this.pattern.exec(test)) !== null) {

        const start: MatchPosition = this.getLineAndCharacter(test, match.index);
        const end: MatchPosition = this.getLineAndCharacter(test, this.pattern.lastIndex);

        const diagnostic: Diagnostic = {
          severity: this.severity,
          range: {
            start: { line: start.line, character: start.character },
            end: { line: end.line, character: end.character }
          },
          message: this.message,
          source: this.code
        };
        diagnostics.push(diagnostic);
      }

      return diagnostics;
      
    }

    return null;

  }


  matches(test: string): number {

    let noOfMatches: number = 0;
    const matches = test.matchAll(this.pattern);
		for (const match of matches) {
      noOfMatches++;
		}
    return noOfMatches;
		
	}
}