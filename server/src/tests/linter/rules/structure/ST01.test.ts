/**
 * @fileoverview Test suite for LT13 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { ElseNull } from '../../../../linter/rules/structure/ST01';

describe('ElseNull', () => {
    let instance: ElseNull;

    beforeEach(() => {
        instance = new ElseNull(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate('test');
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and pattern matches', () => {
        instance.enabled = true;
        const result = instance.evaluate('select case when col1 = 1 then 2 else null end col from table');
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 33 },
                end: { line: 0, character: 42 }
            },
            source: instance.source,
            tags: [1]
        }]);
    });

    it('should return null when rule is enabled but pattern does not match', () => {
        instance.enabled = true;
        const result = instance.evaluate('select case when col1 = 1 then 2 end col from table');
        expect(result).to.be.null;
    });
});