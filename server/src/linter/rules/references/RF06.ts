import { type Diagnostic, TextEdit } from 'vscode-languageserver/node';
import keywords from '../../keywords.json';
import type { DocumentCache } from '../../parser/tokenCache';
import { quotingOptions, resolveOption } from '../../../ruleOptions';
import { SourceFixRule, type SourceToken } from '../source';
import { identifiers, ignoredIdentifier } from './identifiers';

const reserved = new Set(keywords.reserved);
const unquoted = /^[a-z_][a-z0-9_]*$/i;
const dashed = /^[a-z_][a-z0-9_]*(?:-(?:[a-z_][a-z0-9_]*|[0-9]+))*$/i;

export class Quoting extends SourceFixRule {
  readonly name = 'quoting';
  readonly code = 'RF06';
  readonly ruleGroup = 'references';
  readonly message = 'Unnecessary backticks around identifier.';
  protected readonly fixTitle = 'Remove unnecessary backticks';
  protected readonly queryScoped = false;

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const options = this.settings.rules?.RF06?.options;
    const tables = resolveOption(quotingOptions.check_table_paths, options?.check_table_paths);
    const ignored = resolveOption(quotingOptions.ignore_words, options?.ignore_words);
    return identifiers(tokens, cache)
      .filter(({ quoted, role }) => quoted && (role !== 'table' || tables))
      .filter((identifier) => {
        const { name, role, first } = identifier;
        if (ignoredIdentifier(name, ignored)) return false;
        const parts = role === 'table' ? name.split('.') : [name];
        return parts.every(
          (part, index) =>
            !ignoredIdentifier(part, ignored) &&
            (unquoted.test(part) ||
              (role === 'table' && first && index === 0 && identifier.dashed && dashed.test(part))) &&
            (!(first && index === 0) || !reserved.has(part.toLowerCase())),
        );
      })
      .map(({ token, name }) => this.diagnosticWithFix(token.range, uri, [TextEdit.replace(token.range, name)]));
  }
}
