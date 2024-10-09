import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const hyperLogFunctions: CompletionItem[] = [{
  label: 'hll_count.extract',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(sketch) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'A scalar function that extracts a cardinality estimate of a single [HLL++](https://research.google.com/pubs/pub40671.html) sketch.'
  },
  insertText: 'hll_count.extract(${1:sketch})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'hll_count.extract(sketch)'
},
{
  label: 'hll_count.init',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(input[, precision]) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'An aggregate function that takes one or more `input` values and aggregates them into a [HLL++](https://research.google.com/pubs/pub40671.html) sketch.'
  },
  insertText: 'hll_count.init(${1:input}${2:, ${3:precision}})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'hll_count.init(input [, precision])'
},
{
  label: 'hll_count.merge',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(sketch) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'An aggregate function that returns the cardinality of several [HLL++](https://research.google.com/pubs/pub40671.html) sketches by computing their union.'
  },
  insertText: 'hll_count.merge(${1:sketch})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'hll_count.merge(sketch)'
},
{
  label: 'hll_count.merge_partial',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(sketch) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'An aggregate function that takes one or more [HLL++](https://research.google.com/pubs/pub40671.html) `sketch` inputs and merges them into a new sketch.'
  },
  insertText: 'hll_count.merge_partial(${1:sketch})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'hll_count.merge_partial(sketch)'
}];