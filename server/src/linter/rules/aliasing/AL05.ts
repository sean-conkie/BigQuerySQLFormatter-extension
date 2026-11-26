import { type Diagnostic, TextEdit } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { QueryScopeResolver } from '../../scope';
import { SourceFixRule, type SourceToken } from '../source';
import { aliasPrefix, columnReferences, referenceName } from '../references/columns';
import { consistencyOptions, resolveOption } from '../../../ruleOptions';

export class UnusedAlias extends SourceFixRule {
  readonly name = 'unused_alias';
  readonly code = 'AL05';
  readonly message = 'Columns must use table alias.';
  readonly relatedInformation = 'All columns should be referenced using the table alias when an alias is defined.';
  readonly ruleGroup = 'aliasing';
  protected readonly fixTitle = 'Qualify column with its table alias';
  protected readonly queryScoped = false;

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const resolver = new QueryScopeResolver(tokens);
    const unqualified =
      resolveOption(
        consistencyOptions.single_table_references,
        this.settings.rules?.RF03?.options?.single_table_references,
      ) === 'unqualified';
    const diagnostics: Diagnostic[] = [];
    for (const reference of columnReferences(tokens, cache, resolver)) {
      const { scope, parts, range, wildcard } = reference;
      if (scope.special || wildcard || !scope.sources.some((source) => source.aliasToken)) continue;
      if (scope.usingColumns.some((column) => referenceName(column.value) === referenceName(parts[0]))) continue;
      if (resolver.resolveSource(scope, parts[0])) continue;
      // A STRUCT field path is unqualified too, but its field names must not change.
      const source = scope.sources[0];
      if (scope.sources.length !== 1 || !source.aliasToken || source.kind === 'unnest' || unqualified) {
        diagnostics.push(this.createDiagnostic(range, uri));
        continue;
      }
      diagnostics.push(
        this.diagnosticWithFix(range, uri, [TextEdit.insert(range.start, `${aliasPrefix(source.alias!)}.`)]),
      );
    }
    return diagnostics;
  }
}
