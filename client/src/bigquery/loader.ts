import { commands, workspace, window, Uri, type ExtensionContext } from 'vscode';
import type { BigQueryIntegration } from './index';
import type { BigQueryFeature } from './settings';
import type { BigQueryRequest } from './rest';
import type { TokenizeSql } from './dryRun';

export interface BigQueryApi {
  request(
    feature: BigQueryFeature,
    request: BigQueryRequest,
    resource?: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
  setResult(resource: string, result: string): void;
}

export function registerBigQuery(context: ExtensionContext, tokenize: TokenizeSql): BigQueryApi {
  let integration: BigQueryIntegration | undefined;
  let disabledReported = false;
  let consentUpdate: Promise<void> = Promise.resolve();
  const enabled = (resource?: string) => {
    const config = workspace.getConfiguration(
      'bigquerySQLFormatter.bigquery',
      resource ? Uri.parse(resource) : window.activeTextEditor?.document.uri,
    );
    return config.get('dryRun.enabled') === true || config.get('schema.enabled') === true;
  };
  const load = () => {
    if (!integration) {
      const module: typeof import('./index') = require(context.asAbsolutePath('dist/bigquery.js'));
      integration = module.initialize(context, tokenize);
    }
    return integration;
  };
  const refresh = () => {
    disabledReported = false;
    integration?.dispose();
    integration = undefined;
    if (enabled() || workspace.workspaceFolders?.some((folder) => enabled(folder.uri.toString()))) {
      try {
        load();
      } catch {
        // Do not expose dependency errors that can contain credential or proxy details.
        void window.showErrorMessage(
          'BigQuery integration could not start. Check the BigQuery and HTTP proxy settings.',
        );
      }
    }
  };
  context.subscriptions.push(
    { dispose: () => integration?.dispose() },
    workspace.onDidGrantWorkspaceTrust(refresh),
    window.onDidChangeActiveTextEditor(() => {
      if (!integration && enabled()) refresh();
    }),
    workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('bigquerySQLFormatter.bigquery.projectId') ||
        event.affectsConfiguration('bigquerySQLFormatter.bigquery.quotaProjectId') ||
        event.affectsConfiguration('bigquerySQLFormatter.bigquery.location')
      ) {
        integration?.dispose();
        integration = undefined;
        consentUpdate = Promise.resolve(
          context.workspaceState.update('bigquerySQLFormatter.bigquery.consent', undefined),
        );
        void consentUpdate.then(refresh, () => {
          void window.showErrorMessage(
            'BigQuery consent could not be cleared. Reset BigQuery Consent before retrying.',
          );
        });
      } else if (event.affectsConfiguration('bigquerySQLFormatter.bigquery') || event.affectsConfiguration('http')) {
        refresh();
      }
    }),
    commands.registerCommand('bigquerySQLFormatter.bigquery.resetConsent', async () => {
      integration?.dispose();
      integration = undefined;
      consentUpdate = Promise.resolve(
        context.workspaceState.update('bigquerySQLFormatter.bigquery.consent', undefined),
      );
      await consentUpdate;
      refresh();
      void window.showInformationMessage(
        'BigQuery consent reset. The next BigQuery request will ask for consent again.',
      );
    }),
    commands.registerCommand('bigquerySQLFormatter.bigquery.retry', async () => {
      await consentUpdate;
      if (enabled()) load().retry();
      else void window.showInformationMessage('Enable a BigQuery feature in settings before retrying.');
    }),
    commands.registerCommand('bigquerySQLFormatter.bigquery.actions', async () => {
      const action = await window.showQuickPick(
        [
          'Dry Run Current File',
          'Dry Run Selection',
          'Retry BigQuery Connection',
          'Reset BigQuery Consent',
          'Open BigQuery Output',
          'Open BigQuery Settings',
        ],
        { title: 'BigQuery SQL' },
      );
      if (action === 'Dry Run Current File') await commands.executeCommand('bigquerySQLFormatter.bigquery.dryRunFile');
      else if (action === 'Dry Run Selection')
        await commands.executeCommand('bigquerySQLFormatter.bigquery.dryRunSelection');
      else if (action === 'Retry BigQuery Connection')
        await commands.executeCommand('bigquerySQLFormatter.bigquery.retry');
      else if (action === 'Reset BigQuery Consent')
        await commands.executeCommand('bigquerySQLFormatter.bigquery.resetConsent');
      else if (action === 'Open BigQuery Output') integration?.showOutput();
      else if (action === 'Open BigQuery Settings')
        await commands.executeCommand('workbench.action.openSettings', 'bigquerySQLFormatter.bigquery');
    }),
  );
  for (const [command, selection] of [
    ['bigquerySQLFormatter.bigquery.dryRunFile', false],
    ['bigquerySQLFormatter.bigquery.dryRunSelection', true],
  ] as const) {
    context.subscriptions.push(
      commands.registerCommand(command, async () => {
        const editor = window.activeTextEditor;
        if (editor?.document.languageId !== 'googlesql' || editor.document.uri.scheme !== 'file') {
          void window.showWarningMessage('Open a GoogleSQL file before running a BigQuery dry run.');
          return;
        }
        if (!workspace.isTrusted || !enabled(editor.document.uri.toString())) {
          void window.showWarningMessage('Enable BigQuery dry runs in a trusted workspace first.');
          return;
        }
        if (selection && editor.selection.isEmpty) {
          void window.showWarningMessage('Select SQL before running a BigQuery selection dry run.');
          return;
        }
        await consentUpdate;
        await load().dryRun(editor.document, selection ? editor.selection : undefined);
      }),
    );
  }
  refresh();
  return {
    request: async (feature, request, resource, signal) => {
      if (!workspace.isTrusted || !enabled(resource)) {
        if (!disabledReported) {
          disabledReported = true;
          void window.showWarningMessage('BigQuery integration is disabled or the workspace is untrusted.');
        }
        throw new Error('BigQuery integration is disabled or the workspace is untrusted.');
      }
      await consentUpdate;
      return load().request(feature, request, resource, signal);
    },
    setResult: (resource, result) => integration?.setResult(resource, result),
  };
}
