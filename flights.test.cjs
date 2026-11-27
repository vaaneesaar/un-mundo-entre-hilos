'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const FlightData = require('./flights.js');
const LoomMaterials = require('./materials.js');
const source = fs.readFileSync(require.resolve('./loom.js'), 'utf8')
  .replace('return { mount, buildFibers, qualityFor };', 'return { buildFibers, qualityFor, meshFibers };');
const loom = vm.runInNewContext(source + '\nTextileLoom', { FlightData, LoomMaterials });

test('UTC validates calendar dates and only counts available distinct flights in the UTC day', () => {
  const day = '2026-01-14';
  assert.deepEqual(FlightData.dayBounds(day), ['2026-01-14T00:00:00.000Z','2026-01-15T00:00:00.000Z']);
  assert.throws(() => FlightData.dayBounds('2026-02-30'), RangeError);
  const first = { id: 'F1', sourceId: 'demo', originId: 'MMMX', destinationId: 'KMCO', dateUtc: day };
  const second = { ...first, id: 'F2', timeUtc: '2026-01-13T20:00:00-04:00' };
  const result = FlightData.aggregateFlights([
    first, first, second, { ...second, id: 'F3', timeUtc: '2026-01-15T00:00:00Z' },
    { ...first, id: 'F4', status: 'unavailable' },
    { ...first, id: 'F5', originId: 'KMCO', destinationId: 'MMMX' },
    { ...first, sourceId: 'other' }
  ], day);
  assert.deepEqual(result.map(r => r.flightCount), [1, 2, 1]);
  assert.equal(new Set(result.map(r => r.routeId)).size, 3);
});

test('catalog anchors are stable, geodesic distance is symmetric and can be absent', () => {
  const { MMMX, KMCO } = FlightData.airports;
  assert.deepEqual(FlightData.plotAnchor(MMMX), FlightData.anchors.MMMX);
  assert.notDeepEqual(FlightData.plotAnchor(MMMX), FlightData.plotAnchor(KMCO));
  assert.equal(FlightData.distanceKm(MMMX, KMCO), FlightData.distanceKm(KMCO, MMMX));
  assert(FlightData.distanceKm(MMMX, KMCO) > 2000 && FlightData.distanceKm(MMMX, KMCO) < 2100);
  assert.equal(FlightData.distanceKm(MMMX, {}), null);
  assert.throws(() => FlightData.plotAnchor({id:'bad', lat:100, lon:0}), RangeError);
});

test('bounded proportional allocation retains small routes or reports them as omitted', () => {
  const routes = [300, 170, 30, 1].map((flightCount, index) => ({ routeId: 'r' + index, flightCount }));
  const { shares, omitted } = FlightData.allocate(routes, 87);
  assert.equal(omitted.length, 0);
  assert.equal(shares.reduce((n, s) => n + s.count, 0), 87);
  assert.equal(shares.at(-1).count, 1);
  assert(shares[0].count > shares[1].count && shares[1].count > shares[2].count);
  assert.equal(FlightData.allocate(routes, 2).omitted.length, 2);
  assert.equal(FlightData.allocate(routes, 2000).shares.reduce((n, s) => n + s.count, 0), 501);
});

test('both days produce increasing density, preserve flight counts, anchors and route identities', () => {
  for (const date of FlightData.days) {
    const quality = loom.qualityFor(1000);
    const density = [];
    for (const activity of ['low','medium','high']) {
      const dataset = FlightData.getDemo(date, activity);
      const data = FlightData.toLoomData(dataset);
      const fibers = loom.buildFibers(data, quality);
      const reversed = loom.buildFibers(FlightData.toLoomData({
        ...dataset, routes: [...dataset.routes].reverse()
      }), quality);
      const signature = f => JSON.stringify(f.weft.map(thread => [thread.id, thread.sample(.45)]));
      assert.equal(signature(fibers), signature(reversed));
      assert.equal(fibers.omitted, 0);
      const counts = new Map();
      for (const fiber of fibers.weft) {
        const info = fiber.flightInfo;
        counts.set(info.routeId, (counts.get(info.routeId) || 0) + info.represented);
        assert.equal(JSON.stringify(fiber.sample(0)), JSON.stringify(data.anchors[info.originId]));
        assert.equal(JSON.stringify(fiber.sample(1)), JSON.stringify(data.anchors[info.destinationId]));
        assert.equal(info.status, 'demo');
        assert.equal(info.periodStart.slice(0, 10), date);
      }
      for (const route of dataset.routes) assert.equal(counts.get(route.routeId), route.flightCount);
      assert.notEqual(dataset.daily.sourceId, dataset.metadata.sourceId);
      assert.notEqual(dataset.daily.flightCount, dataset.routes.reduce((n, r) => n + r.flightCount, 0));
      assert(!fibers.warp.some(fiber => fiber.flightInfo));
      density.push(fibers.weft.length);
    }
    assert(density[0] < density[1] && density[1] < density[2] && density[2] <= 180);
  }
});

test('rebuild preserves common IDs, retains removed fibers only in the transition and keeps pick codes valid', () => {
  const q = loom.qualityFor(360);
  const build = (day, level) => loom.buildFibers(FlightData.toLoomData(FlightData.getDemo(day, level)), q);
  const previous = build(FlightData.days[0], 'high');
  const prior = new Map([...previous.warp, ...previous.weft].map(fiber => [fiber.id, fiber]));
  const next = build(FlightData.days[1], 'low');
  const settled = new Set(previous.weft.map(fiber => fiber.id));
  const mesh = loom.meshFibers(next, q, settled, prior);
  assert(mesh.activeIndexCount < mesh.indices.length);
  assert(mesh.vertices.every(Number.isFinite));
  assert.equal(mesh.byCode.filter(fiber => fiber && !fiber.retired).length, next.warp.length + next.weft.length);
  for (const fiber of next.weft) {
    const result = mesh.ranges.get(fiber.id);
    assert.equal(result.retired, false);
    assert.equal(mesh.byCode[result.code].id, fiber.id);
    assert.equal(result.delay < 0, settled.has(fiber.id));
  }
});

test('dense allocations prioritize a destination within the shared cap and retain exact route counts', () => {
  const rows = Array.from({ length: 200 }, (_, i) => ({
    routeId: String(i), flightCount: 201 - i, textile: { distance: i / 200 }
  }));
  const focus = new Set(['190', '191', '192']);
  const { shares, omitted } = FlightData.allocateFocused(rows, 100, focus);
  assert.equal(shares.reduce((sum, share) => sum + share.count, 0), 100);
  assert.equal(shares.length + omitted.length, 200);
  assert([...focus].every(id => shares.some(row => row.route.routeId === id)));
  assert(shares.every(row => row.count <= row.route.flightCount));
  assert.deepEqual(FlightData.allocateFocused([...rows].reverse(), 100, focus), { shares, omitted });
});
