import syntaxJson from '../syntaxes/syntax.json';
import { GrammarLoader, Grammar, GrammarTokenizeLineResult, RuleStack } from '../grammarLoader';
import { Token, LineToken, includeTokensWithMatchingScopes } from './token';
import { Rule } from './matches';
import { StatementAST } from './ast';
import { MatchObj, MatchedRule } from './matches';
import { globalTokenCache, DocumentCache } from './tokenCache';
import { DidChangeTextDocumentParams, TextDocumentItem, TextDocumentContentChangeEvent, VersionedTextDocumentIdentifier } from 'vscode-languageserver';
import { range } from '../../utils';
import { findToken  } from './utils';

const punctuation: string[] = syntaxJson.punctuation;
const skipTokens: string[] = syntaxJson.skipTokens;
const recursiveGroupBegin: string[] = syntaxJson.recursiveGroupBegin;
const recursiveGroupEnd: string[] = syntaxJson.recursiveGroupEnd;
const syntaxRules: Rule[] = syntaxJson.rules;
const comparisonGroupRules: string[] = syntaxJson.comparisonGroupRules;

/**
 * A map that associates line numbers with their corresponding string content.
 * 
 * @typedef {Map<number, string>} LineMap
 */
type LineMap = Map<number, string>;


type ChangedRange = {
	startLine: number;
	endLine: number;
	startIndex: number;
	endIndex: number;
}

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
	 * Parses the given text document and returns a FileMap.
	 * 
	 * @param textDocument - The text document to be parsed.
	 * @returns A promise that resolves to a FileMap.
	 * 
	 * @remarks
	 * - If the grammar is not initialized, it will be initialized before parsing.
	 * - If the document exists in the token cache, it will be removed from the cache.
	 * - The document will be tokenized before parsing statements.
	 */
	async parse(textDocument: TextDocumentItem): Promise<FileMap> {

		if (this.grammar === null) {
			await this.initialize();
		}

		// if the document exists in the cache, remove it
		if (globalTokenCache.has(textDocument.uri)) {
			globalTokenCache.delete(textDocument.uri);
		}

		this.tokenizeInitialDocument(textDocument);
		
		return this.parseStatements(textDocument);

	}

	/**
	 * Parses changes in a text document and updates the token cache accordingly.
	 * If the grammar is not initialized, it initializes it first.
	 * If the token cache does not have the document URI, it returns an empty FileMap.
	 * Otherwise, it tokenizes the changed document and parses the statements.
	 *
	 * @param textDocumentChangeParams - The parameters containing the text document change details.
	 * @returns A promise that resolves to a FileMap containing the parsed statements.
	 */
	async parseChange(textDocumentChangeParams: DidChangeTextDocumentParams): Promise<FileMap> {

		if (this.grammar === null) {
			await this.initialize();
		}

		if (!globalTokenCache.has(textDocumentChangeParams.textDocument.uri)) {
			return {};
		}

		this.tokenizeChangeDocument(textDocumentChangeParams);
		const fullText = globalTokenCache.get(textDocumentChangeParams.textDocument.uri)!.getText();

		const textDocument = {
			uri: textDocumentChangeParams.textDocument.uri,
			text: fullText,
			version: textDocumentChangeParams.textDocument.version,
			languageId: 'googlesql'
		};
		
		return this.parseStatements(textDocument);

	}

	/**
	 * Parses the statements from a given text document and returns a file map.
	 *
	 * @param textDocument - The text document to parse.
	 * @returns A file map where each key is the index of the statement and the value is the parsed statement object.
	 */
	private parseStatements(textDocument: TextDocumentItem): FileMap {
		const statements = this.splitSource(textDocument.text);
		let startLine: number = 0;
		const fileMap: FileMap = {};

		for (let i = 0; i < statements.length; i++) {
			const statement: MatchObj = statements[i];

			const s = this.parseStatement(
				range(startLine, statement.line + 1).map((line) => {
					if (globalTokenCache.get(textDocument.uri)?.has(line)) {
						return globalTokenCache.get(textDocument.uri)?.get(line)?.tokens;
					}
				})
				.flat()
				.filter((t) => t !== undefined)
			);

			s.statement = statement.statement;
			fileMap[i] = s;
			startLine = statement.line + 1;

		}

		return fileMap;
	}

	/**
	 * Handles changes to the content of a text document.
	 *
	 * @param change - The change event containing details about the content change.
	 * @param document - The identifier for the versioned text document.
	 *
	 * This method updates the token cache based on the changes made to the document.
	 * If the change includes a range, it updates the cache by processing the lines
	 * within the range and adjusting the line numbers accordingly. If the change
	 * does not include a range, it re-tokenizes the entire document and updates the cache.
	 */
	private handleContentChange(change: TextDocumentContentChangeEvent, document: VersionedTextDocumentIdentifier) {
		const cache = globalTokenCache.get(document.uri)!;

		if ('range' in change) {
			const startLine = change.range.start.line;
			const endLine = change.range.end.line;
			const linesBeingReplaced = endLine - startLine;
		
			const newLines = change.text.split('\n');
			const lineDelta = (newLines.length - 1) - linesBeingReplaced;
		
			const changedRange: ChangedRange = {
				startLine: startLine,
				endLine: endLine + 1,
				startIndex: change.range.start.character,
				endIndex: change.range.end.character,
			};

			// if all checks pass then we are removing line(s)
			if (lineDelta < 0) {
				// alter the changedRange so that the starting line if the previous line and
				// starting index is the end of that line.
				// end line should now be the endLine - 1
				changedRange.startLine = startLine - 1;
				changedRange.endLine = endLine;
				changedRange.startIndex = cache.get(startLine - 1)?.value.length ?? 0;
				changedRange.endIndex = changedRange.startIndex;
			}


			// Create new cache incorporating changes
			const newCache = new DocumentCache();
			for (const [lineNumber, lineToken] of cache.entries()) {
			// for (const lineNumber of range(changedRange.start, documentLength)) {
				// const lineToken = cache.get(lineNumber);
				if (lineNumber >= changedRange.endLine) {

					// alter line numbers
					lineToken!.lineNumber = lineNumber + lineDelta;
					lineToken!.tokens = lineToken!.tokens.map((token) => {
						token.lineNumber = lineNumber + lineDelta;
						return token;
					});

					newCache.set(lineNumber + lineDelta, lineToken); // Shift lines up
				} else if (lineNumber >= changedRange.startLine) {
					// line is changed...
					if (linesBeingReplaced === 0) {
						newLines.map((line, index, array) => {
							const[ newLineNumber, newLineToken] = this.processLineUpdate(index, line, array.length, lineNumber, lineToken!, changedRange);
							newCache.set(newLineNumber, newLineToken);
						});
					} else {
						// lines being replaced
						const workingLineNumber = lineNumber - changedRange.startLine;
						if (workingLineNumber < newLines.length) {
							// line is being updated
							const [newLineNumber, newLineToken] = this.processLineReplace(workingLineNumber, newLines[workingLineNumber], newLines.length, lineNumber, lineToken!, changedRange);
							newCache.set(newLineNumber, newLineToken);
						}
						// else line is being deleted so do nothing
					}
				} else {
					newCache.set(lineNumber, lineToken!);
				}
			}
			globalTokenCache.set(document.uri, newCache);
		} else {
			const textDocument = {
				uri: document.uri,
				text: change.text,
				version: document.version,
				languageId: 'googlesql'
			};
			// if the document exists in the cache, remove it
			if (globalTokenCache.has(textDocument.uri)) {
				globalTokenCache.delete(textDocument.uri);
			}

			this.tokenizeInitialDocument(textDocument);
		}
	}

	/**
	 * Processes a line replacement by updating the line with the new content.
	 *
	 * @param index - The index of the line to be replaced.
	 * @param newLine - The new content for the line.
	 * @param newLinesCount - The number of new lines to be added.
	 * @param lineNumber - The current line number.
	 * @param lineToken - The token representing the line.
	 * @param change - The range of changes to be applied.
	 * @returns A tuple containing the updated line number and the updated line token.
	 */
	private processLineReplace(index: number, newLine: string, newLinesCount: number, lineNumber: number, lineToken: LineToken, change: ChangedRange): [number, LineToken] {
		return this.processLineUpdate(index, newLine, newLinesCount, lineNumber-index, lineToken, change);
	}

	/**
	 * Processes an update to a line of text, adjusting the line number and token as necessary.
	 *
	 * @param index - The index of the line being updated relative to the change.
	 * @param newLine - The new content of the line.
	 * @param newLinesCount - The total number of new lines introduced by the change.
	 * @param lineNumber - The original line number before the update.
	 * @param lineToken - The token associated with the original line.
	 * @param change - The range of the change within the line.
	 * @returns A tuple containing the new line number and the updated line token.
	 */
	private processLineUpdate(index: number, newLine: string, newLinesCount: number, lineNumber: number, lineToken: LineToken, change: ChangedRange): [number, LineToken] {
		const newLineNumber = lineNumber + index;
		const retainedLinePrefix = index === 0 ? lineToken!.value.substring(0, change.startIndex) : '';
		const retainedLineSuffix = index === (newLinesCount - 1) ? lineToken!.value.substring(change.endIndex) : '';
		const value = retainedLinePrefix + newLine + retainedLineSuffix;
		if (value === lineToken?.value && lineToken?.lineNumber === newLineNumber) {
			return [newLineNumber, lineToken!];
		} else {
			const ruleStack = lineToken === undefined ? null : lineToken.ruleStack;
			const tokens = Parser.tokenize(this.grammar!, new Map([[newLineNumber, value]]), ruleStack);
			return [newLineNumber, tokens[0]];
		}
	}

	/**
	 * Tokenizes the changes in a document.
	 *
	 * @param document - The parameters of the document that has changed, including the content changes and the text document.
	 */
	private tokenizeChangeDocument(document: DidChangeTextDocumentParams) {
		document.contentChanges.map((change) => this.handleContentChange(change, document.textDocument));
	}

	/**
	 * Tokenizes the initial document.
	 *
	 * @param document - The text document item to tokenize.
	 */
	private tokenizeInitialDocument(document: TextDocumentItem) {
		
		const lineMap = new Map<number, string>();

		document.text.split('\n').map((line, index) => {
			lineMap.set(index, line);
		});

		const tokens = Parser.tokenize(this.grammar!, lineMap);

		const cache: DocumentCache = new DocumentCache();

		tokens.map((lineToken) => {
			cache.set(lineToken.lineNumber!, lineToken);
		});

		globalTokenCache.set(document.uri, cache);

	}

	/**
	 * Parses a list of tokens into a StatementAST.
	 *
	 * @param tokens - The list of tokens to parse.
	 * @returns The parsed StatementAST.
	 *
	 * This method processes the tokens to form a statement by applying syntax rules.
	 * It handles punctuation, skips certain tokens, and checks for syntax errors.
	 * If a rule is matched, it processes the rule and resets the state for the next potential statement.
	 *
	 * The method uses a recursive lookahead to handle nested structures and ensures that
	 * infinite loops are avoided by using a reCheck flag.
	 */
	private parseStatement(tokens: Token[]): StatementAST {

		const statement = new StatementAST(tokens);

		if (tokens.length === 0) {
			return statement;
		}

		let rules = syntaxRules;
		let expressionTokens: Token[] = [];
		let tokenCounter: number = 0;
		let reCheck: boolean = true; // used to stop infinite loops
		statement.tokens = tokens;
		statement.startLine = tokens[0].lineNumber;

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

			rules = this.filterRules(token, tokenCounter, tokens.slice(i + 1), rules);

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
				const matchedRule = new MatchedRule(rules.find((rule) => rule.scopes.join('|') === this.getMatchedTokens(expressionTokens)) ?? null, expressionTokens);

				if (matchedRule.rule && matchedRule.rule.type === 'subquery') {
					// process subquery
					// subqueries need to be processed separately as they are not part of the main statement
					// create a subset of tokens, using parentheses as the start and end tokens
					const subqueryTokens: Token[] = [];

					let parenCounter = 0;

					for (let j = i; j < tokens.length; j++) {
						const subqueryToken = tokens[j];
						subqueryTokens.push(subqueryToken);
						if (subqueryToken.scopes.filter((scope) => recursiveGroupBegin.includes(scope)).length > 0) {
							parenCounter++;
						} else if (subqueryToken.scopes.filter((scope) => recursiveGroupEnd.includes(scope)).length > 0) {
							parenCounter--;
						}
						if (parenCounter === 0) {
							i = j + 1;
							break;
						}
					}

					const subqueryStatement = this.parseStatement(subqueryTokens.slice(1, subqueryTokens.length - 1));

					if (matchedRule.rule.alias === true) {
						const [matchedRules, y] = this.recursiveLookahead(tokens.slice(i + 1), syntaxRules.filter((rule) => ["implicit.alias", "explicit.alias"].includes(rule.name)));
						if (matchedRules.length > 0) {
							const alias = includeTokensWithMatchingScopes(matchedRules[0].tokens, ["entity.name.alias.sql", "entity.name.tag"]);
							if (alias.length > 0) {
								subqueryStatement.alias = alias[0].value;
							}
						}
						i += y;
					}

					if (matchedRule.rule.name === "from.subquery") {
						statement.from = subqueryStatement;
					}
					reset();
					continue;

				}

				if (matchedRule.rule && matchedRule.rule.recursive) {
					const [matchedRules, y] = this.recursiveLookahead(tokens.slice(i + 1), null, matchedRule.rule.end);
					matchedRule.matches!.push(...matchedRules);
					i += y;
				}

				if (matchedRule.rule) {
					if (matchedRule.rule.children != null) {
						const [matchedRules, y] = this.recursiveLookahead(tokens.slice(i + 1), syntaxRules.filter((rule) => matchedRule.rule?.children?.includes(rule.name)));
						matchedRule.matches!.push(...matchedRules);
						i += y;
					}
					if (matchedRule.rule.alias === true) {
						const [matchedRules, y] = this.recursiveLookahead(tokens.slice(i + 1), syntaxRules.filter((rule) => ["implicit.alias", "explicit.alias"].includes(rule.name)));
						matchedRule.matches!.push(...matchedRules);
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
	 * @name filterRules
	 * @private
	 */
	private filterRules(token: Token, tokenCounter: number, nextTokens: Token[], rules: Rule[]): Rule[] {

		const passingRules: Rule[] = [];
		for (const rule of rules) {
			if (!(token.scopes.includes(rule.scopes[tokenCounter]) || rule.scopes[tokenCounter] === '*')) {
				continue;
			}

			if (rule.lookahead > 0 || rule.negativeLookahead != null) {
				if (!this.lookahead(nextTokens, rule, tokenCounter + 1)) {
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
	private lookahead(tokens: Token[], rule: Rule, currentMatchCount: number): Rule | null {
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


		const lengthCheck = filteredTokens.length + tokenCounter;
		// if we've matched all the tokens but we have a negativeLookahead, then if filtered length is less
		// than the number of tokens we need to check return the rule
		if (checkIndex === rule.scopes.length && lengthCheck < rule.lookahead) {
			return rule;
		}

		// if filtered length is less than the number of tokens we need to check return null
		if (lengthCheck < rule.lookahead) {
			return null;
		}

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
			} else if (tokenCounter >= rule.lookahead && rule.negativeLookahead === null) {
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
	private recursiveLookahead(tokens: Token[], rules?: Rule[] | null, endToken?: string[] | null): [MatchedRule[], number] {
		const matches: MatchedRule[] = [];
		const exitOnMatch: boolean = rules != null;
		let workingRules: Rule[] = [];
		let expressionTokens: Token[] = [];
		let tokenCounter: number = 0;
		let reCheck: boolean = true; // used to stop infinite loops
		const setRules = () => {
			if (rules == null) {
					workingRules = syntaxRules;
			} else {
					workingRules = rules;
			}
		};
		const reset = () => {
			setRules();
			expressionTokens = [];
			tokenCounter = 0;
		};
		let loopCounter = 0;
		setRules();

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

			workingRules = this.filterRules(token, tokenCounter, tokens.slice(i + 1), workingRules);

			if (token.scopes.filter((scope) => recursiveGroupBegin.includes(scope)).length > 0 && workingRules.length === 0) {
				const [matchedRules, y] = this.recursiveLookahead(tokens.slice(i + 1));
				matches.push(...matchedRules);
				i += y;
				reset();
				continue;
			}

			if (workingRules.length === 0) {
				if (reCheck) {
					i--; // restart checking from the last token
					reCheck = false;
				} else if (reCheck === false && rules != null && exitOnMatch) {
					// in this scenario we are searching for a sepcific rule subset
					// the token has been checked and no rules have matched so exit.
					loopCounter = 0; // reset loop counter because we never matched anything
					break;
				} else {
					reCheck = true;
				}
				reset();
				continue;
			}

			reCheck = true;

			tokenCounter++;

			expressionTokens.push(token);

			const matchedRule = new MatchedRule( workingRules.find((rule) => rule.scopes.join('|') === this.getMatchedTokens(expressionTokens)) ?? null, expressionTokens);

			if (matchedRule.rule && matchedRule.rule.recursive) {
				const [matchedRules, y] = this.recursiveLookahead(tokens.slice(i + 1), null, matchedRule.rule.end);
				matchedRule.matches!.push(...matchedRules);
				i += y;
			}

			if (matchedRule.rule) {
				matches.push(matchedRule);
				loopCounter = i;
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
	static tokenize(grammar: Grammar, source: LineMap, ruleStack: RuleStack | null = null, lineNumber: number = 0): LineToken[] {


		const tokenizedLines: GrammarTokenizeLineResult[] = [];

		const lineTokens: LineToken[] = [];

		for (const [lineNumber, line] of source.entries()) {
			
			// Initial tokenization
			const result = grammar.tokenizeLine(line, ruleStack);
		
			if (result.stoppedEarly) {
				let startIndex = result.tokens[result.tokens.length - 1].endIndex;
				let currentLine = line.substring(startIndex);
				let currentRuleStack = result.ruleStack;
		
				while (currentLine.length > 0) {
					const newResult = grammar.tokenizeLine(currentLine, currentRuleStack);
		
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
			lineTokens.push(LineToken.fromGrammarTokens(result.tokens, line, lineNumber, result.ruleStack));
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
	private getMatchedTokens(tokens: Token[]): string {
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
	private splitSource(source: string): MatchObj[] {

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
				"end": match.index + 1,
				"start": start,
				"line": lines.indexOf(lines.find((line) => (match?.index ?? -1) >= line.start && (match?.index ?? -1) < line.end) ?? lines[0]),
				"statement": source.substring(start, match.index + 1)
			};
			start = m.end + 1;
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

		if (statements[statements.length - 1].end < source.length) {
			statements.push({
				"start": statements[statements.length - 1].end,
				"end": source.length,
				"statement": source.substring(statements[statements.length - 1].end, source.length),
				"line": lines.indexOf(lines.find((line) => source.length >= line.start && source.length < line.end) ?? lines[0]),
			});
		}

		return statements;

	}
}

// #endregion
