import { instantiateRules, type Rule, type RuleConstructor } from '../base';
import type { ServerSettings } from '../../../settings';
import type { FileMap } from '../../parser';
import { Keywords } from './RF04';

export const classes: readonly RuleConstructor[] = [Keywords];

export function referencesRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {
  return instantiateRules(classes, settings, problems);
}
