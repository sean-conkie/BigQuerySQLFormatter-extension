import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const securityFunctions: CompletionItem[] = [{
  label: 'session_user',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '() -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'For first-party users, returns the email address of the user running the query. For third-party users, returns the [principal identifier](https://cloud.google.com/iam/docs/principal-identifiers) of the user running the query. For more info, see [Principals](https://cloud.google.com/docs/authentication#principal).'
  },
  insertText: 'session_user()$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'session_user()'
}];