/**
 * @fileoverview Tests for the rules module.
 */

import { expect } from 'chai';
import { initialiseRules } from '../../../linter/rules/rules';
import { aliasRules } from '../../../linter/rules/aliasing/rules';
import { ambiguousRules } from '../../../linter/rules/ambiguous/rules';
import { capitalisationRules } from '../../../linter/rules/capitalisation/rules';
import { conventionRules } from '../../../linter/rules/convention/rules';
import { layoutRules } from '../../../linter/rules/layout/rules';
import { structureRules } from '../../../linter/rules/structure/rules';
import { defaultSettings, ServerSettings } from '../../../settings'; // replace with your actual import

describe('initialiseRules', () => {
    let settings: ServerSettings;
    let problems: number;

    beforeEach(() => {
        settings = defaultSettings; // replace with your actual default settings
        problems = 0;
    });

    it('should return an array with the same content as the result of the rules', () => {
        const layoutRulesResult = [...aliasRules(settings, problems),
            ...ambiguousRules(settings, problems),
            ...capitalisationRules(settings, problems),
            ...conventionRules(settings, problems),
            ...layoutRules(settings, problems),
            ...structureRules(settings, problems)];
        const result = initialiseRules(settings, problems);
        expect(result).to.deep.equal(layoutRulesResult);
    });
});