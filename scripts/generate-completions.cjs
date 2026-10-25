const { load } = require('cheerio');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const reference = 'https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/';
const root = path.join(__dirname, '..');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function discoverFunctions(html) {
  const $ = load(html);
  const functions = new Map();
  $('table tr').each((_, row) => {
    const cells = $(row).children('td');
    const link = cells.first().find('a[href]').first();
    const name = normalize(link.find('code').first().text());
    if (!/^[A-Z][A-Z0-9_]*(?:\.[A-Z0-9_]+)*$/.test(name)) return;
    const description = normalize(cells.eq(1).text());
    if (!description) throw new Error(`Missing description for ${name}`);
    if (!functions.has(name)) functions.set(name, { name, description, url: new URL(link.attr('href'), reference).href });
  });
  // AI/ML functions have individual pages and are absent from functions-all's table.
  $('.devsite-nav-item a[href]').each((_, element) => {
    const link = $(element);
    const name = normalize(link.find('.devsite-nav-text').text());
    if (!/^(?:AI|ML)\.[A-Z0-9_]+$/.test(name)) return;
    const url = new URL(link.attr('href'), reference);
    if (url.origin !== new URL(reference).origin || !url.pathname.startsWith(new URL(reference).pathname)) {
      throw new Error(`Unexpected function reference URL: ${url}`);
    }
    if (!functions.has(name)) functions.set(name, { name, url: url.href });
  });
  if (!functions.size) throw new Error('No functions found in reference');
  for (const namespace of ['AI.', 'ML.']) {
    if (![...functions.keys()].some((name) => name.startsWith(namespace))) {
      throw new Error(`Missing ${namespace} functions in reference navigation`);
    }
  }
  return [...functions.values()].sort((a, b) => compare(a.name.toLowerCase(), b.name.toLowerCase()));
}

function readFunction(entry, html) {
  const $ = load(html);
  const article = $('.devsite-article-body');
  if (!article.length) throw new Error(`Missing reference article for ${entry.name}`);
  const fragment = new URL(entry.url).hash.slice(1);
  const heading = fragment
    ? article.find('[id]').filter((_, el) => $(el).attr('id') === fragment).first()
    : article.find('h2, h3').filter((_, el) => /syntax/i.test($(el).text())).first();
  if (!heading.length) throw new Error(`Missing syntax section for ${entry.name}: ${entry.url}`);
  const section = heading.nextUntil('h2');
  const pre = section.filter('pre').add(section.find('pre')).first();
  const signature = normalize(pre.text());
  const description = entry.description || normalize(article.children('p').filter((_, el) => $(el).text().includes(entry.name)).first().text());
  if (!signature || !description) throw new Error(`Missing signature or description for ${entry.name}: ${entry.url}`);
  return { name: entry.name.toLowerCase(), signature, description, url: entry.url };
}

function functionPatterns(functions, existingPatterns) {
  const legacy = existingPatterns
    .filter((pattern) => pattern.captures?.[1]?.name.startsWith('support.function.'))
    .map((pattern) => ({ scope: pattern.captures[1].name, regex: new RegExp(pattern.match.replace(/^\(\?i\)/, ''), 'i') }));
  const groups = new Map();
  for (const { name } of functions) {
    const scope = legacy.find(({ regex }) => regex.exec(`${name}(`)?.[1]?.toLowerCase() === name)?.scope || 'support.function.builtin.sql';
    if (!groups.has(scope)) groups.set(scope, []);
    groups.get(scope).push(escapeRegex(name.toUpperCase()));
  }
  return [...groups].map(([scope, names]) => ({
    captures: { 1: { name: scope } },
    match: `(?i)(?<![\\w.])(${names.join('|')})(?=\\s*\\()`,
    name: 'meta.function.sql',
  }));
}

async function generate(fetchPage = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}, outputRoot = root) {
  const entries = discoverFunctions(await fetchPage(`${reference}functions-all?hl=en`));
  const pages = new Map();
  for (const entry of entries) {
    const url = new URL(entry.url);
    url.hash = '';
    url.searchParams.set('hl', 'en');
    pages.set(url.href, undefined);
  }
  const urls = [...pages.keys()].sort(compare);
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      pages.set(url, await fetchPage(url));
    }
  }));
  const functions = entries.map((entry) => {
    const url = new URL(entry.url);
    url.hash = '';
    url.searchParams.set('hl', 'en');
    return readFunction(entry, pages.get(url.href));
  });
  const grammarPath = path.join(outputRoot, 'server/src/linter/syntaxes/googlesql.tmLanguage.json');
  const grammarText = await readFile(grammarPath, 'utf8');
  const grammar = JSON.parse(grammarText);
  if (!grammar.patterns.some((pattern) => pattern.include === '#generatedFunctions') ||
      !/^    "generatedFunctions": .*,$/m.test(grammarText)) {
    throw new Error('Missing generatedFunctions grammar integration');
  }
  const generated = JSON.stringify({ patterns: functionPatterns(functions, grammar.repository.functions.patterns) });
  const updatedGrammar = grammarText.replace(/^    "generatedFunctions": .*,$/m, () => `    "generatedFunctions": ${generated},`);
  // Complete all downloads and parsing before changing either committed output.
  await writeFile(path.join(outputRoot, 'server/src/completions/functions.json'), `${JSON.stringify(functions, null, 2)}\n`);
  await writeFile(grammarPath, updatedGrammar);
  console.log(`Generated ${functions.length} functions from ${pages.size} reference pages.`);
}

module.exports = { discoverFunctions, readFunction, functionPatterns, generate };
if (require.main === module) {
  generate().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
