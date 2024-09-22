/**
 * @fileoverview Parser for the BigQuery SQL.
 * @module parser
 */

import { mergeArrayToUnique } from '../utils';
import syntaxJson from './syntaxes/syntax.json';
import { GrammarLoader, Grammar, GrammarToken, GrammarTokenizeLineResult } from './grammarLoader';

const punctuation: string[] = syntaxJson.punctuation;
const skipTokens: string[] = syntaxJson.skipTokens;
const recursiveGroupBegin: string[] = syntaxJson.recursiveGroupBegin;
const recursiveGroupEnd: string[] = syntaxJson.recursiveGroupEnd;
const syntaxRules: Rule[] = syntaxJson.rules;
const comparisonGroupRules: string[] = syntaxJson.comparisonGroupRules;

// #region Enums
enum StatementType {
	SELECT = 'select',
	INSERT = 'insert',
	UPDATE = 'update',
	DELETE = 'delete',
	CREATE = 'create',
	DROP = 'drop',
	ALTER = 'alter',
	TRUNCATE = 'truncate',
	MERGE = 'merge',
	WRITE_TRUNCATE = 'write_truncate',
	WRITE_APPEND = 'write_append',
	WRITE_EMPTY = 'write_empty',
	CALL = 'call',
}

enum JoinType {
	INNER = 'inner',
	LEFT = 'left',
	RIGHT = 'right',
	FULL = 'full',
	CROSS = 'cross',
}

enum LogicalOperator {
	AND = 'and',
	OR = 'or',
	ON = 'on',
	WHERE = 'where',
	USING = 'using',
}

enum ComparisonOperator {
	EQUAL = '=',
	NOT_EQUAL = '!=',
	GREATER_THAN = '>',
	GREATER_THAN_OR_EQUAL = '>=',
	LESS_THAN = '<',
	LESS_THAN_OR_EQUAL = '<=',
	NOT_EQUAL_ALT = '<>',
}

// #endregion

// #region Types

type ASTPosition = {
	lineNumber: number | null,
	startIndex: number | null,
	endIndex: number | null,
};

export class Token extends GrammarToken {
	value: string;
	lineNumber: number | null = null;

	constructor(scopes: string[], startIndex: number, endIndex: number, value: string, lineNumber: number | null = null) {
		super(scopes, startIndex, endIndex);
		this.value = value;
		this.lineNumber = lineNumber;
	}

	static fromGrammarToken(grammarToken: GrammarToken, sourceLine: string, lineNumber: number | null = null): Token {
		const value = sourceLine.substring(grammarToken.startIndex, grammarToken.endIndex);
		return new Token(grammarToken.scopes, grammarToken.startIndex, grammarToken.endIndex, value, lineNumber);
	}

}

class LineToken extends GrammarToken {
	value: string;
	lineNumber: number | null = null;
	tokens: Token[] = [];


	constructor(scopes: string[], startIndex: number, endIndex: number, value: string, lineNumber: number | null = null, tokens: Token[] = []) {
		super(scopes, startIndex, endIndex);
		this.value = value;
		this.lineNumber = lineNumber;
		this.tokens = tokens;
	}

	static fromGrammarTokens(grammarTokens: GrammarToken[], sourceLine: string, lineNumber: number | null = null): LineToken {
		const tokens: Token[] = [];
		for (const token of grammarTokens) {
			if (token.startIndex === undefined || token.endIndex === undefined) {
				throw new Error('Token does not have start and end indexes');
			}
			tokens.push(Token.fromGrammarToken(token, sourceLine, lineNumber));
		}

		return new LineToken(
			tokens.reduce((p, token) => mergeArrayToUnique(p, token.scopes), [] as string[]),
			grammarTokens[0].startIndex,
			grammarTokens[grammarTokens.length - 1].endIndex,
			sourceLine.substring(grammarTokens[0].startIndex, grammarTokens[grammarTokens.length - 1].endIndex),
			lineNumber,
			tokens
		);

	}

}

interface AST extends ASTPosition {
	"tokens": Token[]

}

type Column = ColumnAST | ColumnFunctionAST | StatementAST | StringAST | NumberAST | KeywordAST | CaseStatementAST;

type FunctionParameter = Column | KeywordAST;

type Rule = {
	name: string,
	scopes: string[],
	type: string,
	lookahead: number,
	negativeLookahead: string[] | null,
	recursive: boolean,
	children: string[] | null,
	end: string[] | null
}

type Comparison = {
	left: Column | ArrayAST | null,
	operator: ComparisonOperator | null,
	right: Column | ArrayAST | null,
	logicalOperator: LogicalOperator | null
}

/**
 * An object to store the match object when splitting the source code into statements
 * @typedef {Object} MatchObj
 * @property {number} end The end index of the statement
 * @property {number} start The start index of the statement
 * @property {string} statement The statement
 * @memberof Parser
 * @name MatchObj
 */
type MatchObj = { end: number, start: number, statement: string, line: number };

