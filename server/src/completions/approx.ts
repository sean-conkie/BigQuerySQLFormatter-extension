import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const approxFunctions: CompletionItem[] = [{
	label: 'approx_count_distinct',
	labelDetails: {
		detail: 'int64',
		description: 'Approximate count of distinct values in expression.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression) -> INT64',
	documentation: {
		kind: 'markdown',
		value: 'Returns the approximate result for `count(distinct expression)`. The value returned is a statistical estimate, not necessarily the actual value. This function is less accurate than `count(distinct expression)`, but performs better on huge input.'
	},
	insertText: 'approx_count_distinct(${1:expression})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'approx_count_distinct(expression)'
},
{
	label: 'approx_quantiles',
	labelDetails: {
		detail: 'array<T>',
		description: 'Approximate quantile boundaries for the expression.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression, number) -> ARRAY<T>',
	documentation: {
		kind: 'markdown',
		value: 'Returns the approximate boundaries for a group of `expression` values, where `number` represents the number of quantiles to create. This function returns an array of `number` + 1 elements, sorted in ascending order, where the first element is the approximate minimum and the last element is the approximate maximum.'
	},
	insertText: 'approx_quantiles(${1:expression}, ${2:number})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'approx_quantiles(expression, number)'
},
{
	label: 'approx_top_count',
	labelDetails: {
		detail: 'array<struct>',
		description: 'Approximate top elements and their count.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression, number) -> ARRAY<STRUCT<value ANY_VALUE, count INT64>>',
	documentation: {
		kind: 'markdown',
		value: 'Returns the approximate top elements of `expression` as an array of `structs`. The `number` parameter specifies the number of elements returned. Each `struct` contains two fields. The first field (named `value`) contains an input value. The second field (named `count`) contains an `int64` specifying the number of times the value was returned.'
	},
	insertText: 'approx_top_count(${1:expression}, ${2:number})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'approx_top_count(expression, number)'
},
{
	label: 'approx_top_sum',
	labelDetails: {
		detail: 'array<struct>',
		description: 'Approximate top elements ordered by sum of weights.'
	},
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(expression, weight, number) -> ARRAY<STRUCT<value ANY_VALUE, sum FLOAT64>>',
	documentation: {
		kind: 'markdown',
		value: 'Returns the approximate top elements of `expression`, ordered by the sum of the `weight` values provided for each unique value of `expression`. The `number` parameter specifies the number of elements returned. The elements are returned as an array of `structs`. Each `struct` contains two fields: `value` and `sum`.'
	},
	insertText: 'approx_top_sum(${1:expression}, ${2:weight}, ${3:number})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'approx_top_sum(expression, weight, number)'
}];