'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const needle = require('./needle.js');
const FlightData = require('./flights.js');
const LoomMaterials = require('./materials.js');

test('picking returns the nearest visible fiber ID and longitudinal coordinate', () => {
  const pixels = new Uint8Array(needle.pickSize ** 2 * 4);
  function write(x, y, code, t) {
    pixels.set([code % 256, Math.floor(code / 256), t, 255], (y * needle.pickSize + x) * 4);
  }
  write(24, 23, 261, 113);
  write(27, 27, 13, 98);
  const hit = needle.decodePick(pixels, 7);
  assert.equal(hit.main.code, 261);
  assert.equal(hit.main.t, 113 / 255);
  assert.equal(hit.candidates.length, 2);
  assert.equal(needle.decodePick(pixels, .15), null);
});

test('pointer deltas are direct inside the canvas and clamp only at its bounds', () => {
  assert.deepEqual(needle.pointerOffset({x:100,y:120}, {x:220,y:180}, 40, 300, 350), [3, -1.5]);
  assert.deepEqual(needle.pointerOffset({x:100,y:120}, {x:-22,y:400}, 40, 300, 350), [-2.5, -5.75]);
  for (const anchor of [.02,.15,.5,.87,.98]) {
    assert.equal(needle.influence(anchor, anchor, 2), 1);
    assert(needle.influence(anchor + .01, anchor, 2) > .99);
  }
  assert.equal(needle.influence(0, .5, 2), 0);
  assert.equal(needle.influence(1, .5, 2), 0);
});

test('existing strand IDs survive density rebuilds', () => {
  const source = fs.readFileSync(require.resolve('./loom.js'), 'utf8');
  const loom = vm.runInNewContext(source + '\nTextileLoom', { FlightData, LoomMaterials });
  const data = {
    seed: 45, anchors: { x: [-2, 0, 0], y: [2, 1, 0] },
    routes: [{ id: 'demo', from: 'x', to: 'y', flights: 240, concentration: .6, distance: .8, lift: .8, width: .7, color: '#A9C1FD' }]
  };
  const quality = loom.qualityFor(620);
  const low = loom.buildFibers(data, quality);
  const high = loom.buildFibers({ ...data, routes: [{ ...data.routes[0], flights: 620 }] }, quality);
  assert(high.weft.length > low.weft.length);
  assert.equal(JSON.stringify(high.warp.map(f => f.id)), JSON.stringify(low.warp.map(f => f.id)));
  assert.equal(JSON.stringify(high.weft.slice(0, low.weft.length).map(f => f.id)), JSON.stringify(low.weft.map(f => f.id)));
});

