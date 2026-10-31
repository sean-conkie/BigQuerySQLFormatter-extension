import type { Diagnostic, Range } from 'vscode-languageserver/node';
import type { FileMap } from '../../parser';
import { comparePositions, queryBlocks, queryRange } from '../../parser/queryBlocks';
import { pipeItems, topLevel, type PipeItem } from '../../parser/pipe';
import { globalTokenCache } from '../../parser/tokenCache';
import { QueryScopeResolver } from '../../scope';
import type { ParserRule } from '../base';
import { columnReferences, referenceName } from '../references/columns';
import { keyword, type SourceToken } from '../source';
import { TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function implicitAliasEdit(uri: string, range: Range): TextEdit {
  const text = globalTokenCache.get(uri)!.getText();
  const document = TextDocument.create(uri, 'googlesql', 0, text);
  let start = document.offsetAt(range.start);
  let end = document.offsetAt(range.end);
  if (/[ \t]/.test(text[start - 1] ?? '')) start--;
  else if (/[ \t]/.test(text[end] ?? '')) end++;
  return TextEdit.del({ start: document.positionAt(start), end: document.positionAt(end) });
}

const rangeOf = (tokens: SourceToken[]): Range => ({
  start: tokens[0].range.start,
  end: tokens[tokens.length - 1].range.end,
});
const simplePath = (tokens: SourceToken[]) =>
  tokens.length % 2 === 1 &&
  tokens.every((token, i) =>
    i % 2
      ? keyword(token, '.')
      : token.value.startsWith('`') || (!token.literal && /^[a-z_][\w$]*$/i.test(token.value)),
  );

// Traditional rules keep their historical AST behaviour. Extended blocks use
// stage-local sources and output lists, rather than TextMate's SELECT-only scopes.
export function pipeAliasingDiagnostics(rule: ParserRule, ast: FileMap, uri: string | null): Diagnostic[] {
  if (uri === null) return [];
  const cache = globalTokenCache.get(uri)!;
  const ranges: Range[] = [];
  for (const block of queryBlocks(ast, true)) {
    if (!block.hasExtendedQuerySyntax || block.hasUnsupportedQuerySyntax) continue;
    const tokens = block.sourceTokens;
    const resolver = new QueryScopeResolver(tokens);
    const children = block.queryBlocks.map(queryRange);
    const local = (range: Range) =>
      !children.some(
        (child) => comparePositions(range.start, child.start) >= 0 && comparePositions(range.end, child.end) <= 0,
      );
    const sources = [
      ...new Map(
        resolver.scopes
          .flatMap((scope) => [
            ...scope.sources,
            ...(scope.pipe?.kind === 'source' && scope.pipe.relation ? [scope.pipe.relation] : []),
          ])
          .filter((source) => source.kind !== 'pipe' && local(source.range))
          .map((source) => [source.start, source]),
      ).values(),
    ];
    if (rule.code === 'AL01') {
      for (const source of sources) {
        if (source.explicitAlias && source.aliasToken) {
          const as = tokens[source.end - 2];
          if (keyword(as, 'AS')) ranges.push(as.range);
        }
      }
      // |> AS names the entire row: AS is mandatory, so AL01 is not applicable.
    } else if (rule.code === 'AL06') {
      ranges.push(...sources.filter((source) => !source.aliasToken).map((source) => source.range));
    } else if (rule.code === 'AL04') {
      for (const scope of resolver.scopes) {
        const aliases = new Map<string, Range[]>();
        for (const source of scope.sources) {
          if (!source.alias || !local(source.range)) continue;
          const key = referenceName(source.alias);
          aliases.set(key, [...(aliases.get(key) ?? []), source.aliasToken?.range ?? source.range]);
        }
        for (const entries of aliases.values()) if (entries.length > 1) ranges.push(...entries);
      }
    } else if (rule.code === 'AL05') {
      ranges.push(
        ...columnReferences(tokens, cache, resolver)
          .filter(
            (reference) =>
              reference.parts.length === 1 &&
              !reference.wildcard &&
              reference.scope.sources.some((source) => source.aliasToken) &&
              !reference.scope.usingColumns.some(
                (token) => referenceName(token.value) === referenceName(reference.parts[0]),
              ) &&
              local(reference.range),
          )
          .map((reference) => reference.range),
      );
    } else {
      for (const scope of resolver.scopes) {
        const stage = scope.pipe;
        let items: PipeItem[];
        if (stage?.kind === 'projection') items = [...stage.groupBy, ...stage.items];
        else if (!stage && keyword(tokens[scope.start], 'SELECT')) {
          const end = topLevel(tokens, scope.start + 1, scope.end).find((i) => keyword(tokens[i], 'FROM')) ?? scope.end;
          items = pipeItems(tokens, scope.start + 1, end);
        } else continue;
        items = items.filter((item) => local(rangeOf(item.tokens)));
        if (rule.code === 'AL08') {
          const names = new Map<string, Range[]>();
          if (stage?.kind === 'projection' && stage.operator === 'EXTEND') {
            for (const token of scope.visibleAliases ?? []) {
              const key = referenceName(token.value);
              names.set(key, [...(names.get(key) ?? []), token.range]);
            }
          }
          for (const item of items) {
            const name = item.alias ?? (simplePath(item.expression) ? item.expression.at(-1) : undefined);
            if (!name) continue; // Anonymous expressions and wildcards have no known output name.
            const key = referenceName(name.value);
            names.set(key, [...(names.get(key) ?? []), rangeOf(item.tokens)]);
          }
          for (const entries of names.values()) if (entries.length > 1) ranges.push(...entries);
        } else {
          for (const item of items) {
            if (rule.code === 'AL02' && item.as) ranges.push(item.as.range);
            if (
              rule.code === 'AL09' &&
              item.alias &&
              simplePath(item.expression) &&
              referenceName(item.alias.value) === referenceName(item.expression.at(-1)!.value)
            ) {
              ranges.push({ start: item.expression.at(-1)!.range.end, end: item.alias.range.end });
            }
          }
        }
      }
      // No output expression list means AL02/AL08/AL09 are not applicable.
    }
  }
  return [...new Map(ranges.map((range) => [rule.createCacheKey(range), range])).values()].map((range) =>
    rule.createDiagnostic(range, uri),
  );
}
