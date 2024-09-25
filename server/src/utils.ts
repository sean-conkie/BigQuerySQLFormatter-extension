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