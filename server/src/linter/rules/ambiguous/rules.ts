import { Rule } from '../base';
import { ServerSettings } from '../../../settings';
import { Distinct } from './AM01';
import { ColumnCount } from './AM04';
import { FileMap } from '../../parser';

export const classes = [Distinct, ColumnCount];

export function ambiguousRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {

	const length: number = classes.length;
	const rules: Rule<string | FileMap>[] = [];

	for (let i = 0; i < length; i++) {
		rules.push(new classes[i](settings, problems));
	}

	return rules;
}