type MatchedRule = { "rule": Rule | null, "tokens": Token[], "matches"?: MatchedRule[] };


export class ColumnAST implements AST {
	source: string | null = null;
	column: string | null = null;
	alias: string | null = null;
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor(matchedRule: MatchedRule) {
		this.tokens = matchedRule.tokens;

		if (matchedRule.matches != null && matchedRule.matches.length > 0) {
			this.tokens.push(...matchedRule.matches[0].tokens);
		}

		this.tokens = Parser.sortTokens(this.tokens);

		this.source = findToken(matchedRule.tokens, "entity.name.alias.sql")?.value ?? null;
		this.column = findToken(matchedRule.tokens, "entity.other.column.sql")?.value ?? null;
		this.alias = findToken(matchedRule.tokens, "entity.name.tag")?.value ?? null;
		this.lineNumber = matchedRule.tokens[0].lineNumber;
		this.startIndex = matchedRule.tokens[0].startIndex;
		this.endIndex = matchedRule.tokens[matchedRule.tokens.length - 1].endIndex;
	}
}

class StringAST implements AST {
	value: string | null = null;
	tokens: Token[] = [];
	alias: string | null = null;
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.value = tokens.map((token) => token.value).join('');
		this.alias = findToken(tokens, "entity.name.tag")?.value ?? null;
		this.lineNumber = tokens[0].lineNumber;
		this.startIndex = tokens[0].startIndex;
		this.endIndex = tokens[tokens.length - 1].endIndex;
	}
}

class NumberAST implements AST {
	value: number | null = null;
	tokens: Token[] = [];
	alias: string | null = null;
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.value = Number(tokens.map((token) => token.value).join(''));
		this.alias = findToken(tokens, "entity.name.tag")?.value ?? null;
		this.lineNumber = tokens[0].lineNumber;
		this.startIndex = tokens[0].startIndex;
		this.endIndex = tokens[tokens.length - 1].endIndex;
	}
}

class KeywordAST implements AST {
	value: string | null = null;
	tokens: Token[] = [];
	alias: string | null = null;
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.value = tokens.map((token) => token.value).join('');
		this.alias = findToken(tokens, "entity.name.tag")?.value ?? null;
		this.lineNumber = tokens[0].lineNumber;
		this.startIndex = tokens[0].startIndex;
		this.endIndex = tokens[tokens.length - 1].endIndex;
	}
}

class OrderAST implements AST {
	column: Column | null = null;
	direction: string | null = null;
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

}

class WindowAST implements AST {
	partition: Column[] = [];
	order: OrderAST[] = [];
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor(match: MatchedRule) {
		const emptyMatch = { rule: null, tokens: [], matches: [] };
		const partitionByIndex = match.matches?.indexOf(match.matches?.find((match) => match.rule?.name === "keyword.partition") ?? emptyMatch) ?? 0;
		const orderByIndex = match.matches?.indexOf(match.matches?.find((match) => match.rule?.name === "keyword.order") ?? emptyMatch) ?? match.matches?.length;

		const partitionMatches = match.matches?.slice(partitionByIndex + 1, orderByIndex);
		const orderMatches = match.matches?.slice((orderByIndex ?? 0) + 1);

		this.partition = partitionMatches?.map((match) => createColumn(match) ?? null).filter((column) => column !== null) as Column[];
		this.order = orderMatches?.map((match) => new OrderAST()) ?? [];

	}
}

