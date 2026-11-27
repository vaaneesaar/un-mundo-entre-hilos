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
    const colors = ['#A9C1FD', '#A38BE8', '#A9C1FD', '#A38BE8', '#64B9F4'];
    function depthAt(x, y) {
      const transverse = Math.exp(-((x + .75) ** 2) / 3.4);
      const gathering = Math.exp(-((y - .18) ** 2) / 1.4);
      return .56 * transverse * gathering + .19 * Math.sin(x * 1.06 + y * .83) + .10 * Math.sin(y * 2.2 - x * .55);
    }
    const fibers = Array.from({ length: quality.warp }, (_, index) => {
      const x = first + index * spacing;
      const length = 4.72 - .34 * (x / 4.85) ** 2 + random() * .30;
      const center = .14 * Math.sin(x * .68);
      return {
        id: 'urdimbre-' + index, system: 'warp', group: 'urdimbre',
        phase: random() * tau, color: colors[index % colors.length],
        radius: .0105 + random() * .0065, tension: .56 + random() * .26, steps: 52,
        sample(t) {
          const y = center + (t - .5) * length;
          return layout([x, y, depthAt(x, y)]);
        }
      };
    });
    return { first, spacing, depthAt, fibers };
  }

  function makeWeft(data, quality, layout, warp, focus) {
    const fibers = [];
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
          color: index % 17 === 4 && routeSeed % 3 === 0 ? '#F7BF3B'
            : index % 11 === 3 && routeSeed % 3 === 1 ? '#F47FA6'
            : route.color,
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
              + arc * Math.sin(t * 7.2 + phaseOffset) * route.distance * .63
              + spread * separation * attachment + arc * Math.sin(t * 14 + phase) * .065;
            // At each warp column, adjacent picks alternate on opposite sides of the same depth surface.
            const crossing = Math.PI * ((x - warp.first) / warp.spacing + parity);
            const overUnder = Math.cos(crossing) * (.098 + thickness * .75 + gather * .026);
            // Relief peaks between columns and vanishes at the interlacing points.
            const pocket = Math.sin(crossing) ** 2;
            const foldHeight = bundle * route.lift * (.18 + scale * .28);
            const relief = arc * (foldHeight * (.34 + pocket * .66)
              + pocket * (spread * .06 + lerp(start[2], end[2], t) * .08));
            return layout([x, y, lerp(lerp(start[2], end[2], t), warp.depthAt(x, y) + overUnder + relief, attachment)]);
          }
        });
      }
    });
    return { fibers, omitted: allocation.omitted.length };
  }

  function buildFibers(data, quality, embroidered = null, focus) {
    const layout = ([x, y, z]) => quality.portrait
      ? [x * .45 - y * .22, y * 1.04 + x * .32, z * .9]
      : [x, y, z];
    const warp = makeWarp(data, quality, layout);
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
      (fiber.system === 'support' || (fiber.system === 'weft' && settled.has(fiber.id))));
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
    const stride = 19;
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
      const delay = timings.get(fiber.id) ?? -10;
      const direction = fiber.system === 'weft' ? 1 : fiber.system === 'support' ? .25 : 0;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const oldCenter = previousFiber?.sample(t) ?? centers[i];
        const delta = subtract(oldCenter, centers[i]);
        const tangent = normalize(subtract(centers[Math.min(steps, i + 1)], centers[Math.max(0, i - 1)]));
        const across = normalize(cross(tangent, [0, 0, 1]));
        const normal = cross(tangent, across);
        const texture = .96 + .07 * Math.sin(t * 74 + fiber.phase) + .05 * Math.sin(t * 38);
        for (const [partIndex, part] of surface.parts.entries()) {
          const [sideOffset, depthOffset] = LoomMaterials.offset(part, t);
          const radius = part.radius * texture;
          for (let j = 0; j <= sides; j++) {
            const u = j / sides;
            const angle = u * tau;
            const c = Math.cos(angle), s = Math.sin(angle);
            const surfaceNormal = across.map((n, k) => n * c + normal[k] * s);
            const point = centers[i].map((n, k) => n + radius * surfaceNormal[k] + across[k] * sideOffset + normal[k] * depthOffset);
            vertices.set([...point, ...surfaceNormal, ...colors[partIndex],
              t, u, basePhase, delay, direction, fiber.tension, ...delta, Number(retired)], cursor);
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
      const record = { ...fiber, previousSample: previousFiber?.sample, retired, code, centers, delay, vertexStart: base, vertexCount: (steps + 1) * ringSize, first, count: indexCursor - first };
      ranges.set(fiber.id, record);
      byCode.push(record);
    }
    const lastActive = byCode[active.length];
    const activeIndexCount = lastActive ? lastActive.first + lastActive.count : 0;
    return { vertices, indices, ranges, byCode, vertexCount, activeIndexCount };
  }

  function projectedBounds(mesh, portrait) {
    const tilt = portrait ? .16 : .26;
    let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
    for (const fiber of mesh.ranges.values()) {
      if (fiber.retired) continue;
      const margin = fiber.material === 'mesh' || fiber.material === 'band' ? .30 : fiber.radius * 2 + .075;
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
    attribute vec3 stitch;
    attribute vec4 fiberEdit;
    attribute vec4 previousPosition;
    uniform mediump float morph;
    uniform vec2 frame, sceneCenter;
    uniform vec4 pickView;
    uniform vec4 pull;
    uniform float editWeight;
    uniform float highlight;
    uniform float time, portrait, insertion, moving;
    uniform vec3 expressionMotion;
    uniform vec2 expressionGesture;
    varying vec3 vNormal, vColor;
    varying vec2 vYarn, vCode;
    varying float vHighlight, vRetired, vWarp, vEdited;
    varying float vDepth, vPhase, vEntry;
    float pullInfluence(float t, float anchor, float magnitude) {
      float radius = min(.48, .23 + magnitude * .09);
      float edge = t < anchor ? anchor : 1.0 - anchor;
      float span = min(radius, max(.12, edge));
      float u = min(1.0, abs(t - anchor) / span);
      return 1.0 - u * u * u * (u * (u * 6.0 - 15.0) + 10.0);
    }
    void main() {
      vec3 p = point + previousPosition.xyz * (1.0 - morph);
      vRetired = previousPosition.w;
      float fromEdge = stitch.y < 0.0 ? 1.0 - yarn.x : yarn.x;
      float age = insertion - stitch.x - fromEdge * 1.65;
      float slack = exp(-max(age, 0.0) * 4.0);
      float envelope = sin(yarn.x * 3.14159);
      float tension = stitch.z;
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
      // Keep the structural warp, anchored ends and hand-placed sections steady.
      float expression = expressionMotion.x * threaded * moving * envelope *
        (grabbed ? 0.0 : 1.0 - vEdited);
      float accent = sin(expressionMotion.y + threadPhase + yarn.x * 15.0);
      float spread = sin(expressionMotion.y + threadPhase * .43);
      float crossing = sin(expressionMotion.y - fromEdge * 11.0 + threadPhase);
      p.y += expression * expressionGesture.x * (spread + .20 * accent);
      p.z += expression * expressionMotion.z * (.008 * accent + expressionGesture.y * crossing);
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
      vColor = color;
      vYarn = yarn;
      vDepth = camera.z;
      vPhase = phase;
      vEntry = threaded < .5 ? 1.0 : age;
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform float picking, layerProgress, layerWidth, embroideryPass;
    uniform sampler2D layerTexture;
    uniform vec3 expressionLow, expressionMid, expressionHigh;
    uniform vec4 expressionFinish;
    uniform mediump float morph;
    varying vec3 vNormal, vColor;
    varying vec2 vYarn, vCode;
    varying float vHighlight, vRetired, vWarp, vEdited;
    varying float vDepth, vPhase, vEntry;
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
      if (embroideryPass > .5 && abs(layer.a - (embroideryPass - 1.0)) > .5) discard;
      coverage *= mix(layer.r, layer.g, layerProgress);
      if (coverage <= .01) discard;
      // The free ends recede, while the central warp retains enough contrast to read at crossings.
      float endFade = smoothstep(0.0, .20, min(vYarn.x, 1.0 - vYarn.x));
      float warpOpacity = .30 + .44 * endFade;
      coverage *= mix(1.0, warpOpacity, vWarp);
      vec3 n = normalize(vNormal);
      float kind = floor(vPhase / 8.0);
      float threadPhase = mod(vPhase, 8.0);
      float keyLight = max(0.0, dot(n, normalize(vec3(-.44, .70, .63))));
      float warm = max(0.0, dot(n, normalize(vec3(.85, .13, .52))));
      float satin = step(.5, kind) * (1.0 - step(1.5, kind));
      float bundled = step(1.5, kind);
      float open = step(2.5, kind) * (1.0 - step(3.5, kind));
      float expression = expressionFinish.x * (1.0 - vWarp);
      satin = clamp(satin + expression * expressionFinish.y, 0.0, 1.0);
      float sheen = pow(max(0.0, dot(n, normalize(vec3(-.24, .28, .93)))), mix(7.0, 18.0, satin));
      float twist = sin(vYarn.x * 360.0 + vYarn.y * 18.85 + threadPhase);
      float crossgrain = sin(vYarn.x * 485.0 - vYarn.y * 25.13);
      float grain = twist * crossgrain * mix(.10, .045, satin) + twist * .035;
      grain += expression * expressionFinish.z * crossgrain;
      float contact = .93 - bundled * (.15 + expression * expressionFinish.w) * (1.0 - keyLight);
      float light = (.39 + keyLight * .56 + warm * .16 + grain) * contact;
      light *= clamp(.91 + vDepth * .14, .62, 1.22);
      light *= mix(1.21, .81, vWarp);
      float tone = clamp(dot(vColor, vec3(.22, .65, .13)) * .8 + .20 * sin(threadPhase * 2.1), 0.0, 1.0);
      vec3 tinted = mix(mix(expressionLow, expressionMid, smoothstep(.0, .60, tone)),
        expressionHigh, smoothstep(.56, 1.0, tone));
      vec3 pigment = mix(vColor, tinted, expression * .76) * light + vec3(.045,.055,.10) * (1.0 - keyLight);
      pigment += vec3(.19,.17,.16) * warm * .2 + vec3(.76,.80,.92) * sheen * (.040 + satin * .10);
      coverage *= 1.0 - open * .23;
      pigment = mix(pigment, vec3(.93, .88, .99), max(vHighlight * .35, vEdited * .11));
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
    let expressionTime = 0;
    let elapsed = 0, insertion = 0, previous = 0, failed = false;
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
      const sides = fiber.vertexCount / (steps + 1);
      for (let ring = 0; ring <= steps; ring++) {
        const [x, y] = TextileNeedle.offsetAt(edit, Math.fround(ring / steps));
        for (let side = 0; side < sides; side++) {
          const index = start + (ring * sides + side) * 4;
          target[index] = fiber.code;
          target[index + 1] = x;
          target[index + 2] = y;
          target[index + 3] = 0;
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
      if (fiber.system === 'support') return embroidered && !fiber.retired ? 1 : 0;
      if (embroidered) {
        if (fiber.system === 'warp') return .25;
        if (fiber.figure) return 1;
        if (!embroidered.routeIds.size || layer.mode === 'isolate') return 0;
        return layer.mode === 'all' ? .24 : .09;
      }
      return LoomDestinations.layerOpacity(layer.mode, layer.routeIds.has(fiber.group), fiber.system === 'warp');
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
          if (previousById) start = previousById.get(fiber.id) ?? (fiber.system === 'support' ? 0 : target);
          else if (layerPixels?.length === pixels.length) start = Math.round(lerp(layerPixels[i], layerPixels[i + 1], eased));
        }
        const visible = embroidered
          ? target > 0 && Boolean(fiber.figure) && fiber.pickable !== false
          : LoomDestinations.layerPickable(layer.mode, layer.routeIds.has(fiber.group), fiber.system === 'warp');
        pixels.set([start, target, visible && !fiber.retired ? 255 : 0, fiber.figure ? 255 : 0], i);
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
      for (const [name, size, offset] of [['point',3,0], ['normal',3,3], ['color',3,6], ['yarn',2,9], ['phase',1,11], ['stitch',3,12], ['previousPosition',4,15]]) {
        const location = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 76, offset * 4);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, editBuffer);
      const editLocation = gl.getAttribLocation(program, 'fiberEdit');
      gl.enableVertexAttribArray(editLocation);
      gl.vertexAttribPointer(editLocation, 4, gl.FLOAT, false, 16, 0);
      uniforms = Object.fromEntries(['frame','sceneCenter','time','portrait','insertion','moving','pickView','picking','pull','editWeight','highlight','morph','layerProgress','layerWidth','layerTexture','embroideryPass','expressionMotion','expressionGesture','expressionLow','expressionMid','expressionHigh','expressionFinish'].map(name => [name, gl.getUniformLocation(program, name)]));
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
      if (!frameReady || rebuildNeeded || !mesh || gl.isContextLost()) return null;
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
        candidate.distance <= Math.min(tolerance, hit.main.distance + 2) && layer.routeIds.has(candidate.fiber.group));
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
      const fibers = buildFibers(data, quality, embroidered, layer.routeIds);
      mesh = meshFibers(fibers, quality, settled, prior);
      bounds = projectedBounds(mesh, quality.portrait);
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
      morph = motion.matches ? 1 : Math.min(1, morph + delta / .95);
      const easedMorph = morph * morph * (3 - 2 * morph);
      layerProgress = motion.matches ? 1 : Math.min(1, layerProgress + delta / layerDuration);
      gl.uniform1f(uniforms.layerProgress, easedLayer());
      if (motion.matches) insertion = 10;
      else if (!paused) {
        elapsed += delta;
        insertion = Math.min(10, insertion + delta);
      }
      const [strength, lr, lg, lb, mr, mg, mb, hr, hg, hb, finish, grain, contrast, speed, amplitude, spread, crossing] =
        expression.advance(Math.min(delta, .05), motion.matches);
      if (!paused && !motion.matches) expressionTime = (expressionTime + delta * 2.4 * speed) % (2 * Math.PI);
      gl.uniform3f(uniforms.expressionMotion, strength, expressionTime, amplitude);
      gl.uniform2f(uniforms.expressionGesture, spread, crossing);
      gl.uniform3f(uniforms.expressionLow, lr, lg, lb);
      gl.uniform3f(uniforms.expressionMid, mr, mg, mb);
      gl.uniform3f(uniforms.expressionHigh, hr, hg, hb);
      gl.uniform4f(uniforms.expressionFinish, strength, finish, grain, contrast);
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
      if ((!paused && !motion.matches) || morph < 1 || layerProgress < 1 || expression.active || needle.needsFrame()) schedule();
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
        else { rememberSeated(); dispose(); previous = 0; }
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
      restart() {
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
        layer = { mode, routeIds };
        if (!sameFocus && data.routes.length > 10) refresh();
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
