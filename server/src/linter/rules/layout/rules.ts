/**
 * @fileoverview Linter rules for layout
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import { instantiateRules, type Rule } from '../base';
import type { ServerSettings } from '../../../settings';
import { TrailingSpaces } from './LT01';
import { Indent } from './LT02';
import { TrailingComma } from './LT04';
import { Functions } from './LT06';
import { CteBracket } from './LT07';
import { SelectTargets } from './LT09';
import { SelectModifiers } from './LT10';
import { UnionCheck } from './LT11';
import { EndOfFile } from './LT12';
import { StartOfFile } from './LT13';
import { ComparisonOperators } from './LT15';
import type { FileMap } from '../../parser';

export const classes = [
  TrailingSpaces,
  Indent,
  TrailingComma,
  Functions,
  CteBracket,
  SelectTargets,
  SelectModifiers,
  UnionCheck,
  EndOfFile,
  StartOfFile,
  ComparisonOperators,
];

export function layoutRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {
  return instantiateRules(classes, settings, problems);
}
