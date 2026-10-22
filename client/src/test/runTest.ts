/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

import { runTests } from '@vscode/test-electron';

async function main() {
	// Keep the profile path short enough for macOS IPC sockets and isolate test settings.
	const testProfile = await mkdtemp(path.join(tmpdir(), 'bqsql-'));
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './index');

		// Download VS Code, unzip it and run the integration test
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [
				'--disable-extensions',
				`--user-data-dir=${path.join(testProfile, 'user')}`,
				`--extensions-dir=${path.join(testProfile, 'extensions')}`
			]
		});
	} finally {
		await rm(testProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
	}
}

main().catch(err => {
	console.error('Failed to run tests', err);
	process.exitCode = 1;
});
