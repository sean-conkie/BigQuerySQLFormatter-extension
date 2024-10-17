import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const textAnalysisFunctions: CompletionItem[] = [{
  label: 'bag_of_words',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(tokenized_document) -> MAP<STRING, INT64>',
  documentation: {
    kind: 'markdown',
    value: 'Gets the frequency of each term (token) in a tokenized document.'
  },
  insertText: 'bag_of_words(${1:tokenized_document})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'bag_of_words(tokenized_document)'
},
{
  label: 'text_analyze',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(tokenized_document) -> MAP<STRING, INT64>',
  documentation: {
    kind: 'markdown',
    value: 'Extracts terms (tokens) from text and converts them into a tokenized document.'
  },
  insertText: 'text_analyze(${1:text}, ${2:analyzer}, ${3:analyzer_options})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'text_analyze(text, analyzer, analyzer_options)'
},
{
  label: 'tf_idf',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(tokenized_document, max_distinct_tokens, frequency_threshold) -> MAP<STRING, FLOAT64>',
  documentation: {
    kind: 'markdown',
    value: 'Evaluates how relevant a term is to a tokenized document in a set of tokenized documents.'
  },
  insertText: 'tf_idf(${1:tokenized_document}, ${2:max_distinct_tokens}, ${3:frequency_threshold})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'tf_idf(tokenized_document, max_distinct_tokens, frequency_threshold)'
}];