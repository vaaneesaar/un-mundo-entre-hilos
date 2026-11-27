'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { describe, mount } = require('./loom-audio.js');

class Param {
  constructor() { this.value = 0; this.changes = []; }
  setValueAtTime(value) { this.changes.push(value); }
  setTargetAtTime(value) { this.changes.push(value); }
  linearRampToValueAtTime(value) { this.changes.push(value); }
  exponentialRampToValueAtTime(value) { this.changes.push(value); }
}

class AudioNode {
  connect() {}
  disconnect() {}
}

class Context {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.oscillators = [];
    this.gains = [];
    this.filters = [];
    Context.last = this;
  }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  createGain() {
    const node = Object.assign(new AudioNode(), { gain: new Param() });
    this.gains.push(node);
    return node;
  }
  createBiquadFilter() {
    const node = Object.assign(new AudioNode(), { frequency: new Param(), Q: new Param() });
    this.filters.push(node);
    return node;
  }
  createOscillator() {
    const node = Object.assign(new AudioNode(), {
      frequency: new Param(), detune: new Param(), start() {}, stop() {}
    });
    this.oscillators.push(node);
    return node;
  }
}

function eventTarget() {
  return Object.assign(new EventTarget(), { setAttribute() {}, value: '46', hidden: false });
}

test('a shared scale links volume, route diversity and concentration to separate audio parameters', () => {
  const short = describe([{ flightCount: 6 }]);
  const large = describe(Array.from({ length: 400 }, () => ({ flightCount: 300 })));
  assert(large.density > short.density);
  assert(large.layers > short.layers);
  assert(large.concentration < short.concentration);
  assert.equal(describe([]).flights, 0);
});

test('audio starts only after opt-in and bounds voices, drag and output while visibility changes', async t => {
  t.mock.method(global, 'setTimeout', () => 1);
  t.mock.method(global, 'clearTimeout', () => {});
  Object.assign(global, {
    window: Object.assign(eventTarget(), { AudioContext: Context }),
    document: eventTarget(),
    matchMedia: () => ({ matches: false })
  });
  const button = eventTarget(), volume = eventTarget(), status = {};
  const audio = mount(button, volume, status);
  audio.setVisible(true);
  audio.setScene(Array.from({ length: 400 }, () => ({ flightCount: 100 })), 'day-a');
  audio.build(.7);
  assert.equal(Context.last, undefined);

  button.dispatchEvent(new Event('click'));
  await Promise.resolve();
  const context = Context.last;
  assert.equal(context.state, 'running');
  assert.equal(status.textContent, 'Sonido activado');
  const expire = () => context.oscillators.filter(node => node.onended).forEach(node => {
    node.onended();
    node.onended = null;
  });
  expire();

  audio.build(0);
  for (const progress of [.20, .38, .56, .74, .90]) audio.build(progress);
  assert(context.oscillators.length > 3);
  const tails = context.oscillators.length;
  audio.build(.90);
  assert.equal(context.oscillators.length, tails, 'same stage does not replay');
  audio.build(1, 'complete');
  expire();

  const filterCuts = [];
  for (const emotion of ['nostalgia', 'joy', 'anticipation', 'reunion']) {
    audio.setEmotion(emotion);
    context.currentTime += 1;
    audio.gesture('pluck', { id: 'ruta', flightInfo: { represented: 9 } });
    filterCuts.push(context.filters.at(-1).frequency.value);
    expire();
  }
  assert.equal(new Set(filterCuts).size, 4);
  context.currentTime += 1;
  audio.gesture('tension', { id: 'ruta' }, .4);
  const dragged = context.oscillators.length;
  for (let i = 0; i < 20; i++) {
    context.currentTime += .06;
    audio.gesture('tension', { id: 'ruta' }, i / 20);
  }
  assert.equal(context.oscillators.length, dragged);
  audio.gesture('release', { id: 'ruta' });
  for (let i = 0; i < 30; i++) {
    context.currentTime += .1;
    audio.gesture('pluck', { id: 'ruta' });
  }
  const sounding = context.oscillators.filter(node => node.onended).length;
  assert(sounding <= 5 * 4);
  volume.value = '100';
  volume.dispatchEvent(new Event('input'));
  assert.equal(Math.max(...context.gains[0].gain.changes), .16);
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(context.gains[0].gain.changes.at(-1), 0);
  audio.gesture('pluck', { id: 'ruta' });
  assert.equal(context.oscillators.filter(node => node.onended).length, sounding);
  button.dispatchEvent(new Event('click'));
  assert.equal(status.textContent, 'Sonido silenciado');
});
