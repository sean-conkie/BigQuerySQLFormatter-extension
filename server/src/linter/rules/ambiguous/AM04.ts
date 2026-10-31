import type { ServerSettings } from '../../../settings';
import type { Diagnostic } from 'vscode-languageserver/node';
import { RegexRule } from '../base';
import { QueryScopeResolver } from '../../scope';
import { tokenizeSource, keyword } from '../source';

/**
 * The ColumnCount rule
 * @class ColumnCount
 * @extends Rule
 * @memberof Linter.Rules
 */
export class ColumnCount extends RegexRule {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = 'column_count';
  readonly code: string = 'AM04';
  readonly message: string = 'Query produces an unknown number of result columns.';
  readonly relatedInformation: string =
    'Querying all columns using * produces a query result where the number or ordering of columns changes if the upstream table’s schema changes. This should be avoided because it can cause slow performance, cause important schema changes to go undetected, or break production code.';
  readonly pattern: RegExp = /(?<target>(?:[\w_]+\.)?\*)/gim;
  readonly ruleGroup: string = 'ambiguous';

  evaluate(text: string, uri: string | null = null): Diagnostic[] | null {
    const diagnostics = super.evaluate(text, uri);
    if (!diagnostics) return null;
    const tokens = tokenizeSource(text);
    const resolver = new QueryScopeResolver(tokens);
    return diagnostics.filter((diagnostic) => {
      const index = tokens.findIndex(
        (token) =>
          token.range.start.line === diagnostic.range.start.line &&
          token.range.start.character === diagnostic.range.start.character,
      );
      const stage = resolver.scopeAt(index)?.pipe;
      if (!stage) return true;
      // Multiplication and COUNT(*) are not output wildcards. Operators without
      // an output list have no SELECT-star equivalent.
      if (stage.kind !== 'projection') return false;
      return stage.items.some((item) => {
        const star = item.expression.findIndex((token) => keyword(token, '*'));
        return (
          (star === 0 || (star > 0 && keyword(item.expression[star - 1], '.'))) &&
          item.expression[0].range.start.line === diagnostic.range.start.line &&
          item.expression[0].range.start.character === diagnostic.range.start.character
        );
      });
    });
  }
}
