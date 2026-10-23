import { expect } from 'chai';
import { Linter } from '../../linter/linter';
import { RuleType } from '../../linter/rules/enums';
import {
	Diagnostic
} from 'vscode-languageserver/node';
import { defaultSettings, ServerSettings } from '../../settings';
import { initialiseRules } from '../../linter/rules/rules';
import { globalTokenCache } from '../../linter/parser/tokenCache';

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
        const source = {text:'select case when cc.enddate is null then 1 else null end as is_current, -- noqa\n  from dataset.table cc;\n', uri: 'test.sql', languageId: 'sql', version: 0};
        const result = await linter.verify(source);
        expect(result.length).to.be.equal(0);
    });

    it('should ignore only rules mentioned for lines with directives', async () => {
        const source = {text:'select case when cc.enddate is null then 1 else null end as  is_current -- noqa: ST01\n  from dataset.table cc;\n', uri: 'test.sql', languageId: 'sql', version: 0};
        const result = await linter.verify(source);
        expect(result.length).to.be.equal(1);
    });

    it('updates parser diagnostics when a block comment is opened and removed', async () => {
        const uri = 'comment-diagnostics.sql';
        try {
            linter.regexRules = [];
            const diagnostics = await linter.verify({
                text: 'select t.col1\n  from dataset.table as t;\n', uri, languageId: 'googlesql', version: 0
            });

            for (const directive of ['-- NOQA', '--noqa', '--  noqa', '--\tNoQa']) {
                it(`suppresses all diagnostics with ${directive}`, async () => {
                    const result = await linter.verify({
                        text: `select a = null ${directive}\n`, uri: 'directives.sql', languageId: 'googlesql', version: 1
                    });
                    expect(result).to.deep.equal([]);
                });
            }

            it('compares comma-separated rule codes exactly and case-insensitively', async () => {
                const source = { text: 'select a = null -- noqa: LT01, cv05\n', uri: 'directives.sql', languageId: 'googlesql', version: 1 };
                const filtered = await linter.verify(source);
                expect(filtered.some(d => String(d.code).startsWith('CV05:'))).to.equal(false);
                const partial = await linter.verify({ ...source, text: 'select a = null -- noqa: CV0\n' });
                expect(partial.some(d => String(d.code).startsWith('CV05:'))).to.equal(true);
            });

            it('does not treat strings or preceding lines as directives', async () => {
                const result = await linter.verify({
                    text: "select '-- noqa' as txt, a = null\n-- noqa:\nselect b = null\n",
                    uri: 'directives.sql', languageId: 'googlesql', version: 1
                });
                expect(result.filter(d => String(d.code).startsWith('CV05:')).map(d => d.range.start.line)).to.deep.equal([0, 2]);
            });
            expect(diagnostics.some(diagnostic => String(diagnostic.code).includes('AL01'))).to.equal(true);
            const commented = await linter.verifyChanges({
                textDocument: {uri, version: 1},
                contentChanges: [{
                    range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}}, text: '/*'
                }]
            });
            expect(commented).to.deep.equal([]);
            const uncommented = await linter.verifyChanges({
                textDocument: {uri, version: 2},
                contentChanges: [{
                    range: {start: {line: 0, character: 0}, end: {line: 0, character: 2}}, text: ''
                }]
            });
            expect(uncommented).to.deep.equal(diagnostics);
        } finally {
            globalTokenCache.delete(uri);
        }
    });
});