import { Token, LineToken } from './token';
import { MatchedRule } from './matches';
import { findToken, sortTokens } from './utils';
import { StatementType, JoinType, LogicalOperator, ComparisonOperator } from './enums';

// region base types
export type ASTPosition = {
	lineNumber: number | null,
	startIndex: number | null,
	endIndex: number | null,
};



export interface AST extends ASTPosition {
	"tokens": Token[]

}
// endregion base types

// region functions
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
 * Extract the type of the statement from the tokenized source code
 * @param {LineToken[]} tokenizedLines The tokenized source code
 * @returns {[StatementType | undefined, ObjectAST | null]} The type of the statement and the object AST
 * @memberof Parser
 * @name _extractStatementType
 */
function extractStatementType(tokens: Token[]): [StatementType | undefined, ObjectAST | null] {
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
// endregion functions

// region columns
/**
 * Represents a column in the SQL statement.
 * 
 * A column can be one of the following types:
 * - `ColumnAST`: Abstract Syntax Tree representation of a column.
 * - `ColumnFunctionAST`: Abstract Syntax Tree representation of a column function.
 * - `StatementAST`: Abstract Syntax Tree representation of a statement.
 * - `StringAST`: Abstract Syntax Tree representation of a string.
 * - `NumberAST`: Abstract Syntax Tree representation of a number.
 * - `KeywordAST`: Abstract Syntax Tree representation of a keyword.
 * - `CaseStatementAST`: Abstract Syntax Tree representation of a case statement.
 */
export type Column = ColumnAST | ColumnFunctionAST | StatementAST | StringAST | NumberAST | KeywordAST | CaseStatementAST;

/**
 * Represents a parameter that can be either a Column or a KeywordAST.
 * This type is used to define the possible types of parameters that can be passed to functions.
 */
export type FunctionParameter = Column | KeywordAST;



/**
 * Represents a column in the Abstract Syntax Tree (AST).
 * 
 * This class is used to parse and store information about a column, including its source, name, alias, and token positions.
 * 
 * @implements {AST}
 */
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

		this.tokens = sortTokens(this.tokens);

		this.source = findToken(matchedRule.tokens, "entity.name.alias.sql")?.value ?? null;
		this.column = findToken(matchedRule.tokens, "entity.other.column.sql")?.value ?? null;
		this.alias = findToken(matchedRule.tokens, "entity.name.tag")?.value ?? null;
		this.lineNumber = matchedRule.tokens.filter((token) => 
																									!token.scopes.includes('punctuation.whitespace.leading.sql') && 
																									!token.scopes.includes('punctuation.whitespace.trailing.sql') && 
																									!token.scopes.includes('punctuation.whitespace.sql') && 
																									!token.scopes.includes('punctuation.separator.comma.sql')
																								)[0].lineNumber;
		this.startIndex = matchedRule.tokens[0].startIndex;
		this.endIndex = matchedRule.tokens[matchedRule.tokens.length - 1].endIndex;
	}

	/**
	 * Checks if the alias is redundant.
	 * 
	 * An alias is considered redundant if it is not null and is the same as the column name.
	 * 
	 * @returns {boolean} - Returns `true` if the alias is redundant, otherwise `false`.
	 */
	redundantAlias(): boolean {
		if (this.alias === null) {
			return false;
		}

		if (this.column === null) {
			return false;
		}

		return this.column === this.alias;
	}

}


/**
 * Represents a column function in the Abstract Syntax Tree (AST).
 */
class StringAST implements AST {
	value: string | null = null;
	tokens: Token[] = [];
	alias: string | null = null;
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	/**
	 * Constructs a new instance of the class.
	 * 
	 * @param tokens - An array of Token objects that represent the tokens to be parsed.
	 * 
	 * @remarks
	 * This constructor initializes the following properties:
	 * - `tokens`: Stores the provided tokens.
	 * - `value`: Concatenates the values of all tokens into a single string.
	 * - `alias`: Finds the token with the scope "entity.name.tag" and assigns its value, or null if not found.
	 * - `lineNumber`: Determines the line number of the first non-whitespace token.
	 * - `startIndex`: Sets the start index to the start index of the first token.
	 * - `endIndex`: Sets the end index to the end index of the last token.
	 */
	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.value = tokens.map((token) => token.value).join('');
		this.alias = findToken(tokens, "entity.name.tag")?.value ?? null;
		this.lineNumber = tokens.filter((token) => !token.scopes.includes('punctuation.whitespace.leading.sql') && !token.scopes.includes('punctuation.whitespace.trailing.sql') && !token.scopes.includes('punctuation.whitespace.sql'))[0].lineNumber;
		this.startIndex = tokens[0].startIndex;
		this.endIndex = tokens[tokens.length - 1].endIndex;
	}
}

