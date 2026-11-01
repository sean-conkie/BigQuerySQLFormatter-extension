import {
  type CancellationToken,
  type CompletionItem,
  CompletionItemKind,
  type CompletionList,
  type Hover,
  type Position,
  type Range,
} from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { SchemaEntry, SchemaField, SchemaRequest, SchemaResponse } from '../../../shared/schema';
import { awaitWithCancellation, checkCancellation } from '../cancellation';
import { QueryScopeResolver, type QueryScope, type QuerySource } from '../linter/scope';
import { keyword, schemaPositionAllowed, tokenizeSource } from '../linter/rules/source';
import { quoteIdentifierPath } from '../linter/quoting';
import { topLevel } from '../linter/parser/pipe';

export type SchemaProvider = (request: SchemaRequest, token: CancellationToken) => Promise<SchemaResponse>;
const normalize = (name: string) => name.replace(/^`|`$/g, '').toLowerCase();
const markdown = (text: string) => text.replace(/[\\`*_{}[\]<>()!|]/g, '\\$&');

function describeField(field: SchemaField): string {
  const nested = field.fields?.length
    ? `<${field.fields.map((child) => `${child.name} ${describeField(child)}`).join(', ')}>`
    : '';
  return `${field.type}${nested} (${field.mode})`;
}

function describe(entry: SchemaEntry | SchemaField): string {
  const lines = ['mode' in entry ? describeField(entry) : (entry.type ?? 'DATASET')];
  if (entry.description) lines.push(entry.description);
  if ('location' in entry && entry.location) lines.push(`Location: ${entry.location}`);
  if ('numRows' in entry && entry.numRows !== undefined) lines.push(`Rows: ${entry.numRows}`);
  if ('numBytes' in entry && entry.numBytes !== undefined) lines.push(`Size: ${entry.numBytes} bytes`);
  if ('partitioning' in entry && entry.partitioning) lines.push(`Partitioning: ${entry.partitioning}`);
  if ('clustering' in entry && entry.clustering?.length) lines.push(`Clustering: ${entry.clustering.join(', ')}`);
  if ('lastModifiedTime' in entry && entry.lastModifiedTime) {
    const time = Number(entry.lastModifiedTime);
    lines.push(
      `Last modified: ${
        Number.isFinite(time) && Math.abs(time) <= 8640000000000000
          ? new Date(time).toISOString()
          : entry.lastModifiedTime
      }`,
    );
  }
  return lines.map(markdown).join('\n\n');
}

interface PathContext {
  parts: string[];
  prefix: string;
  range: Range;
  start: number;
  index: number;
  scope?: QueryScope;
  relation: boolean;
  allowDash: boolean;
}

interface ResolvedField extends SchemaField {
  qualifier?: string;
}

export class SchemaBuilder {
  private readonly text: string;
  private readonly resolver: QueryScopeResolver;
  private pending = false;
  private unavailable = false;
  private config: SchemaResponse = { entries: [] };

  constructor(
    private readonly document: TextDocument,
    private readonly provider: SchemaProvider,
  ) {
    this.text = document.getText();
    this.resolver = new QueryScopeResolver(tokenizeSource(this.text), true);
  }

  private context(position: Position): PathContext | undefined {
    const offset = this.document.offsetAt(position);
    if (!schemaPositionAllowed(this.text, offset)) return undefined;
    const before = this.text.slice(0, offset);
    const match = before.match(/`[^`\r\n]*$|[\w$-]+(?:\.[\w$-]*)*\.?$/);
    const raw = match?.[0] ?? '';
    const start = offset - raw.length;
    const end = offset + (this.text.slice(offset).match(/^[\w$-]*`?/)?.[0].length ?? 0);
    const parts = raw.replace(/^`/, '').split('.');
    const prefix = parts.pop() ?? '';
    const tokens = this.resolver.tokens;
    let index = tokens.findIndex((token) => this.document.offsetAt(token.range.end) > start);
    if (index < 0) index = tokens.length;
    const scope = this.resolver.scopeAt(Math.min(index, tokens.length - 1));
    const previous = tokens[index - 1];
    const introducer = previous && /^(FROM|JOIN|INTO|UPDATE|MERGE|USING)$/i.test(previous.value) && !previous.literal;
    const source = scope?.sources.find(
      (source) =>
        start >= this.document.offsetAt(source.range.start) &&
        start <= this.document.offsetAt(source.range.end) &&
        (!source.aliasToken || start < this.document.offsetAt(source.aliasToken.range.start)),
    );
    const lastClause = scope
      ? topLevel(tokens, scope.start, index)
          .map((index) => tokens[index])
          .filter(
            (token) =>
              !token.literal &&
              /^(FROM|JOIN|WHERE|ON|USING|GROUP|ORDER|HAVING|QUALIFY|SELECT|SET|VALUES|LIMIT|RETURNING)$/i.test(
                token.value,
              ),
          )
          .at(-1)
      : undefined;
    const relation = Boolean(
      introducer || source || (keyword(previous, ',') && (keyword(lastClause, 'FROM') || keyword(lastClause, 'JOIN'))),
    );
    return {
      parts,
      prefix,
      start,
      index,
      scope,
      relation,
      allowDash: relation && !['INTO', 'UPDATE', 'MERGE'].some((word) => keyword(previous, word)),
      range: { start: this.document.positionAt(start), end: this.document.positionAt(end) },
    };
  }

  private async request(request: Omit<SchemaRequest, 'resource'>, token: CancellationToken): Promise<SchemaResponse> {
    checkCancellation(token);
    const result = await awaitWithCancellation(
      this.provider({ ...request, resource: this.document.uri }, token),
      token,
    );
    checkCancellation(token);
    this.pending ||= result.pending === true;
    this.unavailable ||= result.unavailable === true;
    return result;
  }

  private item(entry: SchemaEntry | SchemaField, kind: CompletionItemKind, context: PathContext): CompletionItem {
    const path = [...context.parts, entry.name];
    return {
      label: entry.name,
      kind,
      detail:
        'mode' in entry
          ? describeField(entry)
          : [entry.type ?? (kind === CompletionItemKind.Module ? 'DATASET' : 'TABLE'), entry.location]
              .filter(Boolean)
              .join(' - '),
      documentation: { kind: 'markdown', value: describe(entry) },
      insertText: quoteIdentifierPath(path, context.allowDash),
      textEdit: { range: context.range, newText: quoteIdentifierPath(path, context.allowDash) },
    };
  }

  private visibleSources(scope: QueryScope): QuerySource[] {
    const sources = new Map<string, QuerySource>();
    for (
      let current: QueryScope | undefined = scope;
      current;
      current = current.cteBody ? current.parent?.parent : current.parent
    ) {
      for (const source of current.sources) {
        const name = normalize(source.alias ?? source.path.join('.'));
        if (!sources.has(name)) sources.set(name, source);
      }
    }
    return [...sources.values()];
  }

  private staticFields(source: QuerySource): SchemaField[] {
    const start = source.kind === 'cte' ? source.cte?.open : source.kind === 'subquery' ? source.start : undefined;
    const scope = start === undefined ? undefined : this.resolver.scopes.find((scope) => scope.start === start + 1);
    return (scope?.selectAliases ?? []).map((token) => ({
      name: token.value.replace(/^`|`$/g, ''),
      type: 'Output column',
      mode: 'UNKNOWN',
    }));
  }

  private async sourceFields(source: QuerySource, token: CancellationToken): Promise<SchemaField[]> {
    if (source.kind === 'cte' || source.kind === 'subquery') return this.staticFields(source);
    if (source.kind === 'pipe') {
      const scope = this.resolver.scopes.find((scope) => scope.pipe?.start === source.start);
      if (scope?.pipe?.kind === 'alias') {
        const known = (scope.visibleAliases ?? []).map((token) => ({
          name: token.value.replace(/^`|`$/g, ''),
          type: 'Output column',
          mode: 'UNKNOWN',
        }));
        return known.length
          ? known
          : (await Promise.all(scope.sources.map((source) => this.sourceFields(source, token)))).flat();
      }
      return (scope?.selectAliases ?? []).map((token) => ({
        name: token.value.replace(/^`|`$/g, ''),
        type: 'Output column',
        mode: 'UNKNOWN',
      }));
    }
    if (source.kind !== 'table' && source.kind !== 'dml-target') return [];
    const [table, dataset, project] = source.path.slice().reverse();
    if (!table) return [];
    const response = await this.request({ project, dataset, table }, token);
    return response.entries[0]?.fields ?? [];
  }

  private async columns(context: PathContext, token: CancellationToken): Promise<ResolvedField[]> {
    if (!context.scope) return [];
    let sources = this.visibleSources(context.scope);
    let parts = context.parts;
    if (parts.length) {
      const resolved = this.resolver.resolveSource(context.scope, parts[0]);
      if (resolved) {
        sources = [resolved.source];
        parts = parts.slice(1);
      }
    }
    const lists = await Promise.all(sources.map((source) => this.sourceFields(source, token)));
    let fields: ResolvedField[] = lists.flatMap((fields, index) =>
      fields.map((field) => ({ ...field, qualifier: sources[index].alias })),
    );
    for (const part of parts) {
      fields = fields
        .filter((field) => normalize(field.name) === normalize(part))
        .flatMap((field) => (field.fields ?? []).map((child) => ({ ...child, qualifier: field.qualifier })));
    }
    if (!context.parts.length) {
      const aliases =
        context.scope.visibleAliases ??
        (context.scope.clauses.some((clause) => context.index >= clause.start && context.index < clause.end)
          ? context.scope.selectAliases
          : []);
      fields.push(
        ...aliases.map((token) => ({
          name: token.value.replace(/^`|`$/g, ''),
          type: 'Output column',
          mode: 'UNKNOWN',
        })),
      );
    }
    return fields;
  }

  async completions(position: Position, token: CancellationToken): Promise<CompletionList | undefined> {
    checkCancellation(token);
    const context = this.context(position);
    if (!context) return undefined;
    this.config = await this.request({ contextOnly: true }, token);
    if (this.config.unavailable) return undefined;
    let items: CompletionItem[];
    if (context.relation) {
      if (context.parts.length === 0) {
        const datasets = await this.request({}, token);
        items = datasets.entries.map((entry) => this.item(entry, CompletionItemKind.Module, context));
        const projects = new Set(
          this.resolver.scopes
            .flatMap((scope) => scope.sources)
            .filter((source) => source.path.length === 3 && ['table', 'dml-target'].includes(source.kind))
            .map((source) => source.path[0])
            .filter((project) => project !== this.config.projectId),
        );
        for (const project of projects) {
          const extra = await this.request({ project }, token);
          items.push(
            ...extra.entries.map((entry) =>
              this.item(entry, CompletionItemKind.Module, { ...context, parts: [project] }),
            ),
          );
        }
        if (datasets.defaultDataset && !datasets.unavailable) {
          const tables = await this.request({ dataset: datasets.defaultDataset }, token);
          items.push(...tables.entries.map((entry) => this.item(entry, CompletionItemKind.Class, context)));
        }
        if (context.scope)
          items.push(
            ...this.resolver
              .visibleCtes(context.scope, context.index)
              .map((cte) => this.item({ name: cte.name, type: 'CTE' }, CompletionItemKind.Class, context)),
          );
      } else if (context.parts.length === 1) {
        const isProject =
          context.parts[0] === this.config.projectId ||
          this.resolver.scopes.some((scope) =>
            scope.sources.some((source) => source.path.length === 3 && source.path[0] === context.parts[0]),
          );
        const defaults = isProject ? this.config : await this.request({}, token);
        if (
          defaults.entries.some((entry) => entry.name === context.parts[0]) ||
          defaults.defaultDataset === context.parts[0]
        ) {
          const tables = await this.request({ dataset: context.parts[0] }, token);
          items = tables.entries.map((entry) => this.item(entry, CompletionItemKind.Class, context));
        } else if (!isProject && (defaults.pending || defaults.unavailable)) {
          items = [];
        } else {
          const datasets = await this.request({ project: context.parts[0] }, token);
          items = datasets.entries.map((entry) => this.item(entry, CompletionItemKind.Module, context));
        }
      } else {
        const tables = await this.request({ project: context.parts[0], dataset: context.parts[1] }, token);
        items = tables.entries.map((entry) => this.item(entry, CompletionItemKind.Class, context));
      }
    } else {
      const columns = await this.columns(context, token);
      const counts = new Map<string, number>();
      for (const field of columns) counts.set(normalize(field.name), (counts.get(normalize(field.name)) ?? 0) + 1);
      const qualified =
        context.parts.length > 0 &&
        context.scope &&
        this.resolver.resolveSource(context.scope, context.parts[0]) !== undefined;
      items = columns.map((entry) => {
        const ambiguous = !qualified && (counts.get(normalize(entry.name)) ?? 0) > 1;
        const item = this.item(
          entry,
          CompletionItemKind.Field,
          ambiguous && entry.qualifier ? { ...context, parts: [entry.qualifier, ...context.parts] } : context,
        );
        if (ambiguous && entry.qualifier) item.detail += ` - ${entry.qualifier}`;
        return item;
      });
    }
    checkCancellation(token);
    if (this.unavailable) return undefined;
    const unique = new Map<string, CompletionItem>();
    for (const item of items) {
      if (item.label.toLowerCase().startsWith(context.prefix.toLowerCase()))
        unique.set(item.insertText?.toString() ?? item.label, item);
    }
    return unique.size || this.pending ? { isIncomplete: this.pending, items: [...unique.values()] } : undefined;
  }

  async hover(position: Position, token: CancellationToken): Promise<Hover | null> {
    checkCancellation(token);
    const offset = this.document.offsetAt(position);
    if (!schemaPositionAllowed(this.text, offset)) return null;
    const lexical = this.resolver.tokens.find(
      (token) =>
        offset >= this.document.offsetAt(token.range.start) && offset < this.document.offsetAt(token.range.end),
    );
    if (!lexical) return null;
    const atEnd = this.document.positionAt(
      this.document.offsetAt(lexical.range.end) -
        (lexical.value.startsWith('`') && lexical.value.endsWith('`') ? 1 : 0),
    );
    const context = this.context(atEnd);
    if (!context) return null;
    this.config = await this.request({ contextOnly: true }, token);
    if (this.config.unavailable) return null;
    const name = context.prefix;
    let entry: SchemaEntry | SchemaField | undefined;
    const source = this.resolver.scopes
      .flatMap((scope) => scope.sources)
      .find(
        (source) =>
          offset >= this.document.offsetAt(source.range.start) &&
          offset < this.document.offsetAt(source.range.end) &&
          (!source.aliasToken || offset < this.document.offsetAt(source.aliasToken.range.start)),
      );
    if (source && (source.kind === 'table' || source.kind === 'dml-target')) {
      const [table, dataset, project] = source.path.slice().reverse();
      const tableStart = this.document.offsetAt(this.resolver.tokens[source.start].range.start);
      const tableText = this.text.slice(tableStart, this.document.offsetAt(source.range.end)).replace(/^`/, '');
      const datasetStart = dataset
        ? tableStart + tableText.indexOf(dataset) + (this.resolver.tokens[source.start].value.startsWith('`') ? 1 : 0)
        : -1;
      if (dataset && offset >= datasetStart && offset < datasetStart + dataset.length) {
        entry = (await this.request({ project }, token)).entries.find((entry) => entry.name === dataset);
      } else {
        entry = (await this.request({ project, dataset, table }, token)).entries[0];
      }
    } else {
      const matches = (await this.columns(context, token)).filter((field) => normalize(field.name) === normalize(name));
      if (matches.length === 1) entry = matches[0];
    }
    return entry && !this.unavailable
      ? {
          contents: { kind: 'markdown', value: `**${markdown(entry.name)}**\n\n${describe(entry)}` },
          range: context.range,
        }
      : null;
  }
}
