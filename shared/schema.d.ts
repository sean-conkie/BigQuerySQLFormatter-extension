export interface SchemaRequest {
  resource: string;
  project?: string;
  dataset?: string;
  table?: string;
  contextOnly?: boolean;
}

export interface SchemaField {
  name: string;
  type: string;
  mode: string;
  description?: string;
  fields?: SchemaField[];
}

export interface SchemaEntry {
  name: string;
  type?: string;
  location?: string;
  description?: string;
  fields?: SchemaField[];
  numRows?: string;
  numBytes?: string;
  lastModifiedTime?: string;
  partitioning?: string;
  clustering?: string[];
}

export interface SchemaResponse {
  unavailable?: boolean;
  pending?: boolean;
  defaultDataset?: string;
  projectId?: string;
  entries: SchemaEntry[];
}
