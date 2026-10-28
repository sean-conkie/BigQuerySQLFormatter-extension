import { spawn } from 'node:child_process';
import * as path from 'node:path';
import {
  createProtocolConnection,
  StreamMessageReader,
  StreamMessageWriter,
  PublishDiagnosticsNotification,
  LogMessageNotification,
  MessageType,
  type PublishDiagnosticsParams,
} from 'vscode-languageserver/node';

export function startTestServer(serverPath = path.join(__dirname, '../server.js')) {
  const child = spawn(process.execPath, [serverPath, '--stdio']);
  const connection = createProtocolConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin),
  );
  const diagnostics: PublishDiagnosticsParams[] = [];
  const received: PublishDiagnosticsParams[] = [];
  const waiting: {
    resolve: (params: PublishDiagnosticsParams) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }[] = [];
  let stopping = false;
  let failure: Error | undefined;
  let stderr = '';
  let lastServerError = '';

  function rejectWaiting(error: Error): void {
    for (const waiter of waiting.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  function fail(error: Error): void {
    failure = error;
    rejectWaiting(error);
  }

  child.stderr.on('data', (data: Buffer) => {
    stderr = (stderr + data.toString()).slice(-4096);
  });
  child.on('error', fail);
  const closed = new Promise<void>((resolve) => {
    child.once('close', (code, signal) => {
      if (!stopping) fail(new Error(`Test language server exited (code ${code}, signal ${signal}). ${stderr}`));
      resolve();
    });
  });
  connection.onError(([error]) => fail(error));
  connection.onClose(() => {
    if (!stopping) fail(new Error(`Test language server connection closed. ${stderr}`));
  });
  connection.onNotification(PublishDiagnosticsNotification.type, (params) => {
    diagnostics.push(params);
    const waiter = waiting.shift();
    if (waiter) {
      clearTimeout(waiter.timer);
      waiter.resolve(params);
    } else {
      received.push(params);
    }
  });
  connection.onNotification(LogMessageNotification.type, (params) => {
    if (params.type === MessageType.Error) {
      lastServerError = params.message;
      rejectWaiting(new Error(params.message));
    }
  });
  connection.onRequest('client/registerCapability', () => null);
  connection.listen();

  function nextDiagnostics(timeout = 5000): Promise<PublishDiagnosticsParams> {
    if (failure) return Promise.reject(failure);
    const params = received.shift();
    if (params) return Promise.resolve(params);
    return new Promise((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          waiting.splice(waiting.indexOf(waiter), 1);
          reject(new Error(`Timed out waiting for server diagnostics. ${lastServerError || stderr}`));
        }, timeout),
      };
      waiting.push(waiter);
    });
  }

  async function stop(): Promise<void> {
    stopping = true;
    rejectWaiting(new Error('Test language server stopped.'));
    connection.dispose();
    child.stdin.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    if (child.exitCode === null && child.signalCode === null) child.kill();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        closed,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error('Test language server did not exit during teardown.'));
          }, 5000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  return { child, connection, diagnostics, nextDiagnostics, stop };
}
