import type { Diagnostic } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { QueryScopeResolver } from '../../scope';
import { SourceRule, type SourceToken } from '../source';
import { columnReferences } from './columns';

export class From extends SourceRule {
  readonly name = 'from';
  readonly code = 'RF01';
  readonly ruleGroup = 'references';
  readonly message = 'Reference qualifier is not a visible source.';
  readonly defaultEnabled = false;
  readonly is_fix_compatible = false;
  protected readonly queryScoped = false;

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const resolver = new QueryScopeResolver(tokens);
    return columnReferences(tokens, cache, resolver)
      .filter(({ scope, parts }) => parts.length > 1 && !resolver.resolveSource(scope, parts[0]))
      .map(({ range }) => this.createDiagnostic(range, uri));
  }
}
