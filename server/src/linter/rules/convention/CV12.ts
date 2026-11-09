import type { ServerSettings } from '../../../settings';
import { type Diagnostic, DiagnosticSeverity, type TextDocumentIdentifier } from 'vscode-languageserver/node';
import { RegexRule } from '../base';
import { QueryScopeResolver } from '../../scope';
import { keyword, tokenizeSource } from '../source';
import { comparePositions } from '../../parser/queryBlocks';

/**
 * The AllDistinct rule
 * @class AllDistinct
 * @extends Rule
 * @memberof Linter.Rules
 */
export class AllDistinct extends RegexRule {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = 'all_distinct';
  readonly code: string = 'CV12';
  readonly message: string = 'EXCEPT and INTERSECT require DISTINCT.';
  readonly relatedInformation: string =
    'UNION modifiers are checked by AM02; EXCEPT and INTERSECT require DISTINCT in GoogleSQL.';
  readonly pattern: RegExp = /\b(?<target>except|intersect)\b(?!\s+distinct\b)/gim;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';

  evaluate(text: string, uri: string | null = null): Diagnostic[] | null {
    if (!this.enabled) return null;
    const tokens = tokenizeSource(text);
    const resolver = new QueryScopeResolver(tokens);
    const stages = resolver.scopes.flatMap(({ pipe }) => (pipe?.kind === 'set' ? [pipe] : []));
    const diagnostics = (super.evaluate(text, uri) ?? []).filter(({ range }) => {
      const index = tokens.findIndex((token) => comparePositions(range.start, token.range.start) === 0);
      return !resolver.scopeAt(index)?.pipe;
    });
    for (const stage of stages) {
      if (stage.operator !== 'UNION' && !keyword(stage.modifier, 'DISTINCT')) {
        diagnostics.push(this.createDiagnostic(tokens[stage.start + 2].range, uri));
      }
    }
    return diagnostics.length ? diagnostics : null;
  }

  /**
   * Creates a set of code actions to fix diagnostics.
   *
   * @param textDocument - The identifier of the text document where the diagnostic was reported.
   * @param diagnostic - The diagnostic information about the issue to be fixed.
   * @returns An array of code actions that can be applied to fix the issue.
   */
  createCodeAction(textDocument: TextDocumentIdentifier, diagnostic: Diagnostic): null {
    return null;
  }
}
