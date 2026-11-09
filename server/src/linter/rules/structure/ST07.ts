import type { ServerSettings } from '../../../settings';
import { type Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { RegexRule } from '../base';
import { QueryScopeResolver } from '../../scope';
import { keyword, tokenizeSource } from '../source';

/**
 * The Using rule
 * @class Using
 * @extends Rule
 * @memberof Linter.Rules
 */
export class Using extends RegexRule {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = 'using';
  readonly code: string = 'ST07';
  readonly message: string = 'Specify join keys instead of using USING.';
  readonly relatedInformation: string = 'Specify the keys directly.';
  readonly pattern: RegExp =
    /join(?:\s+`?(?:[\w_]+\.)?(?:[\w_]+\.[\w_]+)`?(?:\s+(?:as\s+)?[\w_]+)?)\s+(?<target>using)/gim;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'structure';

  evaluate(text: string, uri: string | null = null): Diagnostic[] | null {
    if (!this.enabled) return null;
    const diagnostics = super.evaluate(text, uri) ?? [];
    const tokens = tokenizeSource(text);
    for (const scope of new QueryScopeResolver(tokens).scopes) {
      const stage = scope.pipe;
      if (stage?.kind !== 'source' || !stage.operator.endsWith('JOIN')) continue;
      const using = stage.relation && tokens[stage.relation.end];
      if (
        using &&
        keyword(using, 'USING') &&
        !diagnostics.some((entry) => this.createCacheKey(entry.range) === this.createCacheKey(using.range))
      ) {
        diagnostics.push(this.createDiagnostic(using.range, uri));
      }
    }
    return diagnostics.length ? diagnostics : null;
  }
}
