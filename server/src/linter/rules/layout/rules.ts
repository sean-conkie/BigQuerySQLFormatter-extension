/**
 * @fileoverview Linter rules for layout
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import { StartOfFile } from './LT13';
import { Rule } from '../base';
import { ServerSettings } from '../../../settings';

export function layoutRules(settings: ServerSettings, problems: number): Rule[] {
	return [
		new StartOfFile(settings, problems)
	];
}