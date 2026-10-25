/**
 * @fileoverview Linter rules for layout
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import { instantiateRules, type Rule } from '../base';
import type { ServerSettings } from '../../../settings';
import { NotEqual } from './CV01';
import { Coalesce } from './CV02';
import { SelectTrailingComma } from './CV03';
import { Count } from './CV04';
import { IsNull } from './CV05';
import { Terminator } from './CV06';
import { LeftJoin } from './CV08';
import { AllDistinct } from './CV12';
import { SpacesNotTabs } from './CV13';
import type { FileMap } from '../../parser';

export const classes = [
  NotEqual,
  Coalesce,
  SelectTrailingComma,
  Count,
  IsNull,
  Terminator,
  LeftJoin,
  AllDistinct,
  SpacesNotTabs,
];

export function conventionRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {
  return instantiateRules(classes, settings, problems);
}
