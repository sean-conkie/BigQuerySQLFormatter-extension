import { expect } from 'chai';
import { InitializeRequest } from 'vscode-languageserver/node';
import { startTestServer } from './serverProcess';

describe('Test language server lifecycle', function () {
  this.timeout(10000);
  let server: ReturnType<typeof startTestServer>;

  beforeEach(() => {
    server = startTestServer();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('waits for the child to close and destroys its streams during teardown', async () => {
    await server.connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: {},
      rootUri: null,
    });
    await server.stop();
    expect(server.child.exitCode !== null || server.child.signalCode !== null).to.equal(true);
    expect(server.child.stdin.destroyed).to.equal(true);
    expect(server.child.stdout.destroyed).to.equal(true);
    expect(server.child.stderr.destroyed).to.equal(true);
  });

  it('rejects pending diagnostics when the server process exits', async () => {
    await server.connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: {},
      rootUri: null,
    });
    const result = server.nextDiagnostics().then(
      () => undefined,
      (error: unknown) => error,
    );
    server.child.kill();
    const error = await result;
    expect(error)
      .to.be.instanceOf(Error)
      .with.property('message')
      .that.matches(/exited|connection closed/);
  });

  it('rejects pending diagnostic waits when teardown runs', async () => {
    const result = server.nextDiagnostics().then(
      () => undefined,
      (error: unknown) => error,
    );
    await server.stop();
    expect(await result)
      .to.be.instanceOf(Error)
      .with.property('message', 'Test language server stopped.');
  });

  it('surfaces server validation errors instead of waiting for the diagnostic timeout', async () => {
    await server.connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      capabilities: {},
      rootUri: null,
    });
    const result = server.nextDiagnostics().then(
      () => undefined,
      (error: unknown) => error,
    );
    await server.connection.sendNotification('workspace/didChangeConfiguration', {
      settings: { bigquerySQLFormatter: { maxNumberOfProblems: -1 } },
    });
    const error = await result;
    expect(error)
      .to.be.instanceOf(Error)
      .with.property('message')
      .that.includes('maxNumberOfProblems must be a non-negative integer');
  });

  it('bounds diagnostic waits when the server sends no response', async () => {
    const result = await server.nextDiagnostics(20).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(result).to.be.instanceOf(Error).with.property('message', 'Timed out waiting for server diagnostics. ');
  });
});
