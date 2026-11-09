import type { ServerSettings } from '../../../settings';
import {
  type CodeAction,
  CodeActionKind,
  type Diagnostic,
  DiagnosticSeverity,
  type TextDocumentIdentifier,
  TextEdit,
} from 'vscode-languageserver/node';
import { RegexReplaceRule } from '../base';
import { QueryScopeResolver } from '../../scope';
import { tokenizeSource } from '../source';
import { globalTokenCache } from '../../parser/tokenCache';
import { comparePositions } from '../../parser/queryBlocks';

/**
 * The LeftJoin rule
 * @class LeftJoin
 * @extends Rule
 * @memberof Linter.Rules
 */
export class LeftJoin extends RegexReplaceRule {
  readonly replacement = 'left join';
  readonly name: string = 'left_join';
  readonly code: string = 'CV08';
  readonly message: string = 'Use LEFT JOIN instead of RIGHT JOIN.';
  readonly relatedInformation: string =
    'It is recommended to avoid using RIGHT JOIN and instead use LEFT JOIN for consistency and readability, as it aligns with the natural left-to-right flow of reading SQL queries, making them easier to understand and maintain.';
  readonly pattern: RegExp = /right\s+join/gim;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Replace with `left join`';

  evaluate(text: string, uri: string | null = null): Diagnostic[] | null {
    if (!this.enabled) return null;
    const diagnostics = super.evaluate(text, uri) ?? [];
    const tokens = tokenizeSource(text);
    for (const scope of new QueryScopeResolver(tokens).scopes) {
      const stage = scope.pipe;
      if (stage?.kind !== 'source' || !['RIGHT JOIN', 'RIGHT OUTER JOIN'].includes(stage.operator)) continue;
      const first = tokens[stage.start + 2];
      if (diagnostics.some(({ range }) => comparePositions(range.start, first.range.start) === 0)) continue;
      const range = { start: first.range.start, end: tokens[stage.body - 1].range.end };
      const cache = uri === null ? undefined : globalTokenCache.get(uri);
      diagnostics.push(this.createDiagnostic(cache && !cache.isCodeRange(range) ? first.range : range, uri));
    }
    return diagnostics.length ? diagnostics : null;
  }

  createCodeAction(document: TextDocumentIdentifier, diagnostic: Diagnostic): CodeAction[] {
    const cache = globalTokenCache.get(document.uri);
    if (cache) {
      const tokens = tokenizeSource(cache.getText());
      const index = tokens.findIndex((token) => comparePositions(diagnostic.range.start, token.range.start) === 0);
      const stage = new QueryScopeResolver(tokens).scopeAt(index)?.pipe;
      // The pipe input cannot be swapped with the right relation by a keyword edit.
      if (stage?.kind === 'source' && stage.operator.startsWith('RIGHT')) return [];
    }
    return super.createCodeAction(document, diagnostic);
  }
}
