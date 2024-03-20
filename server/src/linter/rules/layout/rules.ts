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

export const classes = [SelectModifiers,
                        UnionCheck,
                        EndofFile,
                        StartOfFile];

export function layoutRules(settings: ServerSettings, problems: number): Rule[] {

	const length: number = classes.length;
	const rules: Rule[] = [];

	for (let i = 0; i < length; i++) {
		rules.push(new classes[i](settings, problems));
	}

	return rules;
}