/**
 * Represents a number in the Abstract Syntax Tree (AST).
 */
class NumberAST implements AST {
	value: number | null = null;
	tokens: Token[] = [];
	alias: string | null = null;
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;

	/**
	 * Constructs a new instance of the Column class.
	 * 
	 * @param tokens - An array of Token objects representing the tokens to be parsed.
	 * 
	 * @property tokens - Stores the provided tokens.
	 * @property value - A numeric value derived from concatenating the token values.
	 * @property alias - The alias of the column, if any, extracted from the tokens.
	 * @property lineNumber - The line number of the first non-whitespace token.
	 * @property startIndex - The start index of the first token.
	 * @property endIndex - The end index of the last token.
	 */
	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.value = Number(tokens.map((token) => token.value).join(''));
		this.alias = findToken(tokens, "entity.name.tag")?.value ?? null;
		this.lineNumber = tokens.filter((token) => !token.scopes.includes('punctuation.whitespace.leading.sql') && !token.scopes.includes('punctuation.whitespace.trailing.sql') && !token.scopes.includes('punctuation.whitespace.sql'))[0].lineNumber;
		this.startIndex = tokens[0].startIndex;
		this.endIndex = tokens[tokens.length - 1].endIndex;
	}
}

/**
 * Represents a keyword in the Abstract Syntax Tree (AST).
 */
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
		this.lineNumber = tokens.filter((token) => !token.scopes.includes('punctuation.whitespace.leading.sql') && !token.scopes.includes('punctuation.whitespace.trailing.sql') && !token.scopes.includes('punctuation.whitespace.sql'))[0].lineNumber;
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



export class ColumnFunctionAST implements AST {
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
		this.lineNumber = matchedRule.tokens.filter((token) => !token.scopes.includes('punctuation.whitespace.leading.sql') && !token.scopes.includes('punctuation.whitespace.trailing.sql') && !token.scopes.includes('punctuation.whitespace.sql'))[0].lineNumber;
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


class CaseStatementWhenAST implements AST {
	when: ComparisonGroupAST | null = null;
	then: Column | null = null;
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;
	type: string = 'case.when';

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
		this.lineNumber = matchedRule.tokens.filter((token) => !token.scopes.includes('punctuation.whitespace.leading.sql') && !token.scopes.includes('punctuation.whitespace.trailing.sql') && !token.scopes.includes('punctuation.whitespace.sql'))[0].lineNumber;
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
// endregion columns
// region comparison
export class ComparisonAST implements AST {
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
		this.lineNumber = tokens.filter((token) => !token.scopes.includes('punctuation.whitespace.leading.sql') && !token.scopes.includes('punctuation.whitespace.trailing.sql') && !token.scopes.includes('punctuation.whitespace.sql'))[0].lineNumber;
		this.startIndex = tokens[0].startIndex;
		this.endIndex = tokens[tokens.length - 1].endIndex;
	}
}


export class ComparisonGroupAST implements AST {
	logicalOperator: LogicalOperator | null = null;
	comparisons: (ComparisonGroupAST | ComparisonAST)[] = [];
	tokens: Token[] = [];
	lineNumber: number | null = null;
	startIndex: number | null = null;
	endIndex: number | null = null;
	type: string = 'comparison.group';

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

				if (result !== null) {
					operator = result as LogicalOperator;
				}
			}

			if (partMatches.length === 3) {
				[partMatches, result] = pop(partMatches, "comparison");

				if (result !== null) {
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

				if (comparisonObj.left === null) {
					comparisonObj.left = parameter;
				} else if (comparisonObj.right === null) {
					comparisonObj.right = parameter;
				}
			}

			const comp = new ComparisonAST(comparisonObj, tokens);
			this.comparisons.push(comp);
			this.tokens.push(...comp.tokens);
		}

		this.tokens = sortTokens(this.tokens);

	}
}



type Comparison = {
	left: Column | ArrayAST | null,
	operator: ComparisonOperator | null,
	right: Column | ArrayAST | null,
	logicalOperator: LogicalOperator | null
}
// endregion comparison

// region objects
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
		this.lineNumber = matchedRule.tokens.filter((token) => !token.scopes.includes('punctuation.whitespace.leading.sql') && !token.scopes.includes('punctuation.whitespace.trailing.sql') && !token.scopes.includes('punctuation.whitespace.sql'))[0].lineNumber;
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
// endregion objects
// region statement
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
				const [type, objectAST] = extractStatementType(tokens);
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
// endregion statement