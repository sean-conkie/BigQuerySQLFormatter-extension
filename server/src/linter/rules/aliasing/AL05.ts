import type { Diagnostic } from 'vscode-languageserver/node';
import { ParserRule } from '../base';
import type { FileMap } from '../../parser';
import { legacyColumnReferences } from '../../scope';

export class UnusedAlias extends ParserRule {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = 'unused_alias';
  readonly code: string = 'AL05';
  readonly message: string = 'Columns must use table alias.';
  readonly relatedInformation: string =
    'All columns should be referenced using the table alias when an alias is defined.';
  readonly ruleGroup: string = 'aliasing';

  evaluate(ast: FileMap, documentUri: string | null = null): Diagnostic[] | null {
    if (!this.enabled) return null;
    const errors: Diagnostic[] = [];
    for (const statement of Object.values(ast)) {
      for (const column of legacyColumnReferences(statement)) {
        if (column.source !== null || column.column === null) continue;
        const token = column.tokens.find((token) => token.scopes.includes('meta.column.sql'));
        errors.push(
          this.createDiagnostic(
            token
              ? {
                  start: { line: token.lineNumber ?? 0, character: token.startIndex ?? 0 },
                  end: { line: token.lineNumber ?? 0, character: token.endIndex ?? 0 },
                }
              : {
                  start: { line: column.startLine ?? 0, character: column.startIndex ?? 0 },
                  end: { line: column.startLine ?? 0, character: column.endIndex ?? 0 },
                },
            documentUri,
          ),
        );
      }
    }
    return errors.length ? errors : null;
  }
}
