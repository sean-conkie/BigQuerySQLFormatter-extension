import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const bitFunctions: CompletionItem[] = [{
  label: 'bit_count',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(expression) -> INT64',
  documentation: {
    kind: 'markdown',
    value: "Returns the number of bits that are set in the input `expression`. For signed integers, this is the number of bits in two's complement form."
  },
  insertText: 'bit_count(${1:expression})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'bit_count(expression)'
}];