class ColumnFunctionAST implements AST {
	function: string | null = null;
	parameters: FunctionParameter[] = [];
	over: WindowAST | null = null;
	alias: string | null = null;
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor(matchedRule: MatchedRule) {
		this.function = matchedRule.tokens.filter((token) => token.scopes.includes("meta.function.sql"))[0].value;
		this.tokens.push(...matchedRule.tokens);
		this.lineNumber = matchedRule.tokens[0].lineNumber;
		this.startIndex = matchedRule.tokens[0].startIndex;

		// Special rules have been created for columns being cast as a type - these need split into column
		// and keyword and inserted into the matches array.
		const specialMatches = matchedRule.matches?.filter((match) => match.rule?.type === 'special') ?? [];

		specialMatches.forEach((match) => {
			const indexOfMatch = matchedRule.matches?.indexOf(match) ?? 0;
			const slicePoint = match.tokens.findIndex((token) => token.scopes.includes("keyword.as.sql"));

			const keywordTokens = match.tokens.slice(slicePoint);
			const columnTokens = match.tokens.slice(0, slicePoint);
			matchedRule.matches?.splice(indexOfMatch, 1, {
				"rule": {
					"type": "column",
					"name": "special.column",
					"scopes": [],
					"lookahead": 0,
					"negativeLookahead": null,
					"recursive": false,
					"children": null,
					"end": null
				}, "tokens": columnTokens
			});

			matchedRule.matches?.splice(indexOfMatch + 1, 0, {
				"rule": {
					"type": "keyword",
					"name": "special.keyword",
					"scopes": [],
					"lookahead": 0,
					"negativeLookahead": null,
					"recursive": false,
					"children": null,
					"end": null
				}, "tokens": keywordTokens
			});

		});

		// window functions may contain an alias - pop it to the
		// function level matches
		const window: MatchedRule | null = matchedRule.matches?.find((match) => match.rule?.type === 'over') ?? null;
		if (window) {
			const alias = window.matches?.find((match) => match.rule?.type === 'alias') ?? null;
			if (alias) {
				matchedRule.matches?.push(alias);
			}
		}


		for (const match of matchedRule.matches ?? []) {
			let parameter: FunctionParameter | null = null;
			if (match.rule?.type === 'column') {
				parameter = new ColumnAST(match);
			} else if (match.rule?.type === 'function') {
				parameter = new ColumnFunctionAST(match);
			} else if (match.rule?.type === 'string') {
				parameter = new StringAST(match.tokens);
			} else if (match.rule?.type === 'number') {
				parameter = new NumberAST(match.tokens);
			} else if (['comparison', 'keyword', 'operator'].includes(match.rule?.type ?? '')) {
				parameter = new KeywordAST(match.tokens);
			} else if (match.rule?.type === 'over') {
				this.over = new WindowAST(match);
			} else if (match.rule?.type === 'alias') {
				this.alias = findToken(match.tokens, "entity.name.tag")?.value ?? null;
				this.tokens.push(...match.tokens);
			}
			if (parameter) {
				this.parameters.push(parameter);
				this.tokens.push(...parameter.tokens);
			}
		}

		this.endIndex = this.tokens[this.tokens.length - 1].endIndex;
	}
}

class ArrayAST implements AST {
	values: (StringAST | NumberAST)[] = [];
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor(matchedRules: MatchedRule[]) {
		this.lineNumber = matchedRules[0].tokens[0].lineNumber;
		this.startIndex = matchedRules[0].tokens[0].startIndex;
		this.endIndex = matchedRules[matchedRules.length - 1].tokens[matchedRules[matchedRules.length - 1].tokens.length - 1].endIndex;
		this.tokens = matchedRules.map((match) => match.tokens).flat();

		for (const match of matchedRules) {
			if (match.rule?.type === 'string') {
				this.values.push(new StringAST(match.tokens));
			} else if (match.rule?.type === 'number') {
				this.values.push(new NumberAST(match.tokens));
			}
		}
	}
}

class ComparisonAST implements AST {
	logicalOperator: LogicalOperator | null = null;
	left: Column | ArrayAST | null = null;
	operator: ComparisonOperator | null = null;
	right: Column | ArrayAST | null = null;
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor(comparison: Comparison, tokens: Token[]) {
		this.tokens = tokens;
		this.left = comparison.left;
		this.operator = comparison.operator;
		this.right = comparison.right;
		this.logicalOperator = comparison.logicalOperator;
		this.lineNumber = tokens[0].lineNumber;
		this.startIndex = tokens[0].startIndex;
		this.endIndex = tokens[tokens.length - 1].endIndex;
	}
}


