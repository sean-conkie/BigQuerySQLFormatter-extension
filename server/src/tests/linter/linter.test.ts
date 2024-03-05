import { expect } from 'chai';
import { Linter } from '../../linter/linter';
import { RuleType } from '../../linter/rules/enums';
import {
	Diagnostic
} from 'vscode-languageserver/node';
import { defaultSettings, ServerSettings } from '../../settings';
import { initialiseRules } from '../../linter/rules/rules';

describe('Linter', () => {
    let settings: ServerSettings;
    let linter: Linter;

    beforeEach(() => {
        settings = defaultSettings; // replace with your actual default settings
        linter = new Linter(settings);
    });

    it('should initialise rules on construction', () => {
        const rules = initialiseRules(settings, 0);
        const regexRules = rules.filter(rule => rule.type === RuleType.REGEX);
        const parserRules = rules.filter(rule => rule.type === RuleType.PARSER);
        expect(linter.regexRules).to.deep.equal(regexRules);
        expect(linter.parserRules).to.deep.equal(parserRules);
    });

    it('should verify source code and return diagnostics', () => {
        const source = 'select * from table';
        const diagnostics: Diagnostic[] = [];
        for (const rule of linter.regexRules) {
            const result = rule.evaluate(source);
            if (result !== null) {
                diagnostics.push(result);
            }
        }
        const result = linter.verify(source);
        expect(result).to.deep.equal(diagnostics);
    });

    it('should increment problems for each diagnostic', () => {
        const source = '\nselect *\nfrom table';
        const diagnostics: Diagnostic[] = [];
        for (const rule of linter.regexRules) {
            const result = rule.evaluate(source);
            if (result !== null) {
                diagnostics.push(result);
            }
        }
        linter.verify(source);
        expect(linter.problems).to.equal(diagnostics.length);
    });
});