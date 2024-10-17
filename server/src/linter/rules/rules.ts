import { ServerSettings } from '../../settings';
import { aliasRules } from './aliasing/rules';
import { ambiguousRules } from './ambiguous/rules';
import { capitalisationRules } from './capitalisation/rules';
import { conventionRules } from './convention/rules';
import { layoutRules } from './layout/rules';
import { structureRules } from './structure/rules';
import { Rule } from './base';
import { FileMap } from '../parser';


/**
 * Initialise the rules
 * @param {ServerSettings} settings The server settings
 * @param {integer} problems The number of problems identified in the source code
 * @returns {Rule<string | FileMap>[]} The rules to use
 * @memberof Linter
 * @name initialiseRuls
 */
export function initialiseRules(settings: ServerSettings, problems: number): Rule<string | FileMap>[] {
	return [
		...aliasRules(settings, problems),
		...ambiguousRules(settings, problems),
		...capitalisationRules(settings, problems),
		...conventionRules(settings, problems),
		...layoutRules(settings, problems),
		...structureRules(settings, problems)
	];
}