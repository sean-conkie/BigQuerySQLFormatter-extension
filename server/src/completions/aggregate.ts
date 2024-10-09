import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const aggregateFunctions: CompletionItem[] = [{
	label: 'any_value',
	labelDetails: {
		detail: 'expression any',
		description: 'Matches the input data type.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> ANY_VALUE',
	documentation: {
		kind: 'markdown',
		value: 'Returns `expression` for some row chosen from the group. Which row is chosen is nondeterministic, not random. Returns `NULL` when the input produces no rows. Returns `NULL` when `expression` or `expression2` is `NULL` for all rows in the group.'
	},
	insertText: 'any_value(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'any_value(expression)'
},
{
	label: 'array_agg',
	labelDetails: {
		detail: 'expression all data types except array',
		description: 'ARRAY'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> ARRAY',
	documentation: {
		kind: 'markdown',
		value: 'Returns an ARRAY of `expression` values.'
	},
	insertText: 'array_agg(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'array_agg(expression)'
},
{
	label: 'array_concat_agg',
	labelDetails: { detail: 'expression array', description: 'ARRAY' },
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> ARRAY',
	documentation: {
		kind: 'markdown',
		value: 'Concatenates elements from `expression` of type `ARRAY`, returning a single array as a result.'
	},
	insertText: 'array_concat_agg(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'array_concat_agg(expression)'
},
{
	label: 'avg',
	labelDetails: {
		detail: 'expression numeric',
		description: 'FLOAT64 | NUMERIC | BIGNUMERIC | INTERVAL'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> FLOAT64 | NUMERIC | BIGNUMERIC | INTERVAL',
	documentation: {
		kind: 'markdown',
		value: 'Returns the average of non-`NULL` values in an aggregated group.'
	},
	insertText: 'avg(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'avg(expression)'
},
{
	label: 'bit_and',
	labelDetails: { detail: 'expression int64', description: 'INT64' },
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> INT64',
	documentation: {
		kind: 'markdown',
		value: 'Performs a bitwise AND operation on `expression` and returns the result.'
	},
	insertText: 'bit_and(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'bit_and(expression)'
},
{
	label: 'bit_or',
	labelDetails: { detail: 'expression int64', description: 'INT64' },
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> INT64',
	documentation: {
		kind: 'markdown',
		value: 'Performs a bitwise OR operation on `expression` and returns the result.'
	},
	insertText: 'bit_or(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'bit_or(expression)'
},
{
	label: 'bit_xor',
	labelDetails: { detail: 'expression int64', description: 'INT64' },
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> INT64',
	documentation: {
		kind: 'markdown',
		value: 'Performs a bitwise XOR operation on `expression` and returns the result.'
	},
	insertText: 'bit_xor(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'bit_xor(expression)'
},
{
	label: 'count',
	labelDetails: {
		detail: 'DISTINCT expression any',
		description: 'INT64'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> INT64',
	documentation: {
		kind: 'markdown',
		value: 'Returns the number of rows with `expression` evaluated to any value other than `NULL`.'
	},
	insertText: 'count(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'count(expression)'
},
{
	label: 'countif',
	labelDetails: { detail: 'expression bool', description: 'INT64' },
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> INT64',
	documentation: {
		kind: 'markdown',
		value: 'Returns the count of `TRUE` values for `expression`.'
	},
	insertText: 'countif(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'countif(expression)'
},
{
	label: 'grouping',
	labelDetails: {
		detail: 'groupable_value groupable',
		description: 'INT64'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(groupable_value) -> INT64',
	documentation: {
		kind: 'markdown',
		value: 'Checks if a groupable value in the `GROUP BY` clause is aggregated.'
	},
	insertText: 'grouping(${1:groupable_value})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'grouping(groupable_value)'
},
{
	label: 'logical_and',
	labelDetails: { detail: 'expression bool', description: 'BOOL' },
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> BOOL',
	documentation: {
		kind: 'markdown',
		value: 'Returns the logical AND of all non-`NULL` expressions.'
	},
	insertText: 'logical_and(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'logical_and(expression)'
},
{
	label: 'logical_or',
	labelDetails: { detail: 'expression bool', description: 'BOOL' },
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> BOOL',
	documentation: {
		kind: 'markdown',
		value: 'Returns the logical OR of all non-`NULL` expressions.'
	},
	insertText: 'logical_or(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'logical_or(expression)'
},
{
	label: 'max',
	labelDetails: {
		detail: 'expression orderable',
		description: 'Matches the input data type.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> ANY_VALUE',
	documentation: {
		kind: 'markdown',
		value: 'Returns the maximum non-`NULL` value in an aggregated group.'
	},
	insertText: 'max(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'max(expression)'
},
{
	label: 'max_by',
	labelDetails: {
		detail: 'x, y any type',
		description: 'Matches the input x data type.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(x, y) -> ANY_VALUE',
	documentation: {
		kind: 'markdown',
		value: 'Synonym for `ANY_VALUE(x HAVING MAX y)`.'
	},
	insertText: 'max_by(${1:x}, ${2:y})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'max_by(x, y)'
},
{
	label: 'min',
	labelDetails: {
		detail: 'expression orderable',
		description: 'Matches the input data type.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> ANY_VALUE',
	documentation: {
		kind: 'markdown',
		value: 'Returns the minimum non-`NULL` value in an aggregated group.'
	},
	insertText: 'min(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'min(expression)'
},
{
	label: 'min_by',
	labelDetails: {
		detail: 'x, y any type',
		description: 'Matches the input x data type.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(x, y) -> ANY_VALUE',
	documentation: {
		kind: 'markdown',
		value: 'Synonym for `ANY_VALUE(x HAVING MIN y)`.'
	},
	insertText: 'min_by(${1:x}, ${2:y})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'min_by(x, y)'
},
{
	label: 'string_agg',
	labelDetails: {
		detail: 'expression (string | bytes)',
		description: 'STRING | BYTES'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> STRING | BYTES',
	documentation: {
		kind: 'markdown',
		value: 'Returns a value obtained by concatenating non-`NULL` values. Returns `NULL` if there are zero input rows or `expression` evaluates to `NULL` for all rows. If a `delimiter` is specified, concatenated values are separated by that delimiter; otherwise, a comma is used as a delimiter.'
	},
	insertText: 'string_agg(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'string_agg(expression)'
},
{
	label: 'sum',
	labelDetails: {
		detail: 'expression numeric',
		description: 'INT64 | NUMERIC | BIGNUMERIC | FLOAT64 | INTERVAL'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> INT64 | NUMERIC | BIGNUMERIC | FLOAT64 | INTERVAL',
	documentation: {
		kind: 'markdown',
		value: 'Returns the sum of non-`NULL` values in an aggregated group.'
	},
	insertText: 'sum(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'sum(expression)'
}];