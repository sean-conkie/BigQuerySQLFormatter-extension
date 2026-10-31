import { type Diagnostic, TextEdit } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { readCtes } from '../queries';
import { keyword, SourceFixRule, type SourceToken } from '../source';

export class CteBracket extends SourceFixRule {
  readonly name = 'cte_bracket';
  readonly code = 'LT07';
  readonly message = 'Place a multiline CTE closing bracket on a new line.';
  readonly ruleGroup = 'layout';
  protected readonly fixTitle = 'Move CTE closing bracket to a new line';

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (!keyword(tokens[i], 'WITH')) continue;
      for (const cte of readCtes(tokens, i)) {
        const close = tokens[cte.close];
        if (tokens[cte.open].range.start.line === close.range.start.line) continue;
        const prefix = cache.get(close.range.start.line)!.value.slice(0, close.range.start.character);
        if (!/\S/.test(prefix)) continue;
        const indent = cache.get(tokens[cte.start].range.start.line)!.value.match(/^[ \t]*/)![0];
        const whitespace = prefix.match(/[ \t]*$/)![0].length;
        const range = {
          start: { ...close.range.start, character: close.range.start.character - whitespace },
          end: close.range.start,
        };
        diagnostics.push(this.diagnosticWithFix(close.range, uri, [TextEdit.replace(range, `\n${indent}`)]));
      }
    }
    return diagnostics;
  }
}
