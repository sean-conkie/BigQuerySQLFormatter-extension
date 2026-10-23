import type { Range } from 'vscode-languageserver/node';

/**
 * Represents a position in a text document with a specific line and character.
 *
 * @typedef {Object} MatchPosition
 * @property {number} line - The line number in the document (0-based).
 * @property {number} character - The character position within the line (0-based).
 */
export type MatchPosition = { line: number; character: number };

/**
 * Finds and returns the ranges of all matches of a given regular expression pattern in a test string.
 *
 * @param pattern - The regular expression pattern to search for.
 * @param test - The string to test against the regular expression pattern.
 * @returns An array of `Range` objects representing the start and end positions of each match, or `null` if no matches are found.
 */
export function getRegexMatchRanges(
  pattern: RegExp,
  test: string,
  rangeGroups: readonly string[] = ['target'],
): Range[] | null {
  const flags = new Set(`${pattern.flags}dg`);
  const matcher = new RegExp(pattern.source, [...flags].join(''));

  const matches: Range[] = [];

  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Advance the stateful regex until it is exhausted.
  while ((match = matcher.exec(test)) != null) {
    const indices = rangeGroups.map((group) => match!.indices?.groups?.[group]).find((group) => group !== undefined);
    const [groupStartIndex, groupEndIndex] = indices ?? [match.index, match.index + match[0].length];
    const start: MatchPosition = getLineAndCharacter(test, groupStartIndex);
    const end: MatchPosition = getLineAndCharacter(test, groupEndIndex);
    const range = {
      start: start,
      end: end,
    };

    matches.push(range);
    if (match[0].length === 0) {
      matcher.lastIndex++;
    }
  }

  return matches;
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