class ComparisonGroupAST implements AST {
	logicalOperator: LogicalOperator | null = null;
	comparisons: (ComparisonGroupAST | ComparisonAST)[] = [];
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor(matches: MatchedRule[], logicalOperator: LogicalOperator | null = null) {
		if (matches.length === 0) {
			return;
		}

		const pop = (array: MatchedRule[], scope: string): [MatchedRule[], (LogicalOperator | ComparisonOperator)] => {
			const match: MatchedRule | undefined = array.find((match) => match.rule?.type === scope);
			const result = match?.tokens
				.map((token) => token.scopes.includes(`meta.${scope}.sql`) ? token.value : '')
				.join('') as LogicalOperator;

			if (match !== undefined) {
				const index = array.indexOf(match);
				if (index !== -1) {
					array.splice(index, 1);
				}
			}

			return [array, result];
		};

		this.logicalOperator = logicalOperator;

		// split matches into comparisons
		const comparisonsParts: number[][] = [];
		let lastIndex: number = 0;
		for (let i = 0; i < matches.length; i++) {
			const match = matches[i];
			// check for comparison group or logical operator
			if (match.rule?.type === "group") {
				comparisonsParts.push([lastIndex, i + 1]);
				lastIndex = i + 1;
				continue;
			}

			if (match.rule?.type === "operator" && i > 0) {
				comparisonsParts.push([lastIndex, i]);
				lastIndex = i;
				continue;
			}
		}

		if (lastIndex < matches.length - 1) {
			comparisonsParts.push([lastIndex, matches.length]);
		}

		for (const part of comparisonsParts) {
			let partMatches = matches.slice(part[0], part[1]);
			const tokens = partMatches.map((match) => match.tokens).flat();
			let result: (LogicalOperator | ComparisonOperator | null);
			let operator: LogicalOperator | null = null;
			let comparison: ComparisonOperator | null = null;
			// is there a comparison group?
			if (partMatches.length === 1 && partMatches[0].rule?.type === "group") {
				if (!(partMatches[0].rule?.name === "comparison.group")) {
					operator = partMatches[0].tokens.map((token) => token.scopes.includes("meta.operator.sql") ? token.value : '').join('') as LogicalOperator;
				}
				this.tokens.push(...partMatches[0].tokens);
				const group = new ComparisonGroupAST(partMatches[0].matches ?? [], operator);
				this.comparisons.push(group);
				this.tokens.push(...group.tokens);
				continue;
			}

			if (partMatches.length > 1) {
				[partMatches, result] = pop(partMatches, "operator");

				if (result != null) {
					operator = result as LogicalOperator;
				}
			}

			if (partMatches.length === 3) {
				[partMatches, result] = pop(partMatches, "comparison");

				if (result != null) {
					comparison = result as ComparisonOperator;
				}
			}

			const comparisonObj: Comparison = { "logicalOperator": operator, "operator": comparison } as Comparison;

			for (const match of partMatches ?? []) {
				let parameter: Column | ArrayAST | null = null;
				if (match.rule?.type === 'column') {
					parameter = new ColumnAST(match);
				} else if (match.rule?.type === 'function') {
					parameter = new ColumnFunctionAST(match);
				} else if (match.rule?.type === 'string') {
					parameter = new StringAST(match.tokens);
				} else if (match.rule?.type === 'number') {
					parameter = new NumberAST(match.tokens);
				} else if (match.rule?.type === 'keyword') {
					parameter = new KeywordAST(match.tokens);
				} else if (match.rule?.type === 'group') {
					parameter = new ArrayAST(match.matches ?? []);
					tokens.push(...parameter.tokens);
				}

				if (comparisonObj.left == null) {
					comparisonObj.left = parameter;
				} else if (comparisonObj.right == null) {
					comparisonObj.right = parameter;
				}
			}

			const comp = new ComparisonAST(comparisonObj, tokens);
			this.comparisons.push(comp);
			this.tokens.push(...comp.tokens);
		}

		this.tokens = Parser.sortTokens(this.tokens);

	}
}

class CaseStatementWhenAST implements AST {
	when: ComparisonGroupAST | null = null;
	then: Column | null = null;
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor(when: MatchedRule, then: MatchedRule) {

		this.tokens.push(...when.tokens);
		this.tokens.push(...then.tokens);

		this.lineNumber = this.tokens[0].lineNumber;
		this.startIndex = this.tokens[0].startIndex;
		this.endIndex = this.tokens[this.tokens.length - 1].endIndex;

		this.when = new ComparisonGroupAST(when.matches ?? []);
		this.then = new ColumnAST(then);

	}

}

class CaseStatementAST implements AST {
	when: CaseStatementWhenAST[] = [];
	else: Column | null = null;
	alias: string | null = null;
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor(matchedRule: MatchedRule) {
		this.tokens = matchedRule.tokens;
		this.lineNumber = matchedRule.tokens[0].lineNumber;
		this.startIndex = matchedRule.tokens[0].startIndex;
		this.endIndex = matchedRule.tokens[matchedRule.tokens.length - 1].endIndex;

		const whenMatches = matchedRule.matches?.filter((match) => match.rule?.type === "when") ?? [];
		const thenMatches = matchedRule.matches?.filter((match) => match.rule?.type === "then") ?? [];
		const elseMatch = matchedRule.matches?.find((match) => match.rule?.type === "else") ?? null;
		const aliasMatch = matchedRule.matches?.find((match) => match.rule?.type === "alias") ?? null;

		for (let i = 0; i < whenMatches.length; i++) {
			this.when.push(new CaseStatementWhenAST(whenMatches[i], thenMatches[i]));
		}

		if (elseMatch) {
			this.else = createColumn((elseMatch.matches ?? [{ rule: null, tokens: [] }])[0]);
		}

		if (aliasMatch) {
			this.alias = findToken(aliasMatch.tokens, "entity.name.tag")?.value ?? null;
		}

	}
}

class JoinAST implements AST {
	join: JoinType | null = JoinType.INNER;
	source: ObjectAST | StatementAST | null = null;
	on: ComparisonGroupAST | null = null;
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor(matchedRule: MatchedRule) {
		this.tokens.push(...matchedRule.tokens);
		this.lineNumber = matchedRule.tokens[0].lineNumber;
		this.startIndex = matchedRule.tokens[0].startIndex;

		this.join = findToken(matchedRule.tokens, "keyword.join.sql")?.value as JoinType;
		this.source = new ObjectAST(matchedRule.tokens);

		this.on = new ComparisonGroupAST(matchedRule.matches ?? []);
		this.tokens.push(...this.on.tokens);

		this.endIndex = this.tokens[this.tokens.length - 1].endIndex;
	}
}