test('two displaced threads persist, cancellation is local, and reset restores both', () => {
  const events = new Map();
  let captured, now = 300;
  let count = 0, resetting = false;
  const canvas = {
    addEventListener: (type, handler) => events.set(type, handler),
    getBoundingClientRect: () => ({left: 0, top: 0}), clientWidth: 300, clientHeight: 350,
    hasPointerCapture: id => id === captured, setPointerCapture: id => { captured = id; },
    releasePointerCapture: () => { captured = undefined; }, focus() {}
  };
  const style = { setProperty() {} };
  const cursor = { style, dataset: {} };
  const card = { style, querySelector: () => ({}) };
  const host = {
    querySelector: name => ({canvas, '.needle-cursor': cursor, '.thread-info': card}[name]),
    classList: {toggle() {}}, clientWidth: 300, clientHeight: 350
  };
  const main = {fiber: {id: 'demo-0', group: 'demo', system: 'weft', code: 1}, t: .5, x: 24, y: 24};
  const neighbor = {fiber: {id: 'warp-0', group: 'warp', system: 'warp', code: 2}, t: .4, x: 27, y: 24};
  const second = { ...main, fiber: { ...main.fiber, id: 'demo-1', code: 3 } };
  let picked = main;
  const source = fs.readFileSync(require.resolve('./needle.js'), 'utf8');
  const interaction = vm.runInNewContext(source + '\nTextileNeedle', {
    performance: {now: () => now}, document: {addEventListener() {}}
  }).mount(host, () => ({ main:picked, candidates:[main, neighbor] }), () => {}, () => {}, () => {}, (n, pending) => { count = n; resetting = pending; });
  const pointer = {pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0, clientX: 100, clientY: 130};
  interaction.update(0, 40, false);
  events.get('pointerdown')(pointer);
  assert.equal(captured, 9);
  assert.equal(cursor.dataset.state, 'hold');
  events.get('pointermove')({...pointer, clientX: 180, clientY: 90});
  let frame = interaction.update(250, 40, false);
  assert.equal(frame.highlight, 1);
  assert.equal(cursor.dataset.state, 'drag');
  assert.equal(frame.pull.length, 4);
  assert.equal(frame.pull[0], main.fiber.code);
  assert.equal(frame.pull[2], 2);
  assert.equal(frame.pull[3], 1);
  const preview = [...frame.pull];
  events.get('pointerup')(pointer);
  assert.equal(captured, undefined);
  assert.equal(card.hidden, true);
  frame = interaction.update(480, 40, false);
  assert.equal(frame.highlight, 0);
  assert.equal(frame.pull[2], 0);
  const first = interaction.getEdit(main.fiber.id);
  assert.deepEqual(needle.offsetAt(first, .5), preview.slice(2));
  for (const t of [.25,.42,.5,.62,.9]) {
    const weight = needle.influence(t, preview[1], Math.hypot(...preview.slice(2)));
    assert.deepEqual(needle.offsetAt(first, t), [preview[2] * weight, preview[3] * weight]);
  }
  assert.equal(count, 1);
  picked = { ...main, t: .64 };
  events.get('pointerdown')(pointer);
  const contact = Math.fround(picked.t);
  const originalContact = needle.offsetAt(first, contact);
  events.get('pointermove')({ ...pointer, clientX: 60, clientY: 170 });
  frame = interaction.update(510, 40, false);
  assert.equal(frame.pull[1], contact);
  assert.equal(frame.pull[2], -1);
  assert.equal(frame.pull[3], -1);
  events.get('pointerup')(pointer);
  assert.deepEqual(needle.offsetAt(first, contact), originalContact.map(value => value - 1));
  assert.equal(first.length, 2);
  assert.equal(count, 1);
  picked = second;
  now = 600;
  events.get('pointerdown')(pointer);
  events.get('pointermove')({ ...pointer, clientX: 77 });
  events.get('pointerup')(pointer);
  interaction.update(780, 40, false);
  assert.equal(count, 2);
  assert(needle.offsetAt(interaction.getEdit(second.fiber.id), .5)[0] < 0);
  assert.equal(interaction.getEdit(main.fiber.id), first);
  events.get('pointerdown')(pointer);
  interaction.clear();
  assert.equal(captured, undefined);
  assert.equal(card.hidden, true);
  assert.equal(count, 2);
  assert.equal(interaction.update(801, 40, false).highlight, 0);
  now = 900;
  interaction.reset();
  assert.equal(resetting, true);
  const halfway = interaction.update(1060, 40, false);
  assert(halfway.resetWeight > 0 && halfway.resetWeight < 1);
  interaction.update(1230, 40, false);
  assert.equal(count, 0);
  assert.equal(resetting, false);
  assert.equal(interaction.getEdit(main.fiber.id), undefined);
  assert.equal(interaction.getEdit(second.fiber.id), undefined);
  events.get('pointerdown')(pointer);
  events.get('pointerup')(pointer);
  assert.equal(card.hidden, false, 'A tap keeps the details of the selected thread visible');
  assert.equal(count, 0);
  interaction.clear();
  picked = neighbor;
  const mouse = { ...pointer, pointerType: 'mouse' };
  events.get('pointermove')(mouse);
  assert.equal(interaction.update(1590, 40, false).highlight, 0);
  events.get('pointerdown')(mouse);
  assert.equal(captured, undefined);
  assert.equal(card.hidden, false);
  events.get('pointermove')({ ...mouse, clientX: 150 });
  frame = interaction.update(1700, 40, false);
  assert.equal(frame.highlight, 0);
  assert(frame.pull.every(component => component === 0));
});
