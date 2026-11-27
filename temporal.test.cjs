'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const time = require('./temporal.js');
const flights = require('./flights.js');

test('UTC intervals are half-open across years, ISO weeks and leap months', () => {
  const week = time.interval('week', '2026-01-01');
  assert.equal(week.start, '2025-12-29T00:00:00.000Z');
  assert.equal(week.end, '2026-01-05T00:00:00.000Z');
  assert.equal(week.days, 7);
  assert.equal(time.interval('year', '2024-03-15').days, 366);
  assert.equal(time.interval('month', '2024-02-29').end, '2024-03-01T00:00:00.000Z');
  assert.equal(time.interval('month', '2026-04-15').days, 30);
  assert.equal(time.interval('hour', '2026-01-31', 23).end, '2026-02-01T00:00:00.000Z');
  assert.throws(() => time.interval('day', '2026-02-30'));
  assert.throws(() => time.interval('hour', '2026-02-28', 24));
});

test('the shipped days keep independent world and route sums and expose missing coverage', async () => {
  const source = time.demoSource(flights);
  const read = (type, day) => source.read(time.interval(type, day), 'medium');
  const [a,b,week,month,year,missing,hour] = await Promise.all([
    read('day','2026-01-14'), read('day','2026-01-21'), read('week','2026-01-14'),
    read('month','2026-01-31'), read('year','2026-12-31'), read('day','2026-01-15'), read('hour','2026-01-14')
  ]);
  assert.equal(a.total, 87400);
  assert.equal(b.total, 91600);
  assert.equal(week.average, 87400);
  assert.equal(week.slots, 7);
  assert.deepEqual([month.total,month.average,month.count,month.slots,month.coverage], [179000,89500,2,31,'partial']);
  assert.equal(year.slots, 365);
  assert.equal(year.average, month.average);
  assert.equal(missing.total, null);
  assert.equal(hour.total, null);
  const count = row => row.routes.reduce((total, route) => total + route.flightCount, 0);
  assert.equal(count(month), count(a) + count(b));
  assert.notEqual(count(month), month.total);
  assert.equal(time.compare(a,b).difference, 4200);
  assert.equal(time.compare(a,b).percent, 4200 / 87400 * 100);
  assert.equal(time.compare(a,missing), null);
  assert.equal(time.compare(a,hour), null);
  const scale = time.sharedScale(a,b);
  assert(Math.max(count(a),count(b)) / scale <= 100);
  assert.equal(time.sharedScale(b,a), scale);
});

test('hourly fixtures deduplicate slots, retain confirmed zero and ignore overlapping daily totals', () => {
  const period = time.interval('hour', '2026-01-14', 12);
  const row = { periodType: 'hour', periodStart: period.start, periodEnd: period.end, flightCount: 0, sourceId: 'world-test' };
  const route = { ...row, sourceId: 'routes-test', flightCount: 3, originId: 'KLAX', destinationId: 'RJTT', routeId: 'test' };
  const next = time.interval('hour', '2026-01-14', 13);
  const replay = { ...row, periodStart: next.start, periodEnd: next.end, flightCount: 99 };
  const result = time.aggregate(period, [row,row,replay,{ ...row, flightCount: 99, periodType: 'day' }], [route,route],
    { worldSource: 'world-test', routeSource: 'routes-test' });
  assert.equal(result.total, 0);
  assert.equal(result.coverage, 'complete');
  assert.equal(result.routes[0].flightCount, 3);
  assert.equal(time.compare(result,result).percent, null);
});

test('interval cache shares concurrent reads and lets a failed interval retry', async () => {
  let reads = 0;
  const interval = time.interval('day','2026-01-14');
  const cache = time.cache({ read() { if (++reads === 1) throw Error('test'); return reads; } });
  const a = cache.read(interval,'medium');
  assert.equal(a,cache.read(interval,'medium'));
  await assert.rejects(a);
  assert.equal(await cache.read(interval,'medium'),2);
  cache.invalidate();
  assert.equal(await cache.read(interval,'medium'),3);
});
