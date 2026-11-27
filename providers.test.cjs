'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const provider = require('./providers.js');
const time = require('./temporal.js');
const flights = require('./flights.js');
const day = '2026-01-14';
const at = () => Date.parse('2026-01-18T00:00:00Z');
const metadata = { definition: 'Fixture de prueba', coverage: 'Fixture de prueba',
  authorization: 'Referencia ficticia usada solo en pruebas', retrievedAt: '2026-01-15T00:00:00.000Z' };
const departure = { recordId: 'f1', departureUtc: day + 'T23:59:59Z', originId: 'KMCO', destinationId: 'EGLL' };

function fixture() {
  return {
    version: 1,
    world: { ...metadata, provider: 'fr24', url: 'https://www.flightradar24.com/data/statistics', category: 'tracked',
      records: [{ dateUtc: day, recordId: 'd1', coverageStatus: 'complete', flightCount: 90, updatedAt: '2026-01-14T23:59:59Z' },
        { dateUtc: day, recordId: 'd1', coverageStatus: 'complete', flightCount: 100 }] },
    routes: { ...metadata, provider: 'opensky', url: 'https://opensky-network.org/data',
      records: [departure, { ...departure }, { ...departure, recordId: 'f2', destinationId: 'UNKNOWN' },
        { ...departure, recordId: 'f3', departureUtc: '2026-01-15T00:00:00Z' }] }
  };
}

test('authorized import format isolates sources, corrects totals, deduplicates flights and reports omitted endpoints', async () => {
  const adapter = provider.imported(fixture(), flights, time, at);
  assert.deepEqual(adapter.dates, [day, '2026-01-15']);
  const result = await adapter.read(time.interval('day', day));
  assert.equal(result.total, 100);
  assert.equal(result.routes.length, 1);
  assert.equal(result.routes[0].flightCount, 1);
  assert.equal(result.excluded, 1);
  assert.match(result.routes[0].endpointStatus, /estimados/);
  const next = await adapter.read(time.interval('day','2026-01-15'));
  assert.equal(next.total, null);
  assert.equal(next.routes[0].flightCount, 1);
  assert.equal(time.compare(result,next), null);
});

test('rejects invalid provenance, airport-flight conflicts and ambiguous same-revision totals', () => {
  const noPermission = fixture();
  delete noPermission.world.authorization;
  assert.throws(() => provider.imported(noPermission, flights, time, at), /autorización/);
  const fakeHost = fixture();
  fakeHost.world.url = 'https://www.flightradar24.com.example.invalid/';
  assert.throws(() => provider.imported(fakeHost, flights, time, at), /autorización/);
  const invalidFlight = fixture();
  invalidFlight.routes.records[1] = { ...departure, destinationId: 'KLAX' };
  assert.throws(() => provider.imported(invalidFlight, flights, time, at), /contradictorios/);
  const ambiguous = fixture();
  ambiguous.world.records.push({ dateUtc: day, recordId: 'd1', coverageStatus: 'complete', flightCount: 500 });
  assert.throws(() => provider.imported(ambiguous, flights, time, at), /misma fecha/);
});

test('unconfigured or expired inputs never return simulation or an invented zero', async () => {
  const period = time.interval('day', day);
  const empty = await provider.unavailable(time).read(period);
  assert.equal(empty.status, 'unavailable');
  assert.equal(empty.total, null);
  assert.deepEqual(empty.routes, []);
  const expired = provider.imported(fixture(), flights, time, () => Date.parse('2026-03-01T00:00:00Z'));
  const result = await expired.read(period);
  assert.equal(result.expired, true);
  assert.equal(result.total, null);
  assert.equal(result.routes.length, 1);
  const demo = await time.demoSource(flights).read(period, 'medium');
  assert.equal(demo.total, 87400);
});

test('incomplete daily observations are explicitly partial', async () => {
  const data = fixture();
  data.world.records[1].coverageStatus = 'partial';
  const period = time.interval('day', day);
  const result = await provider.imported(data, flights, time, at).read(period);
  assert.equal(result.coverage, 'partial');
  assert.equal(result.partialDays, 1);
});

test('bundled licensed extract preserves its verified routes and never supplies a world total', async () => {
  const payload = require('./data/opensky-abril-2020.json');
  const source = provider.imported(payload, flights, time);
  assert.equal(source.dates.length, 30);
  const april = await source.read(time.interval('month', '2020-04-01'));
  assert.equal(april.total, null);
  assert.equal(april.routes.length, 38);
  assert.equal(april.routes.reduce((sum, route) => sum + route.flightCount, 0), 1203);
  const [a, b] = await Promise.all(['2020-04-05','2020-04-30'].map(day => source.read(time.interval('day', day))));
  assert.equal(time.compare(a, b), null);
  assert.equal(a.routes.reduce((sum, route) => sum + route.flightCount, 0), 65);
  assert.equal(b.routes.reduce((sum, route) => sum + route.flightCount, 0), 29);
  const scale = time.sharedScale(a, b);
  const count = row => Math.round(row.routes.reduce((sum, route) => sum + route.flightCount, 0) / scale);
  assert(count(a) > count(b));
});

test('country options come from historically recorded arrival airports, not the whole catalog', async () => {
  const destinations = require('./destinations.js');
  const source = provider.imported(require('./data/opensky-abril-2020.json'), flights, time);
  const catalog = destinations.buildCatalog(flights.airports);
  const countries = destinations.destinationCountries(catalog, source.destinationIds);
  assert.deepEqual(countries.map(place => place.iso), ['BR','ES','US','FR','JP','GB']);
  assert.deepEqual(countries.map(place => {
    const supported = new Set(source.destinationIds);
    return destinations.search(catalog, place.name, p => p.airportIds.some(id => supported.has(id)))[0].iso;
  }), ['BR','ES','US','FR','JP','GB']);
  const month = await source.read(time.interval('month','2020-04-01'));
  const usa = countries.find(place => place.iso === 'US');
  const arrivals = destinations.connections(month.routes, usa, 'arrivals');
  assert.equal(arrivals.flightCount, 577);
  assert.equal(arrivals.matched.size, 15);
  assert(!source.destinationIds.includes('MMMX'));
});

test('international aggregates validate external anchors and preserve route and world coverage', async () => {
  const payload = require('./data/opensky-febrero-2019.json');
  const source = provider.imported(payload, flights, time);
  assert.equal(source.dates.length, 28);
  assert.deepEqual(source.anchors.KMCO, flights.anchors.KMCO);
  assert(source.destinationIds.some(id => source.airports[id].country === 'MX'));
  const month = await source.read(time.interval('month', '2019-02-01'));
  assert.equal(month.total, null);
  assert.equal(month.routes.length, 53854);
  assert.equal(month.routes.reduce((sum, route) => sum + route.flightCount, 0), 753347);
  const day = await source.read(time.interval('day', '2019-02-01'));
  assert.equal(day.routes.reduce((sum, route) => sum + route.flightCount, 0), 29456);
});
