const assert = require('node:assert/strict');
const test = require('node:test');
const { createHandSequence } = require('./hand-gesture.js');

test('a stable fist followed by a stable open palm starts only once', () => {
  const detect = createHandSequence();
  let time = 0;
  const sample = (categoryName, score = .95) => detect({ categoryName, score }, time += 100);
  for (let index = 0; index < 8; index++) assert.equal(sample('Open_Palm'), false);
  for (let index = 0; index < 4; index++) assert.equal(sample('Closed_Fist'), false);
  assert.equal(sample('Open_Palm', .5), false);
  for (let index = 0; index < 3; index++) assert.equal(sample('Open_Palm'), false);
  assert.equal(sample('Open_Palm'), true);
  assert.equal(sample('Open_Palm'), false);
});

test('an old fist and interrupted detections cannot start the loom', () => {
  const detect = createHandSequence();
  for (let time = 0; time <= 300; time += 100) detect({ categoryName: 'Closed_Fist', score: .9 }, time);
  assert.equal(detect(undefined, 400), false);
  for (let time = 3500; time <= 4000; time += 100) {
    assert.equal(detect({ categoryName: 'Open_Palm', score: .9 }, time), false);
  }
});
