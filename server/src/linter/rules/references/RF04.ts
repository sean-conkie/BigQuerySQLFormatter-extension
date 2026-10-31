import type { Diagnostic } from 'vscode-languageserver/node';
import keywords from '../../keywords.json';
import type { DocumentCache } from '../../parser/tokenCache';
import { keywordIdentifierOptions, resolveOption } from '../../../ruleOptions';
import { SourceRule, type SourceToken } from '../source';
import { identifiers, ignoredIdentifier, matchesPolicy } from './identifiers';

const keywordNames = new Set([...keywords.reserved, ...keywords.nonReserved]);

export class Keywords extends SourceRule {
  readonly name = 'keywords';
  readonly code = 'RF04';
  readonly ruleGroup = 'references';
  readonly message = 'Keywords should not be used as identifiers.';
  readonly is_fix_compatible = false;
  protected readonly queryScoped = false;

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const options = this.settings.rules?.RF04?.options;
    const unquoted = resolveOption(
      keywordIdentifierOptions.unquoted_identifiers_policy,
      options?.unquoted_identifiers_policy,
    );
    const quoted = resolveOption(
      keywordIdentifierOptions.quoted_identifiers_policy,
      options?.quoted_identifiers_policy,
    );
    const ignored = resolveOption(keywordIdentifierOptions.ignore_words, options?.ignore_words);
    return identifiers(tokens, cache)
      .filter((identifier) => matchesPolicy(identifier, identifier.quoted ? quoted : unquoted))
      .filter(
        ({ name }) =>
          name.split('.').some((part) => keywordNames.has(part.toLowerCase()) && !ignoredIdentifier(part, ignored)) &&
          !ignoredIdentifier(name, ignored),
      )
      .map(({ token }) => this.createDiagnostic(token.range, uri));
  }
}
