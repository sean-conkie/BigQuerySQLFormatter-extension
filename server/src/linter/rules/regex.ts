import { Range } from 'vscode-languageserver/node';


/**
 * Represents a position in a text document with a specific line and character.
 * 
 * @typedef {Object} MatchPosition
 * @property {number} line - The line number in the document (0-based).
 * @property {number} character - The character position within the line (0-based).
 */
export type MatchPosition = { line: number, character: number }


/**
 * Finds and returns the ranges of all matches of a given regular expression pattern in a test string.
 *
 * @param pattern - The regular expression pattern to search for.
 * @param test - The string to test against the regular expression pattern.
 * @returns An array of `Range` objects representing the start and end positions of each match, or `null` if no matches are found.
 */
export function getRegexMatchRanges(pattern: RegExp, test: string): Range[] | null {

	// Reset the regex, regexes are stateful
	pattern.lastIndex = 0;

	const matches: Range[] = [];
	
	let match;
	while ((match = pattern.exec(test)) != null) {
			let groupStartIndex: number;
			let groupEndIndex: number;
			if (match.length > 1) {
				[groupStartIndex, groupEndIndex] = getCaptureGroupIndices(match, match.slice(1).findIndex((group) => group != null) + 1);
			} else {
				groupStartIndex = match.index;
				groupEndIndex = pattern.lastIndex;
			}
			const start: MatchPosition = getLineAndCharacter(test, groupStartIndex);
			const end: MatchPosition = getLineAndCharacter(test, groupEndIndex);
			const range = {
					start: start,
					end: end
			};
	
			matches.push(range);
	}
	
	return matches;
}
	
/**
 * Retrieves the start and end indices of a specific capture group within a regular expression match.
 *
 * @param match - The result of a regular expression execution, containing the matched text and capture groups.
 * @param groupNumber - The index of the capture group to locate.
 * @returns A tuple containing the start and end indices of the specified capture group.
 *          If the capture group is not matched, returns the indices of the overall match.
 */
export function getCaptureGroupIndices(match: RegExpExecArray, groupNumber: number): [number, number] {

		if (match[groupNumber] == null) {
			return [match.index, match.index + match[0].length];
		}

		const overallMatchStartIndex = match.index;
		let searchStart = 0;
		for (let i = 1; i <= groupNumber; i++) {
				const groupText = match[i];
				if (groupText == null) {
					continue; // Skip unmatched groups
				}
				const idxInMatch0 = match[0].indexOf(groupText, searchStart);
				if (idxInMatch0 === -1) {
					return [match.index, match.index + match[0].length];
				}
				if (i === groupNumber) {
						const groupStartIndex = overallMatchStartIndex + idxInMatch0;
						const groupEndIndex = groupStartIndex + groupText.length;
						return [groupStartIndex, groupEndIndex];
				}
				searchStart = idxInMatch0 + groupText.length;
		}
		return [match.index, match.index + match[0].length];
}

/**
 * Gets the line and character position of a match index within a given content string.
 *
 * @param content - The content string to search within.
 * @param matchIndex - The index of the match within the content string.
 * @returns An object containing the line and character position of the match.
 * @throws Will throw an error if the match index is out of range.
 */
export function getLineAndCharacter(content: string, matchIndex: number): MatchPosition {
		const lines = content.split('\n');
		let runningTotal = 0;
		for (let i = 0; i < lines.length; i++) {
				if (runningTotal + lines[i].length + 1 > matchIndex) {
						return { line: i, character: matchIndex - runningTotal };
				}
				runningTotal += lines[i].length + 1;
		}
		throw new Error('Match index out of range');
}