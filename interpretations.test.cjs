const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const model = runInNewContext(readFileSync(require.resolve('./interpretations.js'), 'utf8') + '\nLoomInterpretations');

test('motives require exact geography and matching UTC reference period', () => {
  const survey = model.compatibleSurvey('country:MX', '2026-01-14');
  assert.equal(survey.dataStatus, 'synthetic');
  assert.equal(survey.units, 'percent');
  assert.equal(survey.categories.reduce((sum, item) => sum + item.value, 0), 100);
  for (const id of [null, 'city:orlando', 'city:mexico-city', 'airport:MMMX']) {
    assert.equal(model.compatibleSurvey(id, '2026-01-14'), undefined);
  }
  assert.equal(model.compatibleSurvey('country:MX', '2026-02-01'), undefined);
  assert.equal(model.compatibleSurvey('country:MX', '2025-12-31'), undefined);
  assert.equal(model.compatibleSurvey('country:MX', '2026-01-31'), survey);
});

test('neutral default and five distinct surface and motion presets', () => {
  const presets = [...model.presets.entries()];
  assert.equal(presets.length, 6);
  assert.equal(model.get('unknown').values[0], 0);
  assert.equal(model.transition().advance(0, false)[0], 0);
  for (const section of [[1, 10], [10, 13], [13, 15], [15, 17]]) {
    assert.equal(new Set(presets.slice(1).map(([, row]) => row.values.slice(...section).join())).size, 5);
  }
});

test('interrupted material transition continues from the visible state', () => {
  const animation = model.transition();
  animation.select(model.get('joy').values);
  const midway = Array.from(animation.advance(.24, false));
  assert.equal(midway[0], .5);
  animation.select(model.get('reunion').values);
  assert.deepEqual(Array.from(animation.advance(0, false)), midway);
  assert.equal(animation.advance(0, true)[0], 1);
  animation.select(model.get('neutral').values);
  assert.equal(animation.advance(.48, false)[0], 0);
  assert.equal(animation.active, false);
});
