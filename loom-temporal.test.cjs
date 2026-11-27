'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const FlightData = require('./flights.js');
const materials = require('./materials.js');
const history = require('./historical.js');
const providers = require('./providers.js');
const time = require('./temporal.js');

const loom = vm.runInNewContext(fs.readFileSync(require.resolve('./loom.js'), 'utf8')
  .replace('return { mount, buildFibers, qualityFor };', 'return { buildFibers, qualityFor, textileMass, projectedBounds, meshFibers };') + '\nTextileLoom;',
{ FlightData, LoomMaterials: materials });
const source = history.create(require('./data/history.json'), file =>
  providers.imported(JSON.parse(fs.readFileSync(require.resolve('./data/' + file), 'utf8')), FlightData, time),
FlightData, time);

function textile(result, country, quality) {
  const data = FlightData.toLoomData({ routes: result.routes, anchors: source.anchors, airports: source.airports,
    metadata: { status: 'sample' } });
  const focus = new Set(data.routes.filter(route =>
    [route.info.origin.country, route.info.destination.country].includes(country)).map(route => route.id));
  return loom.buildFibers(data, quality, null, focus, country ? 'isolate' : 'all');
}

function summarize(bands) {
  const mean = values => Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
  return {
    flights: bands.reduce((sum, band) => sum + band.corridor.flightCount, 0),
    routes: bands.reduce((sum, band) => sum + band.corridor.routes.length, 0),
    bands: bands.length,
    density: mean(bands.map(band => band.strength)),
    width: mean(bands.map(band => materials.profile(band.material, band.radius, band.strength).parts[0].radius * 2)),
    colors: bands.map(band => band.color).join(' ')
  };
}

function spatialExtent(bands, frame) {
  const points = bands.flatMap(band => Array.from({ length: 73 }, (_, i) => band.sample(i / 72)));
  const x = points.map(([x, , z]) => x + .26 * z);
  const y = points.map(([, y, z]) => y - .28 * z);
  const horizontal = (Math.max(...x) - Math.min(...x)) / frame.width;
  const vertical = (Math.max(...y) - Math.min(...y)) / frame.height;
  return { horizontal, vertical, boundingArea: horizontal * vertical };
}

function shapeDifference(a, b) {
  const distances = [];
  for (const band of a) {
    const newBand = b.find(candidate => candidate.id === band.id);
    if (!newBand) continue;
    for (const t of [0, .15, .35, .5, .7, .85, 1]) {
      const next = newBand.sample(t);
      distances.push(Math.hypot(...band.sample(t).map((value, i) => value - next[i])));
    }
  }
  return Number((distances.reduce((sum, distance) => sum + distance, 0) / distances.length).toFixed(3));
}

test('authentic periods reshape the same stable corridor IDs on a shared visual scale', async t => {
  const period = spec => source.read(time.interval(...spec));
  const jan1 = await period(['day', '2019-01-01']);
  const jan2 = await period(['day', '2019-01-02']);
  const week = await period(['week', '2019-01-01']);
  const month = await period(['month', '2019-01-01']);
  const year = await period(['year', '2019-01-01']);
  const next = await period(['month', '2020-01-01']);
  const cases = [
    ['1 ene 2019', jan1], ['2 ene 2019', jan2], ['Semana inicial', week],
    ['Enero 2019', month], ['Año 2019', year], ['Enero 2020', next],
    ['Francia · enero 2019', month, 'FR'], ['México · enero 2019', month, 'MX'],
    ['Japón · enero 2019', month, 'JP'], ['EE. UU. · enero 2019', month, 'US']
  ];
  const quality = loom.qualityFor(1200);
  const cameraBounds = systems => loom.projectedBounds(loom.meshFibers(systems, quality, new Set(), new Map()), false, true);
  const empty = textile({ routes: [] }, null, quality);
  const frame = cameraBounds(empty);
  const pixelsPerUnit = Math.min(1200 * .97 / frame.width, 560 * .96 / frame.height);
  const states = cases.map(([label, result, country]) => {
    const systems = textile(result, country, quality);
    const bands = systems.weft;
    assert.deepEqual(cameraBounds(systems), frame);
    const extent = spatialExtent(bands, frame);
    assert.ok(extent.horizontal >= .88, label + ' / ancho');
    assert.ok(extent.vertical >= .53, label + ' / altura');
    t.diagnostic(JSON.stringify({ label, canvas: [1200, 560], frame: [frame.width, frame.height],
      pixelsPerUnit, ...extent }));
    const stats = summarize(bands);
    const eligible = result.routes.filter(route => !country ||
      [source.airports[route.originId].country, source.airports[route.destinationId].country].includes(country));
    assert.equal(stats.flights, eligible.reduce((sum, route) => sum + route.flightCount, 0));
    assert.equal(stats.routes, eligible.length);
    assert.ok(stats.bands > 0 && stats.bands <= 8);
    t.diagnostic(JSON.stringify({ label, coverage: result.routeSlots + '/' + result.slots, ...stats }));
    return { label, bands, stats };
  });
  for (const [i, j] of [[0,1], [0,2], [0,3], [3,4], [3,5], [6,7], [8,9]]) {
    const a = states[i], b = states[j];
    const movement = shapeDifference(a.bands, b.bands);
    assert.ok(movement > .015, a.label + ' / ' + b.label);
    assert.notEqual(a.stats.colors, b.stats.colors);
    t.diagnostic(`${a.label} / ${b.label}: desplazamiento medio = ${movement}`);
  }
  for (const i of [1,2,3,4]) {
    assert.ok(states[i].stats.density > states[0].stats.density);
    assert.ok(states[i].stats.width > states[0].stats.width);
  }
  const sparse = textile({ routes: [jan1.routes[0]] }, null, quality);
  assert.equal(sparse.weft.length, 1);
  assert.deepEqual(cameraBounds(sparse), frame);
  assert.ok(spatialExtent(sparse.weft, frame).horizontal >= .88);
  assert.ok(spatialExtent(sparse.weft, frame).vertical >= .53);
  assert.equal(states[0].stats.flights, 21480);
  assert.equal(states[1].stats.flights, 26258);
  assert.equal(shapeDifference(states[0].bands, textile(jan1, null, quality).weft), 0);
  assert.deepEqual(summarize(textile(jan1, null, quality).weft), states[0].stats);
  for (const [a, b] of [[0, 1], [50, 500], [21480, 777959], [1e6, 1e7]]) {
    assert.ok(loom.textileMass(a) < loom.textileMass(b));
  }
});

test('the ADSB.lol pilot dates build distinct route-driven textiles', async () => {
  const days = source.dates.filter(day => source.providerAt(day) === 'ADSB.lol');
  const shapes = [];
  for (const day of days) {
    const result = await source.read(time.interval('day', day));
    const bands = textile(result, null, loom.qualityFor(1366)).weft;
    assert(bands.length > 0, day);
    shapes.push(JSON.stringify(bands.map(band => [band.corridor.id, band.sample(.4)])));
  }
  assert.equal(new Set(shapes).size, days.length);
});
