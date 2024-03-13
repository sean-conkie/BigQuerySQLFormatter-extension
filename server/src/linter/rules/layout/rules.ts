/**
 * @fileoverview Linter rules for layout
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import { Rule } from '../base';
import { ServerSettings } from '../../../settings';
import { UnionCheck } from './LT11';
import { StartOfFile } from './LT13';

export function layoutRules(settings: ServerSettings, problems: number): Rule[] {
	return [
		new UnionCheck(settings, problems),
		new StartOfFile(settings, problems)
	];
}