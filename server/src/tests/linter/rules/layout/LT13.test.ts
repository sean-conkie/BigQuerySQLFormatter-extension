/**
 * @fileoverview Test suite for LT13 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { StartOfFile } from '../../../../linter/rules/layout/LT13';

describe('StartOfFile', () => {
    let instance: StartOfFile;

    beforeEach(() => {
        instance = new StartOfFile(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate('test');
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and pattern matches', () => {
        instance.enabled = true;
        const result = instance.evaluate(' select *\n  from table');
        expect(result).to.deep.equal([{
            code: instance.code,
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 1 }
            },
            source: instance.source
        }]);
    });

    it('should return null when rule is enabled but pattern does not match', () => {
        instance.enabled = true;
        const result = instance.evaluate('select *\n  from table');
        expect(result).to.be.null;
    });
});