
import { Rule } from '../base';
import { ServerSettings } from '../../../settings';
import { RedundantColumnAlias } from './AL09';
import { FileMap } from '../../parser';

export const classes = [RedundantColumnAlias];

/**
 * Generates an array of aliasing rules based on the provided settings and problems count.
 *
 * @param settings - The server settings to be used for rule creation.
 * @param problems - The number of problems to be considered for rule creation.
 * @returns An array of aliasing rules.
 */
export function aliasRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {

	const length: number = classes.length;
	const rules: Rule<string | FileMap>[] = [];

	for (let i = 0; i < length; i++) {
		rules.push(new classes[i](settings, problems));
	}

	return rules;
}