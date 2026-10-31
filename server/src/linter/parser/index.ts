import syntaxJson from '../syntaxes/syntax.json';
import { GrammarLoader, type Grammar, type GrammarTokenizeLineResult, type RuleStack } from '../grammarLoader';
import { type Token, LineToken, includeTokensWithMatchingScopes } from './token';
import type { Rule } from './matches';
import { StatementAST } from './ast';
import { type MatchObj, MatchedRule } from './matches';
import { globalTokenCache, DocumentCache } from './tokenCache';
import type {
  DidChangeTextDocumentParams,
  TextDocumentItem,
  TextDocumentContentChangeEvent,
  VersionedTextDocumentIdentifier,
} from 'vscode-languageserver';
import { CancellationToken } from 'vscode-languageserver';
import { checkCancellation, yieldToEventLoop } from '../../cancellation';
import { findToken } from './utils';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { sourceTokens } from '../rules/source';
import { pipeClauses, unsupportedQuery } from './pipe';
import { QueryScopeResolver } from '../scope';
import {
  comparePositions,
  containsExtendedSyntax,
  hasExtendedSyntax,
  isCode,
  nestedQuerySlices,
  tokenRange,
} from './queryBlocks';

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
  readonly ignoreScopes: string[] = ['comment.line.double-dash.sql', 'punctuation.definition.comment.sql'];
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
  async parse(textDocument: TextDocumentItem, token: CancellationToken = CancellationToken.None): Promise<FileMap> {
    checkCancellation(token);
    if (this.grammar === null) {
      await this.initialize();
    }
    checkCancellation(token);

    await this.tokenizeInitialDocument(textDocument, token);

    return this.parseStatements(
      {
        ...textDocument,
        text: globalTokenCache.get(textDocument.uri)!.getText(),
      },
      token,
    );
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
  async parseChange(
    textDocumentChangeParams: DidChangeTextDocumentParams,
    token: CancellationToken = CancellationToken.None,
  ): Promise<FileMap> {
    checkCancellation(token);
    if (this.grammar === null) {
      await this.initialize();
    }
    checkCancellation(token);

    if (!globalTokenCache.has(textDocumentChangeParams.textDocument.uri)) {
      return {};
    }

    await this.tokenizeChangeDocument(textDocumentChangeParams, token);
    const fullText = globalTokenCache.get(textDocumentChangeParams.textDocument.uri)!.getText();

    const textDocument = {
      uri: textDocumentChangeParams.textDocument.uri,
      text: fullText,
      version: textDocumentChangeParams.textDocument.version,
      languageId: 'googlesql',
    };

    return this.parseStatements(textDocument, token);
  }

  /**
   * Parses the statements from a given text document and returns a file map.
   *
   * @param textDocument - The text document to parse.
   * @returns A file map where each key is the index of the statement and the value is the parsed statement object.
   */
  private async parseStatements(textDocument: TextDocumentItem, token: CancellationToken): Promise<FileMap> {
    const tokens = [...globalTokenCache.get(textDocument.uri)!.tokens].flatMap((line) => line.tokens);
    const statements = this.splitSource(textDocument.text, tokens);
    const fileMap: FileMap = {};
    const source = sourceTokens(globalTokenCache.get(textDocument.uri)!);

    for (let i = 0; i < statements.length; i++) {
      await yieldToEventLoop(token);
      const statement: MatchObj = statements[i];

      const s = await this.parseStatement(statements[i].tokens, token);
      const model = (block: StatementAST) => {
        const range = block.sourceRange ?? tokenRange(block.tokens);
        block.sourceTokens = source.filter(
          (part) =>
            comparePositions(part.range.start, range.start) >= 0 && comparePositions(part.range.end, range.end) <= 0,
        );
        const resolver = new QueryScopeResolver(block.sourceTokens);
        block.pipeClauses = pipeClauses(block.sourceTokens).map(
          (stage) => resolver.scopes.find((scope) => scope.pipe?.start === stage.start && !scope.parent)?.pipe ?? stage,
        );
        if (block.hasExtendedQuerySyntax) block.pipeInput = resolver.scopes[0]?.sources ?? [];
        block.hasUnsupportedQuerySyntax = unsupportedQuery(block.sourceTokens);
        block.queryBlocks.forEach(model);
      };
      if (s.tokens.length && (s.hasExtendedQuerySyntax || s.queryBlocks.length)) model(s);

      s.statement = statement.statement;
      fileMap[i] = s;
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
  private async handleContentChange(
    change: TextDocumentContentChangeEvent,
    document: VersionedTextDocumentIdentifier,
    token: CancellationToken,
  ) {
    checkCancellation(token);
    const cache = globalTokenCache.get(document.uri)!;

    if ('range' in change) {
      const startLine = change.range.start.line;
      const endLine = change.range.end.line;
      const lines = Array.from(cache.tokens, (line) => line.value);
      const newLines = change.text.split(/\r\n?|\n/);
      newLines[0] = lines[startLine].substring(0, change.range.start.character) + newLines[0];
      newLines[newLines.length - 1] += lines[endLine].substring(change.range.end.character);
      lines.splice(startLine, endLine - startLine + 1, ...newLines);

      const newCache = new DocumentCache(cache.eol);
      for (let line = 0; line < startLine; line++) {
        newCache.set(line, cache.get(line)!);
      }

      // The edited line starts in the previous line's end state, not its own.
      const ruleStack = cache.get(startLine - 1)?.ruleStack ?? null;
      const lineMap = new Map(lines.slice(startLine).map((line, index) => [startLine + index, line]));
      for (const lineToken of await this.tokenizeLines(lineMap, ruleStack, token)) {
        newCache.set(lineToken.lineNumber!, lineToken);
      }

      globalTokenCache.set(document.uri, newCache);
    } else {
      const textDocument = {
        uri: document.uri,
        text: change.text,
        version: document.version,
        languageId: 'googlesql',
      };
      // if the document exists in the cache, remove it
      if (globalTokenCache.has(textDocument.uri)) {
        globalTokenCache.delete(textDocument.uri);
      }

      await this.tokenizeInitialDocument(textDocument, token);
    }
  }

  /**
   * Tokenizes the changes in a document.
   *
   * @param document - The parameters of the document that has changed, including the content changes and the text document.
   */
  private async tokenizeChangeDocument(document: DidChangeTextDocumentParams, token: CancellationToken) {
    for (const change of document.contentChanges) {
      await this.handleContentChange(change, document.textDocument, token);
    }
  }

  /**
   * Tokenizes the initial document.
   *
   * @param document - The text document item to tokenize.
   */
  private async tokenizeInitialDocument(document: TextDocumentItem, token: CancellationToken) {
    const lineMap = new Map<number, string>();

    document.text.split(/\r\n?|\n/).forEach((line, index) => {
      lineMap.set(index, line);
    });

    const tokens = await this.tokenizeLines(lineMap, null, token);

    const cache: DocumentCache = new DocumentCache(document.text.match(/\r\n?|\n/)?.[0]);

    tokens.forEach((lineToken) => {
      cache.set(lineToken.lineNumber!, lineToken);
    });

    globalTokenCache.set(document.uri, cache);
  }

  private async tokenizeLines(
    lines: LineMap,
    ruleStack: RuleStack | null,
    token: CancellationToken,
  ): Promise<LineToken[]> {
    const entries = [...lines.entries()];
    const tokens: LineToken[] = [];
    for (let i = 0; i < entries.length; i += 50) {
      await yieldToEventLoop(token);
      const batch = Parser.tokenize(this.grammar!, new Map(entries.slice(i, i + 50)), ruleStack);
      tokens.push(...batch);
      ruleStack = batch[batch.length - 1].ruleStack;
    }
    return tokens;
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
  private async parseStatement(
    tokens: Token[],
    cancellation: CancellationToken,
    partitionQueries = false,
  ): Promise<StatementAST> {
    if (!partitionQueries && !containsExtendedSyntax(tokens)) {
      return this.parseTraditionalStatement(tokens, cancellation);
    }
    const children = nestedQuerySlices(tokens);
    const ownTokens: Token[] = [];
    const queryBlocks: StatementAST[] = [];
    let start = 0;
    for (const child of children) {
      ownTokens.push(...tokens.slice(start, child.start));
      start = child.end;
    }
    ownTokens.push(...tokens.slice(start));
    const extended = hasExtendedSyntax(ownTokens);
    for (const child of children) {
      queryBlocks.push(await this.parseStatement(tokens.slice(child.start, child.end), cancellation, true));
    }
    // Restart highlighting for the traditional block: pipe-stage scopes can otherwise
    // affect FROM/alias scopes after a nested pipeline has closed.
    let traditionalTokens = ownTokens;
    if (!extended) {
      if (ownTokens.find(isCode)?.value.toUpperCase() === 'WITH') {
        let depth = 0;
        const select = ownTokens.findIndex((token) => {
          if (token.scopes.includes('punctuation.definition.section.bracket.round.begin.sql')) depth++;
          if (token.scopes.includes('punctuation.definition.section.bracket.round.end.sql')) depth--;
          return (
            depth === 0 &&
            token.value.toUpperCase() === 'SELECT' &&
            token.scopes.some((scope) => scope.startsWith('keyword.'))
          );
        });
        if (select >= 0) traditionalTokens = ownTokens.slice(select);
      }
      const lines = new Map<number, string>();
      for (const token of traditionalTokens) {
        if (token.lineNumber === null) throw new Error('Query token has no line number');
        const prefix = (lines.get(token.lineNumber) ?? '').padEnd(token.startIndex, ' ');
        lines.set(token.lineNumber, prefix + token.value);
      }
      traditionalTokens = (await this.tokenizeLines(lines, null, cancellation)).flatMap((line) => line.tokens);
    }
    const statement = extended
      ? new StatementAST(tokens)
      : await this.parseTraditionalStatement(traditionalTokens, cancellation, queryBlocks);
    if (!extended) {
      let depth = 0;
      const projectionEnd = traditionalTokens.find((token) => {
        if (token.scopes.includes('punctuation.definition.section.bracket.round.begin.sql')) depth++;
        if (token.scopes.includes('punctuation.definition.section.bracket.round.end.sql')) depth--;
        return (
          depth === 0 &&
          /^(FROM|WHERE|GROUP BY|HAVING|QUALIFY|WINDOW|ORDER BY|LIMIT|UNION|EXCEPT|INTERSECT)$/i.test(token.value) &&
          token.scopes.some((scope) => scope.startsWith('keyword.'))
        );
      });
      if (projectionEnd) {
        const end = tokenRange([projectionEnd]).start;
        statement.columns = statement.columns.filter(
          (column) =>
            column.startLine !== null &&
            column.startIndex !== null &&
            comparePositions({ line: column.startLine, character: column.startIndex }, end) < 0,
        );
      }
    }
    statement.sourceRange = tokenRange(tokens);
    statement.queryBlocks = queryBlocks;
    statement.hasExtendedQuerySyntax = extended;
    if (statement.hasExtendedQuerySyntax) {
      let depth = 0;
      const activeStages = new Map<number, StatementAST['pipeStages'][number]>();
      for (const token of tokens) {
        if (token.scopes.includes('keyword.operator.pipe.sql')) {
          const stage: StatementAST['pipeStages'][number] = { operator: '', depth, tokens: [] };
          activeStages.set(depth, stage);
          statement.pipeStages.push(stage);
        }
        for (const stage of activeStages.values()) {
          stage.tokens.push(token);
          if (
            stage.depth === depth &&
            (token.scopes.includes('keyword.control.pipe.sql') ||
              (!stage.operator && token.scopes.includes('keyword.control.query.sql')))
          ) {
            stage.operator = `${stage.operator ? `${stage.operator} ` : ''}${token.value.toUpperCase().replace(/\s+/g, ' ')}`;
          }
        }
        if (token.scopes.includes('punctuation.definition.section.bracket.round.begin.sql')) depth++;
        if (token.scopes.includes('punctuation.definition.section.bracket.round.end.sql')) {
          activeStages.delete(depth);
          depth--;
        }
      }
    }
    return statement;
  }

  private async parseTraditionalStatement(
    tokens: Token[],
    cancellation: CancellationToken,
    queryBlocks: StatementAST[] = [],
  ): Promise<StatementAST> {
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
      if (i % 256 === 0) {
        await yieldToEventLoop(cancellation);
      }
      const token = tokens[i];

      if (
        token.scopes.map((t) => skipTokens.includes(t)).includes(true) ||
        token.scopes.filter((scope) => !skipTokens.includes(scope.split('.')[0])).length === 0
      ) {
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
        const matchedRule = new MatchedRule(
          rules.find((rule) => rule.scopes.join('|') === this.getMatchedTokens(expressionTokens)) ?? null,
          expressionTokens,
        );

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

          const subqueryRange = tokenRange(subqueryTokens);
          const isolated = queryBlocks.find((block) => {
            const range = tokenRange(block.tokens);
            return (
              comparePositions(range.start, subqueryRange.start) > 0 &&
              (parenCounter > 0 || comparePositions(range.end, subqueryRange.end) <= 0)
            );
          });
          const subqueryStatement = isolated
            ? new StatementAST(isolated.tokens)
            : await this.parseStatement(subqueryTokens.slice(1, subqueryTokens.length - 1), cancellation);
          if (isolated && parenCounter > 0) i = tokens.length;

          if (matchedRule.rule.alias === true) {
            const [matchedRules, y] = this.recursiveLookahead(
              tokens.slice(i + 1),
              syntaxRules.filter((rule) => ['implicit.alias', 'explicit.alias'].includes(rule.name)),
            );
            if (matchedRules.length > 0) {
              const alias = includeTokensWithMatchingScopes(matchedRules[0].tokens, [
                'entity.name.alias.sql',
                'entity.name.tag',
              ]);
              if (alias.length > 0) {
                subqueryStatement.alias = alias[0].value;
              }
            }
            i += y;
          }

          if (matchedRule.rule.name === 'from.subquery') {
            statement.from = subqueryStatement;
          }
          reset();
          continue;
        }

        if (matchedRule.rule?.recursive) {
          const [matchedRules, y] = this.recursiveLookahead(tokens.slice(i + 1), null, matchedRule.rule.end);
          matchedRule.matches!.push(...matchedRules);
          i += y;
        }

        if (matchedRule.rule) {
          if (matchedRule.rule.children != null) {
            const [matchedRules, y] = this.recursiveLookahead(
              tokens.slice(i + 1),
              syntaxRules.filter((rule) => matchedRule.rule?.children?.includes(rule.name)),
            );
            matchedRule.matches!.push(...matchedRules);
            i += y;
          }
          if (matchedRule.rule.alias === true) {
            const [matchedRules, y] = this.recursiveLookahead(
              tokens.slice(i + 1),
              syntaxRules.filter((rule) => ['implicit.alias', 'explicit.alias'].includes(rule.name)),
            );
            matchedRule.matches!.push(...matchedRules);
            i += y;
          }
          statement.processRule(matchedRule);
          reset();
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
    const filteredTokens = tokens
      .filter(
        (token) =>
          token.scopes.map((t) => skipTokens.includes(t)).includes(true) ||
          token.scopes.filter((scope) => !skipTokens.includes(scope.split('.')[0])).length > 0,
      )
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
        } else {
          return null;
        }
      }
      // if i is greater than or equal to the lookahead counter and we have negative lookahead check if token matches negative lookahead
      else if (tokenCounter >= rule.lookahead && rule.negativeLookahead != null) {
        if (
          rule.negativeLookahead != null &&
          rule.negativeLookahead.filter((scope) => filteredTokens[i].scopes.includes(scope)).length > 0
        ) {
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
  private recursiveLookahead(
    tokens: Token[],
    rules?: Rule[] | null,
    endToken?: string[] | null,
  ): [MatchedRule[], number] {
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
      if (
        token.scopes.map((t) => skipTokens.includes(t)).includes(true) ||
        token.scopes.filter((scope) => !skipTokens.includes(scope.split('.')[0])).length === 0
      ) {
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
          // in this scenario we are searching for a specific rule subset
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

      const matchedRule = new MatchedRule(
        workingRules.find((rule) => rule.scopes.join('|') === this.getMatchedTokens(expressionTokens)) ?? null,
        expressionTokens,
      );

      if (matchedRule.rule?.recursive) {
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
  static tokenize(
    grammar: Grammar,
    source: LineMap,
    ruleStack: RuleStack | null = null,
    lineNumber: number = 0,
  ): LineToken[] {
    const tokenizedLines: GrammarTokenizeLineResult[] = [];

    const lineTokens: LineToken[] = [];

    for (const [lineNumber, line] of source.entries()) {
      // Initial tokenization
      const result = grammar.tokenizeLine(line, ruleStack);
      let endRuleStack = result.ruleStack;

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
        endRuleStack = currentRuleStack;
      }

      tokenizedLines.push(result);
      lineTokens.push(LineToken.fromGrammarTokens(result.tokens, line, lineNumber, endRuleStack));
      ruleStack = endRuleStack;
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
    return tokens
      .map(
        (t) =>
          t.scopes.filter((scope) => !skipTokens.includes(scope.split('.')[0]) && !punctuation.includes(scope)) ??
          [''][0],
      )
      .map((t) => t.filter((scope) => scope !== ''))
      .filter((t) => t.length > 0)
      .join('|');
  }

  /**
   * Split the source code into statements
   * @param {string} source The source code to split
   * @returns {MatchObj[]} The source code split into statements
   */
  private splitSource(source: string, tokens: Token[]): (MatchObj & { tokens: Token[] })[] {
    const document = TextDocument.create('', 'googlesql', 0, source);
    const statements: (MatchObj & { tokens: Token[] })[] = [];
    let start = 0;
    let tokenStart = 0;
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      if (!token.scopes.includes('punctuation.terminator.statement.semicolon.sql')) continue;
      if (token.lineNumber === null) throw new Error('Statement terminator has no line number');
      const end = document.offsetAt({ line: token.lineNumber, character: token.endIndex });
      statements.push({
        start,
        end,
        line: token.lineNumber,
        statement: source.slice(start, end),
        tokens: tokens.slice(tokenStart, index + 1),
      });
      start = end;
      tokenStart = index + 1;
    }
    if (start < source.length || statements.length === 0) {
      statements.push({
        start,
        end: source.length,
        statement: source.slice(start),
        line: document.positionAt(source.length).line,
        tokens: tokens.slice(tokenStart),
      });
    }

    return statements;
  }
}

// #endregion