export class ObjectAST implements AST {
	project: string | null = null;
	dataset: string | null = null;
	object: string | null = null;
	alias: string | null = null;
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor(tokens: LineToken[] | Token[]) {

		const project = findToken(tokens, "entity.name.project.sql");
		const dataset = findToken(tokens, "entity.name.dataset.sql");
		const object = findToken(tokens, "entity.name.object.sql");
		const alias = findToken(tokens, "entity.name.alias.sql");

		const statementTokens = [project, dataset, object, alias].filter((token) => token !== null);
		if (statementTokens.length === 0) {
			return;
		}

		this.project = project?.value ?? null;
		this.dataset = dataset?.value ?? null;
		this.object = object?.value ?? null;
		this.alias = alias?.value ?? null;
		this.lineNumber = Math.min(...statementTokens.map((token) => token?.lineNumber ?? 0));
		this.startIndex = Math.min(...statementTokens.map((token) => token?.startIndex ?? 0));
		this.endIndex = Math.min(...statementTokens.map((token) => token?.endIndex ?? 0));
		this.tokens = statementTokens.filter(token => token !== null) as Token[];
	}
}

/**
 * The abstract syntax tree for the SQL code
 */
export class StatementAST implements AST {
	with: StatementAST | null = null;
	type: StatementType | null = StatementType.SELECT;
	object: ObjectAST | null = null;
	options: null = null;
	distinct: boolean = false;
	columns: Column[] = [];
	from: ObjectAST | StatementAST | null = null;
	joins: JoinAST[] = [];
	where: ComparisonGroupAST | null = null;
	groupby: ColumnAST[] = [];
	having: string | null = null;
	orderby: ColumnAST[] = [];
	limit: number | null = null;
	statement: string | null = null;
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	constructor() {
	}

	/**
	 * Processes a matched rule and updates the internal state based on the rule type.
	 *
	 * @param matchedRule - The matched rule object containing the rule and tokens to process.
	 * 
	 * The function performs the following actions based on the rule type:
	 * - 'dml': Extracts the statement type and object AST from the tokens and updates the type and object properties.
	 * - 'select': Checks if the tokens contain a "keyword.select.distinct.sql" scope and sets the distinct property to true if found.
	 * - 'from': Creates a new ObjectAST from the tokens and assigns it to the from property.
	 * - 'join': Creates a new JoinAST from the matched rule and adds it to the joins array.
	 * - 'where': Creates a new ComparisonGroupAST from the matched rule matches and assigns it to the where property.
	 * - Default: Creates a new column from the matched rule and adds it to the columns array.
	 */
	processRule(matchedRule: MatchedRule): void {
		const rule = matchedRule.rule;
		if (rule) {
			const tokens = matchedRule.tokens;
			if (rule.type === 'dml') {
				const [type, objectAST] = Parser.extractStatementType(tokens);
				if (type) {
					this.type = type;
				}
				this.object = objectAST;
			} else if (rule.type === 'select') {
				if (tokens.find((token) => token.scopes.includes("keyword.select.distinct.sql"))) {
					this.distinct = true;
				}
			} else if (rule.type === 'from') {
				this.from = new ObjectAST(tokens);
			} else if (rule.type === 'join') {
				this.joins.push(new JoinAST(matchedRule));
			} else if (rule.type === 'where') {
				this.where = new ComparisonGroupAST(matchedRule.matches ?? []);
			} else {
				this.columns.push(createColumn(matchedRule));
			}
		}
	}

}

// #endregion

// #region Functions
/**
 * Filter the tokens to only include the one with the given scope
 * @param {GrammarToken[][] | LineToken[]} tokens The tokens to filter
 * @param {string} scope The scope to filter the tokens by
 * @returns {GrammarToken | null} The token with the given scope
 * @name findToken
 */
function findToken(tokens: LineToken[] | Token[], scope: string): Token | null {
	const isLineTokenArray = (x: any): x is LineToken[] => x[0] && x[0].tokens;
	let filteredTokens: Token[];
	if (isLineTokenArray(tokens)) {
		const ft = tokens.filter((line) => line.tokens.filter((token) => token.scopes.includes(scope)).length > 0);
		if (ft.length === 0) {
			return null;
		}
		filteredTokens = ft[0].tokens;
	} else {
		filteredTokens = tokens;
	}

	const token = filteredTokens.find((token) => token.scopes.includes(scope));

	if (token) {
		return token;
	}

	return null;

}

/**
 * Extract the statement type and object from the tokens, return an
 * object representing a column.
 * @param matchedRule 
 * @returns Column
 */
function createColumn(matchedRule: MatchedRule): Column {
	if (matchedRule.rule?.type === 'case') {
		return new CaseStatementAST(matchedRule);
	} else if (matchedRule.rule?.type === 'function') {
		return new ColumnFunctionAST(matchedRule);
	} else if (matchedRule.rule?.type === 'string') {
		return new StringAST(matchedRule.tokens);
	} else if (matchedRule.rule?.type === 'number') {
		return new NumberAST(matchedRule.tokens);
	} else if (['comparison', 'keyword'].includes(matchedRule.rule?.type ?? '')) {
		return new KeywordAST(matchedRule.tokens);
	}
	return new ColumnAST(matchedRule);
}


