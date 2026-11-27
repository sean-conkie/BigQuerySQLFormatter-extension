import { type Diagnostic, type TextEdit, TextEdit as Edit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DocumentCache } from '../../parser/tokenCache';
import { closingBracket, keyword, SourceFixRule, type SourceToken } from '../source';

export class StatementBrackets extends SourceFixRule {
  protected readonly queryScoped = false;
  readonly name = 'statement_brackets';
  readonly code = 'CV07';
  readonly message = 'Statements should not be wrapped in brackets.';
  readonly ruleGroup = 'convention';
  protected readonly fixTitle = 'Remove statement brackets';

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const document = TextDocument.create(uri, 'googlesql', 0, cache.getText());
    let statementStart = true;
    let headerEnd: string | undefined;
    let caseDepth = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (keyword(token, ';')) {
        statementStart = true;
        headerEnd = undefined;
        caseDepth = 0;
        continue;
      }
      if (statementStart && !token.literal) {
        if (keyword(tokens[i + 1], ':')) {
          i++;
          continue;
        }
        if (
          ['LOOP', 'REPEAT', 'ELSE'].some((word) => keyword(token, word)) ||
          (keyword(token, 'BEGIN') && !keyword(tokens[i + 1], 'TRANSACTION'))
        ) {
          continue;
        }
        if (['IF', 'ELSEIF', 'WHEN', 'EXCEPTION'].some((word) => keyword(token, word))) headerEnd = 'THEN';
        else if (['WHILE', 'FOR'].some((word) => keyword(token, word))) headerEnd = 'DO';
        else if (keyword(token, 'CASE')) headerEnd = 'WHEN';
      }

      if (keyword(token, '(')) {
        const end = closingBracket(tokens, i);
        if (end < 0) break;
        if (statementStart && (end === tokens.length - 1 || keyword(tokens[end + 1], ';'))) {
          let first = i;
          let last = end;
          const pairs: [number, number][] = [];
          while (keyword(tokens[first], '(') && closingBracket(tokens, first) === last) {
            pairs.push([first++, last--]);
          }
          if (
            !tokens[first]?.literal &&
            /^(SELECT|WITH|FROM|CREATE|INSERT|UPDATE|DELETE|MERGE|SET|DECLARE|CALL|EXECUTE|ASSERT|RETURN|EXPORT|ALTER|DROP|GRANT|REVOKE|TRUNCATE)$/i.test(
              tokens[first]?.value ?? '',
            ) &&
            !tokens.slice(first, last + 1).some((part) => keyword(part, ';'))
          ) {
            const edits: TextEdit[] = [];
            for (const [open, close] of pairs) {
              const opening = tokens[open].range;
              const closing = tokens[close].range;
              const leading = document.getText({ start: opening.end, end: tokens[open + 1].range.start });
              const trailing = document.getText({ start: tokens[close - 1].range.end, end: closing.start });
              const leadingWhitespace = /^\s*/.exec(leading)![0].length;
              const trailingWhitespace = /\s*$/.exec(trailing)![0].length;
              // A line comment still needs its newline after the closing bracket is removed.
              const keepNewline = /(?:--|#)[^\r\n]*(?:\r\n?|\n)\s*$/.test(trailing);
              edits.push(
                Edit.del({
                  start: opening.start,
                  end: document.positionAt(document.offsetAt(opening.end) + leadingWhitespace),
                }),
                Edit.replace(
                  {
                    start: document.positionAt(document.offsetAt(closing.start) - trailingWhitespace),
                    end: closing.end,
                  },
                  keepNewline ? cache.eol : '',
                ),
              );
            }
            diagnostics.push(
              this.diagnosticWithFix({ start: token.range.start, end: tokens[end].range.end }, uri, edits),
            );
          }
        }
        i = end;
      } else if (headerEnd) {
        if (keyword(token, headerEnd) && caseDepth === 0) {
          if (headerEnd === 'WHEN') headerEnd = 'THEN';
          else {
            headerEnd = undefined;
            statementStart = true;
            continue;
          }
        } else if (keyword(token, 'CASE') && !statementStart) caseDepth++;
        else if (keyword(token, 'END') && caseDepth) caseDepth--;
      }
      statementStart = false;
    }
    return diagnostics;
  }
}
