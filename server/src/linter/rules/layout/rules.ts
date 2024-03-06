/**
 * @fileoverview Linter rules for layout
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import { Rule } from '../base';
import { ServerSettings } from '../../../settings';
import { EndofFile } from './LT12';
import { StartOfFile } from './LT13';

export function layoutRules(settings: ServerSettings, problems: number): Rule[] {
	return [
		new StartOfFile(settings, problems),
		new EndofFile(settings, problems)
	];
}