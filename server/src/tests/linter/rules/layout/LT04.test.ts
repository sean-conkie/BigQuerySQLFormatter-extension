/**
 * @fileoverview Test suite for LT04 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { TrailingComma } from '../../../../linter/rules/layout/LT04';
import { FileMap, StatementAST, Parser } from '../../../../linter/parser';

describe('TrailingComma', () => {
    let instance: TrailingComma;

    beforeEach(() => {
        instance = new TrailingComma(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate({1: new StatementAST()} as FileMap);
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and comma is at start of line', async () => {
        instance.enabled = true;


        const parser = new Parser();

        const result = instance.evaluate(await parser.parse('SELECT col1\n ,col2\n FROM table'));
        expect(result).to.deep.equal([{
            code: instance.code,
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 1, character: 1 },
                end: { line: 1, character: 2 }
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