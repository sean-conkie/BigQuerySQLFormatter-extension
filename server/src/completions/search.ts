import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const searchFunctions: CompletionItem[] = [{
  label: 'search',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(data_to_search, search_query, [json_scope => JSON_VALUES, JSON_KEYS, JSON_KEYS_AND_VALUES], [analyzer => LOG_ANALYZER, NO_OP_ANALYZER, PATTERN_ANALYZER], [analyzer_options => analyzer_options_values]) -> BOOL',
  documentation: {
    kind: 'markdown',
    value: 'Checks to see whether a table or other search data contains a set of search terms.'
  },
  insertText: 'search(${1:data_to_search}, ${2:search_query}, [json_scope => ${3|JSON_VALUES,JSON_KEYS,JSON_KEYS_AND_VALUES|}], [analyzer => ${4|LOG_ANALYZER,NO_OP_ANALYZER,PATTERN_ANALYZER|}], [analyzer_options => ${5:analyzer_options_values}])',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'search(${1:data_to_search}, ${2:search_query}, [json_scope => ${3|JSON_VALUES,JSON_KEYS,JSON_KEYS_AND_VALUES|}], [analyzer => ${4|LOG_ANALYZER,NO_OP_ANALYZER,PATTERN_ANALYZER|}], [analyzer_options => ${5:analyzer_options_values}])'
}];