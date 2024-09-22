/**
 * @fileoverview Rules to enforce end of file checks
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */


import { Diagnostic } from 'vscode-languageserver';
import { Rule } from '../base';

export class EndofFile extends Rule<string>{
  readonly name: string = "end_of_file";
  readonly code: string = "LT12";
  readonly message: string = "Files must end with a single trailing newline.";
  readonly pattern: RegExp = /\S\n$/;
	

	constructor(settings: any, problems: number) {
		super(settings, problems);
	}

	evaluate(test: string): Diagnostic[] | null {
		
		if (this.enabled === false) {
			return null;
		}

		if (this.pattern.test(test) === false) {

			const sourceLines: string[] = test.split(/\n|\r\n|\r/);

			return [{
				code: this.code,
				message: this.message,
				severity: this.severity,
				range: {
					start: { line: sourceLines.length, character: sourceLines[sourceLines.length - 1].length },
					end: { line: sourceLines.length, character: sourceLines[sourceLines.length - 1].length },
				},
				source: this.source()
			}];
		}

		return null;
	}

  evaluateAst(): Diagnostic[] | null {
    return null;
  }

}