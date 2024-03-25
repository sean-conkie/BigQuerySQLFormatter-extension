/**
 * @fileoverview Parser for the BigQuery SQL.
 * @module parser
 */

import { Grammar, GrammarRegistry, GrammarToken } from 'first-mate';
import { resolve } from 'path';
import { mergeArrayToUnique } from '../utils';
import { OnigScanner } from 'oniguruma';
import syntaxJson from './syntaxes/syntax.json';

const punctuation: string[] = syntaxJson.punctuation;
const skipTokens: string[] = syntaxJson.skipTokens;
const recursiveGroupBegin: string[] = syntaxJson.recursiveGroupBegin;
const recursiveGroupEnd: string[] = syntaxJson.recursiveGroupEnd;
const syntaxRules: Rule[] = syntaxJson.rules;
const comparisonGroupRules: string[] = syntaxJson.comparisonGroupRules;

// region Enums
enum StatementType{
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

// endregion

// region Types

type ASTPosition = {
	"line": number | null,
	"start": number | null,
	"end": number | null,
};

interface Token extends GrammarToken, ASTPosition {}

interface LineToken extends ASTPosition {
	"tokens": Token[]
	"value": string
	"scopes": string[]
}

interface AST extends ASTPosition {
	"tokens": Token[]

}

type Column = ColumnAST | ColumnFunctionAST | StatementAST | StringAST | NumberAST | KeywordAST;

type FunctionParameter = Column | KeywordAST;

type Rule = {
	"name": string,
	"scopes": string[],
	"type": string,
	"lookahead": number,
	"negativeLookahead": string[] | null,
	"recursive": boolean,
	"children": string[] | null,
	"end": string[] | null
}

type Comparison = {
	"left": Column | null,
	"operator": ComparisonOperator | null,
	"right": Column | null,
	"logicalOperator": LogicalOperator | null
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
type MatchObj = {"end": number, "start": number, statement: string};

type MatchedRule = {"rule": Rule | null, "tokens": Token[], "matches"?: MatchedRule[]};

// endregion

class ColumnAST implements AST {
	source: string | null = null;
	column: string | null = null;
	alias: string | null = null;
	tokens: Token[] = [];
	line: number | null = null;
	start: number | null = null;
	end: number | null = null;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.source = findToken(tokens, "entity.name.alias.sql")?.value ?? null;
		this.column = findToken(tokens, "other.column.name.sql")?.value ?? null;
		this.alias = findToken(tokens, "entity.name.tag")?.value ?? null;
		this.line = tokens[0].line;
		this.start = tokens[0].start;
		this.end = tokens[tokens.length - 1].end;
	}

}

class StringAST implements AST {
	value: string | null = null;
	tokens: Token[] = [];
	alias: string | null = null;
	line: number | null = null;
	start: number | null = null;
	end: number | null = null;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.value = tokens.map((token) => token.value).join('');
		this.alias = findToken(tokens, "entity.name.tag")?.value ?? null;
		this.line = tokens[0].line;
		this.start = tokens[0].start;
		this.end = tokens[tokens.length - 1].end;
	}
}

class NumberAST implements AST {
	value: number | null = null;
	tokens: Token[] = [];
	alias: string | null = null;
	line: number | null = null;
	start: number | null = null;
	end: number | null = null;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.value = Number(tokens.map((token) => token.value).join(''));
		this.alias = findToken(tokens, "entity.name.tag")?.value ?? null;
		this.line = tokens[0].line;
		this.start = tokens[0].start;
		this.end = tokens[tokens.length - 1].end;
	}
}

class KeywordAST implements AST {
	value: string | null = null;
	tokens: Token[] = [];
	line: number | null = null;
	start: number | null = null;
	end: number | null = null;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.value = tokens.map((token) => token.value).join('');
		this.line = tokens[0].line;
		this.start = tokens[0].start;
		this.end = tokens[tokens.length - 1].end;
	}
}


class ColumnFunctionAST implements AST {
	function: string | null = null;
	parameters: FunctionParameter[] = [];
	alias: string | null = null;
	tokens: Token[] = [];
	line: number | null = null;
	start: number | null = null;
	end: number | null = null;

