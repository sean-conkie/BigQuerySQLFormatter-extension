/**
 * @fileoverview Tests for the rules module.
 */

import { expect } from 'chai';
import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { initialiseRules } from '../../../linter/rules/rules';
import { aliasRules } from '../../../linter/rules/aliasing/rules';
import { ambiguousRules } from '../../../linter/rules/ambiguous/rules';
import { capitalisationRules } from '../../../linter/rules/capitalisation/rules';
import { conventionRules } from '../../../linter/rules/convention/rules';
import { layoutRules } from '../../../linter/rules/layout/rules';
import { structureRules } from '../../../linter/rules/structure/rules';
import { defaultSettings, type ServerSettings } from '../../../settings'; // replace with your actual import

describe('initialiseRules', () => {
  let settings: ServerSettings;
  let problems: number;

  beforeEach(() => {
    settings = defaultSettings; // replace with your actual default settings
    problems = 0;
  });

  it('should return an array with the same content as the result of the rules', () => {
    const layoutRulesResult = [
      ...aliasRules(settings, problems),
      ...ambiguousRules(settings, problems),
      ...capitalisationRules(settings, problems),
      ...conventionRules(settings, problems),
      ...layoutRules(settings, problems),
      ...structureRules(settings, problems),
    ];
    const result = initialiseRules(settings, problems);
    expect(result).to.deep.equal(layoutRulesResult);
  });

  it('keeps every registered rule in its implementation folder', () => {
    const rulesDirectory = path.resolve(__dirname, '../../../linter/rules');
    for (const rule of initialiseRules(settings, problems)) {
      const folders = readdirSync(rulesDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .filter((entry) => existsSync(path.join(rulesDirectory, entry.name, `${rule.code}.js`)))
        .map((entry) => entry.name);
      expect(folders, rule.code).to.deep.equal([rule.ruleGroup]);
      expect(new URL(rule.diagnosticCodeDescription).pathname, rule.code).to.match(
        new RegExp(`/rules/${rule.ruleGroup}/${rule.code}\\.html$`),
      );
    }
  });

  it('uses the documented names and documentation groups', () => {
    const rules = initialiseRules(settings, problems);
    expect(rules.find((rule) => rule.code === 'CV08')?.diagnosticCode).to.equal('CV08: left_join');
    expect(rules.find((rule) => rule.code === 'LT01')?.diagnosticCode).to.equal('LT01: trailing_spaces');
    expect(rules.find((rule) => rule.code === 'ST07')?.ruleUrl).to.match(/\/rules\/structure\/ST07\.html$/);
  });
});
