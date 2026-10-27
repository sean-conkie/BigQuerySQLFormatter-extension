const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { mkdir, readFile, writeFile, rm } = require('node:fs/promises');
const path = require('node:path');
const { reference, reservedKeywords, grammarKeywords, keywordCatalog, generate } = require('./generate-keywords.cjs');
const catalog = require('../server/src/linter/keywords.json');
const grammar = require('../server/src/linter/syntaxes/googlesql.tmLanguage.json');
const fixturePath = path.join(__dirname, 'fixtures/reserved-keywords.html');
const fixture = () => readFile(fixturePath, 'utf8');

test('committed reserved keywords match the full documented table fixture', async () => {
  const documented = reservedKeywords(await fixture());
  assert.equal(documented.length, 97);
  assert.deepEqual(catalog.reserved, documented);
  for (const word of ['assert_rows_modified', 'contains', 'graph_table', 'lookup', 'within']) {
    assert.ok(documented.includes(word), word);
  }
});

test('extracts only the reserved table, including line breaks and inline markup', async () => {
  const html = await fixture();
  const decorated = html.replace(/ALL\s*<br\s*\/?>/, '<code>ALL</code><br />')
    .replace('<table>', '<div><table>').replace('</table>', '</table></div>');
  const unrelated = '<table><tr><td>NOT_A_KEYWORD</td></tr></table>';
  assert.deepEqual(reservedKeywords(unrelated + decorated + unrelated), catalog.reserved);
  assert.deepEqual(reservedKeywords(html.replace(/<br\s*\/?>/g, '&nbsp;')), catalog.reserved);
});

test('fails explicitly when the reference section or complete table cannot be extracted', async () => {
  const html = await fixture();
  for (const [input, message] of [
    ['', /Missing reserved_keywords/],
    [html.replace('id="reserved_keywords"', 'id="changed"'), /Missing reserved_keywords/],
    ['<h2 id="reserved_keywords">Reserved</h2><p>No table</p>', /Expected one/],
    [html.replace(/ALL\s*<br\s*\/?>/, 'invalid<br>'), /Invalid or incomplete/],
    [html.replace(/ALL\s*<br\s*\/?>/, 'ALL<br>ALL<br>'), /Invalid or incomplete/],
    ['<h2 id="reserved_keywords">Reserved</h2><table><td>SELECT</td></table>', /Invalid or incomplete/],
    [html.replace('<table>', '<table></table><table>'), /Expected one/],
  ]) {
    assert.throws(() => reservedKeywords(input), message);
  }
});

test('committed keyword data is deterministic, sorted, disjoint and synchronized with grammar', async () => {
  assert.deepEqual(catalog, keywordCatalog(await fixture(), grammar));
  for (const words of Object.values(catalog)) {
    assert.deepEqual(words, [...new Set(words)].sort());
    assert.ok(words.every((word) => /^[a-z][a-z_]*$/.test(word)));
  }
  assert.ok(catalog.nonReserved.every((word) => !catalog.reserved.includes(word)));
  for (const word of ['aggregate', 'acyclic', 'match_recognize', 'microsecond', 'millisecond', 'pivot', 'unpivot']) {
    assert.ok(catalog.nonReserved.includes(word), word);
  }
  for (const word of ['abs', 'int64', 'w', 's', 'alpha', 'functionif']) {
    assert.ok(!catalog.nonReserved.includes(word), word);
  }
  assert.ok(!catalog.nonReserved.includes('select'));
});

test('extracts scoped words, phrase components and nested literal alternatives only', () => {
  const sample = {
    patterns: [
      { match: '(?i)\\b(function(?:\\s*if\\s+not)?|(?:(?:micro|milli)?second)|custom)\\b', name: 'keyword.statement.sql' },
      {
        match: '(?i)(from)\\s+([a-z_]+)(?=\\s+unrelated)',
        captures: { 1: { name: 'keyword.from.sql' }, 2: { name: 'entity.name.sql' } },
      },
      { begin: '(?i)(begin)', end: '(?i)(end)', beginCaptures: { 1: { name: 'keyword.begin.sql' } }, endCaptures: { 1: { name: 'keyword.end.sql' } } },
      { match: '\\*|\\+', name: 'keyword.operator.sql' },
      { match: 'NOT_A_KEYWORD', name: 'support.function.builtin.sql' },
      { match: 'NOT_A_TYPE_KEYWORD', name: 'storage.type.sql' },
    ],
    repository: { extra: { patterns: [{ match: '(?i)\\b(order\\s+by)\\b', captures: { 1: { name: 'keyword.order.sql' } } }] } },
  };
  assert.deepEqual(grammarKeywords(sample), [
    'begin', 'by', 'custom', 'end', 'from', 'function', 'if', 'microsecond', 'millisecond', 'not', 'order', 'second',
  ]);
});

