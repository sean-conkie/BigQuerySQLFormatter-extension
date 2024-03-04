/**
 * @fileoverview Parser for the BigQuery SQL.
 * @module parser
 */

import googlesqlJson from './googlesql.json';
import { GrammarRegistry } from 'first-mate';
import { resolve } from 'path';

/**
 * The map to store private data.
 * @type {WeakMap<Linter, LinterInternalSlots>}
 */
const internalSlotsMap = new WeakMap();

/**
 * The abstract syntax tree for the SQL code
 */
const abstractSyntaxTree = {
  "with": null,
  "type": null,
  "options": null,
  "distinct": null,
  "columns": null,
  "from": [
    {
      "dataset": null,
      "table": null,
      "as": null
    }
  ],
  "where": null,
  "groupby": null,
  "having": null,
  "orderby": null,
  "limit": null,
	"statement": null,
	"start": null,
	"end": null
};

/**
 * The column object
 */
const column = {
	"name": null,
	"alias": null,
	"function": null
};

/**
 * An object to store the match object when splitting the source code into statements
 * @typedef {Object} MatchObj
 * @property {number} end The end index of the statement
 * @property {number} start The start index of the statement
 * @property {string} statement The statement
 * @memberof Parser
 * @name MatchObj
 */
type MatchObj = {"end": number, "start": number, statement: string};


/**
 * Object for parsing SQL code
 * @name Parser
 */
export class Parser {

	constructor() {
		internalSlotsMap.set(this, {
			statements: [],
			abstractSyntaxTree: []
		});
	}

	/**
	 * Parse the source code
	 * @param {string} source The source code to parse
	 */
	parse(source: string) {

		const internalSlots = internalSlotsMap.get(this);

		// create the grammar registry
		const registry = new GrammarRegistry();
		const grammar = registry.loadGrammarSync(resolve(`${__dirname}/syntaxes/googlesql.tmLanguage.json`));
		const tokenizedSource = grammar.tokenizeLines(source);

		// // split string into statements
		// internalSlots.statements = this._split_into_statements(source);

		// // generate abstract syntax tree
		// for (const statement of internalSlots.statements) {
		// 	internalSlots.abstractSyntaxTree.push(this._generateAbstractSyntaxTree(statement));
		// }

		// return internalSlots.abstractSyntaxTree;

	}

	/**
	 * Split the source code into statements
	 * @param {string} source The source code to split
	 * @returns {string[]} The source code split into statements
	 */
	_split_into_statements(source: string) {

		const pattern = /;/g;
		let match: RegExpExecArray | null;
		const statements = [];
		let start = 0;
		while ((match = pattern.exec(source))) {
			const m = {
				"end": match.index,
				"start": start,
				"statement": source.substring(start, match.index)
			};
			start = match.index + 1;
			statements.push(m);
		}

		if (statements.length === 0) {
			statements.push({
				"start": 0,
				"end": source.length,
				"statement": source
			});
		}

		return statements;

	}

	/**
	 * Create the abstract syntax tree for the SQL statement
	 * @param {MatchObj} statement The statement to parse
	 */
	_generateAbstractSyntaxTree(statement: MatchObj) {

		const ast = JSON.parse(JSON.stringify(abstractSyntaxTree));
		ast.statement = statement.statement;
		ast.start = statement.start;
		ast.end = statement.end;

		// identify the type of statement
		const typeRegex = new RegExp(`${googlesqlJson.type.join('|')}`, 'i');
		const m = statement.statement.toLowerCase().match(typeRegex);
		if (m) {
			ast.type = m[0];
		}

		


	}

}