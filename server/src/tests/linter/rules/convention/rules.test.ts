/**
 * @fileoverview Test suite for layoutRules module
 */

import { expect } from 'chai';
import { conventionRules } from '../../../../linter/rules/convention/rules';
import { classes } from '../../../../linter/rules/convention/rules';
import { defaultSettings } from '../../../../settings';

describe('conventionRules', () => {
    it('should return an array with a single instance of each rule', () => {
        const problems = 0;
        const result = conventionRules(defaultSettings, problems);
        const classes_length = classes.length;
        expect(result).to.be.an('array').that.has.lengthOf(classes_length);
        for (const [index, val] of classes.entries()) {
            expect(result[index]).to.be.an.instanceOf(val);
        }
    });

    it('should pass the settings and problems to the each constructor', () => {
        const problems = 5;
        const result = conventionRules(defaultSettings, problems);
        const length = result.length;
        for (let i = 0; i < length; i++){
            expect(result[i].settings).to.equal(defaultSettings);
            expect(result[i].problems).to.equal(problems);
        }
    });
});