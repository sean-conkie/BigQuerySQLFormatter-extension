import { CodeActionKind, type Diagnostic, type TextDocumentIdentifier, TextEdit } from 'vscode-languageserver/node';
import { Rule } from '../base';
import { globalTokenCache } from '../../parser/tokenCache';
import { capitalisationOptions, resolveOption } from '../../../ruleOptions';
import type { RuleCode } from '../../../settings';

export abstract class CapitalisationRule extends Rule<string> {
  readonly ruleGroup = 'capitalisation';
  abstract readonly scopes: readonly string[];
  readonly codeActionKind = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  private readonly casing = new Map<string, 'lower' | 'upper'>();

  evaluate(_text: string, uri: string | null = null): Diagnostic[] | null {
    if (!this.enabled || uri === null) return null;
    const cache = globalTokenCache.get(uri);
    if (!cache) return null;
    const policy = resolveOption(
      capitalisationOptions.capitalisation_policy,
      this.settings.rules?.[this.code as RuleCode]?.options?.capitalisation_policy,
    );
    let casing = policy === 'consistent' ? undefined : policy;
    const diagnostics: Diagnostic[] = [];
    for (const [line, entry] of cache.entries()) {
      for (const token of entry.tokens) {
        if (
          !token.scopes.some((scope) =>
            this.scopes.some((target) => scope === target || scope.startsWith(`${target}.`)),
          ) ||
          !/[a-z]/i.test(token.value)
        )
          continue;
        const range = {
          start: { line, character: token.startIndex },
          end: { line, character: token.endIndex },
        };
        if (!cache.isCodeRange(range)) continue;
        // Mixed-case first tokens have no uniform casing; use the default policy.
        casing ??= token.value === token.value.toUpperCase() ? 'upper' : 'lower';
        const expected = casing === 'upper' ? token.value.toUpperCase() : token.value.toLowerCase();
        if (token.value !== expected) diagnostics.push(this.createDiagnostic(range, uri));
      }
    }
    this.casing.set(uri, casing ?? 'lower');
    return diagnostics.length ? diagnostics : null;
  }

  createCodeAction(document: TextDocumentIdentifier, diagnostic: Diagnostic) {
    const cache = globalTokenCache.get(document.uri);
    const casing = this.casing.get(document.uri);
    if (!cache || !casing) return [];
    const value = cache.getText(diagnostic.range);
    return this.createFixActions(
      {
        changes: {
          [document.uri]: [
            TextEdit.replace(diagnostic.range, casing === 'upper' ? value.toUpperCase() : value.toLowerCase()),
          ],
        },
      },
      diagnostic,
      this.codeActionKind,
      `Convert to ${casing}case`,
    );
  }

  closeDocument(uri: string): void {
    this.casing.delete(uri);
  }
}
