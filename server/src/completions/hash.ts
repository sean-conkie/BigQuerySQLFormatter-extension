import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const hashFunctions: CompletionItem[] = [{
  label: 'farm_fingerprint',
  labelDetails: { detail: '', description: '' },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the fingerprint of the `STRING` or `BYTES` input using the `Fingerprint64` function from the [open-source FarmHash library](https://github.com/google/farmhash). The output of this function for a particular input will never change. **Return type**: `INT64`'
  },
  insertText: 'farm_fingerprint(${1:value})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'farm_fingerprint(value)'
},
{
  label: 'md5',
  labelDetails: { detail: '', description: '' },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(input) -> BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Computes the hash of the input using the [MD5 algorithm](https://en.wikipedia.org/wiki/MD5). The input can either be `STRING` or `BYTES`. The string version treats the input as an array of bytes. **Return type**: `BYTES`'
  },
  insertText: 'md5(${1:input})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'md5(input)'
},
{
  label: 'sha1',
  labelDetails: { detail: '', description: '' },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(input) -> BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Computes the hash of the input using the [SHA-1 algorithm](https://en.wikipedia.org/wiki/SHA-1). The input can either be `STRING` or `BYTES`. The string version treats the input as an array of bytes. **Return type**: `BYTES`'
  },
  insertText: 'sha1(${1:input})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'sha1(input)'
},
{
  label: 'sha256',
  labelDetails: { detail: '', description: '' },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(input) -> BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Computes the hash of the input using the [SHA-256 algorithm](https://en.wikipedia.org/wiki/SHA-2). The input can either be `STRING` or `BYTES`. The string version treats the input as an array of bytes. **Return type**: `BYTES`'
  },
  insertText: 'sha256(${1:input})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'sha256(input)'
},
{
  label: 'sha512',
  labelDetails: { detail: '', description: '' },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(input) -> BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Computes the hash of the input using the [SHA-512 algorithm](https://en.wikipedia.org/wiki/SHA-2). The input can either be `STRING` or `BYTES`. The string version treats the input as an array of bytes. **Return type**: `BYTES`'
  },
  insertText: 'sha512(${1:input})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'sha512(input)'
}];