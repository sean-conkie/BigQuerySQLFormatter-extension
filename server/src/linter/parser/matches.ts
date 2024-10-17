import { Token } from './token';
import { sortTokens } from './utils';
/**
 * An object to store the match object when splitting the source code into statements
 * @typedef {Object} MatchObj
 * @property {number} end The end index of the statement
 * @property {number} start The start index of the statement
 * @property {string} statement The statement
 * @memberof Parser
 * @name MatchObj
 */
export type MatchObj = { end: number, start: number, statement: string, line: number };

// /**
//  * Represents a matched rule in the parsing process.
//  * 
//  * @typedef MatchedRule
//  * 
//  * @property {Rule | null} rule - The rule that was matched, or null if no rule was matched.
//  * @property {Token[]} tokens - The tokens that were matched by the rule.
//  * @property {MatchedRule[]} [matches] - Optional nested matches if the rule contains sub-rules.
//  */
// export type MatchedRule = { "rule": Rule | null, "tokens": Token[], "matches"?: MatchedRule[] };

/**
 * Represents a matched rule in the parsing process.
 */
export class MatchedRule {
  rule: Rule | null;
  tokens: Token[];
  matches?: MatchedRule[] = [];

  /**
   * Constructs a new instance of MatchedRule.
   *
   * @param rule - The rule that was matched, or null if no rule was matched.
   * @param tokens - The tokens that were matched by the rule.
   * @param matches - Optional nested matches if the rule contains sub-rules.
   */
  constructor(rule: Rule | null, tokens: Token[], matches?: MatchedRule[]) {
    this.rule = rule;
    this.tokens = tokens;

		if (matches) {
			this.matches = matches;
		}
  }

  /**
   * Retrieves a flattened list of all unique tokens from this rule and its nested matches.
   *
   * Tokens are considered unique based on their `lineNumber`, `startIndex`, and `endIndex`.
   */
  get allTokens(): Token[] {
    const tokens: Token[] = [];
    const tokenSet = new Set<string>();

    const collectTokens = (matchedRule: MatchedRule) => {
      for (const token of matchedRule.tokens) {
        const lineNumberKey = token.lineNumber !== null ? token.lineNumber : 'null';
        const key = `${lineNumberKey}-${token.startIndex}-${token.endIndex}`;

        if (!tokenSet.has(key)) {
          tokenSet.add(key);
          tokens.push(token);
        }
      }

      if (matchedRule.matches) {
        for (const childMatch of matchedRule.matches) {
          collectTokens(childMatch);
        }
      }
    };

    collectTokens(this);
    return sortTokens(tokens);
  }
}

/**
 * Represents a rule used in the linter parser.
 * 
 * @typedef {Object} Rule
 * @property {string} name - The name of the rule.
 * @property {string[]} scopes - The scopes where the rule is applicable.
 * @property {string} type - The type of the rule.
 * @property {number} lookahead - The number of tokens to look ahead.
 * @property {string[] | null} negativeLookahead - The tokens that should not follow.
 * @property {boolean} recursive - Indicates if the rule is recursive.
 * @property {string[] | null} children - The child rules.
 * @property {string[] | null} end - The tokens that signify the end of the rule.
 */
export type Rule = {
	name: string,
	scopes: string[],
	type: string,
	lookahead: number,
	negativeLookahead: string[] | null,
	recursive: boolean,
	children: string[] | null,
	end: string[] | null,
  alias: boolean
}