/**
 * Extract the statement type and object from the tokens
 * @param tokens The tokens to extract the statement type and object from
 * @returns [StatementType, ObjectAST] The statement type and object
 */
export type FileMap = { [key: number]: StatementAST };

/**
 * Object for parsing SQL code
 * @name Parser
 */
export class Parser {
	/**
	 * The scopes to ignore
	 */
	readonly ignoreScopes: string[] = ["comment.line.double-dash.sql", "punctuation.definition.comment.sql"];
	fileMap: FileMap = {};
	grammar: Grammar | null = null;

	/**
	 * Initializes the parser by loading the grammar for GoogleSQL.
	 * This method should be called before using the parser to ensure
	 * that the necessary grammar is loaded and ready for use.
	 *
	 * @returns {Promise<void>} A promise that resolves when the grammar is successfully loaded.
	 */
	async initialize() {
		const grammarLoader = new GrammarLoader();
		this.grammar = await grammarLoader.loadGrammar('source.googlesql');
	}

	/**
	 * Parses the provided source string into a FileMap.
	 *
	 * @param source - The source string to be parsed.
	 * @returns A promise that resolves to a FileMap containing the parsed statements.
	 *
	 * @remarks
	 * - If the grammar is not initialized, it will be initialized before parsing.
	 * - The source string is split into individual statements.
	 * - Each statement is tokenized and parsed.
	 * - The parsed statements are stored in the fileMap.
	 */
	async parse(source: string): Promise<FileMap> {

		if (this.grammar === null) {
			await this.initialize();
		}

		// split string into statements
		const statements = this._splitSource(source);
		let lines: number = 0;

		for (let i = 0; i < statements.length; i++) {
			const statement: MatchObj = statements[i];
			const tokenizedLines: LineToken[] = Parser.tokenize(this.grammar!, statement.statement, lines);
			lines = statement.line;

			const s = this._parseStatement(tokenizedLines.map((line) => line.tokens).flat());
			s.statement = statement.statement;
			this.fileMap[i] = s;

		}

		return this.fileMap;

	}

	_parseStatement(tokens: Token[]): StatementAST {

		const statement = new StatementAST();
		let rules = syntaxRules;
		let expressionTokens: Token[] = [];
		let tokenCounter: number = 0;
		let reCheck: boolean = true; // used to stop infinite loops
		statement.tokens = tokens;
		statement.lineNumber = tokens[0].lineNumber;

		const reset = () => {
			rules = syntaxJson.rules;
			expressionTokens = [];
			tokenCounter = 0;
		};

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];

			if (token.scopes.map((t) => skipTokens.includes(t)).includes(true) || token.scopes.filter((scope) => !skipTokens.includes(scope.split('.')[0])).length === 0) {
				continue;
			}

			if (token.scopes.map((t) => punctuation.includes(t)).includes(true)) {
				expressionTokens.push(token);
				continue;
			}

			rules = this._filterRules(token, tokenCounter, tokens.slice(i + 1), rules);

			if (rules.length === 0) {
				if (reCheck) {
					i--; // restart checking from the last token
					reCheck = false;
				} else {
					reCheck = true;
				}
				// add syntax error
				reset();
				continue;
			}

			reCheck = true;

			tokenCounter++;

			expressionTokens.push(token);

