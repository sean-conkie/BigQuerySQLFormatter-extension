import { CompletionItem, CompletionItemKind, InsertTextFormat, InsertTextMode } from 'vscode-languageserver/node';

export const federatedQueryFunctions: CompletionItem[] = [{
  label: 'external_query',
  labelDetails: { detail: undefined, description: undefined },
  kind: CompletionItemKind.Function,
  tags: undefined,
  detail: '(connection_id, external_database_query[, options]) -> TABLE',
  documentation: {
    kind: 'markdown',
    value: "```sql\nexternal_query('connection_id', '''external_database_query'''[, 'options'])\n```\n\nExecutes a query on an external database and returns the results as a temporary table. The external database data type is converted to a [GoogleSQL data type](https://cloud.google.com/bigquery/docs/reference/standard-sql/data-types#data-types) in the temporary result table with [these data type mappings](#data_type_mappings).\n\n**Parameters:**\n- `external_database_query`: The query to run on the external database.\n- `connection_id`: The ID of the [connection resource](https://cloud.google.com/bigquery/docs/cloud-sql-federated-queries#setting_up_database_connections). If you do not have a default project configured, prepend the project ID to the connection ID in the following format: `projects/PROJECT_ID/locations/LOCATION/connections/CONNECTION_ID`.\n- `options`: An optional string in JSON format with key-value pairs of option name and value.\n\n**Return Data Type:** BigQuery table\n\n**Caution:** If you have a view shared across multiple projects using `external_query`, always use the fully qualified connection ID.\n\n**Example:**\n```sql\nSELECT ...\nFROM EXTERNAL_QUERY('connection_id', '''SELECT customer_id, MIN(order_date) AS first_order_date FROM orders GROUP BY customer_id''')\n```\n"
  },
  insertText: "external_query('${1:connection_id}', '''${2:external_database_query}'''[, '${3:options}'])$0",
  insertTextFormat: InsertTextFormat.Snippet,
  insertTextMode: InsertTextMode.adjustIndentation,
  textEditText: "external_query('connection_id', '''external_database_query'''[, 'options'])"
}];