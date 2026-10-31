import { window, workspace, StatusBarAlignment, Uri, type ExtensionContext } from 'vscode';
import { BigQueryRestClient, createCredentials, type BigQueryRequest } from './rest';
import { parseBigQuerySettings, type BigQueryFeature, type BigQuerySettings } from './settings';
import { BigQueryService } from './service';

export interface BigQueryIntegration {
  request(
    feature: BigQueryFeature,
    request: BigQueryRequest,
    resource?: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
  setResult(resource: string, result: string): void;
  retry(): void;
  showOutput(): void;
  dispose(): void;
}

export const consentKey = 'bigquerySQLFormatter.bigquery.consent';

export function initialize(context: ExtensionContext): BigQueryIntegration {
  const results = new Map<string, string>();
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
    status.tooltip = 'BigQuery actions: retry, reset consent, output and settings';
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
  render();
  void service.checkCredentials();
  return {
    request: (feature, request, resource, signal) => service.request(feature, request, resource, signal),
    setResult: (resource, result) => {
      results.set(resource, result.replace(/[\r\n\t]/g, ' ').slice(0, 100));
      render();
    },
    retry: () => service.retry(),
    showOutput: () => output.show(),
    dispose: () => {
      service.dispose();
      editorChange.dispose();
      status.dispose();
      output.dispose();
    },
  };
}
