/**
 * @fileoverview Linter rules for layout
 * @module linter/rules/layout
 * @requires vscode-languageserver
 * @requires settings
 * @requires Rule
 */

import { Rule } from '../base';
import { ServerSettings } from '../../../settings';
import { NotEqual } from './CV01';
import { Coalesce } from './CV02';
import { SelectTrailingComma } from './CV03';
import { Count } from './CV04';
import { IsNull } from './CV05';
import { LeftJoin } from './CV08';
import { AllDistinct } from './CV12';
import { SpacesNotTabs } from './CV13';
import { FileMap } from '../../parser';

export const classes = [NotEqual,
												Coalesce,
												SelectTrailingComma,
												Count,
												IsNull,
												LeftJoin,
												AllDistinct,
												SpacesNotTabs
											];

export function conventionRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {

	const length: number = classes.length;
	const rules: Rule<string | FileMap>[] = [];

	for (let i = 0; i < length; i++) {
		rules.push(new classes[i](settings, problems));
	}

	return rules;
}