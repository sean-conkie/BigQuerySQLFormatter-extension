import { expect } from 'chai';
import { spawn } from 'child_process';
import * as path from 'path';
import {
	createProtocolConnection, StreamMessageReader, StreamMessageWriter,
	InitializeRequest, DidOpenTextDocumentNotification, DidCloseTextDocumentNotification,
	PublishDiagnosticsNotification, PublishDiagnosticsParams
} from 'vscode-languageserver/node';

describe('Language server lifecycle', () => {
	it('does not publish stale diagnostics after close and can reopen the URI', async () => {
		const child = spawn(process.execPath, [path.join(__dirname, '../server.js'), '--stdio']);
		const connection = createProtocolConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
		const published: PublishDiagnosticsParams[] = [];
		connection.onNotification(PublishDiagnosticsNotification.type, params => published.push(params));
		connection.listen();
		try {
			await connection.sendRequest(InitializeRequest.type, { processId: process.pid, capabilities: {}, rootUri: null });
			const document = { uri: 'file:///lifecycle.sql', languageId: 'googlesql', version: 1, text: '\nselect col\nfrom dataset.table' };
			await connection.sendNotification(DidOpenTextDocumentNotification.type, { textDocument: document });
			await connection.sendNotification(DidCloseTextDocumentNotification.type, { textDocument: { uri: document.uri } });
			// A request is processed after the preceding notifications, without waiting for async validation.
			await connection.sendRequest('textDocument/hover', { textDocument: { uri: document.uri }, position: { line: 0, character: 0 } });
			await new Promise(resolve => setTimeout(resolve, 200));
			expect(published).to.deep.equal([{ uri: document.uri, diagnostics: [] }]);
			const reopened = new Promise<PublishDiagnosticsParams>(resolve => {
				connection.onNotification(PublishDiagnosticsNotification.type, resolve);
			});
			await connection.sendNotification(DidOpenTextDocumentNotification.type, { textDocument: { ...document, version: 2 } });
			expect((await reopened).diagnostics).not.to.be.empty;
		} finally {
			connection.dispose();
			child.kill();
		}
	});
});
