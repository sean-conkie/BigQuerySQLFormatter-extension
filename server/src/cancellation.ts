import { type CancellationToken, LSPErrorCodes, ResponseError } from 'vscode-languageserver/node';

export function checkCancellation(token: CancellationToken): void {
  if (token.isCancellationRequested) {
    throw new ResponseError(LSPErrorCodes.RequestCancelled, 'Validation cancelled');
  }
}

export async function yieldToEventLoop(token: CancellationToken): Promise<void> {
  checkCancellation(token);
  await new Promise<void>((resolve) => setImmediate(resolve));
  checkCancellation(token);
}

export function awaitWithCancellation<T>(pending: PromiseLike<T>, token: CancellationToken): Promise<T> {
  checkCancellation(token);
  return new Promise<T>((resolve, reject) => {
    const subscription = token.onCancellationRequested(() => {
      subscription.dispose();
      reject(new ResponseError(LSPErrorCodes.RequestCancelled, 'Validation cancelled'));
    });
    Promise.resolve(pending).then(
      (value) => {
        subscription.dispose();
        resolve(value);
      },
      (error: unknown) => {
        subscription.dispose();
        reject(error);
      },
    );
  });
}
