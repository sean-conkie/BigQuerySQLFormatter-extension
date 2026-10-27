import type { Diagnostic, Range } from 'vscode-languageserver/node';
import { ParserRule } from '../base';
import type { FileMap } from '../../parser';
import { legacyTableSources } from '../../scope';

export class UniqueTable extends ParserRule {
  readonly is_fix_compatible: boolean = false;
  readonly name: string = 'unique_table';
  readonly code: string = 'AL04';
  readonly message: string = 'Table aliases should be unique within each clause.';
  readonly relatedInformation: string = '';
  readonly ruleGroup: string = 'aliasing';

  evaluate(ast: FileMap, documentUri: string | null = null): Diagnostic[] | null {
    if (!this.enabled) return null;
    const errors: Diagnostic[] = [];
    for (const statement of Object.values(ast)) {
      const aliases = new Map<string, Range[]>();
      for (const source of legacyTableSources(statement)) {
        const ranges = aliases.get(source.alias) ?? [];
        ranges.push(source.range);
        aliases.set(source.alias, ranges);
      }
      for (const ranges of aliases.values()) {
        if (ranges.length > 1) {
          for (const range of ranges) errors.push(this.createDiagnostic(range, documentUri));
        }
      }
    }
    return errors.length ? errors : null;
  }
}
