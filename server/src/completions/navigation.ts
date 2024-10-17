import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const navigationFunctions: CompletionItem[] = [{
	label: 'first_value',
	labelDetails: undefined,
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(value_expression) -> ANY_VALUE',
	documentation: {
		kind: 'markdown',
		value: 'Gets a value for the first row in the current window frame.'
	},
	insertText: 'first_value(${1:value_expression} [${2|RESPECT,IGNORE|} NULLS]) over(${3:over_clause})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'first_value(${1:value_expression} [${2|RESPECT,IGNORE|} NULLS]) over(${3:over_clause})'
},
{
	label: 'lag',
	labelDetails: undefined,
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(value_expression) -> ANY_VALUE',
	documentation: {
		kind: 'markdown',
		value: 'Gets a value for a preceding row.'
	},
	insertText: 'lag(${1:value_expression}[, ${2:offset}[, ${3:default_expression}]]) over(${4:over_clause})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'lag(${1:value_expression}[, ${2:offset}[, ${3:default_expression}]]) over(${4:over_clause})'
},
{
	label: 'last_value',
	labelDetails: undefined,
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(value_expression) -> ANY_VALUE',
	documentation: {
		kind: 'markdown',
		value: 'Gets a value for the last row in the current window frame.'
	},
	insertText: 'last_value(${1:value_expression} [${2|RESPECT,IGNORE|} NULLS]) over(${3:over_clause})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'last_value(${1:value_expression} [${2|RESPECT,IGNORE|} NULLS]) over(${3:over_clause})'
},
{
	label: 'lead',
	labelDetails: undefined,
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(value_expression) -> ANY_VALUE',
	documentation: {
		kind: 'markdown',
		value: 'Gets a value for a subsequent row.'
	},
	insertText: 'lead(${1:value_expression}[, ${2:offset}[, ${3:default_expression}]]) over(${4:over_clause})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'lead(${1:value_expression}[, ${2:offset}[, ${3:default_expression}]]) over(${4:over_clause})'
},
{
	label: 'nth_value',
	labelDetails: undefined,
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(value_expression) -> ANY_VALUE',
	documentation: {
		kind: 'markdown',
		value: 'Gets a value for the Nth row of the current window frame.'
	},
	insertText: 'nth_value(${1:value_expression}, ${2:constant_integer_expression} [${3|RESPECT,IGNORE|} NULLS]) over(${4:over_clause})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'nth_value(${1:value_expression}, ${2:constant_integer_expression} [${3|RESPECT,IGNORE|} NULLS]) over(${4:over_clause})'
},
{
	label: 'percentile_cont',
	labelDetails: undefined,
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(value_expression) -> NUMERIC',
	documentation: {
		kind: 'markdown',
		value: 'Computes the specified percentile for a value, using linear interpolation.'
	},
	insertText: 'percentile_cont(${1:value_expression}, ${2:percentile} [${3|RESPECT,IGNORE|} NULLS]) over(${4:over_clause})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'percentile_cont(${1:value_expression}, ${2:percentile} [${3|RESPECT,IGNORE|} NULLS]) over(${4:over_clause})'
},
{
	label: 'percentile_disc',
	labelDetails: undefined,
	kind: CompletionItemKind.Function,
	tags: undefined,
	detail: '(value_expression) -> ANY_VALUE',
	documentation: {
		kind: 'markdown',
		value: 'Computes the specified percentile for a discrete value.'
	},
	insertText: 'percentile_disc(${1:value_expression}, ${2:percentile} [${3|RESPECT,IGNORE|} NULLS]) over(${4:over_clause})',
	insertTextFormat: InsertTextFormat.Snippet,
	insertTextMode: InsertTextMode.adjustIndentation,
	textEditText: 'percentile_disc(${1:value_expression}, ${2:percentile} [${3|RESPECT,IGNORE|} NULLS]) over(${4:over_clause})'
}];