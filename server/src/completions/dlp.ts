import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const dlpFunctions: CompletionItem[] = [{
  label: 'dlp_deterministic_encrypt(key, plaintext, surrogate, context): string',
  labelDetails: { detail: 'string', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(key, plaintext, surrogate, context) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'This function derives a data encryption key from `key` and `context`, and then encrypts `plaintext`. You can use `surrogate` to prepend the encryption result.'
  },
  insertText: 'dlp_deterministic_encrypt(${1:key}, ${2:plaintext}, ${3:surrogate}, ${4:context})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'dlp_deterministic_encrypt(key, plaintext, surrogate, context)'
},
{
  label: 'dlp_deterministic_decrypt(key, ciphertext, surrogate, context): string',
  labelDetails: { detail: 'string', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(key, ciphertext, surrogate, context) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'This function decrypts `ciphertext` using an encryption key derived from `key` and `context`. You can use `surrogate` to prepend the decryption result.'
  },
  insertText: 'dlp_deterministic_decrypt(${1:key}, ${2:ciphertext}, ${3:surrogate}, ${4:context})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'dlp_deterministic_decrypt(key, ciphertext, surrogate, context)'
},
{
  label: 'dlp_key_chain(kms_resource_name, wrapped_key): struct',
  labelDetails: { detail: 'struct', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(kms_resource_name, wrapped_key) -> STRUCT',
  documentation: {
    kind: 'markdown',
    value: 'Gets a data encryption key wrapped by Cloud Key Management Service.'
  },
  insertText: 'dlp_key_chain(${1:kms_resource_name}, ${2:wrapped_key})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'dlp_key_chain(kms_resource_name, wrapped_key)'
}];