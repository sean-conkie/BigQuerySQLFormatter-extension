const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtemp, mkdir, readFile, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { discoverFunctions, readFunction, functionPatterns, generate } = require('./generate-completions.cjs');
const functions = require('../server/src/completions/functions.json');
const grammar = require('../server/src/linter/syntaxes/googlesql.tmLanguage.json');

test('discovers sorted, unique functions, including AI/ML navigation entries', () => {
  const row = (name, description) => `<tr><td><a href="math#abs"><code>${name}</code></a></td><td>${description}</td></tr>`;
  const html = `<table>${row('ABS', 'Absolute <code>value</code>.')}${row('ABS', 'Duplicate.')}</table>
    <li class="devsite-nav-item"><a href="ai"><span class="devsite-nav-text">AI.GENERATE</span></a></li>
    <li class="devsite-nav-item"><a href="ml"><span class="devsite-nav-text">ML.PREDICT</span></a></li>`;
  const entries = discoverFunctions(html);
  assert.deepEqual(entries.map(({ name }) => name), ['ABS', 'AI.GENERATE', 'ML.PREDICT']);
  assert.equal(entries[0].description, 'Absolute value.');
  assert.deepEqual(discoverFunctions(html), entries);
});

test('reads syntax rather than examples and decodes HTML entities', () => {
  const entry = { name: 'AI.GENERATE', url: 'https://docs.cloud.google.com/ai' };
  const html = `<div class="devsite-article-body"><p></p><p>AI.GENERATE returns a &lt;value&gt;.</p>
    <pre>SELECT example;</pre><h2>Syntax for models</h2>
    <devsite-code><pre><code>AI.GENERATE(
      <span>prompt</span> =&gt; 'text'
    )</code></pre></devsite-code><h2>Examples</h2><pre>SELECT other;</pre></div>`;
  assert.deepEqual(readFunction(entry, html), {
    name: 'ai.generate',
    signature: "AI.GENERATE( prompt => 'text' )",
    description: 'AI.GENERATE returns a <value>.',
    url: entry.url,
  });
});

test('reads the linked function section rather than the first function', () => {
  const entry = { name: 'ARRAY_LAST', description: 'Last array item.', url: 'https://docs.cloud.google.com/array#array_last' };
  const html = `<div class="devsite-article-body"><h2 id="array_first">ARRAY_FIRST</h2><pre>ARRAY_FIRST(array)</pre>
    <h2 id="array_last">ARRAY_LAST</h2><pre>ARRAY_LAST(array)</pre></div>`;
  assert.equal(readFunction(entry, html).signature, 'ARRAY_LAST(array)');
});

test('fails explicitly when upstream reference markup or data is missing', () => {
  assert.throws(() => discoverFunctions('<html></html>'), /No functions/);
  assert.throws(() => discoverFunctions('<table><tr><td><a href="math#abs"><code>ABS</code></a></td><td>Absolute value.</td></tr></table>'), /Missing AI/);
  const entry = { name: 'ABS', description: 'Absolute value.', url: 'https://docs.cloud.google.com/math#abs' };
  assert.throws(() => readFunction(entry, ''), /Missing reference article/);
  assert.throws(() => readFunction(entry, '<div class="devsite-article-body"></div>'), /Missing syntax section/);
  assert.throws(() => readFunction(entry, '<div class="devsite-article-body"><h2 id="abs">ABS</h2></div>'), /Missing signature/);
  assert.throws(() => discoverFunctions('<table><tr><td><a href="math#abs"><code>ABS</code></a></td><td></td></tr></table>'), /Missing description/);
  assert.throws(() => discoverFunctions('<li class="devsite-nav-item"><a href="https://example.com/ai"><span class="devsite-nav-text">AI.GENERATE</span></a></li>'), /Unexpected function reference URL/);
  assert.throws(() => discoverFunctions('<li class="devsite-nav-item"><a href="ai"><span class="devsite-nav-text">AI.GENERATE</span></a></li>'), /Missing ML/);
});

test('committed catalog is sorted, unique, complete and synchronized with grammar', () => {
  const names = functions.map(({ name }) => name);
  assert.deepEqual(names, [...new Set(names)].sort());
  for (const entry of functions) {
    assert.ok(entry.signature.includes('('), entry.name);
    assert.ok(entry.description.length > 0, entry.name);
    assert.ok(entry.url.startsWith('https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/'), entry.name);
  }
  assert.deepEqual(grammar.repository.generatedFunctions.patterns, functionPatterns(functions, grammar.repository.functions.patterns));
});

const reference = 'https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/';
const indexHtml = `<table>
  <tr><td><a href="math#abs"><code>ABS</code></a></td><td>Absolute value.</td></tr>
  <tr><td><a href="math#acos"><code>ACOS</code></a></td><td>Inverse cosine.</td></tr>
  <tr><td><a href="array#array_first"><code>ARRAY_FIRST</code></a></td><td>First item.</td></tr>
  </table>
  <li class="devsite-nav-item"><a href="ai"><span class="devsite-nav-text">AI.GENERATE</span></a></li>
  <li class="devsite-nav-item"><a href="forecast"><span class="devsite-nav-text">AI.FORECAST</span></a></li>
  <li class="devsite-nav-item"><a href="ml"><span class="devsite-nav-text">ML.PREDICT</span></a></li>`;
const article = (name) => `<div class="devsite-article-body"><p>${name} returns a value.</p>
  <h2 id="syntax">Syntax</h2><pre>${name}(value)</pre></div>`;
