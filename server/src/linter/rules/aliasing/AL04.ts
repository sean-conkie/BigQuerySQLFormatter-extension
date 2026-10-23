import type { ServerSettings } from '../../../settings';
import type { Diagnostic, Range } from 'vscode-languageserver/node';
import { ParserRule } from '../base';
import type { FileMap } from '../../parser';
import { excludeTokensWithMatchingScopes, includeTokensWithMatchingScopes } from '../../parser/token';
import { ObjectAST, StatementAST } from '../../parser/ast';

export class UniqueTable extends ParserRule {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = 'unique_table';
  readonly code: string = 'AL04';
  readonly message: string = 'Table aliases should be unique within each clause.';
  readonly relatedInformation: string = '';
  readonly ruleGroup: string = 'aliasing';

  /**
   * Evaluates the given Abstract Syntax Tree (AST) to identify redundant aliases in column definitions.
   *
   * @param ast - The Abstract Syntax Tree (AST) representing the SQL file structure.
   * @param documentUri - The URI of the document being evaluated, or null if not applicable.
   * @returns An array of Diagnostic objects representing the errors found, or null if no errors are found or the rule is disabled.
   */
  evaluate(ast: FileMap, documentUri: string | null = null): Diagnostic[] | null {
    if (this.enabled === false) {
      return null;
    }
    const errors: Diagnostic[] = [];
    for (const i in ast) {
      const aliases: Map<string, Range[]> = new Map();
      const from = ast[i].from;
      if (from) {
        const fromTokens = excludeTokensWithMatchingScopes(from.tokens, [
          'punctuation.whitespace.sql',
          'punctuation.whitespace.leading.sql',
          'punctuation.whitespace.trailing.sql',
          'keyword.from.sql',
        ]);
        const fromRange = {
          start: {
            line: fromTokens[0].lineNumber ?? 0,
            character: fromTokens[0].startIndex ?? 0,
          },
          end: {
            line: fromTokens[fromTokens.length - 1].lineNumber ?? 0,
            character: fromTokens[fromTokens.length - 1].endIndex ?? 0,
          },
        };
        if (from.alias == null && from instanceof ObjectAST) {
          aliases.set(from.object ?? '', [fromRange]);
        } else if (from.alias != null && from instanceof ObjectAST) {
          aliases.set(from.alias ?? '', [fromRange]);
        }
      }

      if (ast[i].joins) {
        ast[i].joins.forEach((join) => {
          if (join.source) {
            const sourceTokens = excludeTokensWithMatchingScopes(join.source.tokens, [
              'punctuation.whitespace.sql',
              'punctuation.whitespace.leading.sql',
              'punctuation.whitespace.trailing.sql',
              'keyword.join.sql',
            ]);
            const sourceRange = {
              start: {
                line: sourceTokens[0].lineNumber ?? 0,
                character: sourceTokens[0].startIndex ?? 0,
              },
              end: {
                line: sourceTokens[sourceTokens.length - 1].lineNumber ?? 0,
                character: sourceTokens[sourceTokens.length - 1].endIndex ?? 0,
              },
            };
            if (join.source.alias == null && join.source instanceof ObjectAST) {
              let aliasesCache = aliases.get(join.source.object ?? '');
              if (!aliasesCache) {
                aliasesCache = [];
              }
              aliasesCache.push(sourceRange);
              aliases.set(join.source.object ?? '', aliasesCache);
            } else if (join.source.alias != null && join.source instanceof ObjectAST) {
              let aliasesCache = aliases.get(join.source.alias ?? '');
              if (!aliasesCache) {
                aliasesCache = [];
              }
              aliasesCache.push(sourceRange);
              aliases.set(join.source.alias ?? '', aliasesCache);
            }
          }
        });
      }

      for (const [alias, ranges] of aliases) {
        if (ranges.length > 1) {
          for (const range of ranges) {
            errors.push(this.createDiagnostic(range, documentUri));
          }
        }
      }
    }

    return errors.length > 0 ? errors : null;
  }
}
