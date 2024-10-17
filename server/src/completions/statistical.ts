import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const statisticalFunctions: CompletionItem[] = [{
  label: 'corr',
  labelDetails: { detail: 'Returns FLOAT64', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(x1, x2) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the Pearson coefficient of correlation of a set of number pairs.'
  },
  insertText: 'corr(${1:x1}, ${2:x2})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'corr(x1, x2)'
},
{
  label: 'covar_pop',
  labelDetails: { detail: 'Returns FLOAT64', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(x1, x2) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the population covariance of a set of number pairs.'
  },
  insertText: 'covar_pop(${1:x1}, ${2:x2})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'covar_pop(x1, x2)'
},
{
  label: 'covar_samp',
  labelDetails: { detail: 'Returns FLOAT64', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(x1, x2) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the sample covariance of a set of number pairs.'
  },
  insertText: 'covar_samp(${1:x1}, ${2:x2})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'covar_samp(x1, x2)'
},
{
  label: 'stddev',
  labelDetails: { detail: 'Alias of STDDEV_SAMP', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(expression) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'An alias of the stddev_samp function.'
  },
  insertText: 'stddev(${1:expression})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'stddev(expression)'
},
{
  label: 'stddev_pop',
  labelDetails: { detail: 'Returns FLOAT64', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(expression) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the population (biased) standard deviation of the values.'
  },
  insertText: 'stddev_pop(${1:expression})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'stddev_pop(expression)'
},
{
  label: 'stddev_samp',
  labelDetails: { detail: 'Returns FLOAT64', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(expression) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the sample (unbiased) standard deviation of the values.'
  },
  insertText: 'stddev_samp(${1:expression})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'stddev_samp(expression)'
},
{
  label: 'var_pop',
  labelDetails: { detail: 'Returns FLOAT64', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(expression) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the population (biased) variance of the values.'
  },
  insertText: 'var_pop(${1:expression})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'var_pop(expression)'
},
{
  label: 'var_samp',
  labelDetails: { detail: 'Returns FLOAT64', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(expression) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the sample (unbiased) variance of the values.'
  },
  insertText: 'var_samp(${1:expression})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'var_samp(expression)'
},
{
  label: 'variance',
  labelDetails: { detail: 'Alias of VAR_SAMP', description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(expression) -> FLOAT64',
  documentation: { kind: 'markdown', value: 'An alias of var_samp.' },
  insertText: 'variance(${1:expression})$0',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'variance(expression)'
}];