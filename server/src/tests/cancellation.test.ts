import { expect } from 'chai';
import { CancellationToken, CancellationTokenSource, LSPErrorCodes } from 'vscode-languageserver/node';
import { awaitWithCancellation } from '../cancellation';

describe('Cancellable awaits', () => {
  it('returns results and propagates errors without a cancellation request', async () => {
    expect(await awaitWithCancellation(Promise.resolve(42), CancellationToken.None)).to.equal(42);
    const failure = new Error('settings failed');
    try {
      await awaitWithCancellation(Promise.reject(failure), CancellationToken.None);
      expect.fail('Expected settings failure');
    } catch (error) {
      expect(error).to.equal(failure);
    }
  });

  it('rejects immediately when a token is already cancelled', () => {
    const source = new CancellationTokenSource();
    source.cancel();
    try {
      expect(() => awaitWithCancellation(new Promise(() => {}), source.token)).to.throw('Validation cancelled');
    } finally {
      source.dispose();
    }
  });

  it('cancels without waiting for the underlying request to finish', async () => {
    const source = new CancellationTokenSource();
    let resolve!: (value: number) => void;
    const underlying = new Promise<number>((done) => {
      resolve = done;
    });
    const pending = awaitWithCancellation(underlying, source.token);
    source.cancel();
    try {
      await pending;
      expect.fail('Expected cancellation before settings resolve');
    } catch (error) {
      expect(error).to.have.property('code', LSPErrorCodes.RequestCancelled);
    } finally {
      resolve(42);
      source.dispose();
    }
  });
});
