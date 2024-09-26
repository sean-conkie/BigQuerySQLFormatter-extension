/**
 * @fileoverview Linter rules for layout
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import { Rule } from '../base';
import { ServerSettings } from '../../../settings';
import { TrailingSpaces } from './LT01';
import { TrailingComma } from './LT04';
import { Functions } from './LT06';
import { SelectTargets } from './LT09';
import { SelectModifiers } from './LT10';
import { UnionCheck } from './LT11';
import { EndofFile } from './LT12';
import { StartOfFile } from './LT13';
import { ComparisonOperators } from './LT15';
import { FileMap } from '../../parser';

export const classes = [SelectModifiers,
												SelectTargets,
                        UnionCheck,
												TrailingComma,
                        EndofFile,
                        StartOfFile,
                        TrailingSpaces,
												Functions,
												ComparisonOperators];

export function layoutRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {

	const length: number = classes.length;
	const rules: Rule<string | FileMap>[] = [];

	for (let i = 0; i < length; i++) {
		rules.push(new classes[i](settings, problems));
	}

	return rules;
}