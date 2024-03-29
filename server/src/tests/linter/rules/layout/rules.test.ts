/**
 * @fileoverview Test suite for layoutRules module
 */

import { expect } from 'chai';
import { layoutRules } from '../../../../linter/rules/layout/rules';
import { SelectModifiers } from '../../../../linter/rules/layout/LT10';
import { UnionCheck } from '../../../../linter/rules/layout/LT11';
import { EndofFile } from '../../../../linter/rules/layout/LT12';
import { StartOfFile } from '../../../../linter/rules/layout/LT13';
import { defaultSettings } from '../../../../settings';

describe('layoutRules', () => {
    it('should return an array with a single instance of each rule', () => {
        const problems = 0;
        const result = layoutRules(defaultSettings, problems);
        expect(result).to.be.an('array').that.has.lengthOf(4);
        expect(result[0]).to.be.an.instanceOf(SelectModifiers);
        expect(result[1]).to.be.an.instanceOf(UnionCheck);
        expect(result[2]).to.be.an.instanceOf(EndofFile);
        expect(result[3]).to.be.an.instanceOf(StartOfFile);
    });

    it('should pass the settings and problems to the each constructor', () => {
        const problems = 5;
        const result = layoutRules(defaultSettings, problems);
        const length = result.length;
        for (let i = 0; i < length; i++){
            expect(result[i].settings).to.equal(defaultSettings);
            expect(result[i].problems).to.equal(problems);
        }
    });
});
