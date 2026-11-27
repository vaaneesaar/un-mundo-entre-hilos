const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const surveys = require('./travel-surveys.js');
const model = runInNewContext(readFileSync(require.resolve('./interpretations.js'), 'utf8') + '\nLoomInterpretations');

test('motives require exact geography and matching UTC reference period', () => {
  const survey = surveys.compatibleSurvey('country:MX', '2026-01-14');
  assert.equal(survey.dataStatus, 'synthetic');
  assert.equal(survey.units, 'percent');
  assert.equal(survey.categories.reduce((sum, item) => sum + item.value, 0), 100);
  for (const id of [null, 'city:orlando', 'city:mexico-city', 'airport:MMMX']) {
    assert.equal(surveys.compatibleSurvey(id, '2026-01-14'), undefined);
  }
  assert.equal(surveys.compatibleSurvey('country:MX', '2026-02-01'), undefined);
  assert.equal(surveys.compatibleSurvey('country:MX', '2025-12-31'), undefined);
  assert.equal(surveys.compatibleSurvey('country:MX', '2026-01-31'), survey);
});

test('neutral default and four distinct surface and motion presets', () => {
  const presets = [...model.presets.entries()];
  assert.deepEqual(presets.map(([id]) => id), ['neutral', 'nostalgia', 'joy', 'anticipation', 'reunion']);
  assert.equal(model.get('unknown').values[0], 0);
  assert.equal(model.transition().advance(0, false)[0], 0);
  for (const section of [[1, 10], [10, 13], [13, 14], [14, 18]]) {
    assert.equal(new Set(presets.slice(1).map(([, row]) => row.values.slice(...section).join())).size, 4);
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


test('the independent textile gestures blend and clear without leaving a residual deformation', () => {
  const animation = model.transition();
  animation.select(model.get('nostalgia').values);
  assert.deepEqual(Array.from(animation.advance(.24, false).slice(14)), [.5, 0, 0, 0]);
  animation.select(model.get('reunion').values);
  assert.deepEqual(Array.from(animation.advance(.24, false).slice(14)), [.25, 0, 0, .5]);
  assert.deepEqual(Array.from(animation.advance(0, true).slice(14)), [0, 0, 0, 1]);
  animation.select(model.get('neutral').values);
  assert.deepEqual(Array.from(animation.advance(.48, false).slice(14)), [0, 0, 0, 0]);
});
