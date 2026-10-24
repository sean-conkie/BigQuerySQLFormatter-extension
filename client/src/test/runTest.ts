/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'node:path';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { runTests, runVSCodeCommand } from '@vscode/test-electron';

async function main() {
  // Keep the profile path short enough for macOS IPC sockets and isolate test settings.
  const testProfile = await mkdtemp(path.join(tmpdir(), 'bqsql-'));
  try {
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
    await runTests({
      version,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        path.resolve(__dirname, '../../testFixture'),
        '--disable-extensions',
        '--disable-workspace-trust',
        '--log=trace',
        `--user-data-dir=${path.join(testProfile, 'user')}`,
        `--extensions-dir=${path.join(testProfile, 'extensions')}`,
      ],
    });
  } catch (error) {
    const logs = path.join(testProfile, 'user', 'logs');
    if (existsSync(logs)) {
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
