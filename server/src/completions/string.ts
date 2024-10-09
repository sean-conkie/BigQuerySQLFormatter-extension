import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const stringFunctions: CompletionItem[] = [{
  label: 'ascii',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Returns the ASCII code for the first character or byte in a `STRING` or `BYTES`. If the string is empty or the ASCII code is `0`, returns `0`.'
  },
  insertText: 'ascii(${1:value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'ascii(value)'
},
{
  label: 'byte_length',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Gets the number of `BYTES` in a `STRING` or `BYTES`.'
  },
  insertText: 'byte_length(${1:value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'byte_length(value)'
},
{
  label: 'char_length',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Gets the number of characters in a `STRING`.'
  },
  insertText: 'char_length(${1:value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'char_length(value)'
},
{
  label: 'chr',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Takes a Unicode code point and returns the character. Returns an empty string for an invalid code point.'
  },
  insertText: 'chr(${1:value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'chr(value)'
},
{
  label: 'code_points_to_bytes',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(ascii_code_points) -> BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Converts an array of extended ASCII code points to `BYTES`.'
  },
  insertText: 'code_points_to_bytes(${1:ascii_code_points})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'code_points_to_bytes(ascii_code_points)'
},
{
  label: 'code_points_to_string',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(unicode_code_points) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Converts an array of Unicode code points to a `STRING`.'
  },
  insertText: 'code_points_to_string(${1:unicode_code_points})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'code_points_to_string(unicode_code_points)'
},
{
  label: 'collate',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value, collate_specification) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Combines a `STRING` and a collation specification into a collation-supported `STRING`.'
  },
  insertText: 'collate(${1:value}, ${2:collate_specification})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'collate(value, collate_specification)'
},
{
  label: 'concat',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value1 [, ...]) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Concatenates one or more `STRING` or `BYTES` into a single result.'
  },
  insertText: 'concat(${1:value1}${2:, ...})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'concat(value1 [, ...])'
},
{
  label: 'contains_substr',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(expression, search_value_literal [, json_scope => json_scope_value]) -> BOOL',
  documentation: {
    kind: 'markdown',
    value: 'Performs a normalized, case-insensitive search.'
  },
  insertText: 'contains_substr(${1:expression}, ${2:search_value_literal}${3:, json_scope => json_scope_value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'contains_substr(expression, search_value_literal [, json_scope => json_scope_value ])'
},
{
  label: 'edit_distance',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value1, value2 [, max_distance => max_distance_value]) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the Levenshtein distance between two `STRING` or `BYTES`.'
  },
  insertText: 'edit_distance(${1:value1}, ${2:value2}${3:, max_distance => max_distance_value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'edit_distance(value1, value2 [, max_distance => max_distance_value ])'
},
{
  label: 'ends_with',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value, suffix) -> BOOL',
  documentation: {
    kind: 'markdown',
    value: 'Returns `TRUE` if `suffix` is a suffix of `value`.'
  },
  insertText: 'ends_with(${1:value}, ${2:suffix})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'ends_with(value, suffix)'
},
{
  label: 'format',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(format_string_expression, data_type_expression [, ...]) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Formats a data type expression as a string.'
  },
  insertText: 'format(${1:format_string_expression}, ${2:data_type_expression}${3:, ...})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'format(format_string_expression, data_type_expression [, ...])'
},
{
  label: 'from_base32',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(string_expr) -> BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Converts a base32-encoded `STRING` into `BYTES`.'
  },
  insertText: 'from_base32(${1:string_expr})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'from_base32(string_expr)'
},
{
  label: 'from_base64',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(string_expr) -> BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Converts a base64-encoded `STRING` into `BYTES`.'
  },
  insertText: 'from_base64(${1:string_expr})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'from_base64(string_expr)'
},
{
  label: 'from_hex',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(string) -> BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Converts a hexadecimal-encoded `STRING` into `BYTES`.'
  },
  insertText: 'from_hex(${1:string})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'from_hex(string)'
},
{
  label: 'initcap',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value [, delimiters]) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Formats a `STRING` as proper case.'
  },
  insertText: 'initcap(${1:value}${2:, delimiters})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'initcap(value [, delimiters])'
},
{
  label: 'instr',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value, subvalue [, position, occurrence]) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Returns the position of a subvalue inside another value.'
  },
  insertText: 'instr(${1:value}, ${2:subvalue}${3:, position, occurrence})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'instr(value, subvalue [, position [, occurrence]])'
},
{
  label: 'left',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value, length) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Returns the specified leftmost portion from a `STRING` or `BYTES`.'
  },
  insertText: 'left(${1:value}, ${2:length})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'left(value, length)'
},
{
  label: 'length',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Returns the length of a `STRING` or `BYTES` value.'
  },
  insertText: 'length(${1:value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'length(value)'
},
{
  label: 'lower',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Returns the original string with all alphabetic characters in lowercase.'
  },
  insertText: 'lower(${1:value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'lower(value)'
},
{
  label: 'lpad',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(original_value, return_length [, pattern]) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Prepends a `STRING` or `BYTES` value with a pattern.'
  },
  insertText: 'lpad(${1:original_value}, ${2:return_length}${3:, pattern})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'lpad(original_value, return_length [, pattern])'
},
{
  label: 'ltrim',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value1 [, value2]) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Removes leading characters.'
  },
  insertText: 'ltrim(${1:value1}${2:, value2})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'ltrim(value1 [, value2])'
},
{
  label: 'normalize',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value [, normalization_mode]) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Returns a normalized string.'
  },
  insertText: 'normalize(${1:value}${2:, normalization_mode})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'normalize(value [, normalization_mode])'
},
{
  label: 'normalize_and_casefold',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value [, normalization_mode]) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Returns a normalized, case-folded string.'
  },
  insertText: 'normalize_and_casefold(${1:value}${2:, normalization_mode})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'normalize_and_casefold(value [, normalization_mode])'
},
{
  label: 'octet_length',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> INT64',
  documentation: { kind: 'markdown', value: 'Alias for `BYTE_LENGTH`.' },
  insertText: 'octet_length(${1:value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'octet_length(value)'
},
{
  label: 'regexp_contains',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value, regexp) -> BOOL',
  documentation: {
    kind: 'markdown',
    value: 'Returns `TRUE` if the value is a partial match for the regular expression.'
  },
  insertText: 'regexp_contains(${1:value}, ${2:regexp})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'regexp_contains(value, regexp)'
},
{
  label: 'regexp_extract',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value, regexp [, position, occurrence]) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Returns the substring in `value` that matches the regular expression.'
  },
  insertText: 'regexp_extract(${1:value}, ${2:regexp}${3:, position, occurrence})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'regexp_extract(value, regexp [, position [, occurrence]])'
},
{
  label: 'regexp_extract_all',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value, regexp) -> ARRAY<STRING> | ARRAY<BYTES>',
  documentation: {
    kind: 'markdown',
    value: 'Returns an array of all substrings of `value` that match the regular expression.'
  },
  insertText: 'regexp_extract_all(${1:value}, ${2:regexp})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'regexp_extract_all(value, regexp)'
},
{
  label: 'regexp_instr',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(source_value, regexp [, position, occurrence, occurrence_position]) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Returns the lowest 1-based position of a regular expression.'
  },
  insertText: 'regexp_instr(${1:source_value}, ${2:regexp}${3:, position, occurrence, occurrence_position})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'regexp_instr(source_value, regexp [, position [, occurrence [, occurrence_position]]])'
},
{
  label: 'regexp_replace',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value, regexp, replacement) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Replaces all substrings of `value` that match a regular expression with `replacement`.'
  },
  insertText: 'regexp_replace(${1:value}, ${2:regexp}, ${3:replacement})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'regexp_replace(value, regexp, replacement)'
},
{
  label: 'repeat',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(original_value, repetitions) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Repeats `original_value` a specified number of times.'
  },
  insertText: 'repeat(${1:original_value}, ${2:repetitions})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'repeat(original_value, repetitions)'
},
{
  label: 'replace',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(original_value, from_pattern, to_pattern) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Replaces all occurrences of `from_pattern` with `to_pattern` in `original_value`.'
  },
  insertText: 'replace(${1:original_value}, ${2:from_pattern}, ${3:to_pattern})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'replace(original_value, from_pattern, to_pattern)'
},
{
  label: 'reverse',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Returns the reverse of the input `STRING` or `BYTES`.'
  },
  insertText: 'reverse(${1:value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'reverse(value)'
},
{
  label: 'right',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value, length) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Returns the specified rightmost portion from a `STRING` or `BYTES`.'
  },
  insertText: 'right(${1:value}, ${2:length})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'right(value, length)'
},
{
  label: 'rpad',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(original_value, return_length [, pattern]) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Appends a `STRING` or `BYTES` value with a pattern.'
  },
  insertText: 'rpad(${1:original_value}, ${2:return_length}${3:, pattern})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'rpad(original_value, return_length [, pattern])'
},
{
  label: 'rtrim',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value1 [, value2]) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Removes trailing characters.'
  },
  insertText: 'rtrim(${1:value1}${2:, value2})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'rtrim(value1 [, value2])'
},
{
  label: 'safe_convert_bytes_to_string',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Converts `BYTES` to a `STRING`, replacing invalid UTF-8 characters.'
  },
  insertText: 'safe_convert_bytes_to_string(${1:value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'safe_convert_bytes_to_string(value)'
},
{
  label: 'soundex',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Returns the Soundex code for a `STRING`.'
  },
  insertText: 'soundex(${1:value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'soundex(value)'
},
{
  label: 'split',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value [, delimiter]) -> ARRAY<STRING> | ARRAY<BYTES>',
  documentation: {
    kind: 'markdown',
    value: 'Splits a `STRING` or `BYTES` using a delimiter.'
  },
  insertText: 'split(${1:value}${2:, delimiter})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'split(value [, delimiter])'
},
{
  label: 'starts_with',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value, prefix) -> BOOL',
  documentation: {
    kind: 'markdown',
    value: 'Returns `TRUE` if `prefix` is a prefix of `value`.'
  },
  insertText: 'starts_with(${1:value}, ${2:prefix})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'starts_with(value, prefix)'
},
{
  label: 'strpos',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value, subvalue) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Returns the 1-based position of the first occurrence of `subvalue` inside `value`.'
  },
  insertText: 'strpos(${1:value}, ${2:subvalue})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'strpos(value, subvalue)'
},
{
  label: 'substr',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value, position [, length]) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Gets a portion of a `STRING` or `BYTES`.'
  },
  insertText: 'substr(${1:value}, ${2:position}${3:, length})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'substr(value, position [, length])'
},
{
  label: 'to_base32',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(bytes_expr) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Converts `BYTES` into a base32-encoded `STRING`.'
  },
  insertText: 'to_base32(${1:bytes_expr})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'to_base32(bytes_expr)'
},
{
  label: 'to_base64',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(bytes_expr) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Converts `BYTES` into a base64-encoded `STRING`.'
  },
  insertText: 'to_base64(${1:bytes_expr})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'to_base64(bytes_expr)'
},
{
  label: 'to_code_points',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> ARRAY<INT64>',
  documentation: {
    kind: 'markdown',
    value: 'Returns an array of code points or extended ASCII character values from a `STRING` or `BYTES`.'
  },
  insertText: 'to_code_points(${1:value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'to_code_points(value)'
},
{
  label: 'to_hex',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(bytes) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Converts `BYTES` into a hexadecimal `STRING`.'
  },
  insertText: 'to_hex(${1:bytes})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'to_hex(bytes)'
},
{
  label: 'translate',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(expression, source_characters, target_characters) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Replaces each character in `source_characters` with the corresponding character in `target_characters`.'
  },
  insertText: 'translate(${1:expression}, ${2:source_characters}, ${3:target_characters})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'translate(expression, source_characters, target_characters)'
},
{
  label: 'trim',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value_to_trim [, set_of_characters_to_remove]) -> STRING | BYTES',
  documentation: {
    kind: 'markdown',
    value: 'Removes leading and trailing characters from a `STRING` or `BYTES` value.'
  },
  insertText: 'trim(${1:value_to_trim}${2:, set_of_characters_to_remove})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'trim(value_to_trim [, set_of_characters_to_remove])'
},
{
  label: 'unicode',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Returns the Unicode code point for the first character in a value.'
  },
  insertText: 'unicode(${1:value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'unicode(value)'
},
{
  label: 'upper',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(value) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Returns the original string with all alphabetic characters in uppercase.'
  },
  insertText: 'upper(${1:value})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'upper(value)'
}];