const pages = new Map([
  [`${reference}functions-all?hl=en`, indexHtml],
  [`${reference}math?hl=en`, `<div class="devsite-article-body">
    <h2 id="abs">ABS</h2><pre>ABS(value)</pre><h2 id="acos">ACOS</h2><pre>ACOS(value)</pre></div>`],
  [`${reference}array?hl=en`, '<div class="devsite-article-body"><h2 id="array_first">ARRAY_FIRST</h2><pre>ARRAY_FIRST(value)</pre></div>'],
  [`${reference}ai?hl=en`, article('AI.GENERATE')],
  [`${reference}forecast?hl=en`, article('AI.FORECAST')],
  [`${reference}ml?hl=en`, article('ML.PREDICT')],
]);

async function outputDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'bqsql-generator-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const grammarPath = path.join(directory, 'server/src/linter/syntaxes/googlesql.tmLanguage.json');
  const catalogPath = path.join(directory, 'server/src/completions/functions.json');
  await mkdir(path.dirname(grammarPath), { recursive: true });
  await mkdir(path.dirname(catalogPath), { recursive: true });
  const grammarText = await readFile(path.join(__dirname, '../server/src/linter/syntaxes/googlesql.tmLanguage.json'), 'utf8');
  await writeFile(grammarPath, grammarText);
  await writeFile(catalogPath, 'unchanged\n');
  return { directory, grammarPath, catalogPath, grammarText };
}

function fixturePage(url) {
  assert.ok(pages.has(url), `Unexpected documentation request: ${url}`);
  return pages.get(url);
}

test('generates both outputs deterministically, deduplicates pages and preserves existing grammar', async (t) => {
  const { directory, grammarPath, catalogPath, grammarText } = await outputDirectory(t);
  const requests = [];
  const fetchPage = async (url) => {
    requests.push(url);
    return fixturePage(url);
  };
  await generate(fetchPage, directory);
  assert.deepEqual([...requests].sort(), [...pages.keys()].sort());
  const catalogText = await readFile(catalogPath, 'utf8');
  const generated = JSON.parse(catalogText);
  assert.deepEqual(generated.map(({ name }) => name), ['abs', 'acos', 'ai.forecast', 'ai.generate', 'array_first', 'ml.predict']);
  assert.equal(generated[0].signature, 'ABS(value)');
  assert.equal(generated[0].description, 'Absolute value.');
  assert.equal(generated[0].url, `${reference}math#abs`);
  const updatedGrammar = await readFile(grammarPath, 'utf8');
  const parsedGrammar = JSON.parse(updatedGrammar);
  assert.deepEqual(parsedGrammar.repository.generatedFunctions.patterns, functionPatterns(generated, grammar.repository.functions.patterns));
  delete parsedGrammar.repository.generatedFunctions;
  const originalGrammar = JSON.parse(grammarText);
  delete originalGrammar.repository.generatedFunctions;
  assert.deepEqual(parsedGrammar, originalGrammar);
  await generate(fetchPage, directory);
  assert.equal(await readFile(catalogPath, 'utf8'), catalogText);
  assert.equal(await readFile(grammarPath, 'utf8'), updatedGrammar);
});

test('uses the default HTTP loader without requiring network access in tests', async (t) => {
  const { directory } = await outputDirectory(t);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, text: async () => fixturePage(url) };
  });
  await generate(undefined, directory);
});

test('reports HTTP errors and leaves committed outputs untouched', async (t) => {
  const { directory, grammarPath, catalogPath, grammarText } = await outputDirectory(t);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  await assert.rejects(generate(undefined, directory), /HTTP 503/);
  assert.equal(await readFile(catalogPath, 'utf8'), 'unchanged\n');
  assert.equal(await readFile(grammarPath, 'utf8'), grammarText);
});

test('does not write either output when a downloaded function cannot be parsed', async (t) => {
  const { directory, grammarPath, catalogPath, grammarText } = await outputDirectory(t);
  await assert.rejects(generate(async (url) => url.endsWith('/ml?hl=en') ? '<html></html>' : fixturePage(url), directory), /Missing reference article for ML.PREDICT/);
  assert.equal(await readFile(catalogPath, 'utf8'), 'unchanged\n');
  assert.equal(await readFile(grammarPath, 'utf8'), grammarText);
});

test('rejects missing grammar integration before writing the catalog', async (t) => {
  const { directory, grammarPath, catalogPath } = await outputDirectory(t);
  for (const text of [
    JSON.stringify({ patterns: [], repository: {} }),
    JSON.stringify({ patterns: [{ include: '#generatedFunctions' }], repository: {} }),
  ]) {
    await writeFile(grammarPath, text);
    await assert.rejects(generate(async (url) => fixturePage(url), directory), /Missing generatedFunctions grammar integration/);
    assert.equal(await readFile(catalogPath, 'utf8'), 'unchanged\n');
    assert.equal(await readFile(grammarPath, 'utf8'), text);
  }
});

test('CLI reports failures on stderr and exits unsuccessfully without changing outputs', async (t) => {
  const { directory } = await outputDirectory(t);
  const outputPaths = [
    path.join(__dirname, '../server/src/completions/functions.json'),
    path.join(__dirname, '../server/src/linter/syntaxes/googlesql.tmLanguage.json'),
  ];
  const before = await Promise.all(outputPaths.map((file) => readFile(file, 'utf8')));
  const preload = path.join(directory, 'offline.cjs');
  await writeFile(preload, 'globalThis.fetch = async () => { throw new Error("Offline fixture failure"); };\n');
  const result = spawnSync(process.execPath, ['--require', preload, path.join(__dirname, 'generate-completions.cjs')], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Offline fixture failure/);
  assert.equal(result.stdout, '');
  assert.deepEqual(await Promise.all(outputPaths.map((file) => readFile(file, 'utf8'))), before);
});
