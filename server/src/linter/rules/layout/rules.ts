/**
 * @fileoverview Linter rules for layout
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import { start_of_file } from './LT13';
import { Rule } from '../base';
import { ServerSettings } from '../../../settings';
import { integer } from 'vscode-languageserver';

export function layoutRules(settings: ServerSettings, problems: integer): Rule[] {
	return [
		new start_of_file(settings, problems)
	];
}