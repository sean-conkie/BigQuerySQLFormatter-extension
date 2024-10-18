import { QueryRowsResponse } from '@google-cloud/bigquery';
import * as vscode from 'vscode';
import { castRows } from '../google/bigQuery/utils';
import { DataGridPanel } from './DataGridPanel';

export function showResultsInWebview(context: vscode.ExtensionContext, results: QueryRowsResponse) {
  DataGridPanel.render(context.extensionUri, getRowData(results));
}

function escapeHtml(unsafe: any): string {
	if (typeof unsafe !== 'string') {
		return unsafe;
	}

  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getRowData(results: QueryRowsResponse): any[] {

	const metadata = results[2];
	return castRows(results[0], metadata.schema.fields);
}