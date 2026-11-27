'use strict';

const TextileLoom = (() => {
  const tau = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const subtract = (a, b) => a.map((n, i) => n - b[i]);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const normalize = (v) => {
    const length = Math.hypot(...v) || 1;
    return v.map(n => n / length);
  };
  const rgb = (hex) => hex.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255);

  function seeded(seed) {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function qualityFor(width) {
    if (width < 465) return { portrait: true, warp: 29, lod: .67, ratio: 1.25 };
    if (width < 730) return { portrait: false, warp: 35, lod: .85, ratio: 1.35 };
    return { portrait: false, warp: 43, lod: 1, ratio: 1.6 };
  }

  function makeWarp(data, quality, layout) {
    const first = -4.85;
    const spacing = 9.7 / (quality.warp - 1);
    const random = seeded(data.seed);
    const colors = ['#AAC9FF', '#B78CF4', '#F9A2BC', '#80D8FF', '#FFCB89', '#C0AAFF'];
    function depthAt(x, y) {
      const transverse = Math.exp(-((x + .75) ** 2) / 3.4);
      const gathering = Math.exp(-((y - .18) ** 2) / 1.4);
      const falloff = Math.max(0, Math.cos(y / 2.44 * Math.PI / 2));
      return falloff * (.56 * transverse * gathering + .19 * Math.sin(x * 1.06 + y * .83) + .10 * Math.sin(y * 2.2 - x * .55));
    }
    const fibers = Array.from({ length: quality.warp }, (_, index) => {
      const x = first + index * spacing;
      const depth = .055 * Math.sin(index * 1.75);
      return {
        id: 'urdimbre-' + index, system: 'warp', group: 'urdimbre',
        phase: random() * tau, color: colors[index % colors.length],
        radius: .0085 + random() * .0050, tension: .56 + random() * .26, steps: 52,
        sample(t) {
          const y = (t - .5) * 4.88;
          return layout([x, y, depthAt(x, y) + depth]);
        }
      };
    });
    for (const y of [-2.44, 2.44]) {
      fibers.push({ id: 'bastidor-' + y, system: 'warp', frameRail: true, phase: 0,
        material: 'wood', color: '#755048', radius: .054, tension: 1, steps: 28,
        sample: t => layout([lerp(-5.04, 5.04, t), y, 0]) });
    }
    return { first, spacing, depthAt, fibers };
  }

  function makeWeft(data, quality, layout, warp, focus) {
    const fibers = [];
    const yarnColors = ['#56CAFF', '#B699FF', '#FF91C6', '#FFC164', '#8C9EFF', '#E8DFFF', '#FF8F84', '#BB78E8'];
    const total = data.routes.reduce((sum, route) => sum + route.flights, 0);
    const budget = data.flightsPerStrand
      ? Math.min(100, Math.round(total / data.flightsPerStrand))
      : FlightData.strandCount(total, quality);
    const allocation = FlightData.allocateFocused(data.routes.map(route => ({
      routeId: route.id, flightCount: route.flights, textile: route
    })), budget, focus);
    const shares = allocation.shares.sort((a, b) => a.route.routeId.localeCompare(b.route.routeId));
    shares.forEach(({ route: { textile: route }, count }) => {
      const start = data.anchors[route.from];
      const end = data.anchors[route.to];
      const routeSeed = FlightData.hash(route.id, data.seed);
      const random = seeded(routeSeed);
      const phaseOffset = routeSeed % 628 / 100;
      const fold = .23 + (routeSeed % 467) / 1000;
      const scale = .55 + route.concentration * .78;
      const span = Math.abs(end[0] - start[0]);
      for (let index = 0; index < count; index++) {
        const phase = random() * tau;
        const spread = ((index * .61803398875 + .5) % 1) * 2 - 1;
        const thickness = (index % 9 === 0 ? .023 : .010) + random() * .006;
        const tension = .34 + route.concentration * .52 + random() * .12;
        const parity = (index + routeSeed) % 2;
        fibers.push({
          id: route.id + '-' + index, system: 'weft', group: route.id, phase, tension,
          steps: Math.max(40, Math.ceil(span / warp.spacing * 6)),
          material: LoomMaterials.routeMaterial(index, routeSeed),
          strength: route.concentration,
          flightInfo: { ...route.info, represented: Math.floor(route.flights / count) + Number(index < route.flights % count) },
          radius: thickness * (.83 + scale * .23),
          color: yarnColors[(routeSeed % yarnColors.length + (index % 9 === 4 ? 3 : 0)) % yarnColors.length],
          sample(t) {
            const x = lerp(start[0], end[0], t);
            if (t === 0) return layout(start);
            if (t === 1) return layout(end);
            const arc = Math.sin(Math.PI * t);
            const attachment = Math.min(1, Math.min(t, 1 - t) * 13);
            const bundle = Math.exp(-((t - fold) ** 2) / .024);
            const gather = bundle * route.concentration;
            const separation = route.width * (1.08 - scale * .12) * (.38 + arc * (.76 - gather * .36));
            const y = lerp(start[1], end[1], t)
              + arc * Math.sin(t * 7.2 + phaseOffset) * route.distance * .86
              + spread * separation * attachment + arc * Math.sin(t * 14 + phase) * .065;
            // At each warp column, adjacent picks alternate on opposite sides of the same depth surface.
            const crossing = Math.PI * ((x - warp.first) / warp.spacing + parity);
            const overUnder = Math.cos(crossing) * (.098 + thickness * .75 + gather * .026);
            // Relief peaks between columns and vanishes at the interlacing points.
            const pocket = Math.sin(crossing) ** 2;
            const foldHeight = bundle * route.lift * (.38 + scale * .46);
            const relief = arc * (foldHeight * (.34 + pocket * .66)
              + pocket * (spread * .06 + lerp(start[2], end[2], t) * .08));
            return layout([x, y, lerp(lerp(start[2], end[2], t), warp.depthAt(x, y) + overUnder + relief, attachment)]);
          }
        });
      }
    });
    return { fibers, omitted: allocation.omitted.length };
  }

  const bandColors = ['#70CBFF', '#DCDFFF', '#FF75B0', '#84A9FF', '#AC8EF8', '#FF985F', '#59D1F2', '#E96DAD'];
  // Each path has a distinct silhouette and travels between foreground and background.
  const drapes = [
    [[1.48,1.78,.88,.28,.98,1.62,1.51], [-.54,-.64,.11,.63,-.28,-.35,.12]],
    [[.58,.81,1.60,1.13,.23,.44,.94], [.53,.32,-.46,-.51,.52,.68,-.12]],
    [[-1.23,-.50,.70,.48,-.52,.22,1.20], [.54,-.10,.63,.33,-.56,.15,.47]],
    [[.20,-.31,-.80,-.45,.23,.90,.64], [-.34,.26,-.47,.43,.29,-.51,-.32]],
    [[-1.67,-.91,-.42,.05,-.50,-.89,-.10], [-.18,.49,.61,-.38,.38,.56,.11]],
    [[-.38,-.95,-.19,.30,-.40,-1.07,-1.68], [-.58,-.47,-.39,.38,-.21,.53,.48]],
    [[-1.95,-1.44,-.72,-1.23,-.61,.25,.87], [.36,-.58,-.10,.42,.55,-.46,-.60]],
    [[-.69,-1.37,-1.76,-1.44,-1.00,-.43,-1.20], [-.15,.36,.60,-.32,-.55,.19,.41]]
  ];

  function drapeAt(knots, t) {
    const index = Math.min(knots.length - 2, Math.floor(t * (knots.length - 1)));
    const u = t * (knots.length - 1) - index;
    const b = knots[index], c = knots[index + 1];
    const a = knots[Math.max(0, index - 1)], d = knots[Math.min(knots.length - 1, index + 2)];
    return lerp(b, c, u * u * (3 - 2 * u))
      + .43 * u * (1 - u) * ((c - a) * (1 - u) - (d - b) * u);
  }

  // Fixed scale for every period and both comparison panels. The logarithm
  // gives small counts room; the rational curve approaches 1 without clipping.
  function textileMass(flights) {
    const weight = Math.log1p(flights / 80);
    const fineWeave = (1 + Math.tanh(3.2 * Math.log((flights + 80) / 3100))) / 2;
    const layeredWeave = (1 + Math.tanh(1.15 * Math.log((flights + 80) / 85000))) / 2;
    return .54 * weight / (weight + 3.8) + .22 * fineWeave + .24 * layeredWeave;
  }

  // The airport projection stays fixed. Spread each anchor onto adjacent
  // warp columns so nearby airports influence the same section of the textile.
  function depositAnchor(columns, anchor, weight, direction) {
    const position = (anchor[0] + 4.85) / 9.7 * (columns.length - 1);
    const start = Math.floor(position);
    for (let i = Math.max(0, start - 1); i <= Math.min(columns.length - 1, start + 2); i++) {
      const blend = Math.max(0, 1 - Math.abs(i - position) / 1.65) ** 2 * weight;
      columns[i][0] += blend;
      columns[i][1] += anchor[1] * blend;
      columns[i][2] += (anchor[2] + direction * .40) * blend;
    }
  }

  function describeCorridor(routes, anchors, total) {
    const from = [0, 0, 0], to = [0, 0, 0];
    const columns = Array.from({ length: 11 }, () => [0, 0, 0]);
    let distance = 0, east = 0, international = 0;
    for (const route of routes) {
      const weight = route.flights / total;
      const a = anchors[route.from], b = anchors[route.to];
      for (let axis = 0; axis < 3; axis++) {
        from[axis] += a[axis] * weight;
        to[axis] += b[axis] * weight;
      }
      depositAnchor(columns, a, weight, -1);
      depositAnchor(columns, b, weight, 1);
      distance += route.distance * weight;
      east += Math.tanh((b[0] - a[0]) / 1.4) * weight;
      if (route.info.origin.country !== route.info.destination.country) international += weight;
    }
    const profile = columns.map(([density, height, relief]) => [
      density / (density + .20), height / (density + .13), relief / (density + .13)
    ]);
    return { from, to, distance, east, international,
      gathers: profile.map(column => column[0]), heights: profile.map(column => column[1]),
      reliefs: profile.map(column => column[2]) };
  }

  function historicalBands(routes, anchors, layout, focus, mode, portrait) {
    const groups = new Map();
    const split = mode !== 'all';
    for (const route of routes) {
      if (!route.flights) continue;
      // The two directional airport IDs form a stable, data-independent visual partition.
      const lane = FlightData.hash(route.id) >>> 29;
      const matched = !split || Boolean(focus?.has(route.id));
      if (!matched && mode === 'isolate') continue;
      const id = `corredor-${lane + 1}${matched ? '' : '-contexto'}`;
      if (!groups.has(id)) groups.set(id, { id, lane, matched, flightCount: 0, routes: [] });
      const group = groups.get(id);
      group.routes.push(route);
      group.flightCount += route.flights;
    }
    const bands = [...groups.values()].sort((a, b) => a.lane - b.lane || Number(b.matched) - Number(a.matched));
    const lanes = [bands.filter(band => !band.matched), bands.filter(band => band.matched)];
    return bands.map(group => {
      const { lane, id, matched, flightCount, routes } = group;
      routes.sort((a, b) => b.flights - a.flights || a.id.localeCompare(b.id));
      const strength = textileMass(flightCount);
      const concentration = routes[0].flights / flightCount;
      const connectivity = routes.length / (routes.length + 180);
      const { from, to, distance, east, international, gathers, heights, reliefs } = describeCorridor(routes, anchors, flightCount);
      const [height, depth] = drapes[lane];
      const phase = (lane * 1.92 + .8 * east + tau) % tau;
      // Attach each corridor near the outer warp columns. Data can bend the
      // interior, while the endpoints stay at the scale of the installation.
      const left = -4.78 + (lane % 3) * .10;
      const right = 4.78 - ((lane + 1) % 3) * .10;
      const center = Math.tanh((from[0] + to[0]) / 5) * .46;
      const layer = lanes[Number(matched)];
      const sparse = layer.length < 5;
      const index = layer.indexOf(group);
      const laneHeight = layer.length > 1 ? lerp(1.60, -1.60, index / (layer.length - 1)) : 0;
      const warm = rgb('#F461AA'), cool = rgb('#64C4FF');
      const pigment = rgb(bandColors[lane]).map((channel, index) =>
        lerp(channel, lerp(warm[index], cool[index], (1 + east) / 2),
          international * .40) * (.91 + .09 * strength));
      const color = '#' + pigment.map(channel => Math.round(channel * 255).toString(16).padStart(2, '0')).join('');
      return {
        id, group: id, system: 'weft', corridor: { lane, matched, flightCount, routes, gathers },
        material: { lane, concentration, connectivity, distance },
        phase, tension: strength, radius: .018 + .027 * strength, strength, steps: 72, color,
        sample(t) {
          const lift = Math.sin(t * Math.PI);
          // These are textile coordinates, not a geographic projection.
          const x = lerp(left, right, t) + (center + .20 * east + .24 * distance * Math.sin(t * tau)) * lift;
          const flow = t + .17 * east * lift;
          const drape = drapeAt(height, flow);
          // With fewer active corridors, give the real bands distinct height
          // guides. A lone corridor crosses the frame on a broad diagonal.
          const guide = !sparse ? drape * 1.12 : layer.length === 1
            ? (lane % 2 ? 1 : -1) * 1.73 * Math.cos(t * Math.PI) + .28 * drape
            : laneHeight + .37 * drape;
          const y = guide + lift * (.28 * lerp(from[1], to[1], t) + .26 * drapeAt(heights, t)
            + (.14 + .58 * distance) * Math.sin(t * tau + phase));
          const z = drapeAt(depth, flow) * (.36 + strength * .88)
            + .38 * lerp(from[2], to[2], t) + lift * .54 * drapeAt(reliefs, t)
            + (.20 + distance * .65) * lift * Math.cos(t * tau + phase)
            + (matched ? .17 : -.46);
          const edgeOffset = portrait ? 0 : .26 * z * (1 - lift);
          return layout([x - edgeOffset, 2.27 * Math.tanh(y / 2.02), z]);
        }
      };
    });
  }

  function buildFibers(data, quality, embroidered = null, focus, mode = 'all') {
    const layout = ([x, y, z]) => quality.portrait
      ? [x * .45 - y * .22, y * 1.04 + x * .32, z * .9]
      : [x, y, z];
    const warp = makeWarp(data, quality, layout);
    if (!embroidered && data.routes.length && data.routes[0].info && data.routes[0].info.status !== 'demo') {
      return { warp: warp.fibers, weft: historicalBands(data.routes, data.anchors, layout, focus, mode, quality.portrait), omitted: 0 };
    }
    const { fibers: weft, omitted } = makeWeft(data, quality, layout, warp, focus);
    if (!embroidered) return { warp: warp.fibers, weft, omitted };
    const related = weft.filter(fiber => embroidered.routeIds.has(fiber.group));
    const stitched = LoomEmbroidery.build(embroidered.symbol, related, quality);
    const byId = new Map(stitched.fibers.map(fiber => [fiber.id, fiber]));
    return { warp: warp.fibers, weft: weft.map(fiber => byId.get(fiber.id) ?? fiber),
      supports: stitched.supports, omitted };
  }

  // Each fiber retains its XYZ centerline and a range in the shared index buffer.
  function meshFibers(systems, quality, settled, prior) {
    const active = [...systems.warp, ...systems.weft, ...(systems.supports ?? [])];
    const activeIds = new Set(active.map(fiber => fiber.id));
    const retiring = [...prior.values()].filter(fiber => !activeIds.has(fiber.id) &&
      (fiber.system === 'support' || (fiber.system === 'weft' && (fiber.corridor || settled.has(fiber.id)))));
    const fibers = [...active, ...retiring];
    const entering = systems.weft.filter(fiber => !settled.has(fiber.id));
    const groups = new Map();
    for (const fiber of entering) {
      if (!groups.has(fiber.group)) groups.set(fiber.group, []);
      groups.get(fiber.group).push(fiber);
    }
    const timings = new Map();
    let order = 0;
    // Distribute incoming picks across routes instead of revealing a completed band at a time.
    const lanes = [...groups.values()];
    for (let row = 0; lanes.some(lane => row < lane.length); row++) {
      for (const lane of lanes) {
        if (lane[row]) timings.set(lane[row].id, .32 + 4.9 * order++ / Math.max(1, entering.length));
      }
    }
    const stride = 20;
    const sides = quality.portrait ? 4 : 5;
    const surfaces = fibers.map(fiber => LoomMaterials.profile(fiber.material, fiber.radius, fiber.strength, quality.lod));
    const segmentCounts = fibers.map((fiber, index) => Math.max(fiber.steps, surfaces[index].steps));
    const vertexCount = surfaces.reduce((total, surface, i) => total + (segmentCounts[i] + 1) * (sides + 1) * surface.parts.length, 0);
    const indexCount = surfaces.reduce((total, surface, i) => total + segmentCounts[i] * sides * 6 * surface.parts.length, 0);
    const vertices = new Float32Array(vertexCount * stride);
    const indices = new Uint32Array(indexCount);
    let cursor = 0, indexCursor = 0;
    const ranges = new Map();
    const byCode = [null];
    for (let fiberIndex = 0; fiberIndex < fibers.length; fiberIndex++) {
      const fiber = fibers[fiberIndex];
      const surface = surfaces[fiberIndex];
      const code = byCode.length;
      const steps = segmentCounts[fiberIndex];
      const ringSize = surface.parts.length * (sides + 1);
      const base = cursor / stride;
      const centers = Array.from({length: steps + 1}, (_, i) => fiber.sample(i / steps));
      const colors = surface.parts.map(part => rgb(fiber.color).map(channel => channel * part.shade));
      const basePhase = fiber.phase % tau + surface.code * 8;
      const retired = !activeIds.has(fiber.id);
      const previousFiber = prior.get(fiber.id);
      const changingBand = fiber.corridor && previousFiber?.corridor;
      const oldWidth = changingBand ? previousFiber.surfaceWidth ?? surface.parts[0].radius : surface.parts[0].radius;
      const widthRatio = oldWidth / surface.parts[0].radius;
      const oldTension = changingBand ? previousFiber.tension : fiber.tension;
      const oldColors = surface.parts.map(part => {
        const [r, g, b] = rgb(changingBand ? previousFiber.color : fiber.color)
          .map(channel => Math.min(255, Math.round(channel * part.shade * 255)));
        return r * 65536 + g * 256 + b;
      });
      const delay = fiber.corridor ? -10 : timings.get(fiber.id) ?? -10;
      const direction = fiber.system === 'weft' ? 1 : fiber.system === 'support' ? .25 : 0;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const oldCenter = previousFiber?.sample(t) ?? centers[i];
        const delta = subtract(oldCenter, centers[i]);
        const tangent = normalize(subtract(centers[Math.min(steps, i + 1)], centers[Math.max(0, i - 1)]));
        const horizontal = normalize(cross(tangent, [0, 0, 1]));
        const perpendicular = cross(tangent, horizontal);
        const roll = fiber.corridor
          ? .80 * Math.sin(t * tau * (1.1 + fiber.corridor.lane % 3 * .26) + fiber.phase)
            + .29 * Math.sin(t * 14 + fiber.phase * .71) : 0;
        const across = horizontal.map((n, k) => n * Math.cos(roll) + perpendicular[k] * Math.sin(roll));
        const normal = cross(tangent, across);
        const gather = fiber.corridor ? Math.max(0, drapeAt(fiber.corridor.gathers, t)) : 0;
        // Adapt the closing textiles' irregular hems, local gathering and
        // cloth dome to the existing panoramic band surfaces.
        const widthAt = fiber.corridor ? (.65 + .39 * Math.sin(t * Math.PI) + .27 * Math.sin(t * 14 + fiber.phase) + .09 * Math.sin(t * 27 + fiber.phase))
          * (.52 + .48 * Math.min(1, Math.min(t, 1 - t) * 8)) * (1 - .20 * gather) : 1;
        const texture = .96 + .07 * Math.sin(t * 74 + fiber.phase) + .05 * Math.sin(t * 38);
        for (const [partIndex, part] of surface.parts.entries()) {
          const [sideOffset, depthOffset] = LoomMaterials.offset(part, t);
          const packedColor = oldColors[partIndex];
          const taper = part.window ? Math.max(0, Math.min(1, (t - part.window[0]) * 22, (part.window[1] - t) * 22)) : 1;
          const radius = part.radius * (part.gauze ? 1 : texture) * taper;
          for (let j = 0; j <= sides; j++) {
            const u = j / sides;
            const angle = u * tau;
            const c = Math.cos(angle), s = Math.sin(angle);
            const edge = u * 2 - 1;
            const surfaceNormal = part.gauze
              ? normalize(normal.map((n, k) => -n + across[k] * edge * .42))
              : across.map((n, k) => n * c + normal[k] * s);
            const fray = part.gauze
              ? 1 + (.076 * Math.sin(t * 89 + fiber.phase + edge * 4)
                + .045 * Math.cos(t * 173 + edge * 7)) * edge ** 2 : 1;
            const acrossDistance = (sideOffset + (part.gauze ? radius * edge * fray : 0)) * widthAt;
            const fold = part.fold ? part.fold * Math.sin(t * 85) * radius * .68 : 0;
            const depth = depthOffset + (part.gauze ? (1 - edge ** 2) * radius * (.75 + .46 * Math.sin(t * 12 + fiber.phase) + .38 * gather) + edge * fold : 0);
            const point = centers[i].map((n, k) =>
              n + (part.gauze ? 0 : radius * surfaceNormal[k]) + across[k] * acrossDistance + normal[k] * depth);
            vertices.set([...point, ...surfaceNormal, ...colors[partIndex],
              t, u, part.code === undefined ? basePhase : fiber.phase % tau + part.code * 8,
              delay, direction, fiber.tension, packedColor,
              ...delta.map((d, k) => d + (point[k] - centers[i][k]) * (widthRatio - 1)),
              Number(retired) * 2 + oldTension], cursor);
            cursor += stride;
          }
        }
      }
      const first = indexCursor;
      for (let i = 0; i < steps; i++) {
        for (let part = 0; part < surface.parts.length; part++) {
          const start = base + i * ringSize + part * (sides + 1);
          for (let j = 0; j < sides; j++) {
            const a = start + j;
            const b = a + ringSize;
            indices.set([a, b, b + 1, a, b + 1, a + 1], indexCursor);
            indexCursor += 6;
          }
        }
      }
      const record = { ...fiber, previousSample: previousFiber?.sample, surfaceWidth: surface.parts[0].radius, retired, code, centers, delay, vertexStart: base, vertexCount: (steps + 1) * ringSize, first, count: indexCursor - first };
      ranges.set(fiber.id, record);
      byCode.push(record);
    }
    const lastActive = byCode[active.length];
    const activeIndexCount = lastActive ? lastActive.first + lastActive.count : 0;
    return { vertices, indices, ranges, byCode, vertexCount, activeIndexCount, stride };
  }

  function projectedBounds(mesh, portrait, keepFrame = false) {
    const tilt = portrait ? .16 : .26;
    let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
    for (const fiber of mesh.ranges.values()) {
      if (fiber.retired) continue;
      if (keepFrame && fiber.system !== 'warp') continue;
      const margin = fiber.material === 'mesh' || fiber.material === 'band' || fiber.corridor ? .64 : fiber.radius * 2.7 + .075;
      for (const [x, y, z] of fiber.centers) {
        const cameraX = x + z * tilt;
        const cameraY = y - z * .28;
        left = Math.min(left, cameraX - margin);
        right = Math.max(right, cameraX + margin);
        bottom = Math.min(bottom, cameraY - margin);
        top = Math.max(top, cameraY + margin);
      }
    }
    return { x: (left + right) / 2, y: (bottom + top) / 2, width: right - left, height: top - bottom };
  }

  const vertexSource = `
    attribute vec3 point, normal, color;
    attribute vec2 yarn;
    attribute float phase;
    attribute vec4 stitch;
    attribute vec4 fiberEdit;
    attribute vec4 previousPosition;
    uniform mediump float morph;
    uniform vec2 frame, sceneCenter;
    uniform vec4 pickView;
    uniform vec4 pull;
    uniform float editWeight;
    uniform float highlight;
    uniform float time, portrait, insertion, moving, construction;
    uniform mediump float expressionClock;
    uniform mediump vec4 expressionModes;
    varying vec3 vNormal, vColor;
    varying vec2 vYarn, vCode;
    varying mediump float vScenarioOffset;
    varying float vHighlight, vRetired, vWarp, vEdited;
    varying float vDepth, vPhase, vEntry, vTension;
    float pullInfluence(float t, float anchor, float magnitude) {
      float radius = min(.48, .23 + magnitude * .09);
      float edge = t < anchor ? anchor : 1.0 - anchor;
      float span = min(radius, max(.12, edge));
      float u = min(1.0, abs(t - anchor) / span);
      return 1.0 - u * u * u * (u * (u * 6.0 - 15.0) + 10.0);
    }
    void main() {
      vec3 p = point + previousPosition.xyz * (1.0 - morph);
      vRetired = step(2.0, previousPosition.w);
      float fromEdge = stitch.y < 0.0 ? 1.0 - yarn.x : yarn.x;
      float age = insertion - stitch.x - fromEdge * 1.65;
      float slack = exp(-max(age, 0.0) * 4.0);
      float envelope = sin(yarn.x * 3.14159);
      float tension = mix(previousPosition.w - 2.0 * vRetired, stitch.z, morph);
      float threadPhase = mod(phase, 8.0);
      float localWave = sin(time * (1.15 + tension * .65) + threadPhase + yarn.x * 6.0);
      float pulse = sin(time * 2.4 - fromEdge * 12.0 + threadPhase);
      float threaded = step(.5, abs(stitch.y));
      vWarp = 1.0 - step(.1, abs(stitch.y));
      float fiberCode = fiberEdit.x;
      bool grabbed = threaded > .5 && abs(fiberCode - pull.x) < .25;
      vec2 committed = fiberEdit.yz * editWeight;
      vec2 displacement = committed;
      if (grabbed) displacement += pull.zw * pullInfluence(yarn.x, pull.y, length(pull.zw));
      vEdited = smoothstep(.004, .06, length(committed));
      float ambient = moving * .25;
      p.y += ambient * envelope * (.0015 + .002 * (1.0 - tension)) * localWave;
      p.z += ambient * envelope * (.002 * pulse + threaded * slack * .004 * localWave);
      // The fixed endpoints and hand-placed sections stay steady. Only the
      // reversible interior gesture is evaluated here, including during picking.
      float freedom = threaded * envelope * (grabbed ? 0.0 : 1.0 - vEdited);
      float rhythm = expressionClock;
      float join = max(exp(-pow(abs(yarn.x - .32) * 10.0, 2.0)),
        exp(-pow(abs(yarn.x - .72) * 10.0, 2.0)));
      float lower = sin(threadPhase + yarn.x * 7.0);
      float lift = sin(threadPhase * .65 + yarn.x * 10.0 - rhythm);
      float wave = sin(rhythm + yarn.x * 8.0 + threadPhase);
      float lateral = dot(expressionModes, vec4(
        -.09 * p.y + .045 * lower + moving * .044 * wave,
        .17 * p.y + .12 * lower + moving * .24 * lift,
        -.25 * p.y + .13 * (yarn.x - .5) + moving * .027 * sin(yarn.x * 38.0 - rhythm * 2.0),
        -.29 * p.y * join + moving * .072 * wave * join));
      float layering = dot(expressionModes, vec4(
        -.27 * p.z + moving * .045 * wave,
        .34 * p.z + .17 * lower + moving * .22 * lift,
        -.46 * p.z + .085 * lower + moving * .045 * lift,
        -.73 * p.z * join + .18 * lower * join + moving * .09 * wave * join));
      p.y += freedom * lateral;
      p.z += freedom * layering;
      float tilt = mix(.26, .16, portrait);
      if (threaded > .5 && dot(displacement, displacement) > .0000001) {
        float depth = (displacement.x - displacement.y) * .14;
        p += vec3(displacement.x - depth * tilt, displacement.y + depth * .28, depth);
      }
      vec3 camera = vec3(p.x + p.z * tilt, p.y - p.z * .28, p.z - p.x * tilt + p.y * .28);
      gl_Position = vec4(((camera.xy - sceneCenter) * frame - pickView.xy) * pickView.zw, -camera.z * .17, 1.0);
      vCode = vec2(mod(fiberCode, 256.0), floor(fiberCode / 256.0)) / 255.0;
      vHighlight = threaded > .5 && abs(fiberCode - highlight) < .25 ? 1.0 : 0.0;
      vNormal = normal;
      vec3 previousColor = vec3(floor(stitch.w / 65536.0),
        floor(mod(stitch.w, 65536.0) / 256.0), mod(stitch.w, 256.0)) / 255.0;
      vColor = mix(previousColor, color, morph);
      vYarn = yarn;
      vScenarioOffset = fiberEdit.w;
      vDepth = camera.z;
      vPhase = phase;
      vTension = tension;
      vEntry = threaded < .5 ? 1.0 : age;
      if (construction < 6.0) {
        bool rail = phase >= 72.0 && phase < 80.0;
        float lane = mod(fiberCode, 8.0);
        float edge = mod(fiberCode, 2.0) < .5 ? yarn.x : 1.0 - yarn.x;
        float arrival = threaded > .5 ? 1.15 + floor(lane * .5) * .68 + edge * 1.75
          : rail ? .04 : .36 + (1.0 - yarn.x) * .95;
        vEntry = construction - arrival;
      }
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform float picking, layerProgress, layerWidth, embroideryPass, scenarioShare;
    uniform sampler2D layerTexture;
    uniform vec3 expressionLow, expressionMid, expressionHigh;
    uniform vec4 expressionFinish;
    uniform mediump vec4 expressionModes;
    uniform mediump float expressionClock;
    uniform mediump float morph;
    varying vec3 vNormal, vColor;
    varying vec2 vYarn, vCode;
    varying mediump float vScenarioOffset;
    varying float vHighlight, vRetired, vWarp, vEdited;
    varying float vDepth, vPhase, vEntry, vTension;
    void main() {
      float coverage = smoothstep(-.045, .115, vEntry);
      coverage *= mix(1.0, 1.0 - morph, vRetired);
      if (coverage <= .01) discard;
      vec2 codeBytes = floor(vCode * 255.0 + .5);
      float code = codeBytes.x + codeBytes.y * 256.0;
      vec4 layer = texture2D(layerTexture, vec2((code + .5) / layerWidth, .5));
      if (picking > .5) {
        if (coverage < .20 || vRetired > .5 || layer.b < .5 || mix(layer.r, layer.g, layerProgress) < .025) discard;
        gl_FragColor = vec4(vCode, vYarn.x, 1.0);
        return;
      }
      if (embroideryPass > .5 && abs(step(.75, layer.a) - (embroideryPass - 1.0)) > .5) discard;
      coverage *= mix(layer.r, layer.g, layerProgress);
      if (coverage <= .01) discard;
      // The free ends recede, while the central warp retains enough contrast to read at crossings.
      float endFade = smoothstep(0.0, .20, min(vYarn.x, 1.0 - vYarn.x));
      float warpOpacity = .46 + .32 * endFade;
      coverage *= mix(1.0, warpOpacity, vWarp);
      vec3 n = normalize(vNormal);
      float kind = floor(vPhase / 8.0);
      float threadPhase = mod(vPhase, 8.0);
      bool gauze = abs(kind - 5.0) < .25;
      bool ribbon = abs(kind - 6.0) < .25;
      bool fold = abs(kind - 8.0) < .25;
      if (abs(kind - 9.0) < .25) {
        float worn = .50 + .34 * max(0.0, n.z) + .16 * sin(vYarn.x * 273.0 + vYarn.y * 12.5);
        float grain = .5 + .5 * sin(vYarn.y * 90.0 + 2.0 * sin(vYarn.x * 29.0));
        gl_FragColor = vec4(vColor * (worn + grain * .16) + vec3(.12,.10,.15) * max(0.0, n.z), coverage * .96);
        return;
      }
      vec4 gestures = expressionModes * (1.0 - vWarp);
      float join = max(exp(-pow(abs(vYarn.x - .32) * 10.0, 2.0)),
        exp(-pow(abs(vYarn.x - .72) * 10.0, 2.0)));
      float shuttle = .5 + .5 * cos(vYarn.x * 18.849556 - expressionClock + threadPhase * .24);
      float pulseLight = pow(shuttle, 9.0) * smoothstep(.35, .78, fract(threadPhase * .41));
      float celebration = pow(.5 + .5 * cos(vYarn.x * 23.0 + threadPhase * 1.6 - expressionClock), 6.0);
      float clothEdge = 0.0;
      if (gauze || ribbon || fold) {
        // A flattened shell carries the woven surface. Its UVs, picking and pull use the same buffer.
        float u = vYarn.y;
        float warpCount = mix(10.0, 42.0, vTension) * (ribbon ? 1.25 : 1.0);
        float across = u * warpCount + .24 * sin(vYarn.x * 28.0 + threadPhase)
          + .17 * sin(vYarn.x * 104.0 + u * 8.0 + threadPhase);
        float along = vYarn.x * (mix(53.0, 213.0, vTension) + 14.0 * sin(threadPhase * .37)) + .35 * sin(u * 6.2 + threadPhase + vYarn.x * 12.0)
          + .23 * cos(u * 27.0 + vYarn.x * 37.0 + threadPhase);
        float longitudinal = 1.0 - smoothstep(.025, .25, abs(fract(across) - .5) * (1.0 + gestures.x * .38 - gestures.y * .20));
        float transverse = 1.0 - smoothstep(.015, .20, abs(fract(along) - .5) * (1.0 + gestures.x * .68 + gestures.z * .45 - gestures.w * .33 * join));
        float warpThread = longitudinal * (.83 + .17 * cos(along * 3.14159));
        float weftThread = transverse * (.82 + .18 * sin(across * 3.14159));
        float cloth = max(warpThread, weftThread);
        float pearl = 1.0 - step(.9, mod(floor(across + .5), 5.0));
        clothEdge = pearl * longitudinal;
        clothEdge = .20 * clothEdge + .80 * smoothstep(.38, .50, abs(u - .5));
        float voile = ribbon ? .20 : .12;
        float filament = voile + (ribbon ? .62 * longitudinal + .22 * transverse : .71 * cloth);
        float depthLight = mix(.76, 1.16, smoothstep(-.8, .9, vDepth));
        coverage *= (filament + clothEdge * .18) * (.89 + .11 * sin(across * 3.14159 + along * 3.14159));
        coverage *= mix(.86, 1.14, vTension) * depthLight;
        if (fold) coverage *= .73;
        coverage *= 1.0 + gestures.y * .20 * longitudinal + gestures.z * .17 * clothEdge
          + gestures.w * .24 * join;
        if (coverage < .026) discard;
      }
      float keyLight = max(0.0, dot(n, normalize(vec3(-.44, .70, .63))));
      float warm = max(0.0, dot(n, normalize(vec3(.85, .13, .52))));
      float satin = step(.5, kind) * (1.0 - step(1.5, kind)) + (ribbon ? .65 : 0.0);
      if (abs(kind - 7.0) < .25) coverage *= .62 + .24 * sin(vYarn.x * 102.0 + threadPhase);
      float bundled = step(1.5, kind);
      float open = step(2.5, kind) * (1.0 - step(3.5, kind)) + (1.0 - step(.25, abs(kind - 5.0)));
      float expression = expressionFinish.x * (1.0 - vWarp);
      float fade = mix(.56, .88, smoothstep(-.9, .75, vDepth));
      coverage *= mix(1.0, fade, gestures.x);
      if (fold || abs(kind - 7.0) < .25) coverage *= 1.0 - .36 * gestures.x;
      satin = clamp(satin + expression * expressionFinish.y, 0.0, 1.0);
      float sheen = pow(max(0.0, dot(n, normalize(vec3(-.24, .28, .93)))), mix(7.0, 18.0, satin));
      float twist = sin(vYarn.x * 360.0 + vYarn.y * 18.85 + threadPhase);
      float crossgrain = sin(vYarn.x * 485.0 - vYarn.y * 25.13);
      float grain = twist * crossgrain * mix(.10, .045, satin) + twist * .035;
      grain += expression * expressionFinish.z * crossgrain;
      float contact = .93 - bundled * (.15 + expression * expressionFinish.w) * (1.0 - keyLight);
      float rim = pow(max(0.0, dot(n, normalize(vec3(.73, -.34, .59)))), 9.0);
      float light = (.45 + keyLight * .63 + warm * .21 + grain) * contact;
      light *= clamp(.91 + vDepth * .14, .62, 1.22);
      light *= mix(1.21, .81, vWarp);
      float tone = clamp(dot(vColor, vec3(.22, .65, .13)) * .8 + .20 * sin(threadPhase * 2.1), 0.0, 1.0);
      vec3 tinted = mix(mix(expressionLow, expressionMid, smoothstep(.0, .60, tone)),
        expressionHigh, smoothstep(.56, 1.0, tone));
      vec3 pigment = mix(vColor, tinted, expression * .91) * light + vec3(.045,.055,.10) * (1.0 - keyLight);
      pigment += vec3(.19,.17,.16) * warm * .2 + vec3(.76,.80,.92) * sheen * (.040 + satin * .10);
      pigment += vec3(.31, .40, .64) * rim * (.15 + bundled * .10) * (1.0 - vWarp);
      float backlight = pow(1.0 - abs(n.z), 2.25);
      float glint = pow(.5 + .5 * twist, 5.0);
      float radiance = clamp(1.0 + expression * (expressionFinish.y * .54 - expressionFinish.z), .58, 1.55);
      pigment += (1.0 - vWarp) * radiance * (vColor * backlight * (.11 + open * .22)
        + vec3(.68, .79, 1.0) * glint * (.045 + satin * .09));
      pigment += (gauze || ribbon || fold ? 1.0 : 0.0) * vColor *
        (.28 * clothEdge + .19 * warm + .14 * sheen + .08 * vTension) * radiance;
      coverage *= 1.0 - open * (.22 - .11 * backlight);
      pigment *= 1.0 - .16 * gestures.x;
      pigment += vec3(1.0, .74, .43) *
        (gestures.y * (.09 * satin + .21 * celebration * (.4 + .6 * sheen))
        + gestures.w * .21 * join * (.32 + .68 * max(clothEdge, sheen)));
      pigment += vec3(.69, .87, 1.0) * gestures.z * (.23 * pulseLight + .13 * clothEdge);
      pigment = mix(pigment, vec3(1.0, .76, .32), max(vHighlight * .48, vEdited * .11));
      pigment += vHighlight * sheen * vec3(.25, .19, .085);
      // The interpretation adds detail to eligible weft without changing
      // the centerline, route counts or the picking buffer.
      if (scenarioShare > 0.0 && layer.a > .25 && layer.a < .75 && vRetired < .5) {
        float marked = 1.0 - step(scenarioShare, fract(vYarn.x + vScenarioOffset));
        float filament = pow(.5 + .5 * sin(vYarn.x * 73.0 + vYarn.y * 28.0 + threadPhase), 6.0);
        vec3 accents = vec3(.70,.75,1.0) * gestures.x * (.12 + .23 * filament)
          + vec3(1.0,.73,.43) * gestures.y * (.16 + .30 * max(filament, celebration))
          + vec3(.48,.85,1.0) * gestures.z * (.14 + .37 * max(pulseLight, .5 * clothEdge))
          + vec3(1.0,.54,.62) * gestures.w * (.10 + .36 * join * max(filament, .48));
        pigment += marked * (.38 + scenarioShare * .70) * (accents + pigment * .25);
        coverage = mix(coverage, min(1.0, coverage + .12 * filament),
          marked * scenarioShare);
      }
      gl_FragColor = vec4(pigment, coverage * .95);
    }
  `;

  function createProgram(gl) {
    const program = gl.createProgram();
    const shaders = [];
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
        const shader = gl.createShader(type);
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
      return program;
    } catch (error) {
      gl.deleteProgram(program);
      throw error;
    } finally {
      shaders.forEach(shader => gl.deleteShader(shader));
    }
  }

  // Frame both periods against the same scene envelope, independent of route density.
  function comparisonProjection(width, height, figure) {
    const envelope = figure ? { x: .08, y: .48, width: 6.45, height: 5.05 }
      : { x: 0, y: .02, width: 10.15, height: 5.35 };
    return { ...envelope, unit: Math.min(width * .98 / envelope.width, height * .97 / envelope.height) };
  }

  function mount(host, selectors, status, initialData, onSelect, options = {}) {
    const canvas = host.querySelector('canvas');
    const fallback = host.querySelector('.loom-fallback');
    const stackedComparison = matchMedia('(max-width: 700px)');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let data = initialData, comparison = false;
    let morph = 1;
    let bounds;
    let visible = false, frameId = 0, gl, program, buffer, editBuffer, elements, uniforms, quality, mesh;
    const expression = LoomInterpretations.transition();
    let expressionTime = 0, scenarioShare = 0, scenarioFiltered = false;
    let elapsed = 0, insertion = 0, previous = 0, failed = false;
    let construction = 6, constructionWait = 0;
    function finishConstruction() {
      if (construction === 6) return;
      construction = 6;
      insertion = 10;
      options.onConstruction?.(false);
      schedule();
    }
    let settled = new Set();
    let rebuildNeeded = true;
    let paused = false, frameReady = false, pickTarget, lastWidth, lastHeight;
    const pauseButton = options.secondary ? null : document.querySelector('#loom-pause');
    const needle = TextileNeedle.mount(host, pickFiber, schedule, onSelect, uploadEdit, (count, resetting) => {
      options.onEdits?.(!failed && count > 0 && !resetting);
    });
    let editScratch = new Float32Array(0);

    function writeEdit(target, fiber, edit, start = 0) {
      const steps = fiber.centers.length - 1;
      const scenarioOffset = FlightData.hash('escenario:' + fiber.id) / 4294967296;
      const sides = fiber.vertexCount / (steps + 1);
      for (let ring = 0; ring <= steps; ring++) {
        const [x, y] = TextileNeedle.offsetAt(edit, Math.fround(ring / steps));
        for (let side = 0; side < sides; side++) {
          const index = start + (ring * sides + side) * 4;
          target[index] = fiber.code;
          target[index + 1] = x;
          target[index + 2] = y;
          target[index + 3] = scenarioOffset;
        }
      }
    }

    function uploadEdit(id, edit) {
      const fiber = mesh?.ranges.get(id);
      if (!fiber || fiber.retired || !gl || gl.isContextLost()) return;
      const length = fiber.vertexCount * 4;
      if (editScratch.length < length) editScratch = new Float32Array(length);
      writeEdit(editScratch, fiber, edit);
      gl.bindBuffer(gl.ARRAY_BUFFER, editBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, fiber.vertexStart * 16, editScratch.subarray(0, length));
    }
    let layer = { mode: 'all', routeIds: new Set() };
    let embroidered = null;
    let layerTexture, layerPixels, layerProgress = 1, layerDirty = true, layerDuration = .30;

    function opacityFor(fiber) {
      if (fiber.frameRail) return embroidered ? .74 : 1;
      if (fiber.system === 'support') return embroidered && !fiber.retired ? 1 : 0;
      if (embroidered) {
        if (fiber.system === 'warp') return .25;
        if (fiber.figure) return 1;
        if (!embroidered.routeIds.size || layer.mode === 'isolate') return 0;
        return layer.mode === 'all' ? .24 : .09;
      }
      return LoomDestinations.layerOpacity(layer.mode, fiber.corridor?.matched ?? layer.routeIds.has(fiber.group), fiber.system === 'warp');
    }

    function easedLayer() {
      return layerProgress * layerProgress * (3 - 2 * layerProgress);
    }

    function syncLayers(animate, previousById = null) {
      const width = mesh.byCode.length;
      const pixels = new Uint8Array(width * 4);
      const eased = easedLayer();
      for (const fiber of mesh.byCode.slice(1)) {
        const i = fiber.code * 4;
        const target = Math.round(opacityFor(fiber) * 255);
        let start = target;
        if (animate) {
          if (previousById) start = previousById.get(fiber.id) ?? (fiber.system === 'support' || fiber.corridor ? 0 : target);
          else if (layerPixels?.length === pixels.length) start = Math.round(lerp(layerPixels[i], layerPixels[i + 1], eased));
        }
        const visible = embroidered
          ? target > 0 && Boolean(fiber.figure) && fiber.pickable !== false
          : LoomDestinations.layerPickable(layer.mode, fiber.corridor?.matched ?? layer.routeIds.has(fiber.group), fiber.system === 'warp');
        const scenarioEligible = scenarioShare > 0 && fiber.system === 'weft'
          && (!scenarioFiltered || (fiber.corridor
            ? fiber.corridor.routes.some(route => layer.routeIds.has(route.id))
            : layer.routeIds.has(fiber.group)));
        pixels.set([start, target, visible && !fiber.retired && !fiber.frameRail ? 255 : 0,
          fiber.figure ? 255 : scenarioEligible ? 128 : 0], i);
      }
      gl.bindTexture(gl.TEXTURE_2D, layerTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.uniform1f(uniforms.layerWidth, width);
      layerPixels = pixels;
      layerDirty = false;
      layerProgress = animate ? 0 : 1;
      layerDuration = previousById ? .75 : .30;
    }

    function showFallback() {
      finishConstruction();
      dispose();
      failed = true;
      canvas.hidden = true;
      fallback.hidden = false;
      selectors.forEach(control => { control.disabled = true; });
      if (pauseButton) pauseButton.disabled = true;
      options.onEdits?.(false);
      status.textContent = 'Vista de respaldo · WebGL no disponible';
    }

    function initialize() {
      gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
      if (!gl || !gl.getExtension('OES_element_index_uint')) throw Error('WebGL con índices de 32 bits no disponible');
      program = createProgram(gl);
      buffer = gl.createBuffer();
      editBuffer = gl.createBuffer();
      elements = gl.createBuffer();
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements);
      for (const [name, size, offset] of [['point',3,0], ['normal',3,3], ['color',3,6], ['yarn',2,9], ['phase',1,11], ['stitch',4,12], ['previousPosition',4,16]]) {
        const location = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 80, offset * 4);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, editBuffer);
      const editLocation = gl.getAttribLocation(program, 'fiberEdit');
      gl.enableVertexAttribArray(editLocation);
      gl.vertexAttribPointer(editLocation, 4, gl.FLOAT, false, 16, 0);
      uniforms = Object.fromEntries(['frame','sceneCenter','time','portrait','insertion','moving','construction','pickView','picking','pull','editWeight','highlight','morph','layerProgress','layerWidth','layerTexture','embroideryPass','scenarioShare','expressionClock','expressionModes','expressionLow','expressionMid','expressionHigh','expressionFinish'].map(name => [name, gl.getUniformLocation(program, name)]));
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      if (gl.isContextLost()) throw Error('Contexto WebGL perdido');
      mesh = undefined;
      pickTarget = createPickTarget();
      layerTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, layerTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(uniforms.layerTexture, 0);
      canvas.hidden = false;
      fallback.hidden = true;
      selectors.forEach(control => { control.disabled = false; });
      if (pauseButton) pauseButton.disabled = false;
      status.textContent = 'Telar 3D';
    }

    function createPickTarget() {
      const size = TextileNeedle.pickSize;
      const color = gl.createTexture();
      const depth = gl.createRenderbuffer();
      const framebuffer = gl.createFramebuffer();
      pickTarget = { color, depth, framebuffer, pixels: new Uint8Array(size * size * 4) };
      gl.bindTexture(gl.TEXTURE_2D, color);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!complete) throw Error('No se pudo preparar la selección de fibras');
      return pickTarget;
    }

    function pickFiber(point, tolerance) {
      if (construction < 6 || !frameReady || rebuildNeeded || !mesh || gl.isContextLost()) return null;
      const width = host.clientWidth, height = host.clientHeight;
      if (width !== lastWidth || height !== lastHeight || point.x < 0 || point.y < 0 || point.x > width || point.y > height) return null;
      const size = TextileNeedle.pickSize, span = TextileNeedle.pickSpan;
      gl.bindFramebuffer(gl.FRAMEBUFFER, pickTarget.framebuffer);
      gl.viewport(0, 0, size, size);
      gl.disable(gl.BLEND);
      gl.disable(gl.DITHER);
      gl.uniform1f(uniforms.picking, 1);
      gl.uniform4f(uniforms.pickView, point.x * 2 / width - 1, 1 - point.y * 2 / height, width / span, height / span);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, mesh.activeIndexCount, gl.UNSIGNED_INT, 0);
      gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pickTarget.pixels);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.enable(gl.DITHER);
      gl.enable(gl.BLEND);
      gl.uniform1f(uniforms.picking, 0);
      gl.uniform4f(uniforms.pickView, 0, 0, 1, 1);
      const hit = TextileNeedle.decodePick(pickTarget.pixels, tolerance);
      if (!hit || !mesh.byCode[hit.main.code]) return null;
      const resolve = candidate => ({ ...candidate, fiber: mesh.byCode[candidate.code] });
      const candidates = hit.candidates.filter(c => mesh.byCode[c.code]).map(resolve);
      const focused = layer.mode === 'highlight' && candidates.find(candidate =>
        candidate.distance <= Math.min(tolerance, hit.main.distance + 2) && (candidate.fiber.corridor?.matched ?? layer.routeIds.has(candidate.fiber.group)));
      return { main: focused || resolve(hit.main), candidates };
    }

    function rebuild(sameQuality) {
      frameReady = false;
      needle.clear();
      const progress = morph * morph * (3 - 2 * morph);
      const prior = new Map();
      const previousLayer = new Map();
      if (sameQuality && mesh && !motion.matches) {
        for (const fiber of mesh.ranges.values()) {
          if (fiber.retired) continue;
          const index = fiber.code * 4;
          if (layerPixels) previousLayer.set(fiber.id, Math.round(lerp(layerPixels[index], layerPixels[index + 1], easedLayer())));
          const { sample, previousSample } = fiber;
          prior.set(fiber.id, {
            ...fiber,
            sample: previousSample && progress < 1
              ? t => sample(t).map((value, i) => lerp(previousSample(t)[i], value, progress))
              : sample
          });
        }
      }
      const fibers = buildFibers(data, quality, embroidered, layer.routeIds, layer.mode);
      mesh = meshFibers(fibers, quality, settled, prior);
      bounds = projectedBounds(mesh, quality.portrait, !embroidered);
      morph = prior.size ? 0 : 1;
      rebuildNeeded = false;
      insertion = paused ? 10 : 0;
      if (fibers.omitted) status.textContent = `Telar 3D · Simulación visual · ${fibers.omitted} rutas fuera del presupuesto visual`;
      else status.textContent = 'Telar 3D';
      needle.prune(new Set(mesh.byCode.slice(1).filter(fiber => !fiber.retired).map(fiber => fiber.id)));
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
      const editData = new Float32Array(mesh.vertexCount * 4);
      for (const fiber of mesh.ranges.values()) {
        writeEdit(editData, fiber, needle.getEdit(fiber.id), fiber.vertexStart * 4);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, editBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, editData, gl.DYNAMIC_DRAW);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
      mesh.indexCount = mesh.indices.length;
      mesh.vertices = mesh.indices = null;
      syncLayers(previousLayer.size > 0, previousLayer.size ? previousLayer : null);
    }

    function draw(now) {
      const width = host.clientWidth, height = host.clientHeight;
      if (!width || !height) return;
      const next = qualityFor(comparison ? 670 : width);
      if (next.warp !== quality?.warp && mesh) rememberSeated();
      if (!mesh || rebuildNeeded || next.warp !== quality?.warp) {
        const sameQuality = quality?.warp === next.warp;
        quality = next;
        rebuild(sameQuality);
      }
      if (width !== lastWidth || height !== lastHeight) {
        frameReady = false;
        needle.clear();
        lastWidth = width;
        lastHeight = height;
      }
      if (layerDirty) syncLayers(!motion.matches);
      const ratio = Math.min(devicePixelRatio || 1, quality.ratio);
      const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      gl.viewport(0, 0, pixelWidth, pixelHeight);
      const commonWidth = stackedComparison.matches ? width : Math.floor(host.parentElement.clientWidth / 2);
      const frame = comparison ? comparisonProjection(commonWidth, height, Boolean(embroidered)) : bounds;
      const unit = comparison ? frame.unit : Math.min(width * .97 / frame.width, height * .96 / frame.height);
      gl.uniform2f(uniforms.sceneCenter, frame.x, frame.y);
      gl.uniform2f(uniforms.frame, unit * 2 / width, unit * 2 / height);
      gl.uniform1f(uniforms.portrait, Number(quality.portrait));
      const delta = previous ? (now - previous) / 1000 : 0;
      if (construction < 6) {
        constructionWait += delta;
        if (motion.matches || constructionWait >= 9) finishConstruction();
        else if (data.routes.length || construction < 1.1) {
          construction += Math.min(delta, .05);
          if (construction >= 5.65) finishConstruction();
        }
      }
      gl.uniform1f(uniforms.construction, construction);
      morph = motion.matches ? 1 : Math.min(1, morph + delta / .95);
      const easedMorph = morph * morph * (3 - 2 * morph);
      layerProgress = motion.matches ? 1 : Math.min(1, layerProgress + delta / layerDuration);
      gl.uniform1f(uniforms.layerProgress, easedLayer());
      if (motion.matches) insertion = 10;
      else if (!paused) {
        elapsed += delta;
        insertion = Math.min(10, insertion + delta);
      }
      const [strength, lr, lg, lb, mr, mg, mb, hr, hg, hb, finish, grain, contrast, speed, memory, joy, anticipation, reunion] =
        expression.advance(Math.min(delta, .05), motion.matches);
      if (!paused && !motion.matches) expressionTime = (expressionTime + delta * 2.4 * speed) % (2 * Math.PI);
      gl.uniform1f(uniforms.scenarioShare, embroidered ? -1 : scenarioShare);
      gl.uniform1f(uniforms.expressionClock, motion.matches ? 0 : expressionTime);
      const interpretation = Number(!embroidered);
      gl.uniform4f(uniforms.expressionModes, memory * interpretation, joy * interpretation,
        anticipation * interpretation, reunion * interpretation);
      gl.uniform3f(uniforms.expressionLow, lr, lg, lb);
      gl.uniform3f(uniforms.expressionMid, mr, mg, mb);
      gl.uniform3f(uniforms.expressionHigh, hr, hg, hb);
      gl.uniform4f(uniforms.expressionFinish, strength * interpretation, finish, grain, contrast);
      const interaction = needle.update(now, unit, motion.matches, paused || motion.matches);
      gl.uniform4fv(uniforms.pull, interaction.pull);
      gl.uniform1f(uniforms.editWeight, interaction.resetWeight);
      gl.uniform1f(uniforms.highlight, interaction.highlight);
      gl.uniform4f(uniforms.pickView, 0, 0, 1, 1);
      gl.uniform1f(uniforms.insertion, insertion);
      gl.uniform1f(uniforms.morph, easedMorph);
      gl.uniform1f(uniforms.time, elapsed);
      gl.uniform1f(uniforms.moving, Number(!motion.matches));
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const indexCount = morph < 1 ? mesh.indexCount : mesh.activeIndexCount;
      if (embroidered) {
        // Context threads remain visible behind the relief without masking its foreground stitches.
        gl.depthMask(false);
        gl.uniform1f(uniforms.embroideryPass, 1);
        gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
        gl.depthMask(true);
        gl.uniform1f(uniforms.embroideryPass, 2);
      }
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);
      gl.uniform1f(uniforms.embroideryPass, 0);
      frameReady = true;
    }

    function tick(now) {
      frameId = 0;
      if (!visible || document.hidden) return;
      if (needle.isDragging() || paused || motion.matches || now - previous >= (quality?.portrait ? 31 : 15)) {
        try {
          if (!gl) initialize();
          draw(now);
          previous = now;
        } catch (error) {
          console.warn('Telar 3D:', error.message);
          showFallback();
        }
      }
      if (construction < 6 || (!paused && !motion.matches) || morph < 1 || layerProgress < 1 || expression.active || needle.needsFrame()) schedule();
    }

    function schedule() {
      if (!frameId && visible && !document.hidden && !failed) frameId = requestAnimationFrame(tick);
    }

    function dispose() {
      cancelAnimationFrame(frameId);
      frameId = 0;
      frameReady = false;
      needle.clear();
      cancelAnimationFrame(frameId);
      frameId = 0;
      if (gl) {
        if (pickTarget) {
          gl.deleteTexture(pickTarget.color);
          gl.deleteRenderbuffer(pickTarget.depth);
          gl.deleteFramebuffer(pickTarget.framebuffer);
        }
        gl.deleteTexture(layerTexture);
        gl.deleteBuffer(buffer);
        gl.deleteBuffer(editBuffer);
        gl.deleteBuffer(elements);
        gl.deleteProgram(program);
      }
      gl = program = buffer = editBuffer = elements = mesh = pickTarget = null;
    }

    const resize = new ResizeObserver(schedule);
    resize.observe(host);
    motion.addEventListener('change', schedule);
    document.addEventListener('visibilitychange', () => {
      previous = 0;
      schedule();
    });
    function rememberSeated() {
      if (!mesh || rebuildNeeded) return;
      settled = new Set([...mesh.ranges.values()]
        .filter(fiber => fiber.system === 'weft' && !fiber.retired && insertion >= fiber.delay + 1.8)
        .map(fiber => fiber.id));
    }

    function refresh() {
      needle.clear();
      rememberSeated();
      rebuildNeeded = true;
      schedule();
    }

    function setPaused(value) {
      if (paused === value) return;
      paused = value;
      previous = 0;
      const label = paused ? 'Reanudar animación' : 'Pausar animación';
      if (pauseButton) {
        pauseButton.setAttribute('aria-label', label);
        pauseButton.title = label;
        pauseButton.firstElementChild.toggleAttribute('hidden', paused);
        pauseButton.lastElementChild.toggleAttribute('hidden', !paused);
      }
      options.onPause?.(paused);
      schedule();
    }

    function handleShortcut(event) {
      if (!visible || !gl || failed || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Escape') needle.clear();
      if (!options.secondary && event.code === 'Space' && !event.repeat &&
          !event.target.closest('input, textarea, select, button, a, summary, [contenteditable], [role="button"]')) {
        event.preventDefault();
        setPaused(!paused);
      }
    }

    pauseButton?.addEventListener('click', () => setPaused(!paused));
    document.addEventListener('keydown', handleShortcut);
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); showFallback(); });
    canvas.addEventListener('webglcontextrestored', () => { failed = false; schedule(); });
    window.addEventListener('pagehide', event => { if (!event.persisted) { resize.disconnect(); dispose(); } });
    window.addEventListener('pageshow', schedule);

    return {
      setVisible(value) {
        visible = value;
        if (value) schedule();
        else { finishConstruction(); rememberSeated(); dispose(); previous = 0; }
      },
      setScenario(intensity, filtered = false) {
        if (scenarioShare === intensity && scenarioFiltered === filtered) return;
        if ((scenarioShare > 0) !== (intensity > 0) || scenarioFiltered !== filtered) layerDirty = true;
        scenarioShare = intensity;
        scenarioFiltered = filtered;
        schedule();
      },
      setEmotion(id) {
        expression.select(LoomInterpretations.get(id).values);
        schedule();
      },
      setData(value) { data = value; refresh(); },
      clearEdits(animate = false) { needle.reset(animate); },
      setPaused,
      setComparison(value) {
        if (comparison === value) return;
        comparison = value;
        refresh();
      },
      startConstruction() {
        if (motion.matches || failed) return;
        construction = constructionWait = 0;
        options.onConstruction?.(true);
        schedule();
      },
      finishConstruction,
      restart() {
        finishConstruction();
        if (paused) setPaused(false);
        settled.clear();
        elapsed = insertion = previous = 0;
        needle.clear();
      },
      setFigure(symbol, routeIds) {
        const key = symbol ? JSON.stringify([symbol.id, [...routeIds].sort()]) : '';
        if (key === (embroidered?.key ?? '')) return;
        embroidered = symbol ? { key, symbol, routeIds } : null;
        refresh();
      },
      setLayer(mode, routeIds) {
        const sameFocus = layer.routeIds.size === routeIds.size && [...routeIds].every(id => layer.routeIds.has(id));
        if (layer.mode === mode && sameFocus) return;
        needle.clear();
        const changedMode = layer.mode !== mode;
        layer = { mode, routeIds };
        if ((!sameFocus && data.routes.length > 10) || (changedMode && data.routes[0]?.info?.status !== 'demo')) refresh();
        layerDirty = true;
        frameReady = false;
        schedule();
      },
      getFiber(id) {
        const fiber = mesh?.ranges.get(id);
        return fiber?.retired ? undefined : fiber;
      }
    };
  }

  return { mount, buildFibers, qualityFor };
})();