			if (rules.length === 1) {
				const matchedRule = { "rule": rules.find((rule) => rule.scopes.join('|') === this._getMatchedTokens(expressionTokens)) ?? null, "tokens": expressionTokens, "matches": [] as MatchedRule[] };

				if (matchedRule.rule && matchedRule.rule.recursive) {
					const [matchedRules, y] = this._recursiveLookahead(tokens.slice(i + 1), null, matchedRule.rule.end);
					matchedRule.matches.push(...matchedRules);
					i += y;
				}

				if (matchedRule.rule) {
					if (matchedRule.rule.children !== null) {
						const [matchedRules, y] = this._recursiveLookahead(tokens.slice(i + 1), syntaxRules.filter((rule) => matchedRule.rule?.children?.includes(rule.name)));
						matchedRule.matches.push(...matchedRules);
						i += y;
					}
					statement.processRule(matchedRule);
					reset();
					continue;
				}
			}
		}
		return statement;
	}

	/**
	 * filter the rules based on the current token
	 * @param {Token} token The current token
	 * @param {number} tokenCounter The current token counter
	 * @param {Token[]} nextTokens The next tokens
	 * @param {Rule[]} rules The rules to filter
	 * @returns {Rule[]} The filtered rules
	 * @memberof Parser
	 * @name _filterRules
	 * @private
	 */
	_filterRules(token: Token, tokenCounter: number, nextTokens: Token[], rules: Rule[]): Rule[] {

		const passingRules: Rule[] = [];
		for (const rule of rules) {
			if (!(token.scopes.includes(rule.scopes[tokenCounter]) || rule.scopes[tokenCounter] === '*')) {
				continue;
			}

			if (rule.lookahead > 0 || rule.negativeLookahead !== null) {
				if (!this._lookahead(nextTokens, rule, tokenCounter + 1)) {
					continue;
				}
			}

			passingRules.push(rule);

		}


		return passingRules;

	}

	/**
	 * Look ahead to the next x tokens, will the rule match?
	 * @param {Token[]} tokens The tokens to look ahead
	 * @param {Rule} rule The rule to look ahead for
	 * @param {number} currentMatchCount The current match count
	 * @returns {Rule | null} The rule that will match
	 * @memberof Parser
	 * @name _lookahead
	 */
	_lookahead(tokens: Token[], rule: Rule, currentMatchCount: number): Rule | null {
		// look ahead to the next x tokens, will the rule match?
		let checkIndex: number = currentMatchCount; // controls which token to look at
		let tokenCounter: number = currentMatchCount - 1;

		// if we have already matched all the tokens in the rule return the rule
		if (checkIndex === rule.scopes.length && rule.negativeLookahead == null) {
			return rule;
		}

		// filter tokens to exclude skips and punctuation
		const filteredTokens = tokens.filter((token) => token.scopes.map((t) => skipTokens.includes(t)).includes(true) || token.scopes.filter((scope) => !skipTokens.includes(scope.split('.')[0])).length > 0)
			.filter((token) => !token.scopes.map((t) => punctuation.includes(t)).includes(true));

		// loop through the tokens by index
		for (let i = 0; i < filteredTokens.length; i++) {

			// if i is less than the lookahead counter check if token matches
			if (tokenCounter < rule.lookahead) {
				if (filteredTokens[i].scopes.includes(rule.scopes[checkIndex]) || rule.scopes[checkIndex] === '*') {
					tokenCounter++;
					checkIndex++;
					continue;
				} else {
					return null;
				}
			}
			// if i is greater than or equal to the lookahead counter and we have negative lookahead check if token matches negative lookahead
			else if (tokenCounter >= rule.lookahead && rule.negativeLookahead != null) {
				if (rule.negativeLookahead != null && rule.negativeLookahead.filter((scope) => filteredTokens[i].scopes.includes(scope)).length > 0) {
					return null;
				} else {
					return rule;
				}
			} else if (tokenCounter >= rule.lookahead && rule.negativeLookahead == null) {
				return rule;
			}

		}

		// if we reach here we have matched the rule
		return rule;
	}

	/**
	 * Look ahead recursively finding all matches
	 * @param {Token[]} tokens The tokens to look ahead
	 * @returns {[MatchedRule[], number]} The matched rules and the number of tokens checked
	 * @memberof Parser
	 * @name _recursiveLookahead
	 */
	_recursiveLookahead(tokens: Token[], rules?: Rule[] | null, endToken?: string[] | null): [MatchedRule[], number] {
		const matches: MatchedRule[] = [];
		const exitOnMatch: boolean = rules != null;
		let workingRules: Rule[] = [];
		let expressionTokens: Token[] = [];
		let tokenCounter: number = 0;
		let reCheck: boolean = true; // used to stop infinite loops
		const setRules = () => {
			rules == null ? workingRules = syntaxRules : workingRules = rules;
		};
		const reset = () => {
			setRules();
			expressionTokens = [];
			tokenCounter = 0;
		};
		let loopCounter = 0;

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			loopCounter = i;
			if (token.scopes.map((t) => skipTokens.includes(t)).includes(true) || token.scopes.filter((scope) => !skipTokens.includes(scope.split('.')[0])).length === 0) {
				continue;
			}

			if (token.scopes.filter((scope) => recursiveGroupEnd.includes(scope)).length > 0) {
				if (matches.length > 0) {
					matches[matches.length - 1].tokens.push(token);
				}
				break;
			} else if (token.scopes.filter((scope) => endToken?.includes(scope)).length > 0) {
				// end tokens are the start of another group so should not be added to the current group
				// we should also decrease the loop counter so that the end token is rechecked
				loopCounter--;
				break;
			}

			if (token.scopes.map((t) => punctuation.includes(t)).includes(true)) {
				expressionTokens.push(token);
				continue;
			}

			workingRules = this._filterRules(token, tokenCounter, tokens.slice(i + 1), workingRules);

			if (token.scopes.filter((scope) => recursiveGroupBegin.includes(scope)).length > 0 && workingRules.length === 0) {
				const [matchedRules, y] = this._recursiveLookahead(tokens.slice(i + 1));
				matches.push(...matchedRules);
				i += y;
				reset();
				continue;
			}

			if (workingRules.length === 0) {
				if (reCheck) {
					i--; // restart checking from the last token
					reCheck = false;
				} else {
					reCheck = true;
				}
				reset();
				continue;
			}

			reCheck = true;

			tokenCounter++;

			expressionTokens.push(token);

			const matchedRule = { "rule": workingRules.find((rule) => rule.scopes.join('|') === this._getMatchedTokens(expressionTokens)) ?? null, "tokens": expressionTokens, "matches": [] as MatchedRule[] };

			if (matchedRule.rule && matchedRule.rule.recursive) {
				const [matchedRules, y] = this._recursiveLookahead(tokens.slice(i + 1), null, matchedRule.rule.end);
				matchedRule.matches.push(...matchedRules);
				matches.push(matchedRule);
				i += y;
				loopCounter = i;
				reset();
				if (exitOnMatch) {
					break;
				}
				continue;
			} else if (matchedRule.rule) {
				matches.push(matchedRule);
				reset();
				if (exitOnMatch) {
					break;
				}
				continue;
			}

		}

		return [matches, loopCounter + 1];
	}

	/**
	 * Tokenize the source code
	 * @param {string} source The source code to tokenize
	 * @returns {LineToken[]} The tokenized source code
	 * @memberof Parser
	 * @name tokenize
	 */
	static tokenize(grammar: Grammar, source: string, lineNumber: number = 0): LineToken[] {

		const lines: string[] = source.split('\n');


		const tokenizedLines: GrammarTokenizeLineResult[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			tokenizedLines.push(grammar.tokenizeLine(line, null, i + lineNumber));
		}

		const lineTokens: LineToken[] = [];

		// const filePosition: number = 0;

		for (let i = 0; i < tokenizedLines.length; i++) {
			const tokenizedLine = tokenizedLines[i];
			const sourceLine = lines[i];

			lineTokens.push(LineToken.fromGrammarTokens(tokenizedLine.tokens, sourceLine, i + lineNumber));

		}

		return lineTokens;
	}

	/**
		 * Get the matched tokens as a string
	 * @param {Token[]} tokens 
	 * @returns {string}
	 * @memberof Parser
	 * @name _getMatchedTokens
	 */
	_getMatchedTokens(tokens: Token[]): string {
		return tokens.map((t) => t.scopes.filter((scope) => !skipTokens.includes(scope.split('.')[0]) && !punctuation.includes(scope)) ?? [''][0])
			.map((t) => t.filter((scope) => scope !== ''))
			.filter((t) => t.length > 0)
			.join('|');
	}

	/**
	 * Split the source code into statements
	 * @param {string} source The source code to split
	 * @returns {MatchObj[]} The source code split into statements
	 */
	_splitSource(source: string): MatchObj[] {

		const pattern = /;/g;
		let match: RegExpExecArray | null;

		const lines: { "start": number, "end": number }[] = [];
		let r: number = 0;

		source.split('\n').map((line) => {
			const len = r + line.length;
			lines.push({ "start": r, "end": len + 1 });
			r = len + 1;
		});


		const statements = [];
		let start = 0;
		while ((match = pattern.exec(source))) {
			const m = {
				"end": match.index,
				"start": start,
				"line": lines.indexOf(lines.find((line) => (match?.index ?? -1) >= line.start && (match?.index ?? -1) < line.end) ?? lines[0]),
				"statement": source.substring(start, match.index)
			};
			start = match.index + 1;
			statements.push(m);
		}

		if (statements.length === 0) {
			statements.push({
				"start": 0,
				"end": source.length,
				"statement": source,
				"line": lines.indexOf(lines.find((line) => source.length >= line.start && source.length < line.end) ?? lines[0]),
			});
		}

		return statements;

	}

	/**
	 * Extract the type of the statement from the tokenized source code
	 * @param {LineToken[]} tokenizedLines The tokenized source code
	 * @returns {[StatementType | undefined, ObjectAST | null]} The type of the statement and the object AST
	 * @memberof Parser
	 * @name _extractStatementType
	 */
	static extractStatementType(tokens: Token[]): [StatementType | undefined, ObjectAST | null] {
		let type: StatementType = StatementType.SELECT;
		let objectAST = null;

		for (const searchString of ["meta.dml.sql", "meta.ddl.sql"]) {
			const targetTokens: Token[] = tokens.filter((token) => token.scopes.some((scope) => scope.includes(searchString)));
			if (targetTokens.length > 0) {
				const typeToken = findToken(targetTokens, "keyword.dml.sql");
				type = StatementType[typeToken?.value?.split(' ')[0].toUpperCase() as keyof typeof StatementType];
				objectAST = new ObjectAST(targetTokens);
				break;
			}
		}

		return [type, objectAST];

	}


	static sortTokens(tokens: Token[]): Token[] {

		return tokens.sort((a, b) => {
			if (a.lineNumber ?? 0 === b.lineNumber ?? 0) {
				return (a.startIndex ?? 0) - (b.startIndex ?? 0);
			}
			return (a.lineNumber ?? 0) - (b.lineNumber ?? 0);
		});
	}

}

// #endregion
