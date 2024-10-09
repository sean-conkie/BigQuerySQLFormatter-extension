import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const intervalFunctions: CompletionItem[] = [{
  label: 'extract',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(part, interval_expression) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Returns the value corresponding to the specified date part. The `part` must be one of `YEAR`, `MONTH`, `DAY`, `HOUR`, `MINUTE`, `SECOND`, `MILLISECOND` or `MICROSECOND`.'
  },
  insertText: 'extract(${1:part} from ${2:interval_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'extract(part from interval_expression)'
},
{
  label: 'justify_days',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(interval_expression) -> INTERVAL',
  documentation: {
    kind: 'markdown',
    value: 'Normalizes the day part of the interval to the range from -29 to 29 by incrementing/decrementing the month or year part of the interval.'
  },
  insertText: 'justify_days(${1:interval_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'justify_days(interval_expression)'
},
{
  label: 'justify_hours',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(interval_expression) -> INTERVAL',
  documentation: {
    kind: 'markdown',
    value: 'Normalizes the time part of the interval to the range from -23:59:59.999999 to 23:59:59.999999 by incrementing/decrementing the day part of the interval.'
  },
  insertText: 'justify_hours(${1:interval_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'justify_hours(interval_expression)'
},
{
  label: 'justify_interval',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(interval_expression) -> INTERVAL',
  documentation: {
    kind: 'markdown',
    value: 'Normalizes the days and time parts of the interval.'
  },
  insertText: 'justify_interval(${1:interval_expression})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'justify_interval(interval_expression)'
},
{
  label: 'make_interval',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(year INT64, month INT64, day INT64, hour INT64, minute INT64, second INT64) -> INTERVAL',
  documentation: {
    kind: 'markdown',
    value: 'Constructs an `INTERVAL` object using `INT64` values representing the year, month, day, hour, minute, and second. All arguments are optional, `0` by default, and can be [named arguments](https://cloud.google.com/bigquery/docs/reference/standard-sql/functions-reference#named_arguments).'
  },
  insertText: 'make_interval(${1:[year => ], }${2:[month => ], }${3:[day => ], }${4:[hour => ], }${5:[minute => ], }${6:[second => ]})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'make_interval([year => ], [month => ], [day => ], [hour => ], [minute => ], [second => ])'
}];