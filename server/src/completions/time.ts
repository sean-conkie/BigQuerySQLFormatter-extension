import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const timeFunctions: CompletionItem[] = [{
  label: 'current_time',
  labelDetails: {
    detail: 'Returns the current time as a TIME value.',
    description: 'Returns the current time as a time value.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '() -> TIME',
  documentation: {
    kind: 'markdown',
    value: 'Returns the current time as a `TIME` value.'
  },
  insertText: 'current_time(${1:time_zone})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'current_time(time_zone)'
},
{
  label: 'extract',
  labelDetails: {
    detail: 'Extracts part of a TIME value.',
    description: 'Extracts part of a time value.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(part from time_expression) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Extracts part of a `TIME` value.'
  },
  insertText: 'extract(${1:part} from ${2:time_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'extract(part from time_expression)'
},
{
  label: 'format_time',
  labelDetails: {
    detail: 'Formats a TIME value according to the specified format string.',
    description: 'Formats a time value according to the specified format string.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(format_string, time_expr) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Formats a `TIME` value according to the specified format string.'
  },
  insertText: 'format_time(${1:format_string}, ${2:time_expr})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'format_time(format_string, time_expr)'
},
{
  label: 'parse_time',
  labelDetails: {
    detail: 'Converts a STRING value to a TIME value.',
    description: 'Converts a string value to a time value.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(format_string, time_string) -> TIME',
  documentation: {
    kind: 'markdown',
    value: 'Converts a `STRING` value to a `TIME` value.'
  },
  insertText: 'parse_time(${1:format_string}, ${2:time_string})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'parse_time(format_string, time_string)'
},
{
  label: 'time',
  labelDetails: {
    detail: 'Constructs a TIME value.',
    description: 'Constructs a time value.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(hour, minute, second) -> TIME',
  documentation: { kind: 'markdown', value: 'Constructs a `TIME` value.' },
  insertText: 'time(${1:hour}, ${2:minute}, ${3:second})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'time(hour, minute, second)'
},
{
  label: 'time_add',
  labelDetails: {
    detail: 'Adds a specified time interval to a TIME value.',
    description: 'Adds a specified time interval to a time value.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(time_expression, interval int64_expression part) -> TIME',
  documentation: {
    kind: 'markdown',
    value: 'Adds a specified time interval to a `TIME` value.'
  },
  insertText: 'time_add(${1:time_expression}, interval ${2:int64_expression} ${3:part})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'time_add(time_expression, interval int64_expression part)'
},
{
  label: 'time_diff',
  labelDetails: {
    detail: 'Gets the number of unit boundaries between two TIME values at a particular time granularity.',
    description: 'Gets the number of unit boundaries between two time values.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(start_time, end_time, granularity) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Gets the number of unit boundaries between two `TIME` values at a particular time granularity.'
  },
  insertText: 'time_diff(${1:start_time}, ${2:end_time}, ${3:granularity})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'time_diff(start_time, end_time, granularity)'
},
{
  label: 'time_sub',
  labelDetails: {
    detail: 'Subtracts a specified time interval from a TIME value.',
    description: 'Subtracts a specified time interval from a time value.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(time_expression, interval int64_expression part) -> TIME',
  documentation: {
    kind: 'markdown',
    value: 'Subtracts a specified time interval from a `TIME` value.'
  },
  insertText: 'time_sub(${1:time_expression}, interval ${2:int64_expression} ${3:part})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'time_sub(time_expression, interval int64_expression part)'
},
{
  label: 'time_trunc',
  labelDetails: {
    detail: 'Truncates a TIME value at a particular granularity.',
    description: 'Truncates a time value at a particular granularity.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(time_value, time_granularity) -> TIME',
  documentation: {
    kind: 'markdown',
    value: 'Truncates a `TIME` value at a particular granularity.'
  },
  insertText: 'time_trunc(${1:time_value}, ${2:time_granularity})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'time_trunc(time_value, time_granularity)'
},

{
  label: 'date_bucket',
  labelDetails: {
    detail: 'DATE',
    description: 'Gets the lower bound of the date bucket that contains a date.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(date_in_bucket, bucket_width) -> DATE',
  documentation: {
    kind: 'markdown',
    value: 'Gets the lower bound of the date bucket that contains a date.'
  },
  insertText: 'date_bucket(${1:date_in_bucket}, ${2:bucket_width})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'date_bucket(date_in_bucket, bucket_width)'
},
{
  label: 'datetime_bucket',
  labelDetails: {
    detail: 'DATETIME',
    description: 'Gets the lower bound of the datetime bucket that contains a datetime.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(datetime_in_bucket, bucket_width) -> DATETIME',
  documentation: {
    kind: 'markdown',
    value: 'Gets the lower bound of the datetime bucket that contains a datetime.'
  },
  insertText: 'datetime_bucket(${1:datetime_in_bucket}, ${2:bucket_width})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'datetime_bucket(datetime_in_bucket, bucket_width)'
},
{
  label: 'gap_fill',
  labelDetails: {
    detail: 'TABLE',
    description: 'Finds and fills gaps in a time series.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(time_series_table, time_series_column, bucket_width, partitioning_columns => value, value_columns => value, origin => value, ignore_null_values => { TRUE | FALSE }) -> TABLE',
  documentation: 'Finds and fills gaps in a time series.',
  insertText: 'gap_fill(${1:table time_series_table}, ${2:time_series_column}, ${3:bucket_width}, ${4|, partitioning_columns => value, , value_columns => value, , origin => value, , ignore_null_values => { TRUE | FALSE} |})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'gap_fill((time_series_subquery), time_series_column, bucket_width)'
},
{
  label: 'timestamp_bucket',
  labelDetails: {
    detail: 'TIMESTAMP',
    description: 'Gets the lower bound of the timestamp bucket that contains a timestamp.'
  },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(timestamp_in_bucket, bucket_width) -> TIMESTAMP',
  documentation: {
    kind: 'markdown',
    value: 'Gets the lower bound of the timestamp bucket that contains a timestamp.'
  },
  insertText: 'timestamp_bucket(${1:timestamp_in_bucket}, ${2:bucket_width})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'timestamp_bucket(timestamp_in_bucket, bucket_width)'
},
{
  label: 'current_timestamp',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '() -> TIMESTAMP',
  documentation: {
    kind: 'markdown',
    value: 'Returns the current date and time as a `TIMESTAMP` object.'
  },
  insertText: 'current_timestamp()',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'current_timestamp()'
},
{
  label: 'extract',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(part from timestamp_expression) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Extracts part of a `TIMESTAMP` value.'
  },
  insertText: 'extract(${1:part} from ${2:timestamp_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'extract(part from timestamp_expression)'
},
{
  label: 'format_timestamp',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(format_string, timestamp_expr) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Formats a `TIMESTAMP` value according to the specified format string.'
  },
  insertText: 'format_timestamp(${1:format_string}, ${2:timestamp_expr}${3:, time_zone})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'format_timestamp(format_string, timestamp_expr[, time_zone])'
},
{
  label: 'parse_timestamp',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(format_string, timestamp_string) -> TIMESTAMP',
  documentation: {
    kind: 'markdown',
    value: 'Converts a `STRING` value to a `TIMESTAMP` value.'
  },
  insertText: 'parse_timestamp(${1:format_string}, ${2:timestamp_string}${3:, time_zone})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'parse_timestamp(format_string, timestamp_string[, time_zone])'
},
{
  label: 'string',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(timestamp_expression) -> STRING',
  documentation: {
    kind: 'markdown',
    value: 'Converts a `TIMESTAMP` value to a `STRING` value.'
  },
  insertText: 'string(${1:timestamp_expression}${2:, time_zone})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'string(timestamp_expression[, time_zone])'
},
{
  label: 'timestamp',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(string_expression) -> TIMESTAMP',
  documentation: {
    kind: 'markdown',
    value: 'Constructs a `TIMESTAMP` value.'
  },
  insertText: 'timestamp(${1:string_expression}${2:, time_zone})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'timestamp(string_expression[, time_zone])'
},
{
  label: 'timestamp_add',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(timestamp_expression, interval int64_expression date_part) -> TIMESTAMP',
  documentation: {
    kind: 'markdown',
    value: 'Adds a specified time interval to a `TIMESTAMP` value.'
  },
  insertText: 'timestamp_add(${1:timestamp_expression}, interval ${2:int64_expression} ${3:date_part})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'timestamp_add(timestamp_expression, interval int64_expression date_part)'
},
{
  label: 'timestamp_diff',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(end_timestamp, start_timestamp, granularity) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Gets the number of unit boundaries between two `TIMESTAMP` values at a particular time granularity.'
  },
  insertText: 'timestamp_diff(${1:end_timestamp}, ${2:start_timestamp}, ${3:granularity})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'timestamp_diff(end_timestamp, start_timestamp, granularity)'
},
{
  label: 'timestamp_micros',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(int64_expression) -> TIMESTAMP',
  documentation: {
    kind: 'markdown',
    value: 'Converts the number of microseconds since 1970-01-01 00:00:00 UTC to a `TIMESTAMP.`'
  },
  insertText: 'timestamp_micros(${1:int64_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'timestamp_micros(int64_expression)'
},
{
  label: 'timestamp_millis',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(int64_expression) -> TIMESTAMP',
  documentation: {
    kind: 'markdown',
    value: 'Converts the number of milliseconds since 1970-01-01 00:00:00 UTC to a `TIMESTAMP.`'
  },
  insertText: 'timestamp_millis(${1:int64_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'timestamp_millis(int64_expression)'
},
{
  label: 'timestamp_seconds',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(int64_expression) -> TIMESTAMP',
  documentation: {
    kind: 'markdown',
    value: 'Converts the number of seconds since 1970-01-01 00:00:00 UTC to a `TIMESTAMP.`'
  },
  insertText: 'timestamp_seconds(${1:int64_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'timestamp_seconds(int64_expression)'
},
{
  label: 'timestamp_sub',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(timestamp_expression, interval int64_expression date_part) -> TIMESTAMP',
  documentation: {
    kind: 'markdown',
    value: 'Subtracts a specified time interval from a `TIMESTAMP` value.'
  },
  insertText: 'timestamp_sub(${1:timestamp_expression}, interval ${2:int64_expression} ${3:date_part})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'timestamp_sub(timestamp_expression, interval int64_expression date_part)'
},
{
  label: 'timestamp_trunc',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(timestamp_value, timestamp_granularity) -> TIMESTAMP',
  documentation: {
    kind: 'markdown',
    value: 'Truncates a `TIMESTAMP` or `DATETIME` value at a particular granularity.'
  },
  insertText: 'timestamp_trunc(${1:timestamp_value}, ${2:timestamp_granularity}${3:, time_zone})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'timestamp_trunc(timestamp_value, timestamp_granularity[, time_zone])'
},
{
  label: 'unix_micros',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(timestamp_expression) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Converts a `TIMESTAMP` value to the number of microseconds since 1970-01-01 00:00:00 UTC.'
  },
  insertText: 'unix_micros(${1:timestamp_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'unix_micros(timestamp_expression)'
},
{
  label: 'unix_millis',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(timestamp_expression) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Converts a `TIMESTAMP` value to the number of milliseconds since 1970-01-01 00:00:00 UTC.'
  },
  insertText: 'unix_millis(${1:timestamp_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'unix_millis(timestamp_expression)'
},
{
  label: 'unix_seconds',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(timestamp_expression) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Converts a `TIMESTAMP` value to the number of seconds since 1970-01-01 00:00:00 UTC.'
  },
  insertText: 'unix_seconds(${1:timestamp_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'unix_seconds(timestamp_expression)'
}
];