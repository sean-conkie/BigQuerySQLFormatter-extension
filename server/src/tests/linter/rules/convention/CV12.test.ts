/**
 * @fileoverview Test suite for LT13 module
 */

import { expect } from 'chai';
import { defaultSettings } from '../../../../settings';
import { AllDistinct } from '../../../../linter/rules/convention/CV12';

describe('AllDistinct', () => {
    let instance: AllDistinct;

    beforeEach(() => {
        instance = new AllDistinct(defaultSettings, 0);
    });

    it('should return null when rule is disabled', () => {
        instance.enabled = false;
        const result = instance.evaluate('test');
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and pattern matches - union', () => {
        instance.enabled = true;
        const result = instance.evaluate('select a.col from dataset.table a\nunion\nselect b.col from dataset.table b');
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 1, character: 0 },
                end: { line: 2, character: 0 }
            },
            source: instance.source
        }]);
    });

    it('should return null when rule is enabled but pattern does not match - union distinct', () => {
        instance.enabled = true;
        const result = instance.evaluate('select a.col from dataset.table a\nunion distinct\nselect b.col from dataset.table b');
        expect(result).to.be.null;
    });

    it('should return null when rule is enabled but pattern does not match - union all', () => {
        instance.enabled = true;
        const result = instance.evaluate('select a.col from dataset.table a\nunion all\nselect b.col from dataset.table b');
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and pattern matches - except', () => {
        instance.enabled = true;
        const result = instance.evaluate('select a.col from dataset.table a\nexcept\nselect b.col from dataset.table b');
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 1, character: 0 },
                end: { line: 2, character: 0 }
            },
            source: instance.source
        }]);
    });

    it('should return null when rule is enabled but pattern does not match - except distinct', () => {
        instance.enabled = true;
        const result = instance.evaluate('select a.col from dataset.table a\nexcept distinct\nselect b.col from dataset.table b');
        expect(result).to.be.null;
    });

    it('should return diagnostic when rule is enabled and pattern matches - intersect', () => {
        instance.enabled = true;
        const result = instance.evaluate('select a.col from dataset.table a\nintersect\nselect b.col from dataset.table b');
        expect(result).to.deep.equal([{
            code: instance.diagnosticCode,
            codeDescription: {href: instance.diagnosticCodeDescription},
            message: instance.message,
            severity: instance.severity,
            range: {
                start: { line: 1, character: 0 },
                end: { line: 2, character: 0 }
            },
            source: instance.source
        }]);
    });

    it('should return null when rule is enabled but pattern does not match - intersect distinct', () => {
        instance.enabled = true;
        const result = instance.evaluate('select a.col from dataset.table a\nintersect distinct\nselect b.col from dataset.table b');
        expect(result).to.be.null;
    });
});