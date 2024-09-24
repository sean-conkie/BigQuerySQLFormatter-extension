/**
 * @fileoverview Parser for the BigQuery SQL.
 * @module parser
 */

import syntaxJson from '../syntaxes/syntax.json';
import { GrammarLoader, Grammar, GrammarTokenizeLineResult } from '../grammarLoader';
import { Token, LineToken } from './token';
import { Rule } from './matches';
import { StatementAST } from './ast';
import { MatchObj, MatchedRule } from './matches';

const punctuation: string[] = syntaxJson.punctuation;
const skipTokens: string[] = syntaxJson.skipTokens;
const recursiveGroupBegin: string[] = syntaxJson.recursiveGroupBegin;
const recursiveGroupEnd: string[] = syntaxJson.recursiveGroupEnd;
const syntaxRules: Rule[] = syntaxJson.rules;
const comparisonGroupRules: string[] = syntaxJson.comparisonGroupRules;

// #region Functions

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
		
			// Initial tokenization
			const result = grammar.tokenizeLine(line, null, i + lineNumber);
		
			if (result.stoppedEarly) {
				let startIndex = result.tokens[result.tokens.length - 1].endIndex;
				let currentLine = line.substring(startIndex);
				let currentRuleStack = result.ruleStack;
		
				while (currentLine.length > 0) {
					const newResult = grammar.tokenizeLine(currentLine, currentRuleStack, i + lineNumber);
		
					// Adjust token positions
					newResult.tokens.forEach((token) => {
						const newToken = {
							startIndex: token.startIndex + startIndex,
							endIndex: token.endIndex + startIndex,
							scopes: token.scopes,
						};
						result.tokens.push(newToken);
					});
		
					// Update indices and states
					const lastToken = newResult.tokens[newResult.tokens.length - 1];
					startIndex += lastToken.endIndex;
					currentLine = line.substring(startIndex);
					currentRuleStack = newResult.ruleStack;
		
					// Exit if fully tokenized
					if (!newResult.stoppedEarly) {
						break;
					}
				}
			}
		
			tokenizedLines.push(result);
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



}

// #endregion
