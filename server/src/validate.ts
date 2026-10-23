import {
  CancellationToken,
  type CodeActionParams,
  type CodeAction,
  type DidChangeTextDocumentParams,
  type TextDocumentItem,
  type PublishDiagnosticsParams,
} from 'vscode-languageserver/node';
import { Linter } from './linter/linter';
import { documentSettings, type ServerSettings } from './settings';
import { globalTokenCache } from './linter/parser/tokenCache';
import { checkCancellation } from './cancellation';

const documentLinters = new Map<string, Linter>();

export function getDocumentLinter(uri: string, settings: ServerSettings): Linter {
  let linter = documentLinters.get(uri);
  if (!linter) {
    linter = new Linter(settings);
    documentLinters.set(uri, linter);
  } else {
    linter.settings = settings;
    for (const rule of [...linter.regexRules, ...linter.parserRules]) {
      rule.settings = settings;
    }
  }
  return linter;
}

export function closeTextDocument(uri: string): PublishDiagnosticsParams {
  documentLinters.get(uri)?.closeDocument(uri);
  documentLinters.delete(uri);
  globalTokenCache.delete(uri);
  documentSettings.delete(uri);
  return { uri, diagnostics: [] };
}

export async function validateTextDocument(
  textDocument: TextDocumentItem,
  settings: ServerSettings,
  token: CancellationToken = CancellationToken.None,
): Promise<PublishDiagnosticsParams> {
  checkCancellation(token);
  const diagnostics = await getDocumentLinter(textDocument.uri, settings).verify(textDocument, token);
  return { uri: textDocument.uri, version: textDocument.version, diagnostics };
}

export async function validateTextDocumentChanges(
  textDocumentChangeParams: DidChangeTextDocumentParams,
  settings: ServerSettings,
  token: CancellationToken = CancellationToken.None,
): Promise<PublishDiagnosticsParams> {
  checkCancellation(token);
  const diagnostics = await getDocumentLinter(textDocumentChangeParams.textDocument.uri, settings).verifyChanges(
    textDocumentChangeParams,
    token,
  );
  return {
    uri: textDocumentChangeParams.textDocument.uri,
    version: textDocumentChangeParams.textDocument.version,
    diagnostics,
  };
}
