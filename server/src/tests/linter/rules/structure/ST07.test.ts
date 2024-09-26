/**
 * @fileoverview Test suite for LT13 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { Using } from '../../../../linter/rules/structure/ST07';

describe('Using', () => {
    let instance: Using;

    beforeEach(() => {
        instance = new Using(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate('test');
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and pattern matches', () => {
        instance.enabled = true;
        const result = instance.evaluate('select a.b from dataset.table a join dataset.table b using (key)');
        expect(result).to.deep.equal([{
            code: instance.code,
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 32 },
                end: { line: 0, character: 58 }
            },
            source: instance.source()
        }]);
    });

    it('should return null when rule is enabled but pattern does not match', () => {
        instance.enabled = true;
        const result = instance.evaluate('select a.b from dataset.table a join dataset.table b on a.key = b.key');
        expect(result).to.be.null;
    });
});