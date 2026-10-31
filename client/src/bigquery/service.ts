import type { BigQueryFeature, BigQuerySettings } from './settings';
import { abortable, BigQueryError, type BigQueryRestClient, type BigQueryRequest, type Credentials } from './rest';

export interface BigQueryHost {
  trusted(): boolean;
  settings(resource?: string): BigQuerySettings;
  scope(resource?: string): string;
  consent(scope: string): string | undefined;
  saveConsent(scope: string, identity: string | undefined): Promise<void>;
  prompt(project: string, location?: string, billingProject?: string, quotaProject?: string): Promise<boolean>;
  notify(message: string): void;
  status(project: string | undefined, state: string): void;
}

export class BigQueryService {
  private controller = new AbortController();
  private readonly notifications = new Set<string>();
  private readonly prompts = new Map<string, Promise<boolean>>();
  private readonly declined = new Set<string>();
  private disposed = false;

  constructor(
    private readonly host: BigQueryHost,
    private readonly credentials: Credentials,
    private readonly rest: BigQueryRestClient,
  ) {}

  invalidate(): void {
    this.controller.abort(new BigQueryError('cancelled', 'BigQuery configuration or consent changed.'));
    this.controller = new AbortController();
    this.prompts.clear();
    this.declined.clear();
    this.notifications.clear();
  }

  retry(): void {
    this.notifications.clear();
    this.declined.clear();
    this.credentials.retry();
    this.host.status(undefined, 'Ready to retry');
    void this.checkCredentials();
  }

  async checkCredentials(): Promise<void> {
    if (this.disposed || !this.host.trusted()) return;
    const local = new AbortController();
    const generation = this.controller.signal;
    const cancel = () => local.abort(generation.reason);
    generation.addEventListener('abort', cancel, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const settings = this.host.settings();
      if (!settings.dryRun.enabled && !settings.schema.enabled) return;
      timer = setTimeout(
        () => local.abort(new BigQueryError('timeout', 'BigQuery credential check timed out. Check ADC and retry.')),
        settings.timeoutMs,
      );
      await abortable(this.credentials.check(), local.signal);
      if (!local.signal.aborted) this.host.status(settings.projectId, 'Signed in');
    } catch (error) {
      const failure = local.signal.aborted
        ? local.signal.reason instanceof BigQueryError
          ? local.signal.reason
          : new BigQueryError('cancelled', 'BigQuery credential check cancelled.')
        : error instanceof BigQueryError
          ? error
          : new BigQueryError(
              'auth',
              'BigQuery credentials unavailable. Run gcloud auth application-default login, or configure GOOGLE_APPLICATION_CREDENTIALS, then retry.',
            );
      this.report(failure);
    } finally {
      clearTimeout(timer);
      generation.removeEventListener('abort', cancel);
    }
  }

