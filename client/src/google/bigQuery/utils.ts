import bigquery from '@google-cloud/bigquery/build/src/types';

type Row = {
	[key: string]: any;
}

export function castRows(rows: any[], schema: bigquery.ITableFieldSchema[]): Row[] {
	// loop schema and cast each column
	schema.map((field) => {

		if (field.mode === 'REPEATED') {

		} else if (['TIMESTAMP', 'TIME'].includes(field.type)) {
			rows.map((row) => {
				row[field.name] = row[field.name] != null ? row[field.name].value : null;
			})
		} else if (['RECORD'].includes(field.type)) {
			const subRow = rows.map((row) => {
				const r = row[field.name];
				Object.keys(r).map((key) => {
					r[`${field.name}.${key}`] = r[key];
					delete r[key];
				});

				return r;
			});
			const fieldSchema = field.fields.map((f) => {f.name = `${field.name}.${f.name}`; return f;})
			const convertedRow = castRows(subRow, fieldSchema);
			
			// zip converted and original rows, remove original field and replace with converted fields
			rows.map((row, index) => {
				const converted = convertedRow[index];
				Object.keys(converted).map((key) => {
					row[key] = converted[key];
				})
				delete row[field.name];
			})

		}
	})

	return rows;
}
