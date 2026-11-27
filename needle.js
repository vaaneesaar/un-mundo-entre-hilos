'use strict';

const TextileNeedle = (() => {
  const pickSize = 48;
  const pickSpan = 36;

  function decodePick(pixels, tolerance) {
    const hits = new Map();
    for (let y = 0; y < pickSize; y++) {
      for (let x = 0; x < pickSize; x++) {
        const offset = (y * pickSize + x) * 4;
        const code = pixels[offset] + pixels[offset + 1] * 256;
        if (!code) continue;
        const distance = Math.hypot(x + .5 - pickSize / 2, y + .5 - pickSize / 2) * pickSpan / pickSize;
        if (!hits.has(code) || distance < hits.get(code).distance) {
          hits.set(code, { code, t: pixels[offset + 2] / 255, distance, x, y });
        }
      }
    }
    const candidates = [...hits.values()].sort((a, b) => a.distance - b.distance);
    const main = candidates[0];
    return main?.distance <= tolerance ? { main, candidates } : null;
  }

  // Match the vertex shader so committing a stroke reproduces the last preview.
  function influence(t, anchor, length) {
    const radius = Math.min(.48, .23 + length * .09);
    const edge = t < anchor ? anchor : 1 - anchor;
    const span = Math.min(radius, Math.max(.12, edge));
    const u = Math.min(1, Math.abs(t - anchor) / span);
    return 1 - u * u * u * (u * (u * 6 - 15) + 10);
  }

  function offsetAt(strokes, t) {
    let x = 0, y = 0;
    for (const stroke of strokes ?? []) {
      const weight = influence(t, stroke.t, stroke.length);
      x += stroke.x * weight;
      y += stroke.y * weight;
    }
    return [x, y];
  }

  function pointerOffset(start, point, scale, width, height) {
    const x = Math.max(0, Math.min(width, point.x)) - start.x;
    const y = Math.max(0, Math.min(height, point.y)) - start.y;
    return [Math.fround(x / scale), Math.fround(-y / scale)];
  }

  const smooth = t => t * t * (3 - 2 * t);
  const significant = offset => Math.hypot(...offset) > .0001;

  function mount(host, pick, wake, onSelect = () => {}, onEdit = () => {}, onCount = () => {}, onGesture = () => {}) {
    const canvas = host.querySelector('canvas');
    const needle = host.querySelector('.needle-cursor');
    const card = host.querySelector('.thread-info');
    const pull = new Float32Array(4);
    let point, hover, active, selected, lastPick = -Infinity;
    const edits = new Map();
    let resetStart = null, resetWeight = 1;
    let unit = 1, reduced = false, angle = -36, phase = '';

    const status = { hold: 'Sujeta', drag: 'En tensión', selected: 'Seleccionada' };
    function showCard(fiber, nextPhase) {
      if (selected?.id !== fiber.id || phase !== nextPhase) {
        const fields = name => card.querySelector(`[data-thread-${name}]`);
        const route = fiber.flightInfo;
        const corridor = fiber.corridor;
        fields('label').textContent = route?.status === 'demo' ? 'Datos de demostración' : 'Datos del vuelo';
        fields('type').textContent = corridor ? `Banda ${corridor.lane + 1} · ${FlightData.countFormat.format(corridor.flightCount)} vuelos` : route ? 'Ruta seleccionada'
          : fiber.system === 'support' ? 'Puntada estructural del bordado. No representa vuelos'
          : 'Hilo estructural del telar. Forma parte de la urdimbre y no representa vuelos';
        fields('symbol').hidden = !fiber.figure;
        fields('route').hidden = !route && !corridor;
        if (corridor) {
          const format = count => FlightData.countFormat.format(count);
          const { info } = corridor.routes[0];
          const examples = corridor.routes.slice(0, 3).map(item =>
            `${item.info.origin?.code ?? item.from} → ${item.info.destination?.code ?? item.to} · ${format(item.flights)}`);
          fields('origin').textContent = `${format(corridor.routes.length)} rutas direccionales`;
          fields('destination').textContent = `Rutas con más vuelos · ${examples.join(' / ')}`;
          fields('date').textContent = info.periodLabel ?? `${FlightData.dateFormat.format(new Date(info.periodStart))} UTC`;
          fields('count').textContent = 'Agrupación textil de rutas observadas';
          fields('distance').textContent = '';
          fields('source').textContent = `Fuente · ${info.sourceName ?? info.sourceId}`;
        } else if (route) {
          const place = airport => airport ? `${airport.city} (${airport.code})` : 'Sin información';
          const format = count => FlightData.countFormat.format(count);
          fields('origin').textContent = `Origen · ${place(route.origin)}`;
          fields('destination').textContent = `Destino · ${place(route.destination)}`;
          fields('date').textContent = route.periodLabel ?? `${FlightData.dateFormat.format(new Date(route.periodStart))} UTC`;
          fields('count').textContent = `${format(route.represented)} vuelos representados por esta hebra · ${format(route.flightCount)} en la ruta`;
          fields('distance').textContent = route.distanceKm === null ? 'Distancia no disponible' : `Distancia aprox. · ${format(route.distanceKm)} km`;
          fields('source').textContent = `Fuente · ${route.status === 'demo' ? 'Muestra sintética' : route.sourceName ?? route.sourceId}`;
        }
        card.querySelector('[data-thread-state]').textContent = status[nextPhase];
      }
      if (selected?.id !== fiber.id) onSelect(fiber);
      selected = fiber;
      phase = nextPhase;
      card.hidden = false;
    }

    function showNeedle() {
      const state = active ? phase : hover ? 'near' : 'explore';
      const inside = point && point.x >= 0 && point.y >= 0 && point.x <= canvas.clientWidth && point.y <= canvas.clientHeight;
      const visible = inside && (point.type !== 'touch' || active);
      needle.hidden = !visible;
      host.classList.toggle('needle-active', Boolean(inside && point.type !== 'touch'));
      if (!visible) return;
      needle.dataset.state = state;
      needle.style.transform = `translate(${point.x}px, ${point.y}px) rotate(${angle}deg)`;
    }

    function clear() {
      const pointer = active?.pointer;
      if (active) onGesture('cancel');
      if (selected) onSelect(null);
      point = hover = active = selected = null;
      phase = '';
      lastPick = -Infinity;
      pull.fill(0);
      card.hidden = true;
      if (pointer !== undefined && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
      showNeedle();
      wake();
    }

    function local(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top, type: event.pointerType };
    }

    canvas.addEventListener('pointermove', event => {
      if (active && active.pointer !== event.pointerId) return;
      const next = local(event);
      if (point && !reduced) {
        const dx = next.x - point.x, dy = next.y - point.y;
        if (Math.hypot(dx, dy) > 1.5) {
          const target = Math.atan2(dy, dx) * 180 / Math.PI + 180;
          angle = (angle + ((target - angle + 900) % 360 - 180) * .32) % 360;
        }
      }
      point = next;
      if (active) {
        active.offset = pointerOffset(active.start, point, active.scale, canvas.clientWidth, canvas.clientHeight);
        if (significant(active.offset)) {
          showCard(active.fiber, 'drag');
          onGesture('tension', active.fiber, Math.hypot(...active.offset));
        }
      }
      showNeedle();
      wake();
    });

    canvas.addEventListener('pointerleave', () => {
      if (active) return;
      point = hover = null;
      showNeedle();
      wake();
    });

    canvas.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || active || resetStart !== null) return;
      const start = local(event);
      const hit = pick(start, start.type === 'mouse' ? 7 : 12);
      if (!hit) {
        clear();
        return;
      }
      canvas.focus({ preventScroll: true });
      point = start;
      const { fiber, t } = hit.main;
      hover = fiber.system === 'weft' ? fiber : null;
      if (hover) {
        canvas.setPointerCapture(event.pointerId);
        active = { pointer: event.pointerId, fiber, t: Math.fround(t), start, scale: unit, offset: [0, 0] };
      }
      showCard(fiber, active ? 'hold' : 'selected');
      const crossing = hit.candidates?.some(candidate => candidate.fiber.id !== fiber.id && candidate.distance <= 3);
      onGesture(crossing ? 'cross' : 'pluck', fiber);
      const { offsetWidth, offsetHeight } = card;
      const right = start.x > host.clientWidth / 2;
      const left = start.x + (right ? -offsetWidth - 12 : 20);
      card.style.setProperty('--card-x', `${Math.max(8, Math.min(host.clientWidth - offsetWidth - 8, left))}px`);
      card.style.setProperty('--card-y', `${Math.max(8, Math.min(host.clientHeight - offsetHeight - 8, start.y + 16))}px`);
      showNeedle();
      wake();
    });

    function finish(event) {
      if (active?.pointer !== event.pointerId) return;
      const held = active;
      const moved = Math.hypot(...held.offset) * held.scale >= 3;
      if (!moved) {
        active = null;
        onGesture('cancel');
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        showCard(held.fiber, 'selected');
        showNeedle();
        wake();
        return;
      }
      clear();
      const [x, y] = held.offset;
      const strokes = edits.get(held.fiber.id) ?? [];
      strokes.push({ t: held.t, x, y, length: Math.hypot(x, y) });
      edits.set(held.fiber.id, strokes);
      onEdit(held.fiber.id, strokes);
      onCount(edits.size, false);
      onGesture('release', held.fiber);
      wake();
    }

    function reset(animate = true) {
      clear();
      if (!animate || reduced) {
        for (const id of edits.keys()) onEdit(id, null);
        edits.clear();
        resetStart = null;
        resetWeight = 1;
      } else if (edits.size && resetStart === null) {
        resetStart = performance.now();
      }
      onCount(edits.size, resetStart !== null);
      wake();
    }

    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', event => { if (active?.pointer === event.pointerId) clear(); });
    canvas.addEventListener('lostpointercapture', event => { if (active?.pointer === event.pointerId) clear(); });
    document.addEventListener('pointerdown', event => {
      if (selected && !event.target.closest('canvas, .thread-info, #emotion-disclosure, #emotion-panel, #emotion-toggle')) clear();
    });

    function update(now, scale, reduceMotion, onDemand) {
      unit = scale;
      reduced = reduceMotion;
      pull.fill(0);
      if (point && !active && point.type !== 'touch' && (onDemand || now - lastPick >= 68)) {
        const fiber = pick(point, 7)?.main.fiber;
        hover = fiber?.system === 'weft' ? fiber : null;
        lastPick = now;
        showNeedle();
      }
      if (resetStart !== null) {
        const progress = reduced ? 1 : Math.min(1, Math.max(0, (now - resetStart) / 320));
        resetWeight = 1 - smooth(progress);
        if (progress === 1) reset(false);
      }
      if (active) pull.set([active.fiber.code, active.t, ...active.offset]);
      const highlighted = active?.fiber ?? hover ?? selected;
      return { pull, resetWeight, highlight: highlighted?.system === 'weft' ? highlighted.code : 0 };
    }

    return {
      clear, update, reset,
      getEdit: id => edits.get(id),
      prune(validIds) {
        for (const id of edits.keys()) {
          if (!validIds.has(id)) {
            edits.delete(id);
            onEdit(id, null);
          }
        }
        onCount(edits.size, resetStart !== null);
      },
      isDragging: () => Boolean(active),
      needsFrame: () => resetStart !== null
    };
  }

  return { mount, decodePick, pointerOffset, influence, offsetAt, pickSize, pickSpan };
})();

if (typeof module !== 'undefined') module.exports = TextileNeedle;
