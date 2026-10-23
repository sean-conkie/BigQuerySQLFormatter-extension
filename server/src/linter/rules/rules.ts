import type { ServerSettings } from '../../settings';
import { classes as aliasing } from './aliasing/rules';
import { classes as ambiguous } from './ambiguous/rules';
import { classes as capitalisation } from './capitalisation/rules';
import { classes as convention } from './convention/rules';
import { classes as layout } from './layout/rules';
import { classes as structure } from './structure/rules';
import { instantiateRules, type Rule } from './base';
import type { FileMap } from '../parser';

export const ruleRegistry = [...aliasing, ...ambiguous, ...capitalisation, ...convention, ...layout, ...structure];

/**
 * Initialise the rules
 * @param {ServerSettings} settings The server settings
 * @param {integer} problems The number of problems identified in the source code
 * @returns {Rule<string | FileMap>[]} The rules to use
 * @memberof Linter
 * @name initialiseRuls
 */
export function initialiseRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {
  return instantiateRules(ruleRegistry, settings, problems);
}
