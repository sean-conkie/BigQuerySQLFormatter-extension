import { instantiateRules, type Rule } from '../base';
import type { ServerSettings } from '../../../settings';
import { Distinct } from './AM01';
import { ColumnCount } from './AM04';
import { UnionModifier } from './AM02';
import { ExplicitInnerJoin } from './AM05';
import { ColumnReferences } from './AM06';
import { SetColumns } from './AM07';
import type { FileMap } from '../../parser';

export const classes = [Distinct, UnionModifier, ColumnCount, ExplicitInnerJoin, ColumnReferences, SetColumns];

export function ambiguousRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {
  return instantiateRules(classes, settings, problems);
}
