'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const FlightData = require('./flights.js');
const LoomMaterials = require('./materials.js');
const LoomDestinations = require('./destinations.js');
const LoomEmbroidery = require('./embroidery.js');
const original = fs.readFileSync(require.resolve('./loom.js'), 'utf8');
const source = original.replace('return { mount, buildFibers, qualityFor };', 'return { buildFibers, qualityFor, meshFibers, projectedBounds, comparisonProjection };');
const loom = vm.runInNewContext(source + '\nTextileLoom', { FlightData, LoomEmbroidery, LoomMaterials });
const symbol = LoomEmbroidery.forDestination('city:ORL');
const catalog = LoomDestinations.buildCatalog(FlightData.airports);
const orlando = catalog.get('city:ORL');

function scenario(width, level, day = FlightData.days[0], direction = 'both') {
  const dataset = FlightData.getDemo(day, level);
  const summary = LoomDestinations.connections(dataset.routes, orlando, direction);
  const input = FlightData.toLoomData(dataset);
  const request = { symbol, routeIds: new Set(summary.matched.keys()) };
  const quality = loom.qualityFor(width);
  const connections = loom.buildFibers(input, quality);
  const figure = loom.buildFibers(input, quality, request);
  return { figure, connections, quality, summary, request, input };
}

test('Orlando uses its own symbol and the seven countries have distinct symbols', () => {
  assert.equal(symbol, LoomEmbroidery.forDestination('airport:KMCO'));
  const symbols = ['FR', 'MX', 'US', 'GB', 'JP', 'BR', 'ES']
    .map(iso => LoomEmbroidery.forDestination('country:' + iso));
  assert.equal(new Set(symbols.map(figure => figure.id)).size, 7);
  for (const figure of symbols) {
    const { connections, quality } = scenario(400, 'low');
    const related = connections.weft.slice(0, 18);
    const woven = LoomEmbroidery.build(figure, related, quality);
    assert(woven.supports.length > 0);
    assert.deepEqual(woven.fibers.map(fiber => fiber.flightInfo), related.map(fiber => fiber.flightInfo));
    for (const fiber of [...woven.fibers, ...woven.supports]) {
      for (let step = 0; step <= 30; step++) assert(fiber.sample(step / 30).every(Number.isFinite), figure.name);
    }
  }
  assert.equal(LoomEmbroidery.forDestination('city:PAR'), null);
});

test('each embroidered fiber keeps the original identity, quantity and source in both dates', () => {
  for (const day of FlightData.days) {
    for (const width of [350, 650, 1000]) {
      for (const activity of ['low','medium','high']) {
        const { figure, connections, summary } = scenario(width, activity, day);
        const represented = figure.weft.filter(fiber => fiber.figure);
        assert(represented.length > 0);
        assert.equal(represented.reduce((sum, fiber) => sum + fiber.flightInfo.represented, 0), summary.flightCount);
        for (const fiber of figure.weft) {
          const originalFiber = connections.weft.find(candidate => candidate.id === fiber.id);
          assert.equal(fiber.flightInfo.flightCount, originalFiber.flightInfo.flightCount);
          assert.equal(fiber.flightInfo.represented, originalFiber.flightInfo.represented);
          assert.equal(fiber.flightInfo.routeId, originalFiber.flightInfo.routeId);
          assert.equal(fiber.flightInfo.sourceId, originalFiber.flightInfo.sourceId);
          if (fiber.figure) assert.notEqual(JSON.stringify(fiber.sample(.41)), JSON.stringify(originalFiber.sample(.41)));
        }
        assert(figure.supports.length > 20);
        assert(figure.supports.every(fiber => !fiber.flightInfo && fiber.system === 'support'));
        assert.equal(JSON.stringify(figure.warp.map(f=>f.sample(.25))), JSON.stringify(connections.warp.map(f=>f.sample(.25))));
      }
    }
  }
});

test('activity adds stitches and relief while preserving the outline across scenarios', () => {
  const low = scenario(1000, 'low').figure;
  const high = scenario(1000, 'high').figure;
  assert(high.weft.filter(f=>f.figure).length > low.weft.filter(f=>f.figure).length);
  assert(high.supports.length > low.supports.length);
  const a = low.supports[0].sample(.45), b = high.supports[0].sample(.45);
  assert.equal(a[0], b[0]);
  assert.equal(a[1], b[1]);
  assert(b[2] > a[2]);
  const mobile = scenario(350, 'low').figure;
  assert(mobile.supports[0].sample(.45)[0] !== a[0]);
});

