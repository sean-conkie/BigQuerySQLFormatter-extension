import type { Diagnostic } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { QueryScopeResolver } from '../../scope';
import { qualificationOptions, resolveOption } from '../../../ruleOptions';
import { SourceRule, type SourceToken } from '../source';
import { columnReferences, referenceName } from './columns';
import { ignoredIdentifier } from './identifiers';

export class Qualification extends SourceRule {
  readonly name = 'qualification';
  readonly code = 'RF02';
  readonly ruleGroup = 'references';
  readonly message = 'Column references should be source-qualified when more than one source is visible.';
  readonly is_fix_compatible = false;
  protected readonly queryScoped = false;

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const options = this.settings.rules?.RF02?.options;
    const ignored = resolveOption(qualificationOptions.ignore_words, options?.ignore_words);
    const ignoreExternal = resolveOption(
      qualificationOptions.subqueries_ignore_external_references,
      options?.subqueries_ignore_external_references,
    );
    const resolver = new QueryScopeResolver(tokens);
    const references = columnReferences(tokens, cache, resolver);
    const diagnostics: Diagnostic[] = [];
    for (const scope of resolver.scopes.filter((scope) => scope.kind === 'query')) {
      const local = references.filter((reference) => reference.scope === scope);
      const sources = new Set(scope.sources);
      if (!ignoreExternal) {
        for (const { parts } of local) {
          const resolved = resolver.resolveSource(scope, parts[0]);
          if (resolved?.correlated) sources.add(resolved.source);
        }
      }
      if (sources.size < 2) continue;
      for (const { parts, range } of local) {
        if (ignoredIdentifier(parts[0], ignored)) continue;
        if (scope.usingColumns.some((token) => referenceName(token.value) === referenceName(parts[0]))) continue;
        const resolved = resolver.resolveSource(scope, parts[0]);
        if (parts.length > 1 && resolved) continue;
        if (
          resolved &&
          (resolved.source.kind === 'unnest' ||
            referenceName(resolved.source.offsetAlias ?? '') === referenceName(parts[0]))
        )
          continue;
        diagnostics.push(this.createDiagnostic(range, uri));
      }
    }
    return diagnostics;
  }
}
