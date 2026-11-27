'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const history = require('./historical.js');
const providers = require('./providers.js');
const flights = require('./flights.js');
const time = require('./temporal.js');

test('historical requests read only intersecting verified months and leave absent periods empty', async () => {
  const index = require('./data/history.json');
  const opened = [];
  const source = history.create(index, file => {
    opened.push(file);
    return providers.imported(require('./data/' + file), flights, time);
  }, flights, time);
  const count = result => result.routes.reduce((sum, row) => sum + row.flightCount, 0);
  const day = await source.read(time.interval('day','2019-02-01'));
  assert.equal(count(day),29456);
  assert.equal(day.total,null);
  assert.equal(opened.length,1);
  const missing = await source.read(time.interval('month','2026-10-01'));
  assert.equal(missing.routeSlots,0);
  assert.equal(missing.total,null);
  assert.equal(opened.length,1);
  assert.equal(source.status('2026-10'),'unpublished');
  assert.equal(source.status('2024-04'),'separate');
  assert.equal(source.status('2020-03'),'pending');
  const across = await source.read(time.interval('week', '2019-02-01'));
  assert.equal(across.routeSlots,7);
  assert.equal(count(across),source.timeline.filter(([date]) => date >= '2019-01-28' && date < '2019-02-04')
    .reduce((sum,[,value])=>sum+value,0));
  assert.equal(opened.length,2);
  const year = await source.read(time.interval('year','2020-04-01'));
  assert.equal(count(year),279216);
  assert.equal(year.routeSlots,30);
  assert.equal(year.slots,366);
});

test('month data whose sum differs from the verified index is rejected', async () => {
  const index = structuredClone(require('./data/history.json'));
  index.months.find(entry => entry.month === '2019-02').days[0][1]++;
  const source = history.create(index, file => providers.imported(require('./data/'+file),flights,time), flights,time);
  await assert.rejects(source.read(time.interval('day','2019-02-01')), /no coincide/);
});
