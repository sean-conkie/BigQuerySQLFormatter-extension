import {
  window,
  workspace,
  languages,
  StatusBarAlignment,
  Uri,
  Range,
  Diagnostic,
  DiagnosticSeverity,
  type ExtensionContext,
  type TextDocument,
} from 'vscode';
import { BigQueryError, BigQueryRestClient, createCredentials, type BigQueryRequest } from './rest';
import { parseBigQuerySettings, type BigQueryFeature, type BigQuerySettings } from './settings';
import { BigQueryService } from './service';
import { dryRunResult, errorOffsets, queryFeatures, type TokenizeSql } from './dryRun';

export interface BigQueryIntegration {
  request(
    feature: BigQueryFeature,
    request: BigQueryRequest,
    resource?: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
  setResult(resource: string, result: string): void;
  dryRun(document: TextDocument, selection?: Range): Promise<void>;
  retry(): void;
  showOutput(): void;
  dispose(): void;
}

export const consentKey = 'bigquerySQLFormatter.bigquery.consent';

export function initialize(context: ExtensionContext, tokenize: TokenizeSql): BigQueryIntegration {
  const results = new Map<string, string>();
  const referencedTables = new Map<string, string[]>();
  const pending = new Map<string, AbortController>();
  const diagnostics = languages.createDiagnosticCollection('BigQuery dry run');
  let project: string | undefined;
  let state = workspace.isTrusted ? 'Not signed in' : 'Disabled in Restricted Mode';
  const activeResource = () => window.activeTextEditor?.document.uri;
  const settings = (resource?: string) => {
    const config = workspace.getConfiguration(
      'bigquerySQLFormatter.bigquery',
      resource ? Uri.parse(resource) : activeResource(),
    );
    return parseBigQuerySettings((key) => config.get(key));
  };
  const render = () => {
    const resource = activeResource();
    let config: BigQuerySettings;
    try {
      config = settings(resource?.toString());
    } catch {
      status.text = '$(warning) BigQuery: Invalid settings';
      status.show();
      if (!invalidSettingsReported) {
        invalidSettingsReported = true;
        void window.showWarningMessage(
          'Invalid BigQuery settings. Check projectId, location, dataset and numeric settings.',
        );
      }
      return;
    }
    invalidSettingsReported = false;
    if (!config.dryRun.enabled && !config.schema.enabled) {
      status.hide();
      return;
    }
    const latest = resource && results.get(resource.toString());
    status.text = `$(database) BigQuery: ${config.projectId ?? project ?? 'ADC project'} - ${latest ?? state}`;
    const tables = resource && referencedTables.get(resource.toString());
    status.tooltip = [latest ?? state, ...(tables ?? [])].join('\n');
    status.command = config.dryRun.enabled
      ? 'bigquerySQLFormatter.bigquery.dryRunFile'
      : 'bigquerySQLFormatter.bigquery.actions';
    status.show();
  };
  const credentials = createCredentials();
  const rest = new BigQueryRestClient(credentials, (metadata) => output.appendLine(JSON.stringify(metadata)));
  const output = window.createOutputChannel('BigQuery SQL Formatter: BigQuery');
  const status = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  status.name = 'BigQuery SQL';
  status.command = 'bigquerySQLFormatter.bigquery.actions';
  let invalidSettingsReported = false;
  const service = new BigQueryService(
    {
      trusted: () => workspace.isTrusted,
      settings,
      scope: (resource) => {
        const uri = resource ? Uri.parse(resource) : activeResource();
        return (
          (uri && workspace.getWorkspaceFolder(uri)?.uri.toString()) ??
          workspace.workspaceFile?.toString() ??
          'empty-workspace'
        );
      },
      consent: (scope) => context.workspaceState.get<Record<string, string>>(consentKey, {})[scope],
      saveConsent: async (scope, identity) => {
        const consent = { ...context.workspaceState.get<Record<string, string>>(consentKey, {}) };
        if (identity === undefined) delete consent[scope];
        else consent[scope] = identity;
        await context.workspaceState.update(consentKey, consent);
      },
      prompt: async (projectId, location, billingProject, quotaProject) =>
        (await window.showInformationMessage(
          `Allow BigQuery access for project "${projectId}", location "${location ?? 'automatic (not set)'}"${billingProject !== projectId ? ` (billing project "${billingProject}")` : ''}${quotaProject ? `, quota project "${quotaProject}"` : ''}? Dry runs send query text. Schema completions send dataset, table and column lookups. Nothing is sent until you allow access. Consent is requested again if the project or location changes.`,
          { modal: true },
          'Allow',
        )) === 'Allow',
      notify: (message) => {
        void window.showWarningMessage(message);
      },
      status: (activeProject, nextState) => {
        project = activeProject;
        state = nextState;
        render();
      },
    },
    credentials,
    rest,
  );
  const editorChange = window.onDidChangeActiveTextEditor(() => {
    project = undefined;
    render();
  });
  const setResult = (resource: string, result: string) => {
    results.set(resource, result.replace(/[\r\n\t]/g, ' '));
    render();
  };
  const clear = (document: TextDocument) => {
    const resource = document.uri.toString();
    pending.get(resource)?.abort();
    pending.delete(resource);
    diagnostics.delete(document.uri);
    results.delete(resource);
    referencedTables.delete(resource);
    render();
  };
  const dryRun = async (document: TextDocument, selection?: Range) => {
    const resource = document.uri.toString();
    clear(document);
    const controller = new AbortController();
    pending.set(resource, controller);
    const version = document.version;
    const query = document.getText(selection);
    const offset = selection ? document.offsetAt(selection.start) : 0;
    const current = () => !controller.signal.aborted && !document.isClosed && document.version === version;
    try {
      const config = settings(resource);
      if (!workspace.isTrusted || !config.dryRun.enabled)
        throw new BigQueryError('disabled', 'Enable BigQuery dry runs in a trusted workspace first.');
      const tokens = await tokenize(query);
      if (!current()) return;
      const features = queryFeatures(tokens, config.dryRun.parameters);
      const fullFeatures = selection ? queryFeatures(await tokenize(document.getText())) : features;
      if (!current()) return;
      if (/\.sqlx$/i.test(document.fileName) || fullFeatures.templated) {
        setResult(resource, 'Skipped templated file (Dataform/dbt)');
        return;
      }
      if (tokens.length === 0) {
        setResult(resource, 'Skipped empty SQL');
        return;
      }
      setResult(resource, 'Dry run in progress');
      let response: unknown;
      try {
        response = await service.request(
          'dryRun',
          { operation: 'jobs.insert', query, parameters: config.dryRun.parameters },
          resource,
          controller.signal,
        );
      } catch (error) {
        if (!current()) return;
        if (!(error instanceof BigQueryError)) throw error;
        if (error.queryMessage) {
          const [start, end] = errorOffsets(query, error.queryMessage, tokens);
          let message = error.queryMessage;
          if (/LIMIT value should not be NULL/i.test(message))
            message += ' Set bigquerySQLFormatter.bigquery.dryRun.parameters with a type and value.';
          if (error.kind === 'permission') message += ` ${error.message}`;
          const diagnostic = new Diagnostic(
            new Range(document.positionAt(offset + start), document.positionAt(offset + end)),
            message,
            DiagnosticSeverity.Error,
          );
          diagnostic.source = 'BigQuery dry run';
          diagnostics.set(document.uri, [diagnostic]);
          setResult(resource, '1 error; fix and re-run');
        } else setResult(resource, error.kind === 'auth' ? 'Not signed in' : error.message);
        return;
      }
      if (!current()) return;
      const result = dryRunResult(response, features.assumedNull, config.dryRun.costPerTiB);
      referencedTables.set(resource, result.tables);
      setResult(resource, result.label);
    } catch (error) {
      if (!current()) return;
      const message =
        error instanceof BigQueryError
          ? error.message
          : 'BigQuery dry run failed. Check dry-run settings (parameter values are required) and retry.';
      setResult(resource, message);
      void window.showWarningMessage(message);
    } finally {
      if (pending.get(resource) === controller) pending.delete(resource);
    }
  };
  const change = workspace.onDidChangeTextDocument((event) => clear(event.document));
  const close = workspace.onDidCloseTextDocument(clear);
  const save = workspace.onDidSaveTextDocument((document) => {
    if (document.languageId !== 'googlesql' || document.uri.scheme !== 'file' || !workspace.isTrusted) return;
    try {
      const config = settings(document.uri.toString());
      if (config.dryRun.enabled && config.dryRun.trigger === 'onSave') void dryRun(document);
    } catch {
      void window.showWarningMessage('Invalid BigQuery settings. Check dry-run settings before saving again.');
    }
  });
  render();
  void service.checkCredentials();
  return {
    request: (feature, request, resource, signal) => service.request(feature, request, resource, signal),
    setResult,
    dryRun,
    retry: () => service.retry(),
    showOutput: () => output.show(),
    dispose: () => {
      service.dispose();
      for (const controller of pending.values()) controller.abort();
      pending.clear();
      diagnostics.dispose();
      change.dispose();
      close.dispose();
      save.dispose();
      editorChange.dispose();
      status.dispose();
      output.dispose();
    },
  };
}
