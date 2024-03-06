import { Diagnostic } from 'vscode-languageserver';
import { Rule } from '../base';
import { RuleType } from '../enums';
import { OnigRegExp } from 'oniguruma';

export class EndofFile extends Rule{
  readonly is_fix_compatible: boolean = true;
  readonly name: string = "end_of_file";
  readonly code: string = "LT12";
  readonly type: RuleType = RuleType.REGEX;
  readonly message: string = "Files must end with a single trailing newline.";
  readonly pattern: RegExp = /./;
	strPattern = new OnigRegExp('\\S\n\\z'); // eslint-disable-line no-useless-escape
	matches: boolean = false;
	

	constructor(settings: any, problems: number) {
		super(settings, problems);
	}

	evaluate(test: string): Diagnostic | null {
		
		if (this.enabled === false) {
			return null;
		}

		this.strPattern.test(test, (error, matches) => {
			this.matches = matches;
		});

		if (this.matches === false) {

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

}