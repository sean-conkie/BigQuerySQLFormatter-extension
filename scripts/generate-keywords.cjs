const { load } = require('cheerio');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const reference = 'https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/lexical?hl=en';
const root = path.join(__dirname, '..');
const sorted = (words) => [...new Set(words)].sort();

function reservedKeywords(html) {
  const $ = load(html);
  const heading = $('h2#reserved_keywords');
  if (heading.length !== 1) throw new Error('Missing reserved_keywords reference section');
  const section = heading.nextUntil('h1, h2');
  const tables = section.filter('table').add(section.find('table'));
  if (tables.length !== 1) throw new Error('Expected one reserved keywords table');
  tables.find('br').replaceWith('\n');
  const words = tables.find('td').toArray().flatMap((cell) => $(cell).text().trim().split(/\s+/));
  if (words.length < 50 || words.some((word) => !/^[A-Z][A-Z_]*$/.test(word)) ||
      new Set(words).size !== words.length) {
    throw new Error('Invalid or incomplete reserved keywords table');
  }
  return sorted(words.map((word) => word.toLowerCase()));
}

// Expand literal alternatives, not arbitrary regex matches. Character classes
// and assertions cannot contribute identifier text; captures retain their scope.
function literalExpressions(source) {
  let position = 0;
  let captureIndex = 0;
  const captures = new Map();
  const product = (left, right) => {
    if (left.length * right.length > 20000) throw new Error('Keyword regex expansion is too large');
    return sorted(left.flatMap((a) => right.map((b) => a + b)));
  };
  function expression(nested = false) {
    let alternatives = [];
    let sequence = [''];
    while (position < source.length && source[position] !== ')') {
      let values;
      const character = source[position++];
      if (character === '|') {
        alternatives.push(...sequence);
        sequence = [''];
        continue;
      }
      if (character === '(') {
        let capture;
        let assertion = false;
        if (source[position] !== '?') {
          capture = ++captureIndex;
        } else {
          position++;
          const prefix = source.slice(position);
          const flags = /^[imsx-]+(?=[:)])/i.exec(prefix)?.[0];
          if (flags) {
            position += flags.length;
            if (source[position] === ')') {
              position++;
              continue;
            }
            position++;
          } else if (prefix.startsWith('<=') || prefix.startsWith('<!')) {
            assertion = true;
            position += 2;
          } else if (['=', '!'].includes(source[position])) {
            assertion = true;
            position++;
          } else if ([':', '>'].includes(source[position])) {
            position++;
          } else {
            throw new Error(`Unsupported keyword regex group: ${source}`);
          }
        }
        values = expression(true);
        if (capture) captures.set(capture, values);
        if (assertion) values = [''];
      } else if (character === '[') {
        let closed = false;
        while (position < source.length) {
          const next = source[position++];
          if (next === '\\') position++;
          else if (next === ']') {
            closed = true;
            break;
          }
        }
        if (!closed) throw new Error(`Unclosed keyword regex class: ${source}`);
        values = [' '];
      } else if (character === '\\') {
        const escaped = source[position++];
        if (!escaped) throw new Error(`Incomplete keyword regex escape: ${source}`);
        if (/[a-z]/i.test(escaped) && !'bBsSwWdDtnr'.includes(escaped)) {
          throw new Error(`Unsupported keyword regex escape: ${source}`);
        }
        values = [escaped === 'b' || escaped === 'B' ? '' : ' '];
      } else if (character === '^' || character === '$') {
        values = [''];
      } else if (/[a-z_0-9]/i.test(character)) {
        values = [character.toLowerCase()];
      } else if (character === '?' || character === '*' || character === '+' || character === '{') {
        throw new Error(`Unsupported keyword regex quantifier: ${source}`);
      } else {
        values = [' '];
      }
      const quantifier = source[position];
      if (quantifier === '?' || quantifier === '*') {
        if (values.length !== 1 || values[0] !== ' ') values = sorted(['', ...values]);
        position++;
      } else if (quantifier === '+') {
        position++;
      } else if (quantifier === '{') {
        const repetition = /^\{(\d+)(?:,(\d+))?\}/.exec(source.slice(position));
        if (!repetition) throw new Error(`Unsupported keyword regex repetition: ${source}`);
        const minimum = Number(repetition[1]);
        const maximum = Number(repetition[2] ?? repetition[1]);
        if (maximum > 8 || minimum > maximum) throw new Error(`Unsupported keyword regex repetition: ${source}`);
        let repeated = [''];
        const choices = [];
        for (let count = 0; count <= maximum; count++) {
          if (count >= minimum) choices.push(...repeated);
          repeated = product(repeated, values);
        }
        values = sorted(choices);
        position += repetition[0].length;
      }
      if (source[position] === '?' || source[position] === '+') position++;
      sequence = product(sequence, values);
    }
    if (nested) {
      if (source[position] !== ')') throw new Error(`Unclosed keyword regex group: ${source}`);
      position++;
    }
    alternatives.push(...sequence);
    return sorted(alternatives);
  }
  const whole = expression();
  if (position !== source.length) throw new Error(`Unexpected keyword regex close: ${source}`);
  captures.set(0, whole);
  return captures;
}

