import { instantiateRules, type Rule, type RuleConstructor } from '../base';
import type { ServerSettings } from '../../../settings';
import type { FileMap } from '../../parser';

export const classes: readonly RuleConstructor[] = [];

export function referencesRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {
  return instantiateRules(classes, settings, problems);
}
