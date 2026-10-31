/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'node:path';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';

import { downloadAndUnzipVSCode, runTests, runVSCodeCommand } from '@vscode/test-electron';
import { coldStartTimeout } from './timeouts';

async function waitForWorkbench(userDataDir: string): Promise<void> {
  const port = (await readFile(path.join(userDataDir, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Cannot discover the test workbench: HTTP ${response.status}`);
  const targets: unknown = await response.json();
  if (!Array.isArray(targets)) throw new Error('The test debugger did not return a target list');
  const pages = targets.filter(
    (target: unknown): target is { webSocketDebuggerUrl: string } =>
      typeof target === 'object' &&
      target !== null &&
      'type' in target &&
      target.type === 'page' &&
      'url' in target &&
      typeof target.url === 'string' &&
      target.url.includes('/workbench') &&
      'webSocketDebuggerUrl' in target &&
      typeof target.webSocketDebuggerUrl === 'string',
  );
  if (pages.length !== 1) throw new Error(`Expected one test workbench, found ${pages.length}`);

  const socket = new WebSocket(pages[0].webSocketDebuggerUrl);
  const signal = AbortSignal.timeout(coldStartTimeout);
  try {
    await once(socket, 'open', { signal });
    const completed = once(socket, 'message', { signal });
    socket.send(
      JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: 'window.driver.whenWorkbenchRestored().then(() => true)',
          awaitPromise: true,
          returnByValue: true,
        },
      }),
    );
    const [event] = await completed;
    const result: {
      id?: number;
      error?: { message: string };
      result?: { exceptionDetails?: { text: string }; result?: { value?: boolean } };
    } = JSON.parse(String(event.data));
    if (result.id !== 1 || result.error || result.result?.exceptionDetails || result.result?.result?.value !== true) {
      throw new Error(`Workbench initialization failed: ${JSON.stringify(result)}`);
    }
  } finally {
    socket.close();
  }
}

async function main() {
  // Keep the profile path short enough for macOS IPC sockets and isolate test settings.
  const testProfile = await mkdtemp(path.join(tmpdir(), 'bqsql-'));
  const userDataDir = path.join(testProfile, 'user');
  const readiness = createServer((_request, response) => {
    waitForWorkbench(userDataDir).then(
      () => response.end('Workbench contributions ready'),
      (error: Error) => {
        console.error('Cannot initialize the test workbench', error);
        response.statusCode = 500;
        response.end(error.message);
      },
    );
  });
  try {
    await mkdir(path.join(userDataDir, 'User'), { recursive: true });
    await writeFile(
      path.join(userDataDir, 'User', 'settings.json'),
      JSON.stringify({
        'bigquerySQLFormatter.trace.server': 'messages',
        'security.workspace.trust.startupPrompt': 'never',
        ...(process.env.BQSQL_TEST_UNTRUSTED === '1' ? { 'security.workspace.trust.enabled': true } : {}),
      }),
    );
    readiness.listen(0, '127.0.0.1');
    await once(readiness, 'listening');
    const address = readiness.address();
    if (!address || typeof address === 'string') throw new Error('Cannot determine the test readiness port');
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    let extensionDevelopmentPath = path.resolve(__dirname, '../../../');
    const vsix = process.env.BQSQL_TEST_VSIX;
    const version = process.env.BQSQL_TEST_VSCODE_VERSION ?? 'stable';
    if (vsix) {
      const result = await runVSCodeCommand(
        [
          '--install-extension',
          path.resolve(vsix),
          '--user-data-dir',
          path.join(testProfile, 'user'),
          '--extensions-dir',
          path.join(testProfile, 'extensions'),
        ],
        { version },
      );
      console.log(result.stdout);
      const installed = (await readdir(path.join(testProfile, 'extensions'))).filter((name) =>
        name.startsWith('sean-conkie.bigquerysqlformatter-'),
      );
      if (installed.length !== 1) {
        throw new Error(`Expected one installed BigQuery SQL Formatter extension, found ${installed.length}`);
      }
      extensionDevelopmentPath = path.join(testProfile, 'extensions', installed[0]);
    }

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './index');

    // Download VS Code, unzip it and run the integration test
    const options = {
      version,
      extensionDevelopmentPath,
      extensionTestsPath,
      extensionTestsEnv: {
        BQSQL_TEST_WORKBENCH_URL: `http://127.0.0.1:${address.port}`,
        BQSQL_TEST_UNTRUSTED: process.env.BQSQL_TEST_UNTRUSTED ?? '0',
      },
      launchArgs: [
        path.resolve(__dirname, '../../testFixture'),
        '--disable-extensions',
        ...(process.env.BQSQL_TEST_UNTRUSTED === '1' ? [] : ['--disable-workspace-trust']),
        '--enable-smoke-test-driver',
        '--remote-debugging-port=0',
        '--remote-debugging-address=127.0.0.1',
        '--log=trace',
        `--user-data-dir=${path.join(testProfile, 'user')}`,
        `--extensions-dir=${path.join(testProfile, 'extensions')}`,
      ],
    };
    if (process.env.BQSQL_TEST_UNTRUSTED === '1') {
      // runTests always adds --disable-workspace-trust, so launch this case directly.
      const executable = await downloadAndUnzipVSCode({ version });
      const child = spawn(
        executable,
        [
          ...options.launchArgs,
          '--no-sandbox',
          '--disable-gpu-sandbox',
          '--disable-updates',
          '--skip-welcome',
          '--skip-release-notes',
          '--no-cached-data',
          `--extensionDevelopmentPath=${extensionDevelopmentPath}`,
          `--extensionTestsPath=${extensionTestsPath}`,
        ],
        { env: { ...process.env, ...options.extensionTestsEnv }, stdio: 'inherit' },
      );
      const [code, signal] = await once(child, 'exit');
      if (code !== 0) throw new Error(`Untrusted extension-host tests exited with ${code ?? signal}`);
    } else {
      await runTests(options);
    }
  } catch (error) {
    const logs = path.join(testProfile, 'user', 'logs');
    if (existsSync(logs)) {
      const retainedLogs = path.join(
        path.resolve(process.env.BQSQL_TEST_LOG_DIR ?? '.vscode-test/logs'),
        path.basename(testProfile),
      );
      await cp(logs, retainedLogs, { recursive: true });
      console.error(`Full VS Code and language server logs retained at ${retainedLogs}`);
      for (const file of await readdir(logs, { recursive: true })) {
        if (!file.endsWith('.log')) continue;
        const lines = (await readFile(path.join(logs, file), 'utf8'))
          .split('\n')
          .filter((line) => /save|format|cancel|error/i.test(line))
          .slice(-80);
        if (lines.length > 0) console.error(`VS Code log ${file}:\n${lines.join('\n')}`);
      }
    }
    throw error;
  } finally {
    await new Promise<void>((resolve, reject) => readiness.close((error) => (error ? reject(error) : resolve())));
    await rm(testProfile, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
}

main().catch((err) => {
  console.error('Failed to run tests', err);
  process.exitCode = 1;
});
