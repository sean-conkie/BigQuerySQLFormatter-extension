import { QueryRowsResponse } from '@google-cloud/bigquery';
import * as vscode from 'vscode';
import { castRows } from '../google/bigQuery/utils';

export function showResultsInWebview(context: vscode.ExtensionContext, results: QueryRowsResponse) {
  const panel = vscode.window.createWebviewPanel(
    'sqlResults',
    'SQL Query Results',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(context.extensionPath)],
    }
  );

  panel.webview.html = getWebviewContent(results);
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

function getWebviewContent(results: QueryRowsResponse): string {

	const metadata = results[2];
	const rows = castRows(results[0], metadata.schema.fields);
  // Get table headers from the first row's keys
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  // Generate HTML table rows
  const rowsHtml = rows
    .map((row) => {
      const cells = headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  // Generate table headers
  const headersHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>SQL Query Results</title>
      <style>
        table {
          width: 100%;
          border-collapse: collapse;
          font-family: Arial, sans-serif;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        tr:hover {background-color: #ddd;}
      </style>
    </head>
    <body>
      <table>
        <thead>
          <tr>${headersHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;
}