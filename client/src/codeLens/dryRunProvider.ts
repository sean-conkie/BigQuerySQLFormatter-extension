import * as vscode from 'vscode';
import { createCodeLenses, errorToDiagnostic, extractTarget, getTextAtRange } from './utils';
import { createQueryObject, execute, getDestination } from '../google/bigQuery';
import { ApiError } from '@google-cloud/common';
import { Table } from '@google-cloud/bigquery';

/**
 * DryRunProvider
 */
export class DryRunProvider implements vscode.CodeLensProvider {

	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
	private readonly commandTitle: string = "🧪 Dry run";
	private readonly commandTooltip: string = "Dry run statement in selected project";
	private readonly commandName: string = "bigquerysqlformatter.dryRunStatementAction";

	constructor() {

		vscode.workspace.onDidChangeConfiguration((_) => {
			this._onDidChangeCodeLenses.fire();
		});
	}

	public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {

		if (vscode.workspace.getConfiguration("bigquerysqlformatter").get("dryRunStatement", true)) {
			return createCodeLenses(document, DryRunProvider.dryRunStatementAction, this.commandTitle, this.commandTooltip, this.commandName);
		}
		return [];
	}

	public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken) {
		if (vscode.workspace.getConfiguration("bigquerysqlformatter").get("dryRunStatement", true)) {
			return codeLens;
		}
		return null;
	}


	public static async dryRunStatementAction(range: vscode.Range, document: vscode.TextDocument, projectId: string): Promise<[vscode.Diagnostic[], null]> {
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

			if (['UPDATE', 'DELETE'].includes(writeDisposition)) { 
				writeDisposition = null;
				dataset = null;
				table = null;
			} else {
				destination = getDestination(dataset, table, projectId);
			}
		}

		const queryOptions = createQueryObject(statement, projectId, { dryRun: true, useLegacySql: false, destination: destination, writeDisposition: writeDisposition });
		const result = await execute(queryOptions, projectId);
		
		if (result instanceof ApiError) {
			// Convert the error to a VS Code Diagnostic
			result.errors.map((error) => errors.push(errorToDiagnostic(result, document, range)));
		} else if (result === null) {
				// Handle the dry run case
			vscode.window.showInformationMessage(`Dry run successful.`);
		}
		return [errors, null];
	}
}
