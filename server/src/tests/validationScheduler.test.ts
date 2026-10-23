import { expect } from 'chai';
import sinon from 'sinon';
import {
  CancellationTokenSource,
  type PublishDiagnosticsParams,
  LSPErrorCodes,
  ResponseError,
} from 'vscode-languageserver/node';
import { ValidationScheduler } from '../validationScheduler';
import { checkCancellation } from '../cancellation';

describe('ValidationScheduler', () => {
  let clock: sinon.SinonFakeTimers;
  let scheduler: ValidationScheduler;
  let published: PublishDiagnosticsParams[];
  let errors: string[];
  const uri = 'file:///debounce.bqsql';
  const diagnostics = { uri, version: 1, diagnostics: [] };

  beforeEach(() => {
    clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    published = [];
    errors = [];
    scheduler = new ValidationScheduler(
      (params) => {
        published.push(params);
      },
      (message) => {
        errors.push(message);
      },
    );
  });

  afterEach(() => {
    scheduler.cancel(uri);
    clock.restore();
  });

  it('debounces to exactly 250ms after the latest change, running only that revision', async () => {
    const validate = sinon.stub().resolves(diagnostics);
    scheduler.schedule(uri, validate, 250);
    await clock.tickAsync(200);
    scheduler.schedule(uri, validate, 250);
    await clock.tickAsync(249);
    expect(validate.callCount).to.equal(0);
    await clock.tickAsync(1);
    expect(validate.callCount).to.equal(1);
    expect(published).to.deep.equal([diagnostics]);
  });

  it('skips cancelled work already queued before it starts', async () => {
    const validate = sinon.stub().resolves(diagnostics);
    scheduler.schedule(uri, validate);
    scheduler.schedule(uri, async () => ({ ...diagnostics, version: 2 }));
    await clock.tickAsync(0);
    expect(validate.callCount).to.equal(0);
    expect(published).to.deep.equal([{ ...diagnostics, version: 2 }]);
  });

  it('cancels in-flight work, serializes replacements, and suppresses stale results', async () => {
    let finish!: () => void;
    const first = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let oldToken: Parameters<typeof checkCancellation>[0] | undefined;
    scheduler.schedule(uri, async (token) => {
      oldToken = token;
      await first;
      return diagnostics;
    });
    await clock.tickAsync(0);
    const validate = sinon.stub().resolves({ ...diagnostics, version: 2 });
    scheduler.schedule(uri, validate);
    expect(oldToken?.isCancellationRequested).to.equal(true);
    await clock.tickAsync(0);
    expect(validate.callCount).to.equal(0);
    finish();
    await clock.tickAsync(0);
    expect(published).to.deep.equal([{ ...diagnostics, version: 2 }]);
    expect(errors).to.deep.equal([]);
  });

  it('cancels delayed work on close without affecting another document', async () => {
    const validate = sinon.stub().resolves(diagnostics);
    scheduler.schedule(uri, validate, 250);
    scheduler.cancel(uri);
    const other = { ...diagnostics, uri: 'file:///other.bqsql' };
    scheduler.schedule(other.uri, async () => other);
    await clock.tickAsync(250);
    expect(validate.callCount).to.equal(0);
    expect(published).to.deep.equal([other]);
    scheduler.cancel(other.uri);
  });

  it('recognizes LSP cancellation, logs real errors, and recovers for future validation', async () => {
    scheduler.schedule(uri, async () => {
      const source = new CancellationTokenSource();
      source.cancel();
      try {
        checkCancellation(source.token);
      } finally {
        source.dispose();
      }
      return diagnostics;
    });
    await clock.tickAsync(0);
    expect(errors).to.deep.equal([]);
    scheduler.schedule(uri, async () => {
      throw new Error('settings failed');
    });
    await clock.tickAsync(0);
    expect(errors).to.have.length(1);
    expect(errors[0]).to.include(uri).and.include('settings failed');
    scheduler.schedule(uri, async () => diagnostics);
    await clock.tickAsync(0);
    expect(published).to.deep.equal([diagnostics]);
    const error = new ResponseError(LSPErrorCodes.RequestCancelled, 'cancelled');
    expect(error.code).to.equal(-32800);
  });
});
