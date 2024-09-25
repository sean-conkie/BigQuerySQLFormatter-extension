
import { mergeArrayToUnique } from '../../utils';
import { GrammarToken, RuleStack } from '../grammarLoader';


// region functions


/**
 * Joins the values of an array of tokens into a single string, with an optional character separator.
 *
 * @param tokens - An array of Token objects whose values need to be joined.
 * @param char - An optional string character to separate each token value. Defaults to an empty string.
 * @returns A single string composed of the token values joined by the specified character.
 */
export function joinTokenValues(tokens: Token[], char: string = ''): string {
	return tokens.map((token) => token.value).join(char);
}

// endregion functions

/**
 * A class that represents a token in a line of code.
 */
export class Token extends GrammarToken {
	value: string;
	lineNumber: number | null = null;

	/**
	 * Constructs a new instance of the class.
	 * 
	 * @param scopes - An array of scope strings.
	 * @param startIndex - The starting index of the token.
	 * @param endIndex - The ending index of the token.
	 * @param value - The value of the token.
	 * @param lineNumber - The line number where the token is located, or null if not applicable.
	 */
	constructor(scopes: string[], startIndex: number, endIndex: number, value: string, lineNumber: number | null = null) {
		super(scopes, startIndex, endIndex);
		this.value = value;
		this.lineNumber = lineNumber;
	}

	/**
	 * Creates a `Token` instance from a given `GrammarToken`.
	 *
	 * @param grammarToken - The grammar token containing scope and index information.
	 * @param sourceLine - The source line from which the token value is extracted.
	 * @param lineNumber - The line number where the token is located, or `null` if not applicable.
	 * @returns A new `Token` instance with the extracted value and provided information.
	 */
	static fromGrammarToken(grammarToken: GrammarToken, sourceLine: string, lineNumber: number | null = null): Token {
		const value = sourceLine.substring(grammarToken.startIndex, grammarToken.endIndex);
		return new Token(grammarToken.scopes, grammarToken.startIndex, grammarToken.endIndex, value, lineNumber);
	}

}

/**
 * A class that represents a line of code.
 */
export class LineToken extends GrammarToken {
	value: string;
	lineNumber: number | null = null;
	/**
	 * An array of Token objects.
	 * This array is used to store the tokens parsed by the linter.
	 */
	tokens: Token[] = [];
	ruleStack: RuleStack;


	/**
	 * Constructs a new instance of the class.
	 * 
	 * @param scopes - An array of scope strings.
	 * @param startIndex - The starting index of the token.
	 * @param endIndex - The ending index of the token.
	 * @param value - The value of the token.
	 * @param lineNumber - The line number where the token is located, or null if not applicable.
	 * @param tokens - An array of child tokens, defaults to an empty array.
	 */
	constructor(scopes: string[], startIndex: number, endIndex: number, value: string, lineNumber: number | null = null, tokens: Token[] = [], ruleStack: RuleStack) {
		super(scopes, startIndex, endIndex);
		this.value = value;
		this.lineNumber = lineNumber;
		this.tokens = tokens;
		this.ruleStack = ruleStack;
	}

	/**
	 * Creates a `LineToken` from an array of `GrammarToken` objects.
	 *
	 * @param grammarTokens - An array of `GrammarToken` objects to be converted.
	 * @param sourceLine - The source line of text from which the tokens are derived.
	 * @param lineNumber - The line number in the source text, or `null` if not applicable.
	 * @returns A `LineToken` object representing the combined tokens.
	 * @throws Will throw an error if any token does not have defined start and end indexes.
	 */
	static fromGrammarTokens(grammarTokens: GrammarToken[], sourceLine: string, lineNumber: number | null = null, ruleStack: RuleStack): LineToken {
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
			tokens,
			ruleStack
		);

	}

}