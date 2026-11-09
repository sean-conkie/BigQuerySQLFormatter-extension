import type { ServerSettings } from '../../../settings';
import {
  type CodeAction,
  CodeActionKind,
  type Diagnostic,
  DiagnosticSeverity,
  type TextDocumentIdentifier,
  TextEdit,
} from 'vscode-languageserver/node';
import { RegexReplaceRule } from '../base';
import { QueryScopeResolver } from '../../scope';
import { keyword, tokenizeSource } from '../source';
import { topLevel } from '../../parser/pipe';

/**
 * The SelectTrailingComma rule
 * @class SelectTrailingComma
 * @extends Rule
 * @memberof Linter.Rules
 */
export class SelectTrailingComma extends RegexReplaceRule {
  readonly replacement = '';
  readonly name: string = 'select_trailing_comma';
  readonly code: string = 'CV03';
  readonly message: string = 'Trailing comma within select clause.';
  readonly relatedInformation: string =
    'To ensure better readability and prevent errors, the trailing comma should be omitted in `SELECT` statements.';
  readonly pattern: RegExp = /(?<target>,)\s*from/gim;
  readonly severity: DiagnosticSeverity = DiagnosticSeverity.Warning;
  readonly ruleGroup: string = 'convention';
  readonly codeActionKind: CodeActionKind[] = [CodeActionKind.SourceFixAll, CodeActionKind.QuickFix];
  readonly codeActionTitle = 'Remove trailing comma';

  evaluate(text: string, uri: string | null = null): Diagnostic[] | null {
    if (!this.enabled) return null;
    const diagnostics = super.evaluate(text, uri) ?? [];
    const tokens = tokenizeSource(text);
    for (const scope of new QueryScopeResolver(tokens).scopes) {
      const stage = scope.pipe;
      if (stage?.kind !== 'projection') continue;
      const end =
        topLevel(tokens, stage.body, stage.end).find(
          (i) => keyword(tokens[i], 'GROUP') || keyword(tokens[i], 'WINDOW'),
        ) ?? stage.end;
      const comma = tokens[end - 1];
      if (keyword(comma, ',')) diagnostics.push(this.createDiagnostic(comma.range, uri));
    }
    return diagnostics.length ? diagnostics : null;
  }
}
