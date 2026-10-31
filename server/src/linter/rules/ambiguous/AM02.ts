import type { Diagnostic } from 'vscode-languageserver/node';
import type { DocumentCache } from '../../parser/tokenCache';
import { keyword, SourceRule, type SourceToken } from '../source';

export class UnionModifier extends SourceRule {
  readonly is_fix_compatible = false;
  readonly name = 'union';
  readonly code = 'AM02';
  readonly message = 'Specify DISTINCT or ALL after UNION.';
  readonly ruleGroup = 'ambiguous';

  protected evaluateSource(tokens: SourceToken[], _cache: DocumentCache, uri: string): Diagnostic[] {
    return tokens.flatMap((token, i) =>
      keyword(token, 'UNION') && !keyword(tokens[i + 1], 'ALL') && !keyword(tokens[i + 1], 'DISTINCT')
        ? [this.createDiagnostic(token.range, uri)]
        : [],
    );
  }
}
