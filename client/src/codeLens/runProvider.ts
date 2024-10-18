import * as vscode from 'vscode';
import { createCodeLenses, errorToDiagnostic, extractTarget, getPosition, getTextAtRange } from './utils';
import { Diagnostic, Position } from 'vscode-languageclient';
import { createQueryObject, execute, getDestination } from '../google/bigQuery';
import { ApiError } from '@google-cloud/common';
import { Table } from '@google-cloud/bigquery';

/**
 * RunProvider
 */
export class RunProvider implements vscode.CodeLensProvider {

	private codeLenses: vscode.CodeLens[] = [];
	private regex: RegExp;
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
	private readonly commandTitle: string = "▶️ Run";
	private readonly commandTooltip: string = "Run statement in selected project";
	private readonly commandName: string = "bigquerysqlformatter.runStatementAction";

	constructor() {
		this.regex = /\w(?:.|\n)+?;/g;

		vscode.workspace.onDidChangeConfiguration((_) => {
			this._onDidChangeCodeLenses.fire();
		});
	}

	public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {

		if (vscode.workspace.getConfiguration("bigquerysqlformatter").get("runStatement", true)) {
			return createCodeLenses(document, RunProvider.runStatementAction, this.commandTitle, this.commandTooltip, this.commandName);
		}
		return [];
	}

	public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
		if (vscode.workspace.getConfiguration("bigquerysqlformatter").get("runStatement", true)) {
			return codeLens;
		}
		return null;
	}

	public static async runStatementAction(range: vscode.Range, document: vscode.TextDocument, projectId: string): Promise<vscode.Diagnostic[]> {
		vscode.workspace.getConfiguration("bigquerysqlformatter").update("dryRunStatement", false, true);
		const errors: vscode.Diagnostic[] = [];
		let statement = getTextAtRange(document.getText(), range)

		// extract target and write disposition from the statement
		const target = extractTarget(statement);
		let dataset: string;
		let table: string;
		let writeDisposition: string | null = null;
		let destination: Table | null = null;
		if (target) {
			[dataset, table, writeDisposition] = target;
			statement = statement.replace(`${dataset}.${table}:${writeDisposition}:`, '');
			destination = getDestination(dataset, table, projectId);
		}

		const queryOptions = createQueryObject(statement, projectId, { useLegacySql: false, destination: destination, writeDisposition: writeDisposition });
		const result = await execute(queryOptions, projectId);
		
		if (result instanceof ApiError) {
			// Convert the error to a VS Code Diagnostic
			result.errors.map((error) => errors.push(errorToDiagnostic(result, document, range)));
		} else if (result === null) {
				// Handle the dry run case
			vscode.window.showInformationMessage(`Dry run successful.`);
		}

		vscode.workspace.getConfiguration("bigquerysqlformatter").update("dryRunStatement", true, true);
		return errors;
	}
}
