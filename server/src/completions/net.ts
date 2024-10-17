import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const netFunctions: CompletionItem[] = [{
  label: 'net.host',
  labelDetails: { detail: 'STRING', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(url) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Takes a URL as a `STRING` value and returns the host. For best results, URL values should comply with the format as defined by [RFC 3986](https://tools.ietf.org/html/rfc3986#appendix-A). If the URL value does not comply with RFC 3986 formatting, this function makes a best effort to parse the input and return a relevant result. If the function cannot parse the input, it returns `NULL`.'
  },
  insertText: 'net.host(${1:url})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'net.host(url)'
},
{
  label: 'net.ip_from_string',
  labelDetails: { detail: 'BYTES', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(addr_str) -> BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Converts an IPv4 or IPv6 address from text (`STRING`) format to binary (`BYTES`) format in network byte order. This function does not support [CIDR notation](https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing), such as `10.1.2.3/32`.'
  },
  insertText: 'net.ip_from_string(${1:addr_str})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'net.ip_from_string(addr_str)'
},
{
  label: 'net.ip_net_mask',
  labelDetails: { detail: 'BYTES', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(num_output_bytes, prefix_length) -> BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Returns a network mask: a byte sequence with length equal to `num_output_bytes`, where the first `prefix_length` bits are set to 1 and the other bits are set to 0. `num_output_bytes` and `prefix_length` are INT64.'
  },
  insertText: 'net.ip_net_mask(${1:num_output_bytes}, ${2:prefix_length})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'net.ip_net_mask(num_output_bytes, prefix_length)'
},
{
  label: 'net.ip_to_string',
  labelDetails: { detail: 'STRING', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(addr_bin) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Converts an IPv4 or IPv6 address from binary (`BYTES`) format in network byte order to text (`STRING`) format. If the input is 4 bytes, this function returns an IPv4 address as a `STRING`. If the input is 16 bytes, it returns an IPv6 address as a `STRING`.'
  },
  insertText: 'net.ip_to_string(${1:addr_bin})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'net.ip_to_string(addr_bin)'
},
{
  label: 'net.ip_trunc',
  labelDetails: { detail: 'BYTES', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(addr_bin, prefix_length) -> BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Takes `addr_bin`, an IPv4 or IPv6 address in binary (`BYTES`) format in network byte order, and returns a subnet address in the same format. The result has the same length as `addr_bin`, where the first `prefix_length` bits are equal to those in `addr_bin` and the remaining bits are 0.'
  },
  insertText: 'net.ip_trunc(${1:addr_bin}, ${2:prefix_length})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'net.ip_trunc(addr_bin, prefix_length)'
},
{
  label: 'net.ipv4_from_int64',
  labelDetails: { detail: 'BYTES', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(integer_value) -> BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Converts an IPv4 address from integer format to binary (`BYTES`) format in network byte order. This function checks that either all the most significant 32 bits are 0, or all the most significant 33 bits are 1 (sign-extended from a 32-bit integer).'
  },
  insertText: 'net.ipv4_from_int64(${1:integer_value})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'net.ipv4_from_int64(integer_value)'
},
{
  label: 'net.ipv4_to_int64',
  labelDetails: { detail: 'INT64', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(addr_bin) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Converts an IPv4 address from binary (`BYTES`) format in network byte order to integer format. The output is in the range `[0, 0xFFFFFFFF]`.'
  },
  insertText: 'net.ipv4_to_int64(${1:addr_bin})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'net.ipv4_to_int64(addr_bin)'
},
{
  label: 'net.public_suffix',
  labelDetails: { detail: 'STRING', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(url) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Takes a URL as a `STRING` value and returns the public suffix. For best results, URL values should comply with the format as defined by [RFC 3986](https://tools.ietf.org/html/rfc3986#appendix-A). If the URL value does not comply with RFC 3986 formatting, this function makes a best effort to parse the input and return a relevant result.'
  },
  insertText: 'net.public_suffix(${1:url})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'net.public_suffix(url)'
},
{
  label: 'net.reg_domain',
  labelDetails: { detail: 'STRING', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(url) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Takes a URL as a `STRING` value and returns the registered or registrable domain (the public suffix plus one preceding label), as a string. For best results, URL values should comply with the format as defined by [RFC 3986](https://tools.ietf.org/html/rfc3986#appendix-A). If the URL value does not comply with RFC 3986 formatting, this function makes a best effort to parse the input and return a relevant result.'
  },
  insertText: 'net.reg_domain(${1:url})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'net.reg_domain(url)'
},
{
  label: 'net.safe_ip_from_string',
  labelDetails: { detail: 'BYTES', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(addr_str) -> BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Similar to `NET.IP_FROM_STRING`, but returns `NULL` instead of throwing an error if the input is invalid.'
  },
  insertText: 'net.safe_ip_from_string(${1:addr_str})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'net.safe_ip_from_string(addr_str)'
}];