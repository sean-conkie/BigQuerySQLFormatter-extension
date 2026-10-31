/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as path from 'node:path';
import { readdir } from 'node:fs/promises';
import Mocha from 'mocha';
import { coldStartTimeout, testTimeout } from './timeouts';
import { warmUp } from './helper';

export async function run(): Promise<void> {
  const readinessUrl = process.env.BQSQL_TEST_WORKBENCH_URL;
  if (!readinessUrl) throw new Error('The test runner did not provide a workbench readiness URL');
  const ready = await fetch(readinessUrl, { signal: AbortSignal.timeout(coldStartTimeout + 5000) });
  if (!ready.ok) throw new Error(`Test workbench is not ready: ${await ready.text()}`);

  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  });
  mocha.timeout(testTimeout);
  mocha.suite.beforeAll('Warm up the language server and first validation', warmUp);

  const testsRoot = __dirname;
  const files = (await readdir(testsRoot)).filter((file) => file.endsWith('.test.js'));
  if (files.length === 0) {
    throw new Error(`No integration tests found in ${testsRoot}`);
  }
  files.forEach((file) => {
    mocha.addFile(path.resolve(testsRoot, file));
  });

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
      } else {
        resolve();
      }
    });
  });
}
