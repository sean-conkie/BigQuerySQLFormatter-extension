/**
 * @fileoverview Parser for the BigQuery SQL.
 * @module parser
 */

import { Grammar, GrammarRegistry, GrammarToken } from 'first-mate';
import { resolve } from 'path';
import { mergeArrayToUnique } from '../utils';
import { CaptureIndex, Match, OnigRegExp, OnigScanner } from 'oniguruma';
import { start } from 'repl';

// region Types

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
}

type Column = ColumnAST | ColumnFunctionAST | StatementAST | string | number;

type ASTPosition = {
	"line": number | null,
	"start": number | null,
	"end": number | null,
};

interface Token extends GrammarToken, ASTPosition {}

interface LineToken extends ASTPosition {
	"tokens": Token[]
	"value": string
	"scopes"?: string[]
}

interface AST extends ASTPosition {
	"tokens": Token[]
}

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

type FunctionParameter = ColumnAST | ColumnFunctionAST | string | number;

interface ColumnFunctionAST extends AST {
	"function": string
	"as": string
	"parameters": FunctionParameter[]
	"value": string
}

class ComparisonAST implements AST {
	logicalOperator: LogicalOperator | null = null;
	left: Column | null = null;
	operator: string | null = null;
	right: Column | null = null;
	tokens: Token[] = [];
	line: number | null = null;
	start: number | null = null;
	end: number | null = null;

	constructor(tokens: Token[]) {
		const operator = tokens.filter((token) => token.scopes?.includes("meta.comparison.sql"));

		if (operator.length === 0) {
			return;
		}

		const logicalOperator = findToken(tokens, "meta.operator.sql")?.value;
		if (logicalOperator) {
			this.logicalOperator = LogicalOperator[logicalOperator.toUpperCase() as keyof typeof LogicalOperator];
		}
		this.operator = operator[0].value;
		this.tokens = tokens;

		const left = tokens.slice(0, tokens.indexOf(operator[0]));
		const right = tokens.slice(tokens.indexOf(operator[0]) + 1);

		this.left = extractColumn(left);
		this.right = extractColumn(right);

		this.line = tokens[0].line;
		this.start = tokens[0].start;
		this.end = tokens[tokens.length - 1].end;

	}

}

type ComparisonGroup = {
	"logicalOperator"?: LogicalOperator,
	"comparisons": ComparisonAST | ComparisonGroupAST
}

type ParenthesisGroup = {strings: string[], tokens: LineToken[][], parts: number[][], nested: ParenthesisGroup[], start: number, end: number, line?: number};


class ComparisonGroupAST implements AST {
	logicalOperator: LogicalOperator | null = null;
	comparisons: (ComparisonGroupAST|ComparisonAST)[] = [];
	tokens: Token[] = [];
	line: number | null = null;
	start: number | null = null;
	end: number | null = null;

	constructor(groups: ParenthesisGroup[], logicalOperator?: LogicalOperator) {
		const pattern = /\b(ro|dna)\b/;

		this.line = groups[0].line??1;
		this.start = groups[0].start;
		this.end = groups[groups.length - 1].end;

		for(const group of groups) {
			for(let i = 0; i < group.tokens.length; i++) {
				const isComparison = group.tokens[i].filter((token) => token.scopes?.includes("meta.comparison.sql")).length > 0;
				if (isComparison) {
					const tokens = group.tokens[i].map((token) => token.tokens).flat();
					const slices = tokens.filter((token) => token.scopes.includes("meta.operator.sql")).map((token) => tokens.indexOf(token));
					slices.push(tokens.length);

					let sliceStart = 0;
					for (const slice of slices) {
						this.comparisons.push(new ComparisonAST(tokens.slice(sliceStart, slice)));
						sliceStart = slice;
					}
				}
				
				if (group.nested.length > i) {
					if (group.strings.length > i) {
						const match = group.strings[i].split("").reverse().join("").match(pattern);
						if (match) {
							const operatorString = match[0].split("").reverse().join("");
							logicalOperator = LogicalOperator[operatorString as keyof typeof LogicalOperator];
						}
					}
					this.comparisons.push(new ComparisonGroupAST([group.nested[i]], logicalOperator));
				}
			}			
		}

		this.tokens = this.comparisons.map((comparison) => comparison.tokens).flat();
	}

}

