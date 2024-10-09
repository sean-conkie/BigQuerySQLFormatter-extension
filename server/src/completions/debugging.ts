import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const debuggingFunctions: CompletionItem[] = [{
  label: 'error',
  labelDetails: {
    detail: undefined,
    description: 'Produces an error with a custom error message.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(error_message) -> ERROR',
  documentation: { kind: 'markdown', value: 'Returns an error.' },
  insertText: 'error(${1:error_message})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'error(error_message)'
}];