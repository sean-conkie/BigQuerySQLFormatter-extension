import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const numberingFunctions: CompletionItem[] = [{
  label: 'cume_dist',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '() -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Gets the cumulative distribution (relative position (0,1]) of each row within a window.'
  },
  insertText: 'cume_dist() over ($1)',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'cume_dist() over ($1)'
},
{
  label: 'dense_rank',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '() -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Gets the dense rank (1-based, no gaps) of each row within a window.'
  },
  insertText: 'dense_rank() over ($1)',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'dense_rank() over ($1)'
},
{
  label: 'ntile',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(constant_integer_expression) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Gets the quantile bucket number (1-based) of each row within a window.'
  },
  insertText: 'ntile(${1:2}) over ($2)',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'ntile(${1:2}) over ($2)'
},
{
  label: 'percent_rank',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '() -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Gets the percentile rank (from 0 to 1) of each row within a window.'
  },
  insertText: 'percent_rank() over ($1)',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'percent_rank() over ($1)'
},
{
  label: 'rank',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '() -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Gets the rank (1-based) of each row within a window.'
  },
  insertText: 'rank() over ($1)',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'rank() over ($1)'
},
{
  label: 'row_number',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '() -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Gets the sequential row number (1-based) of each row within a window.'
  },
  insertText: 'row_number() over ($1)',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'row_number() over ($1)'
}];