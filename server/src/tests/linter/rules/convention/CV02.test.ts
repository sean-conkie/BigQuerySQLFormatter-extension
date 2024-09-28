/**
 * @fileoverview Test suite for LT13 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { Coalesce } from '../../../../linter/rules/convention/CV02';

describe('Coalesce', () => {
    let instance: Coalesce;

    beforeEach(() => {
        instance = new Coalesce(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate('test');
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and pattern matches', () => {
        instance.enabled = true;
        const result = instance.evaluate('select ifnull(a.col, b.col) from dataset.table a left join dataset.table b on a.col = b.col');
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 0, character: 7 },
                end: { line: 0, character: 14 }
            },
            source: instance.source
        }]);
    });

    it('should return null when rule is enabled but pattern does not match', () => {
        instance.enabled = true;
        const result = instance.evaluate('select coalesce(a.col, b.col) from dataset.table a left join dataset.table b on a.col = b.col');
        expect(result).to.be.null;
    });
});