const assert = require('node:assert/strict');
const { test } = require('node:test');
const { discoverFunctions, readFunction, functionPatterns } = require('./generate-completions.cjs');
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
