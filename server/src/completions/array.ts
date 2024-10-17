import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const arrayFunctions: CompletionItem[] = [{
	label: 'array',
	labelDetails: {
		detail: 'function',
		description: 'Produces an array with one element for each row in a subquery.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(subquery) -> ARRAY',
	documentation: {
		kind: 'markdown',
		value: 'Produces an array with one element for each row in a subquery.'
	},
	insertText: 'array(${1:subquery})$0',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'array(subquery)'
},
{
	label: 'array_concat',
	labelDetails: {
		detail: 'function',
		description: 'Concatenates one or more arrays with the same element type into a single array.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(array_expression, ...) -> ARRAY',
	documentation: {
		kind: 'markdown',
		value: 'Concatenates one or more arrays with the same element type into a single array.'
	},
	insertText: 'array_concat(${1:array_expression}, ...)',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'array_concat(array_expression, ...)'
},
{
	label: 'array_length',
	labelDetails: {
		detail: 'function',
		description: 'Gets the number of elements in an array.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(array_expression) -> INT64',
	documentation: {
		kind: 'markdown',
		value: 'Gets the number of elements in an array.'
	},
	insertText: 'array_length(${1:array_expression})$0',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'array_length(array_expression)'
},
{
	label: 'array_reverse',
	labelDetails: {
		detail: 'function',
		description: 'Reverses the order of elements in an array.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(value) -> ARRAY',
	documentation: {
		kind: 'markdown',
		value: 'Reverses the order of elements in an array.'
	},
	insertText: 'array_reverse(${1:value})$0',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'array_reverse(value)'
},
{
	label: 'array_to_string',
	labelDetails: {
		detail: 'function',
		description: 'Produces a concatenation of the elements in an array as a STRING value.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(array_expression, delimiter, null_text) -> STRING',
	documentation: {
		kind: 'markdown',
		value: 'Produces a concatenation of the elements in an array as a STRING value.'
	},
	insertText: 'array_to_string(${1:array_expression}, ${2:delimiter}, ${3:null_text})$0',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'array_to_string(array_expression, delimiter, null_text)'
},
{
	label: 'generate_array',
	labelDetails: {
		detail: 'function',
		description: 'Generates an array of values in a range.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(start_expression, end_expression, step_expression) -> ARRAY',
	documentation: {
		kind: 'markdown',
		value: 'Generates an array of values in a range.'
	},
	insertText: 'generate_array(${1:start_expression}, ${2:end_expression}, ${3:step_expression})$0',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'generate_array(start_expression, end_expression, step_expression)'
},
{
	label: 'generate_date_array',
	labelDetails: {
		detail: 'function',
		description: 'Generates an array of dates in a range.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(start_date, end_date, interval_expression date_part) -> ARRAY',
	documentation: {
		kind: 'markdown',
		value: 'Generates an array of dates in a range.'
	},
	insertText: 'generate_date_array(${1:start_date}, ${2:end_date}, INTERVAL ${3:INT64_expr} ${4:date_part})$0',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'generate_date_array(start_date, end_date, INTERVAL INT64_expr date_part)'
},
{
	label: 'generate_timestamp_array',
	labelDetails: {
		detail: 'function',
		description: 'Generates an array of timestamps in a range.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(start_timestamp, end_timestamp, interval_expression date_part) -> ARRAY',
	documentation: {
		kind: 'markdown',
		value: 'Generates an array of timestamps in a range.'
	},
	insertText: 'generate_timestamp_array(${1:start_timestamp}, ${2:end_timestamp}, INTERVAL ${3:step_expression} ${4:date_part})$0',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'generate_timestamp_array(start_timestamp, end_timestamp, INTERVAL step_expression date_part)'
}];