import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const rangeFunctions: CompletionItem[] = [{
  label: 'generate_range_array',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(range_to_split, step_interval) -> ARRAY<RANGE<T>>',
  documentation: {
    kind: 'markdown',
    value: 'Splits a range into an array of subranges.'
  },
  insertText: 'generate_range_array(${1:range_to_split}, ${2:step_interval})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'generate_range_array(range_to_split, step_interval)'
},
{
  label: 'range',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(lower_bound, upper_bound) -> RANGE<T>',
  documentation: {
    kind: 'markdown',
    value: 'Constructs a range of date, datetime, or timestamp values.'
  },
  insertText: 'range(${1:lower_bound}, ${2:upper_bound})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'range(lower_bound, upper_bound)'
},
{
  label: 'range_contains',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(outer_range, inner_range) -> BOOL',
  documentation: {
    kind: 'markdown',
    value: 'Checks if one range is in another range.'
  },
  insertText: 'range_contains(${1:outer_range}, ${2:inner_range})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'range_contains(outer_range, inner_range)'
},
{
  label: 'range_end',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(range_to_check) -> T',
  documentation: {
    kind: 'markdown',
    value: 'Gets the upper bound of a range.'
  },
  insertText: 'range_end(${1:range_to_check})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'range_end(range_to_check)'
},
{
  label: 'range_intersect',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(range_a, range_b) -> RANGE<T>',
  documentation: {
    kind: 'markdown',
    value: 'Gets a segment of two ranges that intersect.'
  },
  insertText: 'range_intersect(${1:range_a}, ${2:range_b})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'range_intersect(range_a, range_b)'
},
{
  label: 'range_overlaps',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(range_a, range_b) -> BOOL',
  documentation: {
    kind: 'markdown',
    value: 'Checks if two ranges overlap.'
  },
  insertText: 'range_overlaps(${1:range_a}, ${2:range_b})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'range_overlaps(range_a, range_b)'
},
{
  label: 'range_sessionize',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(table_name, range_column, partitioning_columns) -> TABLE',
  documentation: {
    kind: 'markdown',
    value: 'Produces a table of sessionized ranges.'
  },
  insertText: 'range_sessionize(${1:table_name}, ${2:range_column}, ${3:partitioning_columns})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'range_sessionize(table_name, range_column, partitioning_columns)'
},
{
  label: 'range_start',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(range_to_check) -> T',
  documentation: {
    kind: 'markdown',
    value: 'Gets the lower bound of a range.'
  },
  insertText: 'range_start(${1:range_to_check})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'range_start(range_to_check)'
}];