  private report(failure: BigQueryError, resource?: string, project?: string): void {
    if (failure.kind === 'cancelled') return;
    this.host.status(project, failure.kind === 'auth' ? 'Not signed in' : failure.message);
    const key = `${this.host.scope(resource)}:${failure.kind}`;
    if (failure.kind !== 'consent' && !this.notifications.has(key)) {
      this.notifications.add(key);
      this.host.notify(failure.message);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.invalidate();
  }

  async request(
    feature: BigQueryFeature,
    request: BigQueryRequest,
    resource?: string,
    cancellation?: AbortSignal,
  ): Promise<unknown> {
    const local = new AbortController();
    const cancel = () => local.abort(cancellation?.reason ?? this.controller.signal.reason);
    const generation = this.controller.signal;
    generation.addEventListener('abort', cancel, { once: true });
    cancellation?.addEventListener('abort', cancel, { once: true });
    if (generation.aborted || cancellation?.aborted) cancel();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let project: string | undefined;
    try {
      if (this.disposed || !this.host.trusted())
        throw new BigQueryError('disabled', 'BigQuery integration requires a trusted workspace.');
      const settings = this.host.settings(resource);
      if (!settings[feature].enabled) throw new BigQueryError('disabled', `BigQuery ${feature} is disabled.`);
      if ((request.operation === 'jobs.insert') !== (feature === 'dryRun'))
        throw new BigQueryError('disabled', 'BigQuery operation does not match the enabled feature.');
      const signal = local.signal;
      signal.throwIfAborted();
      const preparationStarted = performance.now();
      const preparation = setTimeout(
        () =>
          local.abort(
            new BigQueryError(
              'timeout',
              'BigQuery authentication or project discovery timed out. Check ADC and retry.',
            ),
          ),
        settings.timeoutMs,
      );
      try {
        await abortable(this.credentials.check(), signal);
        project = settings.projectId ?? (await abortable(this.credentials.projectId(), signal));
      } catch (error) {
        if (signal.aborted || error instanceof BigQueryError) throw error;
        throw new BigQueryError(
          'auth',
          'BigQuery default project or credentials unavailable. Set bigquerySQLFormatter.bigquery.projectId and run gcloud auth application-default login, then retry.',
        );
      } finally {
        clearTimeout(preparation);
      }
      const remainingMs = Math.max(1, settings.timeoutMs - (performance.now() - preparationStarted));
      if (!/^[a-zA-Z0-9][a-zA-Z0-9.:-]*$/.test(project))
        throw new BigQueryError('api', 'Invalid BigQuery default project.');
      const targetProject = request.operation === 'jobs.insert' ? project : (request.project ?? project);
      if (!/^[a-zA-Z0-9][a-zA-Z0-9.:-]*$/.test(targetProject))
        throw new BigQueryError('api', 'Invalid BigQuery target project.');
      const identity = JSON.stringify([
        project,
        settings.location ?? null,
        targetProject,
        settings.quotaProjectId ?? null,
      ]);
      const scope = this.host.scope(resource);
      const promptKey = `${scope}:${identity}`;
      if (this.host.consent(scope) !== identity) {
        if (this.declined.has(promptKey))
          throw new BigQueryError(
            'consent',
            'BigQuery consent was declined. Use Retry BigQuery Connection to ask again.',
          );
        let prompt = this.prompts.get(promptKey);
        if (!prompt) {
          prompt = (async () => {
            try {
              const accepted = await this.host.prompt(
                targetProject,
                settings.location,
                project,
                settings.quotaProjectId,
              );
              if (generation.aborted || this.disposed || !this.host.trusted()) return false;
              if (accepted) await this.host.saveConsent(scope, identity);
              else this.declined.add(promptKey);
              return accepted;
            } finally {
              if (this.prompts.get(promptKey) === prompt) this.prompts.delete(promptKey);
            }
          })();
          this.prompts.set(promptKey, prompt);
        }
        if (!(await abortable(prompt, signal)))
          throw new BigQueryError('consent', 'BigQuery consent is required before sending data.');
      }
      signal.throwIfAborted();
      if (!this.host.trusted())
        throw new BigQueryError('disabled', 'BigQuery integration requires a trusted workspace.');
      timer = setTimeout(
        () =>
          local.abort(
            new BigQueryError(
              'timeout',
              `BigQuery request timed out after ${settings.timeoutMs}ms. Check your connection or increase timeoutMs.`,
            ),
          ),
        remainingMs,
      );
      this.host.status(project, 'Connecting');
      const result = await this.rest.request(
        request,
        {
          project,
          quotaProjectId: settings.quotaProjectId,
          location: settings.location,
          defaultDataset: settings.defaultDataset,
        },
        signal,
      );
      signal.throwIfAborted();
      this.host.status(project, 'Signed in');
      return result;
    } catch (error) {
      const failure = local.signal.aborted
        ? local.signal.reason instanceof BigQueryError
          ? local.signal.reason
          : new BigQueryError('cancelled', 'BigQuery request cancelled.')
        : error instanceof BigQueryError
          ? error
          : new BigQueryError('api', 'BigQuery integration failed. Check the BigQuery settings and retry.');
      this.report(failure, resource, project);
      throw failure;
    } finally {
      clearTimeout(timer);
      generation.removeEventListener('abort', cancel);
      cancellation?.removeEventListener('abort', cancel);
    }
  }
}
