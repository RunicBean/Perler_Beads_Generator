const { test } = require('node:test');
const assert = require('node:assert/strict');
const { patternMetrics } = require('./pattern-filters.cjs');
test('continuity counts occupied right/down pairs once, excludes empties and row wrapping', () => {
  assert.deepEqual(patternMetrics({ width: 2, cells: ['a','a','a','a'] }), { beads: 4, colors: 1, continuity: 100 });
  assert.deepEqual(patternMetrics({ width: 2, cells: ['a','b','b','a'] }), { beads: 4, colors: 2, continuity: 0 });
  assert.deepEqual(patternMetrics({ width: 2, cells: ['a','a','a','b'] }), { beads: 4, colors: 2, continuity: 50 });
  assert.deepEqual(patternMetrics({ width: 2, cells: [null,'a','a',null] }), { beads: 2, colors: 1, continuity: 0 });
  assert.deepEqual(patternMetrics({ width: 2, cells: ['a',null,'a',null] }), { beads: 2, colors: 1, continuity: 100 });
  assert.deepEqual(patternMetrics({ width: 1, cells: ['a'] }), { beads: 1, colors: 1, continuity: 0 });
  assert.deepEqual(patternMetrics({ width: 1, cells: [null] }), { beads: 0, colors: 0, continuity: 0 });
});
