const assert = require('node:assert/strict');
const { test } = require('node:test');
const { checkDuplication } = require('./check-duplication.cjs');

test('retains the five-percent target for clean code', () => {
  assert.doesNotThrow(() => checkDuplication({ tokens: 100, duplicatedTokens: 0 }, { tokens: 100, duplicatedTokens: 5 }, 5));
  assert.throws(() => checkDuplication({ tokens: 100, duplicatedTokens: 0 }, { tokens: 100, duplicatedTokens: 6 }, 5));
});

test('allows existing duplication but rejects regressions above the baseline', () => {
  const baseline = { tokens: 100, duplicatedTokens: 12 };
  assert.doesNotThrow(() => checkDuplication(baseline, { tokens: 100, duplicatedTokens: 12 }, 5));
  assert.doesNotThrow(() => checkDuplication(baseline, { tokens: 100, duplicatedTokens: 11 }, 5));
  assert.throws(() => checkDuplication(baseline, { tokens: 100, duplicatedTokens: 13 }, 5));
});

test('handles empty snapshots and rejects missing scanner statistics', () => {
  assert.doesNotThrow(() => checkDuplication({ tokens: 0, duplicatedTokens: 0 }, { tokens: 0, duplicatedTokens: 0 }, 5));
  assert.throws(() => checkDuplication({}, { tokens: 0, duplicatedTokens: 0 }, 5));
});
