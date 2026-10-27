import type { Diagnostic } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { isIdentifier } from '../../scope';
import { resolveOption, specialCharacterOptions } from '../../../ruleOptions';
import { keyword, SourceRule, type SourceToken } from '../source';
import { identifiers, ignoredIdentifier, matchesPolicy } from './identifiers';

export class SpecialCharacters extends SourceRule {
  readonly name = 'special_chars';
  readonly code = 'RF05';
  readonly ruleGroup = 'references';
  readonly message = 'Identifiers should contain only letters, digits and underscores.';
  readonly is_fix_compatible = false;
  protected readonly queryScoped = false;

  protected evaluateSource(tokens: SourceToken[], cache: DocumentCache, uri: string): Diagnostic[] {
    const options = this.settings.rules?.RF05?.options;
    const policy = resolveOption(specialCharacterOptions.quoted_identifiers_policy, options?.quoted_identifiers_policy);
    const spaces = resolveOption(specialCharacterOptions.allow_space_in_identifier, options?.allow_space_in_identifier);
    const allowed = new Set<string>(
      resolveOption(
        specialCharacterOptions.additional_allowed_characters,
        options?.additional_allowed_characters,
      ).flatMap((value) => [...value]),
    );
    const ignored = resolveOption(specialCharacterOptions.ignore_words, options?.ignore_words);
    const positions = new Map(tokens.map((token, index) => [token, index]));
    return identifiers(tokens, cache)
      .filter((identifier) => identifier.quoted && matchesPolicy(identifier, policy))
      .filter((identifier) => {
        if (ignoredIdentifier(identifier.name, ignored)) return false;
        const parts = identifier.name.split('.');
        const index = positions.get(identifier.token)!;
        const following: string[] = [];
        for (let cursor = index + 1; keyword(tokens[cursor], '.') && isIdentifier(tokens[cursor + 1]); cursor += 2) {
          following.push(...tokens[cursor + 1].value.replace(/^`|`$/g, '').split('.'));
        }
        return parts.some((part, partIndex) => {
          if (ignoredIdentifier(part, ignored)) return false;
          const project =
            identifier.role === 'table' && identifier.first && partIndex === 0 && parts.length + following.length >= 3;
          const region =
            identifier.role === 'table' &&
            /^region-[a-z0-9-]+$/i.test(part) &&
            (parts[partIndex + 1] ?? following[0])?.toUpperCase() === 'INFORMATION_SCHEMA';
          return [...part].some(
            (character) =>
              !/[a-z0-9_]/i.test(character) &&
              !(character === '-' && (project || region)) &&
              !(character === ' ' && spaces) &&
              !allowed.has(character),
          );
        });
      })
      .map(({ token }) => this.createDiagnostic(token.range, uri));
  }
}
