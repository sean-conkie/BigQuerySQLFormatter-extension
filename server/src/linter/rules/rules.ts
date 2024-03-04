/**
 * @fileoverview Collates and exports the rules for the linter
 * @module linter/rules
 * @requires vscode-languageserver
 * @requires settings
 * @requires RuleType
 */

import { ServerSettings } from '../../settings';
import {
	integer
} from 'vscode-languageserver/node';
import { layoutRules } from './layout/rules';
import { Rule } from './base';

/**
 * Initialise the rules
 * @param {ServerSettings} settings The server settings
 * @param {integer} problems The number of problems identified in the source code
 * @returns {Rule[]} The rules to use
 * @memberof Linter
 * @name initialiseRuls
 */
export function initialiseRules(settings: ServerSettings, problems: integer): Rule[] {
	return [
		...layoutRules(settings, problems)
	];
}