class JoinAST implements AST {
	"join": JoinType | null = null;
	"source": ObjectAST | StatementAST | null = null;
	"on": ComparisonGroupAST | null = null;
	"tokens": Token[] = [];
	"line": number | null = null;
	"start": number | null = null;
	"end": number | null = null;

	constructor(source: ObjectAST | StatementAST, tokens: LineToken[]) {
		this.source = source;
		this.on = new ComparisonGroupAST(Parser.mapParenthesis(tokens));
		this.tokens.push(...source.tokens);
		this.tokens.push(...this.on.tokens);
		this.start = this.tokens[0].start;
		this.end = this.tokens[this.tokens.length - 1].end;
		this.line = this.tokens[0].line;
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

class SourceAST implements AST {
	"source": ObjectAST | StatementAST | null = null;
	"joins": JoinAST[] = [];
	"tokens": Token[] = [];
	"line": number | null = null;
	"start": number | null = null;
	"end": number | null = null;
	
	constructor (tokens: LineToken[]) {

		const sourceEndScopes: string[] = [
			"meta.where.sql",
			"meta.group.sql",
			"meta.order.sql",
			"meta.limit.sql",
			"meta.having.sql",
			"meta.source.sql",
		];

		const matchScopes: string[] = [
			"meta.operator.sql",
			"meta.source.join.sql"
		];

		tokens.filter((line) => line.tokens.filter((token) => token.scopes.includes("meta.source.sql")).length > 0)
					.map((line) => {

						const objectAST = new ObjectAST(line.tokens);
						const joinToken = findToken([line], "keyword.join.sql");

						const index = tokens.indexOf(line);
						const onTokens: LineToken[] = [];
			
						for(let i = (index); i < tokens.length; i++) {
							if (tokens[i].tokens.filter((token) => token.scopes.some((scope) => sourceEndScopes.includes(scope))).length > 0 && i > index) {
								break;
							}
							
							if (tokens[i].tokens.filter((token) => token.scopes.some((scope) => matchScopes.includes(scope))).length > 0) {
								onTokens.push(tokens[i]);
							}
			
						}
						if (onTokens.length > 1) {
							const join = new JoinAST(objectAST, onTokens);
							const joinParts = joinToken?.value.split(' ')??['inner'];
							let joinType: JoinType;
							if (joinParts[0] == 'join') {
								joinType = JoinType['INNER'];
							} else {
								joinType = JoinType[joinParts[0].toUpperCase() as keyof typeof JoinType];
							}
							join.join = joinType;
							this.joins.push(join);
						} else if (this.source === null) {
							this.source = objectAST;
						}
			
		});
		
		this.tokens.push(...this.source?.tokens??[]);
		this.start = this.tokens[0].start;
		this.line = this.tokens[0].line;

		if (this.joins.length > 0) {
			this.tokens.push(...this.joins.map((join) => join.tokens).flat());
		}

		this.end = this.tokens[this.tokens.length - 1].end;

	}
}

/**
 * The abstract syntax tree for the SQL code
 */
class StatementAST implements AST {
  "with": StatementAST | null = null;
  "type": StatementType | null = null;
	"object": ObjectAST | null = null;
  "options": null = null;
  "distinct": boolean = false;
  "columns": ColumnAST[] = [];
  "from": SourceAST | null = null;
  "where": null = null;
  "groupby": ColumnAST[] = [];
  "having": string | null = null;
  "orderby": ColumnAST[] = [];
  "limit": number | null = null;
	"statement": string | null = null;
	"tokens": Token[] = [];
	"line": number | null = null;
	"start": number | null = null;
	"end": number | null = null;

	constructor (statement: MatchObj, tokenizedLines: LineToken[], linePosition: number) {

		const [type, objectAST]: [type: StatementType | undefined, objectAST: ObjectAST | null] = Parser.extractStatementType(tokenizedLines);

		if (type) {
			this.type = type;
			this.object = objectAST;
		} else {
			this.type = StatementType.SELECT;
			this.object = objectAST;
		}

		this.from = new SourceAST(tokenizedLines);
		

	}

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
 * Extract the column from the tokens
 * @param {Token[]} tokens The tokens to extract the column from
 * @returns {Column | null} The column
 * @name extractColumn
 */
function extractColumn(tokens: Token[]): Column | null {
	if (findToken(tokens, "other.column.name.sql")) {
		return new ColumnAST(tokens);
	}
	if (findToken(tokens, "meta.function.sql")) {
		return null;
	}
	if (findToken(tokens, "meta.source.sql")) {
		return null;
	}
	const stringToken = findToken(tokens, "string.quoted.double.sql")?? findToken(tokens, "string.quoted.single.sql")?? null;
	if (stringToken) {
		return tokens.filter((token) => token.scopes.includes("string.quoted.double.sql") || token.scopes.includes("string.quoted.single.sql"))
									.map((token) => token.value).join('');
	}

	const numberToken = findToken(tokens, "constant.numeric.sql"); 

	if (numberToken) {
		return numberToken.value;
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

		let linePosition: number = 0;
		for(let i = 0; i < statements.length; i++) {
			const statement: MatchObj = statements[i];
			const tokenizedLines: LineToken[] = Parser.tokenize(statement.statement);

			this.fileMap[i] = new StatementAST(statement, tokenizedLines, linePosition);

			linePosition += tokenizedLines.length;
		}

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

	static mapParenthesis(tokens: LineToken[]): ParenthesisGroup[] {
		const value: string = tokens.reduce((acc, token) => acc + token.value + '\n', '');
		const scanner = new OnigScanner(['(?i)(?>(?:(?:\\"|\\\')[^)]*?(?:\\"|\\\'))|\\".*?\\(.*?\\"|\\\'.*?\\(.*?\\\'|(\\())']);
		const startPosition = scanner.findNextMatchSync(value, 0)?.captureIndices[1].start ?? 0;
		const matches: number[][] = Parser.pairParenthesis(startPosition, value);
		const parts: number[][][] = matches.sort((a, b) => a[0] - b[0])
																			.map((match) => Parser.createParenthesisGroupPairs(match, matches));

		// check parts for any we aren't interested in
		parts.map((part) => part.map((p) => {
			const str = value.substring(p[0], p[1]);
			const pop = (p: number[]) => {
				parts.map((iPart) => iPart.map((ip) => p[0] == ip[1]?ip[1] = p[1]:null));
				part.splice(part.indexOf(p),1);
			};

			if (/^\((?:\s*(?:\d+|"\w+"|'\w+')\s*,?)+\s*\)$/gm.test(str)) {
				return pop(p);
			} 
			
			if (/^\(\s*\)/gm.test(str)) {
				return pop(p);
			}
			// tokenize the previous string and check if group preceded by function
			const token = Parser.tokenize(value.substring(0, p[0]))
												.reverse()
												.find((token) => !(token.scopes?.includes("punctuation.whitespace.sql") || token.scopes?.join() == "source.sql-bigquery"));

			if ((token && token.scopes?.includes("meta.function.sql")) ?? false) {
				return pop(p);
			}

		}));


		const flatParts: number[][] = parts.flat().sort((a, b) => a[0] - b[0]);
		const strings: Map<number,ParenthesisGroup > = new Map();
		let inputLine: number = tokens[0].line ?? 1;
		const inputStart: number = tokens[0].start ?? 1;
		const lineNumbers: number[] = flatParts.map((p) => {
			const pattern = /\n/g;
			const match = value.substring(p[0], p[1]).match(pattern);
			const rt = inputLine;
			if (match) {
				inputLine ++;
			}
			return rt;
		});

		parts.map((part) => part.length > 0?strings.set(part[0][0], {
			"strings": part.map((p) => value.substring(p[0], p[1])),
			"tokens": part.map((p) => Parser.tokenize(value.substring(p[0], p[1]))),
			"parts": part,
			"start": (part[0][0] + inputStart),
			"end": (part[part.length - 1][0] + inputStart),
			"line": inputLine,
			"nested": []
		}):null);

		lineNumbers.map((line, index) => {
			const key = flatParts[index][0];
			if (strings.has(key)) {
				const value = strings.get(key);
				if (value !== undefined) {
						value.line = line;
						value.tokens = value.tokens.map((token) => token.map((t) => {
							t.line = (t.line??1) + (value.line??1) - 1;
							t.start = (t.start??1) + (value.start??1) - 1;
							t.end = (t.end??1) + (value.start??1) - 1;
							t.tokens.map((token) => {
								token.line = (token.line??1) + (t.line??1) - 1;
								token.start = (token.start??1) + (t.start??1) - 1;
								token.end = (token.end??1) + (t.start??1) - 1;
							});
							return t;
						}));
				}
			}
		});

		const comparisonGroups: ParenthesisGroup[] = [];
		
		const adddNestedGroups = (obj: ParenthesisGroup): ParenthesisGroup => {
			if (obj.parts.length > 1) {
				obj.parts.map((part) => {
					if (strings.has(part[1])) {
						obj.nested.push(adddNestedGroups(strings.get(part[1]) as ParenthesisGroup));
						strings.delete(part[1]);
					}
				});
			}
			return obj;
		};

		for(const [key, value] of strings) {
			comparisonGroups.push(adddNestedGroups(value));
		}
		return comparisonGroups;

	}


	/**
	 * Pair the parenthesis in the source code
	 * @param {number} startPosition The start position of the parenthesis
	 * @param {string} value The source code
	 * @returns {number[][]} The pairs of parenthesis
	 * @memberof Parser
	 * @name pairParenthesis
	 */
	static pairParenthesis = (startPosition: number, value: string): number[][] => {
		const pairs: number[][] = [];
		let counter = 1;
		for (let i = startPosition + 1; i < value.length; i++) {
			const char = value[i];
			if (char === '(') {
				counter++;
				if (pairs.map((pair) => pair[0]).indexOf(i) < 0) {
					pairs.push(...Parser.pairParenthesis(i, value));
				}
			} else if (char === ')') {
				counter--;
			}
			if (counter === 0) {
				const end = i + 1;
				pairs.push([startPosition, end]);
				break;
			}
		}
		return pairs;
	};

	/**
	 * For an array of parenthesis pairs, create identify the string positions that are not nested.
	 * When groups of parenthesis are paired there can be overlapping nested groups, this function
	 * creates a list of string positions excluding the nested groups.
	 * @param {number[]} match The match
	 * @param {number[][]} matches The matches
	 * @returns {number[][]} The parts of the source code
	 * @memberof Parser
	 * @name _createParenthesisGroupPairs
	 */
	static createParenthesisGroupPairs = (match: number[], matches: number[][]): number[][] => {
		const parts: number[][] = [];
		
		let start: number = match[0];
		const end: number = match[1];

		for(const m of matches) {
			if (m[0] > start && m[1] < end) {
				parts.push([start, m[0]]);
				start = m[1];
			}
		}

		if (start <= end) {
			parts.push([start, end]);
		}

		return parts;
	};

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
	 * Strip the tokenized source of comments and other tokens we don't care about
	 * @param {GrammarToken[][]} tokenizedSource The tokenized source code
	 * @returns {GrammarToken[][]} The tokenized source code stripped of comments and other tokens we don't care about
	 * @memberof Parser
	 * @name _stripTokens
	 */
	_stripTokens(tokenizedSource: LineToken[]): LineToken[] {
		return tokenizedSource.filter((line) => line.tokens.filter((token) => !token.scopes.some(scope => this.ignoreScopes.includes(scope))).length > 0);
	}

	/**
	 * Extract the type of the statement from the tokenized source code
	 * @param {LineToken[]} tokenizedLines The tokenized source code
	 * @returns {[StatementType | undefined, ObjectAST | null]} The type of the statement and the object AST
	 * @memberof Parser
	 * @name _extractStatementType
	 */
	static extractStatementType(tokenizedLines: LineToken[]): [StatementType | undefined, ObjectAST | null]{
		let type: StatementType = StatementType.SELECT;
		let objectAST = null;

		for(const searchString of ["meta.dml.sql", "meta.ddl.sql"]) {
			const tokens: LineToken[] = tokenizedLines.filter((line) => 
																					line.tokens.filter((token) => token.scopes.some((scope) => scope.includes(searchString))).length > 0);
			if (tokens.length > 0) {
				const typeToken = findToken(tokens, "keyword.dml.sql");
				type = StatementType[typeToken?.value.toUpperCase() as keyof typeof StatementType];
				objectAST = new ObjectAST(tokens);
				break;
			}
		}

		return [type, objectAST];
		
	}


}