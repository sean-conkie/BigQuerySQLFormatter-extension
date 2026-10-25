import { type Diagnostic, TextEdit } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { readCtes } from '../queries';
import { keyword, SourceFixRule, type SourceToken } from '../source';

export class CteNewline extends SourceFixRule {
  readonly name = 'cte_newline';
  readonly code = 'LT08';
  readonly message = 'Add a blank line after each CTE closing bracket.';
  readonly ruleGroup = 'layout';
  protected readonly fixTitle = 'Add blank line after CTE';

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (!keyword(tokens[i], 'WITH')) continue;
      const ctes = readCtes(tokens, i);
      for (let j = 0; j < ctes.length; j++) {
        const cte = ctes[j];
        const comma = keyword(tokens[cte.close + 1], ',');
        const anchor = tokens[cte.close + (comma ? 1 : 0)];
        const next = tokens[j + 1 < ctes.length ? ctes[j + 1].start : cte.close + 1];
        if (!next || (j === ctes.length - 1 && !keyword(next, 'SELECT') && !keyword(next, '('))) continue;
        const gap = { start: anchor.range.end, end: next.range.start };
        const between = cache.getText(gap);
        if (/\n[ \t]*\n/.test(between)) continue;
        let edit: TextEdit;
        if (anchor.range.end.line === next.range.start.line) {
          const indent = cache.get(next.range.start.line)!.value.match(/^[ \t]*/)![0];
          edit = /^\s*$/.test(between)
            ? TextEdit.replace(gap, `\n\n${indent}`)
            : TextEdit.insert(next.range.start, `\n\n${indent}`);
        } else {
          edit = TextEdit.insert({ line: next.range.start.line, character: 0 }, '\n');
        }
        diagnostics.push(this.diagnosticWithFix(tokens[cte.close].range, uri, [edit]));
      }
    }
    return diagnostics;
  }
}
