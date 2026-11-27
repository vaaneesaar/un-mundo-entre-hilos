'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const history = require('./historical.js');
const providers = require('./providers.js');
const flights = require('./flights.js');
const time = require('./temporal.js');
const fs = require('node:fs');
const load = file => providers.imported(JSON.parse(fs.readFileSync(require.resolve('./data/' + file), 'utf8')), flights, time);

test('historical requests read only intersecting verified months and leave absent periods empty', async () => {
  const index = require('./data/history.json');
  const opened = [];
  const source = history.create(index, file => {
    opened.push(file);
    return load(file);
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
  assert.equal(source.status('2020-03'), index.months.some(row => row.month === '2020-03') ? 'available' : 'pending');
  const across = await source.read(time.interval('week', '2019-02-01'));
  assert.equal(across.routeSlots,7);
  assert.equal(count(across),source.timeline.filter(([date]) => date >= '2019-01-28' && date < '2019-02-04')
    .reduce((sum,[,value])=>sum+value,0));
  assert.equal(opened.length,2);
  const year = await source.read(time.interval('year','2020-04-01'));
  const days2020 = source.timeline.filter(([date]) => date.startsWith('2020-'));
  assert.equal(count(year), days2020.reduce((sum, [,value]) => sum + value, 0));
  assert.equal(year.routeSlots, days2020.length);
  assert.equal(year.slots,366);
});

test('month data whose sum differs from the verified index is rejected', async () => {
  const index = structuredClone(require('./data/history.json'));
  index.months.find(entry => entry.month === '2019-02').days[0][1]++;
  const source = history.create(index, load, flights,time);
  await assert.rejects(source.read(time.interval('day','2019-02-01')), /no coincide/);
});

test('February 2019 keeps the original total and airport lists match the selected period', async () => {
  const source = history.create(require('./data/history.json'), load, flights, time);
  const month = await source.read(time.interval('month','2019-02-01'));
  assert.equal(month.routeSlots, 28);
  assert.equal(month.routes.length, 53854);
  assert.equal(month.routes.reduce((sum, row) => sum + row.flightCount, 0), 753347);
  const day = await source.read(time.interval('day','2019-02-01'));
  assert.deepEqual(new Set(day.originIds), new Set(day.routes.map(route => route.originId)));
  assert.deepEqual(new Set(day.destinationIds), new Set(day.routes.map(route => route.destinationId)));
  assert(day.originIds.length < month.originIds.length);
});

test('every integrated month agrees with its day index and has no world total', async () => {
  const index = require('./data/history.json');
  const source = history.create(index, load, flights, time);
  for (const entry of index.months) {
    const result = await source.read(time.interval('month', entry.month + '-01'));
    assert.equal(result.routeSlots, entry.days.length, entry.month);
    assert.equal(result.routes.reduce((sum, route) => sum + route.flightCount, 0),
      entry.days.reduce((sum, [,count]) => sum + count, 0), entry.month);
    assert.equal(result.total, null, entry.month);
    assert.equal(result.routeSource, 'opensky:routes', entry.month);
  }
});

test('calendar availability keeps leap days and does not fill confirmed OpenSky gaps', () => {
  const source = history.create(require('./data/history.json'), load, flights, time);
  for (const day of ['2019-12-14', '2021-03-14', '2021-05-31']) assert(!source.dates.includes(day));
  assert(source.dates.includes('2020-02-29'));
});
