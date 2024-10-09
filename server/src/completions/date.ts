import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const dateFunctions: CompletionItem[] = [{
	label: 'current_date',
	labelDetails: {
		detail: '() → DATE',
		description: 'Returns the current date as a DATE value.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '() → DATE',
	documentation: {
		kind: 'markdown',
		value: 'Returns the current date as a `DATE` value.'
	},
	insertText: 'current_date()',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'current_date()'
},
{
	label: 'date',
	labelDetails: {
		detail: '(year, month, day) → DATE',
		description: 'Constructs a DATE value.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(year, month, day) → DATE',
	documentation: { kind: 'markdown', value: 'Constructs a `DATE` value.' },
	insertText: 'date(${1:year}, ${2:month}, ${3:day})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'date(${1:year}, ${2:month}, ${3:day})'
},
{
	label: 'date_add',
	labelDetails: {
		detail: '(date_expression, INTERVAL int64_expression date_part) → DATE',
		description: 'Adds a specified time interval to a DATE value.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(date_expression, INTERVAL int64_expression date_part) → DATE',
	documentation: {
		kind: 'markdown',
		value: 'Adds a specified time interval to a `DATE` value.'
	},
	insertText: 'date_add(${1:date_expression}, INTERVAL ${2:int64_expression} ${3:date_part})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'date_add(${1:date_expression}, INTERVAL ${2:int64_expression} ${3:date_part})'
},
{
	label: 'date_diff',
	labelDetails: {
		detail: '(end_date, start_date, granularity) → INT64',
		description: 'Gets the number of unit boundaries between two DATE values.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(end_date, start_date, granularity) → INT64',
	documentation: {
		kind: 'markdown',
		value: 'Gets the number of unit boundaries between two `DATE` values.'
	},
	insertText: 'date_diff(${1:end_date}, ${2:start_date}, ${3:granularity})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'date_diff(${1:end_date}, ${2:start_date}, ${3:granularity})'
},
{
	label: 'date_from_unix_date',
	labelDetails: {
		detail: '(int64_expression) → DATE',
		description: 'Interprets an INT64 expression as the number of days since 1970-01-01.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(int64_expression) → DATE',
	documentation: {
		kind: 'markdown',
		value: 'Interprets an `INT64` expression as the number of days since 1970-01-01.'
	},
	insertText: 'date_from_unix_date(${1:int64_expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'date_from_unix_date(${1:int64_expression})'
},
{
	label: 'date_sub',
	labelDetails: {
		detail: '(date_expression, INTERVAL int64_expression date_part) → DATE',
		description: 'Subtracts a specified time interval from a DATE value.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(date_expression, INTERVAL int64_expression date_part) → DATE',
	documentation: {
		kind: 'markdown',
		value: 'Subtracts a specified time interval from a `DATE` value.'
	},
	insertText: 'date_sub(${1:date_expression}, INTERVAL ${2:int64_expression} ${3:date_part})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'date_sub(${1:date_expression}, INTERVAL ${2:int64_expression} ${3:date_part})'
},
{
	label: 'date_trunc',
	labelDetails: {
		detail: '(date_value, date_granularity) → DATE',
		description: 'Truncates a DATE at a particular granularity.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(date_value, date_granularity) → DATE',
	documentation: {
		kind: 'markdown',
		value: 'Truncates a `DATE` at a particular granularity.'
	},
	insertText: 'date_trunc(${1:date_value}, ${2:date_granularity})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'date_trunc(${1:date_value}, ${2:date_granularity})'
},
{
	label: 'extract',
	labelDetails: {
		detail: '(part FROM date_expression) → INT64',
		description: 'Extracts part of a date from a DATE value.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(part FROM date_expression) → INT64',
	documentation: {
		kind: 'markdown',
		value: 'Extracts part of a date from a `DATE` value.'
	},
	insertText: 'extract(${1:part} FROM ${2:date_expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'extract(${1:part} FROM ${2:date_expression})'
},
{
	label: 'format_date',
	labelDetails: {
		detail: '(format_string, date_expr) → STRING',
		description: 'Formats a DATE value according to a specified format string.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(format_string, date_expr) → STRING',
	documentation: {
		kind: 'markdown',
		value: 'Formats a `DATE` value according to a specified format string.'
	},
	insertText: 'format_date(${1:format_string}, ${2:date_expr})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'format_date(${1:format_string}, ${2:date_expr})'
},
{
	label: 'last_day',
	labelDetails: {
		detail: '(date_expression[, date_part]) → DATE',
		description: 'Gets the last day in a specified time period that contains a DATE value.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(date_expression[, date_part]) → DATE',
	documentation: {
		kind: 'markdown',
		value: 'Gets the last day in a specified time period that contains a `DATE` value.'
	},
	insertText: 'last_day(${1:date_expression}${2:, date_part})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'last_day(${1:date_expression}${2:, date_part})'
},
{
	label: 'parse_date',
	labelDetails: {
		detail: '(format_string, date_string) → DATE',
		description: 'Converts a STRING value to a DATE value.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(format_string, date_string) → DATE',
	documentation: {
		kind: 'markdown',
		value: 'Converts a `STRING` value to a `DATE` value.'
	},
	insertText: 'parse_date(${1:format_string}, ${2:date_string})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'parse_date(${1:format_string}, ${2:date_string})'
},
{
	label: 'unix_date',
	labelDetails: {
		detail: '(date_expression) → INT64',
		description: 'Converts a DATE value to the number of days since 1970-01-01.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(date_expression) → INT64',
	documentation: {
		kind: 'markdown',
		value: 'Converts a `DATE` value to the number of days since 1970-01-01.'
	},
	insertText: 'unix_date(${1:date_expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'unix_date(${1:date_expression})'
}];