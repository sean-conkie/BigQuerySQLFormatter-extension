import { type Diagnostic, type TextEdit, TextEdit as Edit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { DocumentCache } from '../../parser/tokenCache';
import { keyword, SourceFixRule, type SourceToken } from '../source';

export class Terminator extends SourceFixRule {
  readonly name = 'terminator';
  readonly code = 'CV06';
  readonly message = 'End statements with an attached semicolon and a newline.';
  readonly ruleGroup = 'convention';
  protected readonly fixTitle = 'Fix statement terminator';

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = cache.getText();
    const document = TextDocument.create(uri, 'googlesql', 0, text);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!keyword(token, ';')) continue;
      const previous = tokens[i - 1];
      const edits: TextEdit[] = [];
      if (previous && !keyword(previous, ';')) {
        const gap = { start: previous.range.end, end: token.range.start };
        const between = document.getText(gap);
        if (between.length && /^\s+$/.test(between)) {
          edits.push(Edit.del(gap));
        } else if (between.length) {
          edits.push(Edit.insert(previous.range.end, ';'), Edit.del(token.range));
        }
      }
      const line = cache.get(token.range.end.line)!.value;
      const suffix = line.slice(token.range.end.character);
      const next = tokens[i + 1];
      if (next?.range.start.line === token.range.end.line) {
        const gap = { start: token.range.end, end: next.range.start };
        if (/^\s*$/.test(document.getText(gap))) edits.push(Edit.replace(gap, '\n'));
        else edits.push(Edit.insert(token.range.end, '\n'));
      } else if (/^[ \t]*$/.test(suffix)) {
        const end = { line: token.range.end.line, character: line.length };
        const replacement = token.range.end.line === cache.size - 1 ? '\n' : '';
        if (suffix || replacement) edits.push(Edit.replace({ start: token.range.end, end }, replacement));
      } else if (token.range.end.line === cache.size - 1) {
        edits.push(Edit.insert(document.positionAt(text.length), '\n'));
      }
      if (edits.length) diagnostics.push(this.diagnosticWithFix(token.range, uri, edits));
    }
    const last = tokens[tokens.length - 1];
    if (last && !keyword(last, ';') && !(last.literal && !/['"`]$/.test(last.value))) {
      const end = last.range.end;
      const eof = document.positionAt(text.length);
      const atEof = document.offsetAt(end) === text.length;
      const edits = [Edit.insert(end, atEof ? ';\n' : ';')];
      if (!atEof && !text.endsWith('\n')) edits.push(Edit.insert(eof, '\n'));
      diagnostics.push(this.diagnosticWithFix({ start: end, end }, uri, edits));
    }
    return diagnostics;
  }
}
