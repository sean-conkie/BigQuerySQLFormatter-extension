/**
 * @fileoverview Linter for the server
 * @module linter
 * @requires vscode-languageserver
 * @requires settings
 */


import { ServerSettings } from '../settings';

import {
	Diagnostic,
	DiagnosticSeverity
} from 'vscode-languageserver/node';


/**
 * The map to store private data.
 * @type {WeakMap<Linter, LinterInternalSlots>}
 */
const internalSlotsMap = new WeakMap();

/**
 * Object for linting SQL code
 * @name Linter
 */
export class Linter {

	constructor(settings: ServerSettings) {
		internalSlotsMap.set(this, {
		});
	}

	/**
	 * Lint the source code
	 * @param {string} source The source code to lint
	 * @param {object} [config={}] The configuration to use
	 * @returns {Diagnostic[]} The diagnostics found in the source code
	 * @memberof Linter
	 */
	verify(source: string, config: object = {}): Diagnostic[] {
		const internalSlots = internalSlotsMap.get(this);

		const diagnostics: Diagnostic[] = [];


		return diagnostics;
		
	}

}
