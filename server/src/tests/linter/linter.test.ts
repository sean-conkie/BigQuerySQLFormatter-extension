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

    it('should verify source code and return diagnostics', async () => {
        const source = {text:'\nselect col\nfrom dataset.table', uri: 'test.sql', languageId: 'sql', version: 0};
        const result = await linter.verify(source);
        expect(result.length).to.be.greaterThan(0);
    });

    it('should increment problems for each diagnostic', async () => {
        const source = {text:'\nselect col\nfrom dataset.table', uri: 'test.sql', languageId: 'sql', version: 0};
        await linter.verify(source);
        expect(linter.problems).to.be.greaterThan(0);
    });

    it('should ignore rules for lines with directives', async () => {
        const source = {text:'select case when cc.enddate is null then 1 else null end as is_current, -- noqa\nfrom dataset.table cc;\n', uri: 'test.sql', languageId: 'sql', version: 0};
        const result = await linter.verify(source);
        expect(result.length).to.be.equal(0);
    });

    it('should ignore only rules mentioned for lines with directives', async () => {
        const source = {text:'select case when cc.enddate is null then 1 else null end as is_current, -- noqa: ST01\nfrom dataset.table cc;\n', uri: 'test.sql', languageId: 'sql', version: 0};
        const result = await linter.verify(source);
        expect(result.length).to.be.equal(1);
    });
});