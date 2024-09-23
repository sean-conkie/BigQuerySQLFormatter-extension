/**
 * @fileoverview Test suite for LT04 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { SelectTargets } from '../../../../linter/rules/layout/LT09';
import { FileMap, StatementAST, Parser } from '../../../../linter/parser';

describe('SelectTargets', () => {
    let instance: SelectTargets;

    beforeEach(() => {
        instance = new SelectTargets(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate({1: new StatementAST()} as FileMap);
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and single line select', async () => {
        instance.enabled = true;


        const parser = new Parser();

        const result = instance.evaluate(await parser.parse('SELECT col1, col2\n FROM table'));
        expect(result).to.deep.equal([{
            code: instance.code,
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 7 },
                end: { line: 0, character: 17 }
            },
            source: instance.source()
        }]);
    });

    it('should return null when rule is enabled but pattern does not match', async () => {
        instance.enabled = true;

        const parser = new Parser();

        const result = instance.evaluate(await parser.parse('SELECT col1,\n col2\n FROM table'));
        expect(result).to.be.null;
    });
});