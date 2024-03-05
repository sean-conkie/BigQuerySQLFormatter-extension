
/**
 * Enum for the type of rule
 * @enum {string}
 * @readonly
 * @memberof Linter
 * @name RuleType
 * @property {string} PARSER - The rule is a parser rule
 * @property {string} REGEX - The rule is a regex rule, can be executed on the source code
 */
export enum RuleType {
	PARSER = 'parser',
	REGEX = 'regex'
}