import { type Diagnostic, TextEdit } from 'vscode-languageserver/node';
import { canUnquoteIdentifier } from '../../quoting';
import type { DocumentCache } from '../../parser/tokenCache';
import { quotingOptions, resolveOption } from '../../../ruleOptions';
import { SourceFixRule, type SourceToken } from '../source';
import { identifiers, ignoredIdentifier } from './identifiers';

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
            canUnquoteIdentifier(
              part,
              first && index === 0,
              role === 'table' && first && index === 0 && identifier.dashed,
            ),
        );
      })
      .map(({ token, name }) => this.diagnosticWithFix(token.range, uri, [TextEdit.replace(token.range, name)]));
  }
}