test('rejects missing scopes, malformed captures and unsupported grammar extraction', () => {
  assert.throws(() => grammarKeywords({ patterns: [] }), /No grammar keyword/);
  assert.throws(() => grammarKeywords({ patterns: [{ match: '(select)', captures: { 2: { name: 'keyword.sql' } } }] }), /Missing keyword capture/);
  for (const match of ['(?unknown)', '(select', '[select', 'select)', 'a{99}', 'a{1,}', 'a\\', '\\Qselect\\E']) {
    assert.throws(() => grammarKeywords({ patterns: [{ match, name: 'keyword.sql' }] }), /keyword regex/);
  }
  assert.throws(() => grammarKeywords({ patterns: [{ captures: { 1: { name: 'keyword.sql' } } }] }), /Missing match/);
});

async function outputDirectory(t) {
  const directory = path.join(__dirname, `.keyword-generator-test-${process.pid}-${randomUUID()}`);
  t.after(() => rm(directory, { recursive: true, force: true }));
  const grammarPath = path.join(directory, 'server/src/linter/syntaxes/googlesql.tmLanguage.json');
  const catalogPath = path.join(directory, 'server/src/linter/keywords.json');
  await mkdir(path.dirname(grammarPath), { recursive: true });
  await writeFile(grammarPath, `${JSON.stringify(grammar, null, 2)}\n`);
  await writeFile(catalogPath, 'unchanged\n');
  return { directory, grammarPath, catalogPath };
}

test('generates identical data offline without changing the grammar', async (t) => {
  const { directory, grammarPath, catalogPath } = await outputDirectory(t);
  const html = await fixture();
  const requests = [];
  const fetchPage = async (url) => {
    requests.push(url);
    return html;
  };
  const originalGrammar = await readFile(grammarPath, 'utf8');
  await generate(fetchPage, directory);
  const first = await readFile(catalogPath, 'utf8');
  assert.equal(first, `${JSON.stringify(catalog, null, 2)}\n`);
  await generate(fetchPage, directory);
  assert.equal(await readFile(catalogPath, 'utf8'), first);
  assert.equal(await readFile(grammarPath, 'utf8'), originalGrammar);
  assert.deepEqual(requests, [reference, reference]);
});

test('leaves committed output untouched when reference, grammar or download fails', async (t) => {
  const { directory, grammarPath, catalogPath } = await outputDirectory(t);
  const html = await fixture();
  await assert.rejects(generate(async () => '', directory), /Missing reserved_keywords/);
  await assert.rejects(generate(async () => { throw new Error('Download failed'); }, directory), /Download failed/);
  await writeFile(grammarPath, '{"patterns":[]}');
  await assert.rejects(generate(async () => html, directory), /No grammar keyword/);
  await writeFile(grammarPath, 'invalid json');
  await assert.rejects(generate(async () => html, directory), SyntaxError);
  assert.equal(await readFile(catalogPath, 'utf8'), 'unchanged\n');
});

test('default HTTP loader uses only the official reference and fails before writing on HTTP errors', async (t) => {
  const { directory, catalogPath } = await outputDirectory(t);
  const html = await fixture();
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push(url);
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, text: async () => html };
  });
  await generate(undefined, directory);
  assert.deepEqual(requests, [reference]);
  const generated = await readFile(catalogPath, 'utf8');
  assert.deepEqual(JSON.parse(generated), catalog);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  await assert.rejects(generate(undefined, directory), /HTTP 503/);
  assert.equal(await readFile(catalogPath, 'utf8'), generated);
});
