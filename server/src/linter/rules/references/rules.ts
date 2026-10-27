import { instantiateRules, type Rule, type RuleConstructor } from '../base';
import type { ServerSettings } from '../../../settings';
import type { FileMap } from '../../parser';
import { Keywords } from './RF04';
import { SpecialCharacters } from './RF05';

export const classes: readonly RuleConstructor[] = [Keywords, SpecialCharacters];

export function referencesRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {
  return instantiateRules(classes, settings, problems);
}
