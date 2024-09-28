/**
 * @fileoverview Test suite for LT04 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { RedundantColumnAlias } from '../../../../linter/rules/aliasing/AL09';
import { FileMap, Parser } from '../../../../linter/parser';
import { StatementAST } from '../../../../linter/parser/ast';

describe('RedundantColumnAlias', () => {
    let instance: RedundantColumnAlias;

    beforeEach(() => {
        instance = new RedundantColumnAlias(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate({1: new StatementAST()} as FileMap);
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and alias is redundant', async () => {
        instance.enabled = true;


        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'SELECT col1 as col1,col2\n FROM table', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.deep.equal([{
            code: instance.code,
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 15 },
                end: { line: 0, character: 19 }
            },
            source: instance.source,
            tags: [1]
        }]);
    });

    it('should return null when rule is enabled but pattern does not match', async () => {
        instance.enabled = true;

        const parser = new Parser();

        const result = instance.evaluate(await parser.parse({text:'SELECT col1,\n col2\n FROM table', uri: 'test.sql', languageId: 'sql', version: 0}));
        expect(result).to.be.null;
    });
});