import { type Diagnostic, TextEdit } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { QueryScopeResolver } from '../../scope';
import keywords from '../../keywords.json';
import { consistencyOptions, resolveOption } from '../../../ruleOptions';
import { SourceFixRule, type SourceToken } from '../source';
import { columnReferences, referenceName } from './columns';

const reserved = new Set(keywords.reserved);

export class Consistent extends SourceFixRule {
  readonly name = 'consistent';
  readonly code = 'RF03';
  readonly ruleGroup = 'references';
  readonly message = 'Use consistent column qualification in a single-source query.';
  protected readonly fixTitle = 'Make column qualification consistent';
  protected readonly queryScoped = false;

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const policy = resolveOption(
      consistencyOptions.single_table_references,
      this.settings.rules?.RF03?.options?.single_table_references,
    );
    const resolver = new QueryScopeResolver(tokens);
    const references = columnReferences(tokens, cache, resolver);
    const diagnostics: Diagnostic[] = [];
    for (const scope of resolver.scopes) {
      if (scope.kind !== 'query' || scope.sources.length !== 1) continue;
      const source = scope.sources[0];
      if (!source.alias || source.kind === 'unnest') continue;
      const alias = source.alias;
      const prefix = /^[a-z_][a-z0-9_]*$/i.test(alias) && !reserved.has(alias.toLowerCase()) ? alias : `\`${alias}\``;
      let desired = policy === 'consistent' ? undefined : policy;
      for (const reference of references.filter((reference) => reference.scope === scope)) {
        const { parts, range, tokens: path, wildcard } = reference;
        if (wildcard) continue;
        const resolved = resolver.resolveSource(scope, parts[0]);
        if (resolved?.correlated || (parts.length === 1 && resolved)) continue;
        const qualified = parts.length > 1 && resolved?.source === source;
        // Removing the prefix would turn this column into the source's row value.
        if (qualified && referenceName(parts[1]) === referenceName(alias)) continue;
        const style = qualified ? 'qualified' : 'unqualified';
        desired ??= style;
        if (style === desired) continue;
        const edits = qualified
          ? [TextEdit.del(path[0].range), TextEdit.del(path[1].range)]
          : [TextEdit.insert(range.start, `${prefix}.`)];
        diagnostics.push(this.diagnosticWithFix(range, uri, edits));
      }
    }
    return diagnostics;
  }
}
