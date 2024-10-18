import { BigQuery, Query, Job, Table, Dataset, QueryRowsResponse, JobResponse } from '@google-cloud/bigquery';
import { ApiError } from '@google-cloud/common';



export async function execute(query: Query | string, projectId: string): Promise<QueryRowsResponse | null | ApiError> {
	const bigquery = new BigQuery({ projectId });

	if (typeof query === 'string') {
		query = createQueryObject(query, projectId);
	}

	let jobResponse: JobResponse;
	try {
		jobResponse = await bigquery.createQueryJob(query);
	} catch (error) {
		return error as ApiError;
	}

	if (query.dryRun == true) {
		return null;
	}

	// destructuring assignment
	const [job, _] = jobResponse;

	const rows: QueryRowsResponse = await job.getQueryResults();

	return rows;

}

/**
 * Creates a query object for BigQuery.
 *
 * @param queryString - The SQL query string to be executed.
 * @param projectId - The Google Cloud project ID.
 * @param queryOptions - Optional parameters to customize the query.
 * @returns The constructed query object.
 */
export function createQueryObject(queryString: string, projectId: string, queryOptions: Partial<Query> = {}): Query {
    const bigquery = new BigQuery({ projectId });

    const query: Query = {
        query: queryString,
        ...queryOptions
    };

    return query;
}

/**
 * Retrieves a BigQuery table reference for the specified dataset and table IDs within a given project.
 *
 * @param datasetId - The ID of the dataset containing the table.
 * @param tableId - The ID of the table to retrieve.
 * @param projectId - The ID of the Google Cloud project containing the dataset.
 * @returns A reference to the specified BigQuery table.
 */
export function getDestination(datasetId: string, tableId: string, projectId: string): Table {
		const bigquery = new BigQuery({ projectId });

		const dataset = bigquery.dataset(datasetId);

		return dataset.table(tableId);
}