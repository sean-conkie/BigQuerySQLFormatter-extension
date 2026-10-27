import {
  CancellationToken,
  CodeActionKind,
  type CodeAction,
  type CodeActionParams,
  type Diagnostic,
  type Range,
  type TextEdit,
  LSPErrorCodes,
  ResponseError,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Linter, sourceFixAllKind } from './linter/linter';
import { globalTokenCache } from './linter/parser/tokenCache';
import type { ServerSettings } from './settings';
import { checkCancellation } from './cancellation';

let nextRequest = 0;

async function withIsolatedLinter<T>(
  document: TextDocument,
  settings: ServerSettings,
  run: (linter: Linter, snapshot: TextDocument) => Promise<T>,
): Promise<T> {
  // Parsing writes URI-keyed caches. Never let temporary formatting passes replace live document state.
  const uri = `bigquery-formatter:request-${nextRequest++}`;
  const snapshot = TextDocument.create(uri, document.languageId, document.version, document.getText());
  const linter = new Linter({ ...settings, maxNumberOfProblems: Number.MAX_SAFE_INTEGER });
  try {
    return await run(linter, snapshot);
  } finally {
    linter.closeDocument(uri);
    globalTokenCache.delete(uri);
  }
}

export async function createDocumentCodeActions(
  document: TextDocument,
  settings: ServerSettings,
  params: CodeActionParams,
  token: CancellationToken = CancellationToken.None,
): Promise<CodeAction[]> {
  return withIsolatedLinter(document, settings, async (linter, snapshot) => {
    const diagnostics = await linter.verify(
      { uri: snapshot.uri, languageId: snapshot.languageId, version: snapshot.version, text: snapshot.getText() },
      token,
    );
    const request = { ...params, textDocument: { uri: snapshot.uri } };
    const all = await linter.createCodeActions({ ...request, context: { ...params.context, diagnostics } });
    const quickFixes = await linter.createCodeActions(request);
    const fixAll = all.find((action) => action.kind === sourceFixAllKind);
    if (fixAll) {
      fixAll.edit = {
        changes: { [snapshot.uri]: await formatDocument(snapshot, settings, undefined, token) },
      };
    }
    checkCancellation(token);
    const actions = [
      ...all.filter((action) => action.kind === sourceFixAllKind),
      ...quickFixes.filter((action) => action.kind === CodeActionKind.QuickFix),
    ];
    for (const action of actions) {
      if (action.edit?.changes) {
        action.edit.changes = { [document.uri]: action.edit.changes[snapshot.uri] };
      }
      for (const diagnostic of action.diagnostics ?? []) {
        for (const related of diagnostic.relatedInformation ?? []) {
          if (related.location.uri === snapshot.uri) related.location.uri = document.uri;
        }
      }
    }
    return actions;
  });
}

export async function formatDocument(
  document: TextDocument,
  settings: ServerSettings,
  range?: Range,
  token: CancellationToken = CancellationToken.None,
): Promise<TextEdit[]> {
  return withIsolatedLinter(document, settings, async (linter, snapshot) => {
    const original = document.getText();
    const start = range ? document.offsetAt(range.start) : 0;
    const originalEnd = range ? document.offsetAt(range.end) : original.length;
    const replacementRange = { start: document.positionAt(start), end: document.positionAt(originalEnd) };
    let end = originalEnd;
    let current = snapshot;
    const seen = new Set<string>([original]);
    for (let pass = 0; pass < 100; pass++) {
      checkCancellation(token);
      const diagnostics: Diagnostic[] = await linter.verify(
        { uri: current.uri, languageId: current.languageId, version: current.version, text: current.getText() },
        token,
      );
      const selection = { start: current.positionAt(start), end: current.positionAt(end) };
      const actions = await linter.createCodeActions(
        {
          textDocument: { uri: current.uri },
          range: selection,
          context: { diagnostics, only: [sourceFixAllKind] },
        },
        selection,
      );
      checkCancellation(token);
      const edits = actions[0]?.edit?.changes?.[current.uri] ?? [];
      const text = TextDocument.applyEdits(current, edits);
      if (text === current.getText()) {
        return text === original ? [] : [{ range: replacementRange, newText: text.slice(start, end) }];
      }
      if (seen.has(text)) {
        throw new ResponseError(LSPErrorCodes.RequestFailed, 'BigQuery SQL formatting fixes did not converge (cycle).');
      }
      seen.add(text);
      for (const edit of edits) {
        end += edit.newText.length - (current.offsetAt(edit.range.end) - current.offsetAt(edit.range.start));
      }
      current = TextDocument.create(current.uri, current.languageId, current.version + 1, text);
    }
    throw new ResponseError(LSPErrorCodes.RequestFailed, 'BigQuery SQL formatting exceeded 100 fix passes.');
  });
}