	constructor(matchedRule: MatchedRule) {
		this.function = matchedRule.tokens[0].value;
		this.tokens.push(...matchedRule.tokens);
		this.line = matchedRule.tokens[0].line;
		this.start = matchedRule.tokens[0].start;

		for (const match of matchedRule.matches??[]) {
			let parameter: FunctionParameter | null = null;
			if (match.rule?.type === 'column') {
				parameter = new ColumnAST(match.tokens);
			} else if (match.rule?.type === 'function') {
				parameter = new ColumnFunctionAST(match);
			} else if (match.rule?.type === 'string') {
				parameter = new StringAST(match.tokens);
			} else if (match.rule?.type === 'number') {
				parameter = new NumberAST(match.tokens);
			} else if (match.rule?.type === 'keyword') {
				parameter = new KeywordAST(match.tokens);
			} else if (match.rule?.type === 'alias') {
				this.alias = findToken(match.tokens, "entity.name.tag")?.value ?? null;
				this.tokens.push(...match.tokens);
			}
			if (parameter) {
				this.parameters.push(parameter);
				this.tokens.push(...parameter.tokens);
			}
		}

		this.end = this.tokens[this.tokens.length - 1].end;
	}
}

class ComparisonAST implements AST {
	logicalOperator: LogicalOperator | null = null;
	left: Column | null = null;
	operator: ComparisonOperator | null = null;
	right: Column | null = null;
	tokens: Token[] = [];
	line: number | null = null;
	start: number | null = null;
	end: number | null = null;

	constructor(comparison: Comparison, tokens: Token[]) {
		this.tokens = tokens;
		this.left = comparison.left;
		this.operator = comparison.operator;
		this.right = comparison.right;
		this.logicalOperator = comparison.logicalOperator;
		this.line = tokens[0].line;
		this.start = tokens[0].start;
		this.end = tokens[tokens.length - 1].end;
	}
}


class ComparisonGroupAST implements AST {
	logicalOperator: LogicalOperator | null = null;
	comparisons: (ComparisonGroupAST|ComparisonAST)[] = [];
	tokens: Token[] = [];
	line: number | null = null;
	start: number | null = null;
	end: number | null = null;

	constructor(matches: MatchedRule[], logicalOperator: LogicalOperator | null = null) {
		if (matches.length === 0) {
			return;
		}

		const pop = (array: MatchedRule[], scope: string): [MatchedRule[], (LogicalOperator | ComparisonOperator)] => {
			const match: MatchedRule | undefined = array.find((match) => match.rule?.type === scope);
			const result = match?.tokens
													.map((token) => token.scopes.includes(`meta.${scope}.sql`)? token.value : '')
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
					operator = partMatches[0].tokens.map((token) => token.scopes.includes("meta.operator.sql")? token.value : '').join('') as LogicalOperator;
				}
				this.tokens.push(...partMatches[0].tokens);
				const group = new ComparisonGroupAST(partMatches[0].matches??[], operator);
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

			const comparisonObj: Comparison = {"logicalOperator": operator, "operator": comparison} as Comparison;

			for (const match of partMatches??[]) {
				let parameter: Column | null = null;
				if (match.rule?.type === 'column') {
					parameter = new ColumnAST(match.tokens);
				} else if (match.rule?.type === 'function') {
					parameter = new ColumnFunctionAST(match);
				} else if (match.rule?.type === 'string') {
					parameter = new StringAST(match.tokens);
				} else if (match.rule?.type === 'number') {
					parameter = new NumberAST(match.tokens);
				} else if (match.rule?.type === 'keyword') {
					parameter = new KeywordAST(match.tokens);
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
	}
}

class JoinAST implements AST {
	"join": JoinType | null = JoinType.INNER;
	"source": ObjectAST | StatementAST | null = null;
	"on": ComparisonGroupAST | null = null;
	"tokens": Token[] = [];
	"line": number | null = null;
	"start": number | null = null;
	"end": number | null = null;

	constructor(matchedRule: MatchedRule) {
		this.tokens.push(...matchedRule.tokens);
		this.line = matchedRule.tokens[0].line;
		this.start = matchedRule.tokens[0].start;
		
		this.join = findToken(matchedRule.tokens, "keyword.join.sql")?.value as JoinType;
		this.source = new ObjectAST(matchedRule.tokens);

		this.on = new ComparisonGroupAST(matchedRule.matches??[]);
		this.tokens.push(...this.on.tokens);

		this.end = this.tokens[this.tokens.length - 1].end;
	}
}


class ObjectAST implements AST {
	"project": string | null = null;
	"dataset": string | null = null;
	"object": string | null = null;
	"alias": string | null = null;
	"tokens": Token[] = [];
	"line": number | null = null;
	"start": number | null = null;
	"end": number | null = null;

	constructor (tokens: LineToken[] | Token[]) {

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
		this.line = Math.min(...statementTokens.map((token) => token?.line ?? 0));
		this.start = Math.min(...statementTokens.map((token) => token?.start ?? 0));
		this.end = Math.min(...statementTokens.map((token) => token?.end ?? 0));
		this.tokens = statementTokens.filter(token => token !== null) as Token[];
	}
}

/**
 * The abstract syntax tree for the SQL code
 */
class StatementAST implements AST {
  "with": StatementAST | null = null;
  "type": StatementType | null = StatementType.SELECT;
	"object": ObjectAST | null = null;
  "options": null = null;
  "distinct": boolean = false;
  "columns": Column[] = [];
  "from": ObjectAST | StatementAST | null = null;
	"joins": JoinAST[] = [];
  "where": ComparisonGroupAST | null = null;
  "groupby": ColumnAST[] = [];
  "having": string | null = null;
  "orderby": ColumnAST[] = [];
  "limit": number | null = null;
	"statement": string | null = null;
	"tokens": Token[] = [];
	"line": number | null = null;
	"start": number | null = null;
	"end": number | null = null;

	constructor () {

	}

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
			} else if (rule.type === 'column') {
				this.columns.push(new ColumnAST(tokens));
			} else if (rule.type === 'function') {
				this.columns.push(new ColumnFunctionAST(matchedRule));
			} else if (rule.type === 'from') {
				this.from = new ObjectAST(tokens);
			} else if (rule.type === 'join') {
				this.joins.push(new JoinAST(matchedRule));
			} else if (rule.type === 'where') {
				this.where = new ComparisonGroupAST(matchedRule.matches??[]);
			}
		}
	}

}


