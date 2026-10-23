import { instantiateRules, type Rule } from '../base';
import type { ServerSettings } from '../../../settings';
import { Literals } from './CP04';
import type { FileMap } from '../../parser';

export const classes = [Literals];

export function capitalisationRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {
  return instantiateRules(classes, settings, problems);
}
