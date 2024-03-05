/**
 * @fileoverview Tests for the rules module.
 */

import { expect } from 'chai';
import { initialiseRules } from '../../../linter/rules/rules';
import * as layoutRules from '../../../linter/rules/layout/rules';
import { defaultSettings, ServerSettings } from '../../../settings'; // replace with your actual import

describe('initialiseRules', () => {
    let settings: ServerSettings;
    let problems: number;

    beforeEach(() => {
        settings = defaultSettings; // replace with your actual default settings
        problems = 0;
    });

    it('should return an array with the same content as the result of layoutRules', () => {
        const layoutRulesResult = layoutRules.layoutRules(settings, problems);
        const result = initialiseRules(settings, problems);
        expect(result).to.deep.equal(layoutRulesResult);
    });
});