// endregion


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
	
	const token =  filteredTokens.find((token) => token.scopes.includes(scope));

	if (token) {
		return token;
	}

	return null;

}

/**
 * Object for parsing SQL code
 * @name Parser
 */
export class Parser {

	static registry: GrammarRegistry = new GrammarRegistry();
	static grammar: Grammar = this.registry.loadGrammarSync(resolve(`${__dirname}/syntaxes/googlesql.tmLanguage.json`));
	
	readonly ignoreScopes: string[] = ["comment.line.double-dash.sql","punctuation.definition.comment.sql"];
	fileMap: { [key: number]: StatementAST } = {};


	/**
	 * Parse the source code
	 * @param {string} source The source code to parse
	 */
	parse(source: string) {

		// split string into statements
		const statements = this._splitSource(source);

		for(let i = 0; i < statements.length; i++) {
			const statement: MatchObj = statements[i];
			const tokenizedLines: LineToken[] = Parser.tokenize(statement.statement);

			const s = this._parseStatement(tokenizedLines.map((line) => line.tokens).flat());
			s.statement = statement.statement;
			this.fileMap[i] = s;
			console.log(s);

		}

	}

	_parseStatement(tokens: Token[]): StatementAST {

		const statement = new StatementAST();
		let rules = syntaxRules;
		let expressionTokens: Token[] = [];
		let tokenCounter: number = 0;
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

			rules = rules.filter((rule) => token.scopes.includes(rule.scopes[tokenCounter]) || rule.scopes[tokenCounter] === '*')
									.map((rule) => (rule.lookahead > 0 || rule.negativeLookahead !== null) ? this._lookahead(tokens.slice(i + 1), rule, tokenCounter + 1) : rule)
									.filter((rule) => rule !== null) as Rule[];

			if (rules.length === 0) {
				// add syntax error
				i--; // restart checking from the last token
				reset();
				continue;
			}

			tokenCounter++;

			expressionTokens.push(token);

			if (rules.length === 1) {
				const matchedRule = {"rule": rules.find((rule) => rule.scopes.join('|') === this._getMatchedTokens(expressionTokens))??null, "tokens": expressionTokens, "matches": [] as MatchedRule[]};

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
		let tokenCounter: number = currentMatchCount;
		let lookaheadCounter: number = 0;

		if (tokenCounter === rule.scopes.length && rule.negativeLookahead == null) {
			return rule;
		}
		
		for (const token of tokens) {
			if (token.scopes.map((t) => skipTokens.includes(t)).includes(true) || token.scopes.filter((scope) => !skipTokens.includes(scope.split('.')[0])).length === 0) {
				continue;
			}

			if (token.scopes.map((t) => punctuation.includes(t)).includes(true)) {
				continue;
			}

			if (rule.negativeLookahead != null && rule.negativeLookahead.filter((scope) => token.scopes.includes(scope)).length > 0) {
				return null;
			} else if (token.scopes.includes(rule.scopes[tokenCounter]) || rule.scopes[tokenCounter] === '*') {
				tokenCounter++;
				lookaheadCounter++;
			} else if (rule.negativeLookahead != null && rule.negativeLookahead.filter((scope) => token.scopes.includes(scope)).length == 0) {
				lookaheadCounter++;
			} else {
				return null;
			}

			if (tokenCounter === rule.scopes.length && rule.negativeLookahead == null) {
				return rule;
			}

			if (lookaheadCounter == rule.lookahead) {
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
		rules == null ? rules = syntaxRules : rules;
		let expressionTokens: Token[] = [];
		let tokenCounter: number = 0;
		const reset = () => {
			rules = syntaxJson.rules;
			expressionTokens = [];
			tokenCounter = 0;
		};
		let loopCounter = 0;

		for(let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			loopCounter = i;
			if (token.scopes.map((t) => skipTokens.includes(t)).includes(true) || token.scopes.filter((scope) => !skipTokens.includes(scope.split('.')[0])).length === 0) {
				continue;
			}
			
			if (token.scopes.filter((scope) => recursiveGroupEnd.includes(scope)).length > 0 || token.scopes.filter((scope) => endToken?.includes(scope)).length > 0) {
				if (matches.length > 0) {
					matches[matches.length - 1].tokens.push(token);
				}
				break;
			}

			if (token.scopes.map((t) => punctuation.includes(t)).includes(true)) {
				expressionTokens.push(token);
				continue;
			}

			rules = rules.filter((rule) => token.scopes.includes(rule.scopes[tokenCounter]) || rule.scopes[tokenCounter] === '*')
										.map((rule) => (rule.lookahead > 0 || rule.negativeLookahead != null) ? this._lookahead(tokens.slice(i + 1), rule, tokenCounter + 1) : rule)
										.filter((rule) => rule !== null) as Rule[];



			if (token.scopes.filter((scope) => recursiveGroupBegin.includes(scope)).length > 0 && rules.length === 0) {
				const [matchedRules, y] = this._recursiveLookahead(tokens.slice(i + 1));
				matches.push(...matchedRules);
				i += y;
				reset();
				continue;
			}
			
			if (rules.length === 0) {
				// add syntax error
				i--; // restart checking from the last token
				reset();
				continue;
			}

			tokenCounter++;

			expressionTokens.push(token);

			const matchedRule = {"rule": rules.find((rule) => rule.scopes.join('|') === this._getMatchedTokens(expressionTokens))??null, "tokens": expressionTokens, "matches": [] as MatchedRule[]};

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
	static tokenize(source: string): LineToken[] {
		const tokenizedLines: GrammarToken[][] = Parser.grammar.tokenizeLines(source);
		const lineTokens: LineToken[] = [];

		let filePosition: number = 0;
		for (let i = 0; i < tokenizedLines.length; i++) {
			const line = tokenizedLines[i];
			let innerPosition = filePosition;
			const convertToken = function(token: GrammarToken): Token {
				const newToken = token as Token;
				newToken.line = i + 1;
				newToken.start = innerPosition + 1;
				innerPosition += newToken.value.length;
				newToken.end = innerPosition;
				return newToken;
			};
			const tokens: Token[] = line.map((token) => convertToken(token));

			const token: LineToken = {
				"line": i + 1, 
				"tokens": tokens, 
				"start": 0, 
				"end": 0, 
				"value": tokens.reduce((acc, token) => acc + token.value, ''),
				"scopes": tokens.reduce((p, token) => mergeArrayToUnique(p, token.scopes), [] as string[])
			} as LineToken;
			token.start = filePosition + 1;
			filePosition += line.reduce((acc, token) => acc + token.value.length, 0);
			token.end = filePosition;
			lineTokens.push(token);
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
		return tokens.map((t) => t.scopes.filter((scope) => !skipTokens.includes(scope.split('.')[0]) && !punctuation.includes(scope))??[''][0])
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
		const statements = [];
		let start = 0;
		while ((match = pattern.exec(source))) {
			const m = {
				"end": match.index,
				"start": start,
				"statement": source.substring(start, match.index)
			};
			start = match.index + 1;
			statements.push(m);
		}

		if (statements.length === 0) {
			statements.push({
				"start": 0,
				"end": source.length,
				"statement": source
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
	static extractStatementType(tokens: Token[]): [StatementType | undefined, ObjectAST | null]{
		let type: StatementType = StatementType.SELECT;
		let objectAST = null;

		for(const searchString of ["meta.dml.sql", "meta.ddl.sql"]) {
			const targetTokens: Token[] = tokens.filter((token) => token.scopes.some((scope) => scope.includes(searchString)));
			if (targetTokens.length > 0) {
				const typeToken = findToken(targetTokens, "keyword.dml.sql");
				type = StatementType[typeToken?.value.toUpperCase() as keyof typeof StatementType];
				objectAST = new ObjectAST(targetTokens);
				break;
			}
		}

		return [type, objectAST];
		
	}


}