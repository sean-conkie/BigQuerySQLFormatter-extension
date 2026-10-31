import { DiagnosticTag, type Diagnostic } from 'vscode-languageserver/node';
import { QueryScopeResolver } from '../../scope';
import type { DocumentCache } from '../../parser/tokenCache';
import { SourceRule, type SourceToken } from '../source';

export class UnusedCte extends SourceRule {
  protected readonly queryScoped = false;
  readonly is_fix_compatible = false;
  readonly name = 'unused_cte';
  readonly code = 'ST03';
  readonly ruleGroup = 'structure';
  readonly message = 'CTE is defined but never used.';
  readonly diagnosticTags = [DiagnosticTag.Unnecessary];

  protected evaluateSource(tokens: SourceToken[], _cache: DocumentCache, uri: string): Diagnostic[] {
    return new QueryScopeResolver(tokens)
      .unusedCtes()
      .map((cte) => this.createDiagnostic(tokens[cte.start].range, uri));
  }
}
