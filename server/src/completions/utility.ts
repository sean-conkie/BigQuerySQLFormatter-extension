import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const utilityFunctions: CompletionItem[] = [{
  label: 'generate_uuid',
  labelDetails: {
    detail: '()',
    description: 'Produces a random universally unique identifier (UUID) as a STRING value.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '() -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Returns a random universally unique identifier (UUID) as a `STRING`. The returned `STRING` consists of 32 hexadecimal digits in five groups separated by hyphens in the form 8-4-4-4-12. The hexadecimal digits represent 122 random bits and 6 fixed bits, in compliance with [RFC 4122 section 4.4](https://tools.ietf.org/html/rfc4122#section-4.4). The returned `STRING` is lowercase.'
  },
  insertText: 'generate_uuid()$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'generate_uuid()'
}];