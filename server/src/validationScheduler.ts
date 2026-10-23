import {
  CancellationTokenSource,
  type CancellationToken,
  type PublishDiagnosticsParams,
  ResponseError,
  LSPErrorCodes,
} from 'vscode-languageserver/node';

interface ValidationJob {
  source: CancellationTokenSource;
  timer?: ReturnType<typeof setTimeout>;
}

export class ValidationScheduler {
  private readonly jobs = new Map<string, ValidationJob>();
  private readonly pending = new Map<string, Promise<void>>();

  constructor(
    private readonly publish: (params: PublishDiagnosticsParams) => void,
    private readonly logError: (message: string) => void,
  ) {}

  schedule(uri: string, validate: (token: CancellationToken) => Promise<PublishDiagnosticsParams>, delay = 0): void {
    this.cancel(uri);
    const job: ValidationJob = { source: new CancellationTokenSource() };
    this.jobs.set(uri, job);
    const run = () => {
      job.timer = undefined;
      const token = job.source.token;
      const pending = (this.pending.get(uri) ?? Promise.resolve())
        .then(async () => {
          if (token.isCancellationRequested) return;
          const diagnostics = await validate(token);
          if (!token.isCancellationRequested && this.jobs.get(uri) === job) {
            this.publish(diagnostics);
          }
        })
        .catch((error: unknown) => {
          if (!(error instanceof ResponseError && error.code === LSPErrorCodes.RequestCancelled)) {
            this.logError(`Validation failed for ${uri}: ${String(error)}`);
          }
        })
        .finally(() => {
          job.source.dispose();
          if (this.jobs.get(uri) === job) this.jobs.delete(uri);
          if (this.pending.get(uri) === pending) this.pending.delete(uri);
        });
      this.pending.set(uri, pending);
    };
    if (delay > 0) {
      job.timer = setTimeout(run, delay);
    } else {
      run();
    }
  }

  cancel(uri: string): void {
    const job = this.jobs.get(uri);
    if (!job) return;
    job.source.cancel();
    if (job.timer !== undefined) {
      clearTimeout(job.timer);
      job.source.dispose();
    }
    this.jobs.delete(uri);
  }
}
