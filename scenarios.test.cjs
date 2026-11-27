'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const scenarios = require('./scenarios.js');
const time = require('./temporal.js');
const surveys = require('./travel-surveys.js');

test('assumptions are explicit and bounded; zero is a valid assumption', () => {
  for (const input of ['', ' ', '-1', '101', 'Infinity', 'ten']) assert.equal(scenarios.proportion(input), null);
  assert.equal(scenarios.proportion('0'), 0);
  assert.equal(scenarios.proportion('12.5'), 12.5);
  assert.equal(scenarios.proportion('100'), 100);
  assert.equal(scenarios.quantity(21480, null), null);
  assert.equal(scenarios.quantity(null, 50), null);
  assert.equal(scenarios.quantity(21480, 0), 0);
});

test('the same assumption is applied to both observed totals', () => {
  const a = scenarios.quantity(21480, 25);
  const b = scenarios.quantity(26258, 25);
  assert.equal(a, 5370);
  assert.equal(b, 6565);
  assert.deepEqual(scenarios.variation(b, a, true), { difference: 1195, percent: 1195 / 5370 * 100 });
  assert.deepEqual(scenarios.variation(b, a, false), { difference: 1195, percent: null });
  assert.deepEqual(scenarios.variation(b, 0, true), { difference: 6565, percent: null });
  assert.equal(scenarios.variation(b, null, false), null);
});

test('the UTC chart preserves missing days separately from confirmed zero', () => {
  const timeline = [['2019-01-01', 21480], ['2019-01-02', 26258], ['2019-01-04', 0]];
  const week = scenarios.series(timeline, time.interval('week', '2019-01-02'), 25);
  assert.deepEqual(week.map(bin => bin.quantity), [null, 5370, 6565, null, 0, null, null]);
  const year = scenarios.series(timeline, time.interval('year', '2019-01-02'), 25);
  assert.ok(year.length <= 12);
  assert.equal(year[0].coverage, 3);
  assert.equal(year[0].quantity, 11935);
});

test('synthetic evidence is ineligible for the verified survey registry', () => {
  const demo = surveys.compatibleSurvey('country:MX', '2026-01-14');
  assert.equal(surveys.verifiedMotives([demo], 'country:MX', '2026-01-14'), undefined);
});

test('intensity grows with equivalents on a fixed bounded scale', () => {
  assert.equal(scenarios.intensity(0), 0);
  assert.equal(scenarios.intensity(8000), .45);
  const values = [300, 6444, 7877, 33000, 3000000].map(scenarios.intensity);
  assert.ok(values.every((value, index) => value < .90 && (!index || value > values[index - 1])));
});

test('different calendar durations and coverage compare by covered day', () => {
  const month = { type: 'month', observed: 31000, covered: 31, slots: 31 };
  const partial = { type: 'month', observed: 14000, covered: 28, slots: 30 };
  assert.deepEqual(scenarios.compare(month, partial, 30),
    { current: 300, reference: 150, normalized: true, difference: 150, percent: 100 });
  assert.equal(scenarios.compare(month, { ...partial, covered: 0, observed: null }, 30), null);
  const zero = { ...month, observed: 0 };
  assert.equal(scenarios.compare(month, zero, 30).percent, null);
});

test('observed OpenSky days, months, years and geographic scope drive distinct counts', async () => {
  const fs = require('node:fs');
  const flights = require('./flights.js');
  const history = require('./historical.js');
  const providers = require('./providers.js');
  const destinations = require('./destinations.js');
  const source = history.create(require('./data/history.json'), file =>
    providers.imported(JSON.parse(fs.readFileSync(require.resolve('./data/' + file), 'utf8')), flights, time),
  flights, time);
  const volume = rows => rows.reduce((sum, row) => sum + row.flightCount, 0);
  const read = async (type, date) => {
    const row = await source.read(time.interval(type, date));
    return { observed: volume(row.routes), covered: row.routeSlots, slots: row.slots, type, row };
  };
  const jan1 = await read('day', '2019-01-01');
  const jan2 = await read('day', '2019-01-02');
  const daily = scenarios.compare(jan2, jan1, 30);
  assert.equal(daily.current, 7877);
  assert.equal(daily.reference, 6444);
  assert.equal(daily.difference, 1433);
  assert.ok(scenarios.intensity(daily.current) > scenarios.intensity(daily.reference));
  const jan19 = await read('month', '2019-01-01');
  const jan20 = await read('month', '2020-01-01');
  assert.equal(scenarios.compare(jan20, jan19, 30).difference, 91844);
  const y19 = await read('year', '2019-01-01');
  const y20 = await read('year', '2020-01-01');
  assert.ok(y19.covered > 350 && y20.covered > 350);
  assert.ok(scenarios.compare(y20, y19, 30).normalized);
  const catalog = destinations.buildCatalog(source.airports);
  const arrivals = destinations.connections(jan19.row.routes, catalog.get('country:MX'), 'arrivals');
  assert.ok(arrivals.flightCount > 0 && arrivals.flightCount < jan19.observed);
  assert.ok(scenarios.quantity(arrivals.flightCount, 30) < scenarios.quantity(jan19.observed, 30));
});
