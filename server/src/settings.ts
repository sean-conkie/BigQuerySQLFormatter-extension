import { _Connection } from 'vscode-languageserver/node';

/**
 * Interface representing the settings for the server.
 */
export interface ServerSettings {
	maxNumberOfProblems: number;
}

/**
 * Default server settings.
 * 
 * @constant
 * @type {ServerSettings}
 * @property {number} maxNumberOfProblems - The maximum number of problems allowed.
 */
export const defaultSettings: ServerSettings = { maxNumberOfProblems: 1000 };

/**
 * A map that holds document settings for the server.
 * The key is a string representing the document URI.
 * The value is a Thenable that resolves to the server settings for the document.
 */
export const documentSettings: Map<string, Thenable<ServerSettings>> = new Map();


/**
 * Retrieves the document-specific settings for the given resource.
 * 
 * @param resource - The URI of the resource for which settings are being requested.
 * @param connection - The connection to the client.
 * @param globalSettings - The global settings to use if the client does not support configuration capabilities.
 * @param hasConfigurationCapability - A boolean indicating if the client supports configuration capabilities.
 * @returns A promise that resolves to the server settings for the given resource.
 */
export function getDocumentSettings(resource: string, connection: _Connection, globalSettings: ServerSettings, hasConfigurationCapability: boolean): Thenable<ServerSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'bigquerySQLFormatter'
		});
		documentSettings.set(resource, result);
	}
	return result;
}
