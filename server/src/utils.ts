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