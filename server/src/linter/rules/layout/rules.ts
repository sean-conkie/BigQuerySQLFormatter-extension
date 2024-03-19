/**
 * @fileoverview Linter rules for layout
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import { Rule } from '../base';
import { ServerSettings } from '../../../settings';
import { SelectModifiers } from './LT10';
import { UnionCheck } from './LT11';
import { EndofFile } from './LT12';
import { StartOfFile } from './LT13';

export function layoutRules(settings: ServerSettings, problems: number): Rule[] {
	return [
		new SelectModifiers(settings, problems),
		new UnionCheck(settings, problems),
		new EndofFile(settings, problems),
		new StartOfFile(settings, problems)
	];
}