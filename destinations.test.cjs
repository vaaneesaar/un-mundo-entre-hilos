'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const FlightData = require('./flights.js');
const D = require('./destinations.js');
const catalog = D.buildCatalog(FlightData.airports);

test('normalizes accents and ranks exact city and IATA matches above partial matches', () => {
  assert.equal(D.normalize('  MÉXICO & São Paulo '), 'mexico sao paulo');
  assert.equal(D.search(catalog, 'Mexico')[0].id, 'country:MX');
  assert.deepEqual(D.search(catalog, 'Orlan').map(p => p.id), ['city:ORL', 'airport:KMCO']);
  assert.equal(D.search(catalog, 'MCO')[0].id, 'airport:KMCO');
  assert.equal(D.search(catalog, 'kmco')[0].id, 'airport:KMCO');
  assert.equal(D.search(catalog, 'Madrid')[0].id, 'city:MAD');
  assert.deepEqual(D.search(catalog, 'Destino inexistente'), []);
});

test('resolves catalog relations separately from availability in the selected scenario', () => {
  assert.deepEqual(catalog.get('city:ORL').airportIds, ['KMCO']);
  assert(catalog.get('country:US').cityIds.has('city:ORL'));
  assert.equal(catalog.get('airport:KMCO').cityId, 'city:ORL');
  const low = FlightData.getDemo(FlightData.days[0], 'low');
  assert.equal(D.connections(low.routes, catalog.get('airport:KMCO'), 'arrivals').matched.size, 0);
  assert.equal(D.connections(low.routes, catalog.get('city:ORL'), 'departures').matched.size, 1);
});

test('filters by country and airport, preserving counts and deduplicating both directions', () => {
  const demo = FlightData.getDemo(FlightData.days[0], 'high');
  const before = JSON.stringify(demo);
  const us = D.connections([...demo.routes, ...demo.routes], catalog.get('country:US'), 'both');
  const ids = new Set(catalog.get('country:US').airportIds);
  const expected = demo.routes.filter(r => ids.has(r.originId) || ids.has(r.destinationId));
  assert.equal(us.flightCount, expected.reduce((n, r) => n + r.flightCount, 0));
  assert.equal(us.matched.size, expected.length);
  const arrivals = D.connections(demo.routes, catalog.get('airport:KMCO'), 'arrivals');
  assert.equal(arrivals.matched.size, 1);
  assert([...arrivals.matched.values()].every(r => r.destinationId === 'KMCO'));
  assert.equal(JSON.stringify(demo), before);

  const domestic = { routeId: 'domestic', originId: 'KJFK', destinationId: 'KMCO', flightCount: 15 };
  assert.equal(D.connections([domestic, domestic], catalog.get('country:US'), 'both').flightCount, 15);
});

test('retains destination identity across dates and returns an explicit empty route set', () => {
  const state = D.createState(FlightData.days[0]);
  state.destinationId = 'city:ORL';
  const selected = catalog.get(state.destinationId);
  const first = FlightData.getDemo(state.day, 'medium');
  const next = FlightData.getDemo(FlightData.days[1], 'medium');
  assert.equal(D.connections(first.routes, selected).flightCount, 84);
  assert.equal(D.connections(next.routes, selected).flightCount, 108);
  assert.equal(first.anchors.KMCO, next.anchors.KMCO);
  assert.equal(D.connections([], selected).flightCount, 0);
  assert.equal(D.createState(state.day).destinationId, null);
});

test('layers attenuate unrelated routes and exclude fully hidden fibers from GPU picking', () => {
  assert.equal(D.layerOpacity('all', false, false), 1);
  assert.equal(D.layerOpacity('highlight', true, false), 1);
  assert(D.layerOpacity('highlight', false, false) > 0 && D.layerOpacity('highlight', false, false) < 1);
  assert.equal(D.layerOpacity('isolate', false, false), 0);
  assert.equal(D.layerPickable('highlight', false, false), true);
  assert.equal(D.layerPickable('isolate', false, false), false);
  assert.equal(D.layerPickable('isolate', false, true), false);
  assert.equal(D.layerPickable('isolate', true, false), true);
});