test('an empty Orlando filter leaves the warp available without creating imaginary stitching', () => {
  const { figure, summary } = scenario(1000, 'low', FlightData.days[0], 'arrivals');
  assert.equal(summary.flightCount, 0);
  assert(!figure.weft.some(fiber=>fiber.figure));
  assert.equal(figure.supports.length, 0);
});

test('WebGL buffer contains reversible morph offsets and retires the decorative threads on return', () => {
  const { figure, connections, quality } = scenario(350, 'medium');
  const previous = new Map([...connections.warp, ...connections.weft].map(fiber=>[fiber.id,fiber]));
  const settled = new Set(connections.weft.map(fiber=>fiber.id));
  const forward = loom.meshFibers(figure, quality, settled, previous);
  const embroidered = [...forward.ranges.values()].find(fiber=>fiber.figure && fiber.system==='weft');
  assert(embroidered.previousSample);
  assert(forward.vertices.every(Number.isFinite));
  const bounds = loom.projectedBounds(forward, true);
  assert(bounds.width > 0 && bounds.height > 0);
  const back = loom.meshFibers(connections, quality, settled, forward.ranges);
  assert(back.activeIndexCount < back.indices.length);
  assert(back.ranges.get(embroidered.id).previousSample);
  assert([...back.ranges.values()].filter(fiber=>fiber.system==='support').every(fiber=>fiber.retired));
});

test('open mesh, bands and braids add component geometry under one addressable fiber code', () => {
  const { connections, quality } = scenario(1000, 'high');
  const mesh = loom.meshFibers(connections, quality, new Set(), new Map());
  const logicalCount = connections.warp.length + connections.weft.length;
  assert.equal(mesh.ranges.size, logicalCount);
  let kinds = new Set();
  for (const fiber of mesh.ranges.values()) {
    const surface = LoomMaterials.profile(fiber.material, fiber.radius, fiber.strength, quality.lod);
    kinds.add(surface.kind);
    const perRing = fiber.vertexCount / fiber.centers.length;
    assert.equal(perRing, surface.parts.length * 6);
    const row = Math.floor(fiber.centers.length / 2);
    const start = fiber.vertexStart + row * perRing;
    for (let i = 0; i < perRing; i++) {
      assert.equal(mesh.vertices[(start + i) * mesh.stride + 9], Math.fround(row / (fiber.centers.length - 1)));
    }
    assert.equal(mesh.byCode[fiber.code].id, fiber.id);
  }
  for (const kind of ['cotton','silk','braid','mesh','band']) assert(kinds.has(kind));
  assert(mesh.indices.every(i => i < mesh.vertexCount));
});

test('mobile material profiles use fewer segments and preserve the weave crossover', () => {
  const mobile = LoomMaterials.profile('mesh', .022, .6, .67);
  const desktop = LoomMaterials.profile('mesh', .022, .6, 1);
  assert(mobile.parts.length < desktop.parts.length);
  assert(mobile.steps < desktop.steps);
  const binding = desktop.parts.find(part => part.turns > 0);
  assert(LoomMaterials.offset(binding, .25)[0] * LoomMaterials.offset(binding, .5)[0] < 0);
  assert(Math.abs(LoomMaterials.offset(binding, 1)[1]) < 1e-10);
});

test('the figure registry supports city and country definitions and rejects duplicate ownership', () => {
  const city = { destinationIds: ['city:PAR'] };
  const country = { destinationIds: ['country:FR'] };
  const index = LoomEmbroidery.indexSymbols([city, country]);
  assert.equal(index.get('city:PAR'), city);
  assert.equal(index.get('country:FR'), country);
  assert.throws(() => LoomEmbroidery.indexSymbols([city, city]), /Duplic|duplic/);
});

test('comparison framing fits actual castillo fibers at both desktop and mobile sizes', () => {
  for (const width of [368, 612, 740]) {
    const height = 450;
    const frame = loom.comparisonProjection(width, height, true);
    assert(frame.unit > loom.comparisonProjection(width, height, false).unit);
    for (const day of FlightData.days) {
      const { figure } = scenario(670, 'high', day);
      for (const fiber of [...figure.weft.filter(fiber => fiber.figure), ...figure.supports]) {
        for (let step = 0; step <= 30; step++) {
          const [x, y, z] = fiber.sample(step / 30);
          assert(Math.abs(x + z * .26 - frame.x) * frame.unit <= width / 2);
          assert(Math.abs(y - z * .28 - frame.y) * frame.unit <= height / 2);
        }
      }
    }
  }
});
