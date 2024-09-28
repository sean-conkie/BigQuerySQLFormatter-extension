/**
 * @fileoverview Test suite for LT13 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { LeftJoin } from '../../../../linter/rules/convention/CV08';

describe('LeftJoin', () => {
    let instance: LeftJoin;

    beforeEach(() => {
        instance = new LeftJoin(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate('test');
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and pattern matches', () => {
        instance.enabled = true;
        const result = instance.evaluate('select a.col, b.col from dataset.table a right join dataset.table b on a.col = b.col');
        expect(result).to.deep.equal([{
            code: instance.code,
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 41 },
                end: { line: 0, character: 51 }
            },
            source: instance.source
        }]);
    });

    it('should return null when rule is enabled but pattern does not match', () => {
        instance.enabled = true;
        const result = instance.evaluate('select a.col, b.col from dataset.table a left join dataset.table b on a.col = b.col');
        expect(result).to.be.null;
    });
});