function grammarKeywords(grammar) {
  const words = [];
  let scopedPatterns = 0;
  const keyword = (scope) => typeof scope === 'string' && scope.split(/\s+/).some((name) =>
    name.startsWith('keyword.') || name === 'storage.type.sql');
  function visit(pattern) {
    for (const [field, captureField] of [['match', 'captures'], ['begin', 'beginCaptures'], ['end', 'endCaptures']]) {
      if (field !== 'match' && !pattern[field] && !pattern[captureField]) continue;
      const scopes = pattern[captureField] || (field !== 'match' ? pattern.captures : undefined) || {};
      const indexes = Object.entries(scopes).filter(([, capture]) => keyword(capture.name)).map(([index]) => Number(index));
      if (keyword(pattern.name)) indexes.push(0);
      if (!indexes.length) continue;
      if (typeof pattern[field] !== 'string') {
        if (field === 'match' && (pattern.begin || pattern.end)) continue;
        if (keyword(pattern.name) && !pattern[field]) continue;
        throw new Error(`Missing ${field} expression for keyword scope`);
      }
      scopedPatterns++;
      const captures = literalExpressions(pattern[field]);
      for (const index of indexes) {
        if (!captures.has(index)) throw new Error(`Missing keyword capture ${index}: ${pattern[field]}`);
        for (const text of captures.get(index)) words.push(...(text.match(/[a-z_][a-z_0-9]*/g) || []));
      }
    }
    for (const child of pattern.patterns || []) visit(child);
    for (const child of Object.values(pattern.repository || {})) visit(child);
  }
  visit(grammar);
  if (!scopedPatterns || !words.length) throw new Error('No grammar keyword scopes found');
  return sorted(words);
}

function keywordCatalog(html, grammar) {
  const reserved = reservedKeywords(html);
  const reservedSet = new Set(reserved);
  return { reserved, nonReserved: grammarKeywords(grammar).filter((word) => !reservedSet.has(word)) };
}

async function generate(fetchPage = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}, outputRoot = root) {
  const html = await fetchPage(reference);
  const grammar = JSON.parse(await readFile(path.join(outputRoot, 'server/src/linter/syntaxes/googlesql.tmLanguage.json'), 'utf8'));
  const catalog = keywordCatalog(html, grammar);
  await writeFile(path.join(outputRoot, 'server/src/linter/keywords.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Generated ${catalog.reserved.length} reserved and ${catalog.nonReserved.length} non-reserved keywords.`);
}

module.exports = { reference, reservedKeywords, grammarKeywords, keywordCatalog, generate };
if (require.main === module) {
  generate().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
