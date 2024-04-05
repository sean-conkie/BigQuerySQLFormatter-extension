import { Diagnostic } from 'vscode-languageserver';
import { Rule } from '../base';
import { RuleType } from '../enums';
import { OnigRegExp } from 'oniguruma';

export class EndofFile extends Rule{
  readonly name: string = "end_of_file";
  readonly code: string = "LT12";
  readonly message: string = "Files must end with a single trailing newline.";
  readonly pattern: RegExp = /\S\n$/;
	

	constructor(settings: any, problems: number) {
		super(settings, problems);
	}

	evaluate(test: string): Diagnostic | null {
		
		if (this.enabled === false) {
			return null;
		}

		if (this.pattern.test(test) === false) {

			const sourceLines: string[] = test.split(/\n|\r\n|\r/);

			return {
				message: this.message,
				severity: this.severity,
				range: {
					start: { line: sourceLines.length, character: sourceLines[sourceLines.length - 1].length },
					end: { line: sourceLines.length, character: sourceLines[sourceLines.length - 1].length },
				},
				source: this.name
			};
		}

		return null;
	}

  evaluateAst(): Diagnostic | null {
    return null;
  }

}