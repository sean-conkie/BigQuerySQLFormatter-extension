/**
 * @fileoverview Test suite for LT13 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { ColumnCount } from '../../../../linter/rules/ambiguous/AM04';

describe('ColumnCount', () => {
    let instance: ColumnCount;

    beforeEach(() => {
        instance = new ColumnCount(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate('test');
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and pattern matches', () => {
        instance.enabled = true;
        const result = instance.evaluate('select * from table');
        const range = {
            start: { line: 0, character: 7 },
            end: { line: 0, character: 8 }
        };
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: range,
            source: instance.source
        }]);
    });

    it('should return diagnostic when rule is enabled and pattern matches - alias', () => {
        instance.enabled = true;
        const result = instance.evaluate('select t.* from table t');
        const range = {
            start: { line: 0, character: 7 },
            end: { line: 0, character: 10 }
        };
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: range,
            source: instance.source
        }]);
    });

    it('should return null when rule is enabled but pattern does not match', () => {
        instance.enabled = true;
        const result = instance.evaluate('select col from table');
        expect(result).to.be.null;
    });
});