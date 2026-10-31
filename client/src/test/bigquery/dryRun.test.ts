import assert from 'node:assert/strict';
import { dryRunResult, errorOffsets, queryFeatures, type SqlToken } from '../../bigquery/dryRun';
import { parseBigQuerySettings } from '../../bigquery/settings';

function tokens(values: string[]): SqlToken[] {
  let offset = 0;
  return values.map((value) => {
    const start = offset;
    offset += value.length;
    return {
      value,
      literal: false,
      range: { start: { line: 0, character: start }, end: { line: 0, character: offset } },
    };
  });
}

describe('BigQuery dry-run results and settings', () => {
  it('detects named/positional parameters but excludes system variables and literal contents', () => {
    assert.equal(queryFeatures(tokens(['@', 'name'])).assumedNull, true);
    assert.equal(queryFeatures(tokens(['?'])).assumedNull, true);
    assert.equal(queryFeatures(tokens(['@', '@', 'project_id'])).assumedNull, false);
    assert.equal(queryFeatures(tokens(['@', 'name']), { name: { type: 'STRING', value: 'x' } }).assumedNull, false);
    const literal = tokens(['@name'])[0];
    literal.literal = true;
    assert.deepEqual(queryFeatures([literal]), { assumedNull: false, templated: false });
    for (const values of [
      ['{', '{'],
      ['{', '%'],
      ['$', '{'],
      ['config', '{'],
      ['js', '{'],
    ])
      assert.equal(queryFeatures(tokens(values)).templated, true);
  });

  it('requires a scalar type and explicit value, accepting falsy and NULL values', () => {
    for (const value of [
      { name: { type: 'STRING' } },
      { name: { value: 'x' } },
      { name: { type: 'ARRAY', value: [] } },
      [],
    ])
      assert.throws(
        () => parseBigQuerySettings((key) => (key === 'dryRun.parameters' ? value : undefined)),
        /parameters/,
      );
    for (const value of ['', false, 0, null]) {
      const settings = parseBigQuerySettings((key) =>
        key === 'dryRun.parameters' ? { name: { type: 'string', value } } : undefined,
      );
      assert.deepEqual(settings.dryRun.parameters, { name: { type: 'STRING', value } });
    }
  });

  it('shows exact byte/cost estimates, script limits, parameter notes and normalized referenced tables', () => {
    const result = dryRunResult(
      {
        statistics: {
          totalBytesProcessed: String(2 ** 40),
          query: {
            statementType: 'SCRIPT',
            referencedTables: [{ projectId: 'p', datasetId: 'd', tableId: 't@1234' }],
          },
        },
      },
      true,
      5,
    );
    assert.match(result.label, /≈ 1.10 TB processed; estimated cost 5.00/);
    assert.match(result.label, /script; statements inside IF\/LOOP\/BEGIN blocks aren't estimated/);
    assert.match(result.label, /parameters assumed NULL; estimate may be low/);
    assert.deepEqual(result.tables, ['p.d.t']);
    assert.equal(dryRunResult({ statistics: { query: { totalBytesProcessed: '0' } } }, false).label, '≈ 0 B processed');
    for (const bytes of [undefined, '-1', 'NaN', 12])
      assert.throws(() => dryRunResult({ statistics: { totalBytesProcessed: bytes } }, false), /invalid bytes/);
  });

  it('maps positions across scripts, CRLF and Unicode, clamps invalid positions and locates table paths', () => {
    const query = '-- comment\r\nSELECT "😀", nope;\r\nSELECT 2';
    assert.deepEqual(errorOffsets(query, 'Unrecognized at [2:13]', []), [
      query.indexOf('nope'),
      query.indexOf('nope') + 1,
    ]);
    assert.deepEqual(errorOffsets(query, 'at [3:1]', []), [
      query.lastIndexOf('SELECT'),
      query.lastIndexOf('SELECT') + 1,
    ]);
    assert.deepEqual(errorOffsets('SELECT 1', 'at [99:999]', []), [8, 8]);
    const tableQuery = 'SELECT * FROM `project.dataset.table`';
    assert.deepEqual(errorOffsets(tableQuery, 'Not found: Table project:dataset.table', []), [15, 36]);
    const first = tokens(['SELECT'])[0];
    first.range.start.line = 1;
    assert.deepEqual(errorOffsets(query, 'No position', [first]), [12, 30]);
  });
});
