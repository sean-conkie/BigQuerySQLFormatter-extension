/**
 * @fileoverview Linter rules for layout
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import { instantiateRules, type Rule } from '../base';
import type { ServerSettings } from '../../../settings';
import { ElseNull } from './ST01';
import { Distinct } from './ST08';
import { Using } from './ST07';
import { UnusedCte } from './ST03';
import { SimpleCase } from './ST02';
import { NestedCase } from './ST04';
import { JoinConditionOrder } from './ST09';
import type { FileMap } from '../../parser';

export const classes = [Distinct, ElseNull, Using, UnusedCte, SimpleCase, NestedCase, JoinConditionOrder];

export function structureRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {
  return instantiateRules(classes, settings, problems);
}
