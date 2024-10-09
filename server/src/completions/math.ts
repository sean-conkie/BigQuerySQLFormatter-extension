import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const mathFunctions: CompletionItem[] = [{
  label: 'abs',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the absolute value of X.'
  },
  insertText: 'abs(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'abs(X)'
},
{
  label: 'acos',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the inverse cosine of X.'
  },
  insertText: 'acos(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'acos(X)'
},
{
  label: 'acosh',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the inverse hyperbolic cosine of X.'
  },
  insertText: 'acosh(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'acosh(X)'
},
{
  label: 'asin',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the inverse sine of X.'
  },
  insertText: 'asin(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'asin(X)'
},
{
  label: 'asinh',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the inverse hyperbolic sine of X.'
  },
  insertText: 'asinh(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'asinh(X)'
},
{
  label: 'atan',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the inverse tangent of X.'
  },
  insertText: 'atan(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'atan(X)'
},
{
  label: 'atan2',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X, Y) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the inverse tangent of X/Y.'
  },
  insertText: 'atan2(${1:X}, ${2:Y})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'atan2(X, Y)'
},
{
  label: 'atanh',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the inverse hyperbolic tangent of X.'
  },
  insertText: 'atanh(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'atanh(X)'
},
{
  label: 'cbrt',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the cube root of X.'
  },
  insertText: 'cbrt(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'cbrt(X)'
},
{
  label: 'ceil',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Gets the smallest integral value that is not less than X.'
  },
  insertText: 'ceil(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'ceil(X)'
},
{
  label: 'ceiling',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: { kind: 'markdown', value: 'Synonym of CEIL.' },
  insertText: 'ceiling(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'ceiling(X)'
},
{
  label: 'cos',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: { kind: 'markdown', value: 'Computes the cosine of X.' },
  insertText: 'cos(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'cos(X)'
},
{
  label: 'cosh',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the hyperbolic cosine of X.'
  },
  insertText: 'cosh(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'cosh(X)'
},
{
  label: 'cosine_distance',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(vector1, vector2) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the cosine distance between two vectors.'
  },
  insertText: 'cosine_distance(${1:vector1}, ${2:vector2})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'cosine_distance(vector1, vector2)'
},
{
  label: 'cot',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the cotangent of X.'
  },
  insertText: 'cot(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'cot(X)'
},
{
  label: 'coth',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the hyperbolic cotangent of X.'
  },
  insertText: 'coth(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'coth(X)'
},
{
  label: 'csc',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the cosecant of X.'
  },
  insertText: 'csc(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'csc(X)'
},
{
  label: 'csch',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the hyperbolic cosecant of X.'
  },
  insertText: 'csch(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'csch(X)'
},
{
  label: 'div',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X, Y) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Divides integer X by integer Y.'
  },
  insertText: 'div(${1:X}, ${2:Y})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'div(X, Y)'
},
{
  label: 'exp',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes e to the power of X.'
  },
  insertText: 'exp(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'exp(X)'
},
{
  label: 'euclidean_distance',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(vector1, vector2) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the Euclidean distance between two vectors.'
  },
  insertText: 'euclidean_distance(${1:vector1}, ${2:vector2})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'euclidean_distance(vector1, vector2)'
},
{
  label: 'floor',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Gets the largest integral value that is not greater than X.'
  },
  insertText: 'floor(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'floor(X)'
},
{
  label: 'greatest',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X1, ..., XN) -> generic',
  documentation: {
    kind: 'markdown',
    value: 'Gets the greatest value among X1,...,XN.'
  },
  insertText: 'greatest(${1:X1}, ..., ${2:XN})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'greatest(X1, ..., XN)'
},
{
  label: 'ieee_divide',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X, Y) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Divides X by Y, never fails.'
  },
  insertText: 'ieee_divide(${1:X}, ${2:Y})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'ieee_divide(X, Y)'
},
{
  label: 'is_inf',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> BOOL',
  documentation: {
    kind: 'markdown',
    value: 'Checks if X is positive or negative infinity.'
  },
  insertText: 'is_inf(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'is_inf(X)'
},
{
  label: 'is_nan',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> BOOL',
  documentation: {
    kind: 'markdown',
    value: 'Checks if X is a NaN value.'
  },
  insertText: 'is_nan(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'is_nan(X)'
},
{
  label: 'least',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X1, ..., XN) -> generic',
  documentation: {
    kind: 'markdown',
    value: 'Gets the least value among X1,...,XN.'
  },
  insertText: 'least(${1:X1}, ..., ${2:XN})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'least(X1, ..., XN)'
},
{
  label: 'ln',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the natural logarithm of X.'
  },
  insertText: 'ln(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'ln(X)'
},
{
  label: 'log',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X, Y) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the logarithm of X to base Y.'
  },
  insertText: 'log(${1:X}, ${2:Y})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'log(X, Y)'
},
{
  label: 'log10',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the logarithm of X to base 10.'
  },
  insertText: 'log10(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'log10(X)'
},
{
  label: 'mod',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X, Y) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Gets the remainder of the division of X by Y.'
  },
  insertText: 'mod(${1:X}, ${2:Y})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'mod(X, Y)'
},
{
  label: 'pow',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X, Y) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Produces the value of X raised to the power of Y.'
  },
  insertText: 'pow(${1:X}, ${2:Y})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'pow(X, Y)'
},
{
  label: 'power',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X, Y) -> FLOAT64',
  documentation: { kind: 'markdown', value: 'Synonym of POW.' },
  insertText: 'power(${1:X}, ${2:Y})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'power(X, Y)'
},
{
  label: 'rand',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '() -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Generates a pseudo-random value in the range of [0, 1).'
  },
  insertText: 'rand()',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'rand()'
},
{
  label: 'range_bucket',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(point, boundaries_array) -> INT64',
  documentation: {
    kind: 'markdown',
    value: "Scans through a sorted array and returns the 0-based position of a point's upper bound."
  },
  insertText: 'range_bucket(${1:point}, ${2:boundaries_array})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'range_bucket(point, boundaries_array)'
},
{
  label: 'round',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X, N) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Rounds X to the nearest integer or to N decimal places.'
  },
  insertText: 'round(${1:X}, ${2:N})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'round(X, N)'
},
{
  label: 'safe_add',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X, Y) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Equivalent to addition, returns NULL if overflow occurs.'
  },
  insertText: 'safe_add(${1:X}, ${2:Y})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'safe_add(X, Y)'
},
{
  label: 'safe_divide',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X, Y) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Equivalent to division, returns NULL if an error occurs.'
  },
  insertText: 'safe_divide(${1:X}, ${2:Y})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'safe_divide(X, Y)'
},
{
  label: 'safe_multiply',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X, Y) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Equivalent to multiplication, returns NULL if overflow occurs.'
  },
  insertText: 'safe_multiply(${1:X}, ${2:Y})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'safe_multiply(X, Y)'
},
{
  label: 'safe_negate',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Equivalent to unary minus, returns NULL if overflow occurs.'
  },
  insertText: 'safe_negate(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'safe_negate(X)'
},
{
  label: 'safe_subtract',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X, Y) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Equivalent to subtraction, returns NULL if overflow occurs.'
  },
  insertText: 'safe_subtract(${1:X}, ${2:Y})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'safe_subtract(X, Y)'
},
{
  label: 'sec',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: { kind: 'markdown', value: 'Computes the secant of X.' },
  insertText: 'sec(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'sec(X)'
},
{
  label: 'sech',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the hyperbolic secant of X.'
  },
  insertText: 'sech(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'sech(X)'
},
{
  label: 'sign',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> INT64',
  documentation: {
    kind: 'markdown',
    value: 'Produces -1 , 0, or +1 for negative, zero, and positive arguments respectively.'
  },
  insertText: 'sign(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'sign(X)'
},
{
  label: 'sin',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: { kind: 'markdown', value: 'Computes the sine of X.' },
  insertText: 'sin(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'sin(X)'
},
{
  label: 'sinh',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the hyperbolic sine of X.'
  },
  insertText: 'sinh(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'sinh(X)'
},
{
  label: 'sqrt',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the square root of X.'
  },
  insertText: 'sqrt(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'sqrt(X)'
},
{
  label: 'tan',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: { kind: 'markdown', value: 'Computes the tangent of X.' },
  insertText: 'tan(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'tan(X)'
},
{
  label: 'tanh',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Computes the hyperbolic tangent of X.'
  },
  insertText: 'tanh(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'tanh(X)'
},
{
  label: 'trunc',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(X) -> FLOAT64',
  documentation: {
    kind: 'markdown',
    value: 'Rounds a number like ROUND(X) but always towards zero.'
  },
  insertText: 'trunc(${1:X})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'trunc(X)'
},
{
  label: 'range_bucket',
  labelDetails: undefined,
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(point, boundaries_array) -> INT64',
  documentation: {
    kind: 'markdown',
    value: "Scans through a sorted array and returns the 0-based position of a point's upper bound."
  },
  insertText: 'range_bucket(${1:point}, ${2:boundaries_array})',
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: 'range_bucket(point, boundaries_array)'
}];