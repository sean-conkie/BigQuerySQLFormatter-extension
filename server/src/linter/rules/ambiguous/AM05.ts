import { CodeActionKind, type Diagnostic, type TextDocumentIdentifier, TextEdit } from 'vscode-languageserver/node';
import { type DocumentCache, globalTokenCache } from '../../parser/tokenCache';
import { keyword, SourceRule, type SourceToken } from '../source';

export class ExplicitInnerJoin extends SourceRule {
  readonly name = 'join';
  readonly code = 'AM05';
  readonly message = 'Use INNER JOIN instead of an unqualified JOIN.';
  readonly ruleGroup = 'ambiguous';

  protected evaluateSource(tokens: SourceToken[], _cache: DocumentCache, uri: string): Diagnostic[] {
    const qualifiers = ['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'OUTER'];
    return tokens.flatMap((token, i) =>
      keyword(token, 'JOIN') && !qualifiers.some((qualifier) => keyword(tokens[i - 1], qualifier))
        ? [this.createDiagnostic(token.range, uri)]
        : [],
    );
  }

  createCodeAction(document: TextDocumentIdentifier, diagnostic: Diagnostic) {
    const join = globalTokenCache.get(document.uri)!.getText(diagnostic.range);
    const prefix = join === join.toLowerCase() ? 'inner ' : 'INNER ';
    return this.createFixActions(
      { changes: { [document.uri]: [TextEdit.insert(diagnostic.range.start, prefix)] } },
      diagnostic,
      [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll],
      'Qualify INNER JOIN',
    );
  }
}
