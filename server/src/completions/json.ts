import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const jsonFunctions: CompletionItem[] = [{
  label: 'json_query',
  labelDetails: {
    detail: 'Extracts a JSON value and converts it to a SQL JSON-formatted STRING or JSON value.',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(json_string_expr, json_path) -> JSON',
  documentation: {
    kind: 'markdown',
    value: 'Extracts a JSON value and converts it to a SQL JSON-formatted STRING or JSON value.'
  },
  insertText: 'json_query(${1:json_string_expr}, ${2:json_path})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'json_query(json_string_expr, json_path)'
},
{
  label: 'json_value',
  labelDetails: {
    detail: 'Extracts a JSON scalar value and converts it to a SQL STRING value.',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(json_string_expr, json_path) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Extracts a JSON scalar value and converts it to a SQL STRING value.'
  },
  insertText: 'json_value(${1:json_string_expr}, ${2:json_path})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'json_value(json_string_expr, json_path)'
},
{
  label: 'json_query_array',
  labelDetails: {
    detail: 'Extracts a JSON array and converts it to a SQL ARRAY<JSON-formatted STRING> or ARRAY<JSON> value.',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(json_string_expr, json_path) -> ARRAY',
  documentation: {
    kind: 'markdown',
    value: 'Extracts a JSON array and converts it to a SQL ARRAY<JSON-formatted STRING> or ARRAY<JSON> value.'
  },
  insertText: 'json_query_array(${1:json_string_expr}, ${2:json_path})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'json_query_array(json_string_expr, json_path)'
},
{
  label: 'json_value_array',
  labelDetails: {
    detail: 'Extracts a JSON array of scalar values and converts it to a SQL ARRAY<STRING> value.',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(json_string_expr, json_path) -> ARRAY',
  documentation: {
    kind: 'markdown',
    value: 'Extracts a JSON array of scalar values and converts it to a SQL ARRAY<STRING> value.'
  },
  insertText: 'json_value_array(${1:json_string_expr}, ${2:json_path})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'json_value_array(json_string_expr, json_path)'
},
{
  label: 'json_extract',
  labelDetails: {
    detail: 'Extracts a JSON value and converts it to a SQL JSON-formatted STRING or JSON value.',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(json_string_expr, json_path) -> JSON',
  documentation: {
    kind: 'markdown',
    value: 'Extracts a JSON value and converts it to a SQL JSON-formatted STRING or JSON value.'
  },
  insertText: 'json_extract(${1:json_string_expr}, ${2:json_path})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'json_extract(json_string_expr, json_path)'
},
{
  label: 'json_extract_array',
  labelDetails: {
    detail: 'Extracts a JSON array and converts it to a SQL ARRAY<JSON-formatted STRING> or ARRAY<JSON> value.',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(json_string_expr, json_path) -> ARRAY',
  documentation: {
    kind: 'markdown',
    value: 'Extracts a JSON array and converts it to a SQL ARRAY<JSON-formatted STRING> or ARRAY<JSON> value.'
  },
  insertText: 'json_extract_array(${1:json_string_expr}, ${2:json_path})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'json_extract_array(json_string_expr, json_path)'
},
{
  label: 'json_extract_scalar',
  labelDetails: {
    detail: 'Extracts a JSON scalar value and converts it to a SQL STRING value.',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(json_string_expr, json_path) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Extracts a JSON scalar value and converts it to a SQL STRING value.'
  },
  insertText: 'json_extract_scalar(${1:json_string_expr}, ${2:json_path})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'json_extract_scalar(json_string_expr, json_path)'
},
{
  label: 'json_extract_string_array',
  labelDetails: {
    detail: 'Extracts a JSON array of scalar values and converts it to a SQL ARRAY<STRING> value.',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(json_string_expr, json_path) -> ARRAY',
  documentation: {
    kind: 'markdown',
    value: 'Extracts a JSON array of scalar values and converts it to a SQL ARRAY<STRING> value.'
  },
  insertText: 'json_extract_string_array(${1:json_string_expr}, ${2:json_path})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'json_extract_string_array(json_string_expr, json_path)'
},
{
  label: 'json_keys',
  labelDetails: {
    detail: 'Extracts unique JSON keys from a JSON expression.',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(json_expr, max_depth, mode) -> ARRAY',
  documentation: {
    kind: 'markdown',
    value: 'Extracts unique JSON keys from a JSON expression.'
  },
  insertText: "json_keys(${1:json_expr}, ${2:max_depth}, ${3:mode => 'strict'})",
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: "json_keys(json_expr, max_depth, mode => 'strict')"
},
{
  label: 'json_remove',
  labelDetails: {
    detail: 'Produces a new SQL JSON value with the specified JSON data removed.',
    description: undefined
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(json_expr, json_path, ...) -> JSON',
  documentation: {
    kind: 'markdown',
    value: 'Produces a new SQL JSON value with the specified JSON data removed.'
  },
  insertText: 'json_remove(${1:json_expr}, ${2:json_path}, ${3:...})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'json_remove(json_expr, json_path, ...)'
}];