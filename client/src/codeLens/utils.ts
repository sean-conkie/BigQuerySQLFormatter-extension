
import { Diagnostic, DiagnosticSeverity, Position, Range } from 'vscode-languageclient';
import * as vscode from 'vscode';

/**
 * Gets the line and character position of a match index within a given content string.
 *
 * @param content - The content string to search within.
 * @param matchIndex - The index of the match within the content string.
 * @returns An object containing the line and character position of the match.
 * @throws Will throw an error if the match index is out of range.
 */
export function getPosition(content: string, matchIndex: number): Position {
	const lines = content.split('\n');
	let runningTotal = 0;
	for (let i = 0; i < lines.length; i++) {
			if (runningTotal + lines[i].length + 1 > matchIndex) {
					return { line: i, character: matchIndex - runningTotal };
			}
			runningTotal += lines[i].length + 1;
	}
	throw new Error('Match index out of range');
}

/**
 * Extracts a substring from the given text based on the specified range.
 *
 * @param text - The full text from which to extract the substring.
 * @param range - The range specifying the start and end positions for the substring.
 * @returns The substring within the specified range.
 */
export function getTextAtRange(text: string, range: Range): string {
	// Get the start and end positions of the range
	const start = range.start;
	const end = range.end;

	// Get the start and end indexes of the range
	const startIndex = start.character + (start.line > 0 ? text.split('\n').slice(0, start.line).join('\n').length + 1 : 0);
	const endIndex = end.character + (end.line > 0 ? text.split('\n').slice(0, end.line).join('\n').length + 1 : 0);

	// Get the text within the range
	return text.substring(startIndex, endIndex);
}

/**
 * Extracts the target dataset, table, and write disposition from a given SQL statement.
 *
 * @param statement - The SQL statement to extract the target information from.
 * @returns A tuple containing the dataset, table, and write disposition if the statement matches the expected pattern; otherwise, returns null.
 *
 * @example
 * ```typescript
 * const result = extractTarget("myDataset.myTable:WRITE_TRUNCATE:");
 * // result is ["myDataset", "myTable", "WRITE_TRUNCATE"]
 * ```
 */
export function extractTarget(statement: string): [string, string, string] | null {
    const regex = /(?<dataset>\w+)\.(?<table>\w+)\:(?<write_disposition>\w+)\:/i;
    const match = statement.match(regex);

    if (!match || !match.groups) { return null;}

    let { dataset, table, write_disposition } = match.groups;
    return [dataset, table, write_disposition];
}

/**
 * Extracts a range from a string representation.
 *
 * The input string should be in the format `[line:character]`.
 * If the format is incorrect or the string does not match the expected pattern,
 * the function returns `null`.
 *
 * @param rangeString - The string representation of the range.
 * @returns A `Range` object if the string matches the expected pattern, otherwise `null`.
 */
export function extractRange(rangeString: string): Range | null {
    const regex = /\[(?<line>\d+):(?<character>\d+)\]/;
    const match = rangeString.match(regex);

    if (!match || !match.groups) {
        return null;
    }

    const line = parseInt(match.groups.line, 10);
    const character = parseInt(match.groups.character, 10);

    const start: Position = { line: line - 1, character: character - 1 };
    const end: Position = { line: line - 1, character: character };

    return { start, end };
}

/**
 * Converts an error into a Diagnostic object.
 *
 * @param error - The error to convert.
 * @param documentUri - The URI of the document where the error occurred, or null if not applicable.
 * @returns A Diagnostic object representing the error.
 */
export function errorToDiagnostic(error: Error, document: vscode.TextDocument, defaultRange: Range): vscode.Diagnostic {
	const message = error.message;
	// Assuming the error provides line and character information
	const extractedRange = extractRange(message);
	const range = extractedRange != null ? extractedRange : defaultRange;
	const vscodeRange = new vscode.Range(new vscode.Position(range.start.line, range.start.character), new vscode.Position(range.end.line, range.end.character));

	const diagnostic = new vscode.Diagnostic(
		vscodeRange,
		message,
		vscode.DiagnosticSeverity.Error
	);

	diagnostic.source = 'BigQuery';
	diagnostic.relatedInformation = [{
		location: {
			uri: document.uri,
			range: vscodeRange
		},
		message: message
	}];

	return diagnostic;
}

export function createCodeLenses(document: vscode.TextDocument, callable: (range: vscode.Range, document: vscode.TextDocument, projectId: string) => Promise<any>, commandTitle: string, commandTooltip: string, commandName: string): vscode.CodeLens[] {
	const codeLenses: vscode.CodeLens[] = [];
	const statementRegex = /\w(?:.|\n)+?;/g;
	const text = document.getText();
	const commentsRegex = /^[ \t]*\--.*?$/gm;

	// remove comments from text
	const textWithoutComments = text.replace(commentsRegex, '');

	let match;
	while ((match = statementRegex.exec(textWithoutComments)) !== null) {
		const groupStartIndex: number = match.index;
		const groupEndIndex: number = statementRegex.lastIndex;

		const start: Position = getPosition(textWithoutComments, groupStartIndex);
		const end: Position = getPosition(textWithoutComments, groupEndIndex);
		const statemmentRange = {
				start: start,
				end: end
		};

		const codeLensPosition = new vscode.Position(start.line, 0);
		const codeLensRange = document.getWordRangeAtPosition(codeLensPosition, /[\w-_]/g);

		if (codeLensRange) {
			codeLenses.push(new vscode.CodeLens(
				codeLensRange,
				{
					title: commandTitle,
					tooltip: commandTooltip,
					command: commandName,
					arguments: [callable, statemmentRange, document]
				})
			);
		}
	}
	return codeLenses;
}