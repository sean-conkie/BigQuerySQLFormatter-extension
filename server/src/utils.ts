/**
 * @fileoverview Module for utility functions
 * @module utils
 */

/**
 * Merge two arrays into a single array of unique items
 * @param a 
 * @param b 
 * @param predicate 
 * @returns Unique array of items from A and B
 */
export function mergeArrayToUnique (a: any, b: any, predicate = (a: any, b: any) => a === b): any[] {
	const c = [...a]; // copy to avoid side effects
	// add all items from B to copy C if they're not already present
	b.forEach((bItem: any) => (c.some((cItem) => predicate(bItem, cItem)) ? null : c.push(bItem)));
	return c;
}

/**
 * Generates an array of integers from start (inclusive) to end (exclusive).
 * @param start - The starting integer (inclusive).
 * @param end - The ending integer (exclusive).
 * @returns An array of integers.
 */
export function range(start: number, end: number): number[] {
	if (start > end) {
			throw new Error("Start value must be less than or equal to end value.");
	}
	const result: number[] = [];
	for (let i = start; i < end; i++) {
			result.push(i);
	}
	return result;
}

const isWordChar = (char: string) : boolean => /[a-zA-Z0-9_]/.test(char);

/**
 * Finds the word in a string at a given position.
 *
 * @param {string} text - The text to search within.
 * @param {number} pos - The index position in the text.
 * @returns {string|null} - The word at the given position or null if none found.
 */
export function getWordAt(text: string, pos: number): string | null {
  if (pos < 0 || pos >= text.length) {
    return null;
  }

  // Start and end positions of the word
  let start = pos;
  let end = pos;

  // Expand start position backward
  while (start > 0 && isWordChar(text.charAt(start - 1))) {
    start--;
  }

  // Expand end position forward
  while (end < text.length && isWordChar(text.charAt(end))) {
    end++;
  }

  // Check if a word was found
  if (start === end) {
    return null;
  }

  return text.substring(start, end);
}