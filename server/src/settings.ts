

// The server settings
export interface ServerSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
export const defaultSettings: ServerSettings = { maxNumberOfProblems: 1000 };

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ServerSettings>> = new Map();
