import { TextEdit, type Diagnostic } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { SourceFixRule, type SourceToken } from '../source';
import { pipeLayouts } from './pipe';

export class PipeStages extends SourceFixRule {
  readonly name = 'pipe_stages';
  readonly code = 'LT91';
  readonly ruleGroup = 'layout';
  readonly message = 'Start each pipe stage on its own line, aligned with its input.';
  protected readonly fixTitle = 'Align pipe stage';

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    for (const { input, stages } of pipeLayouts(tokens)) {
      const offset = input.range.start.character;
      const indent = ' '.repeat(offset);
      for (const stage of stages) {
        const pipe = tokens[stage.start];
        const { line, character } = pipe.range.start;
        const gap = { start: tokens[stage.start - 1].range.end, end: pipe.range.start };
        const whitespace = cache.getText(gap);
        const comment = whitespace.search(/--|#|\/\*/);
        const inlineBlock =
          comment >= 0 && whitespace.slice(comment).startsWith('/*') && !whitespace.slice(0, comment).includes('\n');
        if (!inlineBlock && character === offset && /^[ \t]*$/.test(cache.get(line)!.value.slice(0, character)))
          continue;
        let replacement = `\n${indent}`;
        if (comment >= 0) {
          const prefix = whitespace.slice(0, comment);
          // Trailing line comments must remain on their line; inline block comments
          // move with the following stage rather than becoming input comments.
          const leading = prefix.includes('\n') || !whitespace.slice(comment).startsWith('/*') ? prefix : `\n${indent}`;
          replacement = `${leading}${whitespace.slice(comment).trimEnd()}\n${indent}`;
        }
        diagnostics.push(
          this.diagnosticWithFix({ start: pipe.range.start, end: tokens[stage.start + 1].range.end }, uri, [
            TextEdit.replace(gap, replacement.replaceAll('\n', cache.eol)),
          ]),
        );
      }
    }
    return diagnostics;
  }
}
