import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const datetimeFunctions: CompletionItem[] = [{
  label: 'cast',
  labelDetails: {
    detail: 'Convert',
    description: 'expression AS typename [format_clause]'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(expression) -> T',
  documentation: {
    kind: 'markdown',
    value: 'Convert the results of an expression to the given type.'
  },
  insertText: 'cast(${1:expression} as ${2:typename}${3:[format_clause]})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'cast(expression as typename [format_clause])'
},
{
  label: 'parse_bignumeric',
  labelDetails: { detail: 'Converts', description: 'string_expression' },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(string_expression) -> BIGNUMERIC',
  documentation: {
    kind: 'markdown',
    value: 'Converts a `STRING` value to a `BIGNUMERIC` value.'
  },
  insertText: 'parse_bignumeric(${1:string_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'parse_bignumeric(string_expression)'
},
{
  label: 'parse_numeric',
  labelDetails: { detail: 'Converts', description: 'string_expression' },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(string_expression) -> NUMERIC',
  documentation: {
    kind: 'markdown',
    value: 'Converts a `STRING` value to a `NUMERIC` value.'
  },
  insertText: 'parse_numeric(${1:string_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'parse_numeric(string_expression)'
},
{
  label: 'safe_cast',
  labelDetails: {
    detail: 'Similar to CAST',
    description: 'expression AS typename [format_clause]'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(expression) -> T',
  documentation: {
    kind: 'markdown',
    value: 'Similar to the `CAST` function, but returns `NULL` when a runtime error is produced.'
  },
  insertText: 'safe_cast(${1:expression} as ${2:typename}${3:[format_clause]})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'safe_cast(expression as typename [format_clause])'
}];