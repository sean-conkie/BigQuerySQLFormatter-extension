
import { GrammarLoader, Grammar, GrammarTokenizeLineResult } from '../grammarLoader';
import { LineToken, Token } from './token';

/**
 * Filter the tokens to only include the one with the given scope
 * @param {GrammarToken[][] | LineToken[]} tokens The tokens to filter
 * @param {string} scope The scope to filter the tokens by
 * @returns {GrammarToken | null} The token with the given scope
 * @name findToken
 */
export function findToken(tokens: LineToken[] | Token[], scope: string): Token | null {
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
 * Sorts an array of tokens based on their line number and start index.
 * 
 * @param tokens - The array of tokens to be sorted.
 * @returns The sorted array of tokens.
 */
export function sortTokens(tokens: Token[]): Token[] {

	return tokens.sort((a, b) => {
		if (a.lineNumber === b.lineNumber) {
			return (a.startIndex ?? 0) - (b.startIndex ?? 0);
		}
		return (a.lineNumber ?? 0) - (b.lineNumber ?? 0);
	});
}