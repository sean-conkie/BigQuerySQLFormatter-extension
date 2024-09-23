/**
 * @fileoverview Test suite for LT06 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { Functions } from '../../../../linter/rules/layout/LT06';
import { FileMap, StatementAST, Parser } from '../../../../linter/parser';

describe('Functions', () => {
    let instance: Functions;

    beforeEach(() => {
        instance = new Functions(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate({1: new StatementAST()} as FileMap);
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and there is a space between function and parenthesis', async () => {
        instance.enabled = true;


        const parser = new Parser();

        const result = instance.evaluate(await parser.parse('SELECT cast (1 as string),\n col2\n FROM table'));
        expect(result).to.deep.equal([{
            code: instance.code,
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 11 },
                end: { line: 0, character: 12 }
            },
            source: instance.source()
        }]);
    });

    it('should return null when rule is enabled but pattern does not match', async () => {
        instance.enabled = true;

        const parser = new Parser();

        const result = instance.evaluate(await parser.parse('SELECT cast(1 as string),\n col2\n FROM table'));
        expect(result).to.be.null;
    });
});