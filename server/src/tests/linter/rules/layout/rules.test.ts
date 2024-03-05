
/**
 * @fileoverview Test suite for layoutRules module
 */

import { expect } from 'chai';
import { layoutRules } from '../../../../linter/rules/layout/rules';
import { StartOfFile } from '../../../../linter/rules/layout/LT13';
import { defaultSettings } from '../../../../settings';

describe('layoutRules', () => {
    it('should return an array with a single instance of StartOfFile', () => {
        const problems = 0;
        const result = layoutRules(defaultSettings, problems);
        expect(result).to.be.an('array').that.has.lengthOf(1);
        expect(result[0]).to.be.an.instanceOf(StartOfFile);
    });

    it('should pass the settings and problems to the StartOfFile constructor', () => {
        const problems = 5;
        const result = layoutRules(defaultSettings, problems);
        expect(result[0].settings).to.equal(defaultSettings);
        expect(result[0].problems).to.equal(problems);
    });
});