'use strict';

const LoomEmbroidery = (() => {
  const palette = {
    ice: '#DCDFFF', sky: '#A9C1FD', blue: '#64B9F4', lilac: '#A38BE8',
    indigo: '#474292', plum: '#6B467A', rose: '#F47FA6', gold: '#F7BF3B'
  };
  const rectangle = (left, right, bottom, top) => [[left,bottom],[right,bottom],[right,top],[left,top]];
  const arch = (x, bottom, width, spring, rise, depth) => [
    [x - width, bottom, depth],
    ...Array.from({ length: 17 }, (_, i) => {
      const angle = Math.PI * (1 - i / 16);
      return [x + width * Math.cos(angle), spring + rise * Math.sin(angle), depth];
    }),
    [x + width, bottom, depth]
  ];

  function orlandoArchitecture() {
    const outlines = [], panels = [];
    const thread = (points, hue, depth, plies = 1, radius = .012) =>
      outlines.push([points, hue, depth, plies, radius]);
    const panel = (polygon, hue, z, slope, origin, surface, opening) =>
      panels.push({ polygon, hue, z, slope, origin, surface, opening });
    const wall = (left, right, base, top, depth, hue, opening) => {
      const shoulder = right - (right - left) * .29;
      const flank = depth - .26;
      panel(rectangle(left, shoulder, base, top), hue, depth, .075, left, 'face', opening);
      panel(rectangle(shoulder, right, base, top), 'indigo', depth + (shoulder-left)*.075,
        (flank - depth - (shoulder-left)*.075)/(right-shoulder), shoulder, 'flank', opening);
      const molding = y => [[left,y,depth+.024],[shoulder,y,depth+.085],[right,y,flank+.025]];
      thread([[left,base], [left,top]], 'sky', depth+.045, 2, .015);
      thread([[right,base,flank],[right,top,flank]], 'lilac', flank);
      thread(molding(top), 'ice', depth, 2);
      thread(molding(base), 'sky', depth);
    };
    const tower = ({ x, width, base, cornice, tip, depth, hue }) => {
      const left = x - width, right = x + width;
      const eave = width * 1.15;
      const roof = [[x-eave,cornice],[x-width*.77,cornice+.17],[x-width*.41,tip-.22],
        [x-.032,tip],[x+.035,tip],[x+width*.53,tip-.23],[x+width*.84,cornice+.18],[x+eave,cornice]];
      const slit = Math.min(.14, width * .29);
      const spring = cornice - .30;
      wall(left, right, base, cornice, depth, hue, { x: x-.045, width: slit, bottom: spring-.32, spring, rise: slit*.85 });
      const roofDepth = depth + .12;
      panel(roof, 'lilac', roofDepth, 0, x, 'roof');
      thread([...roof, roof[0]], 'sky', roofDepth, 2, .014);
      for (const rib of [-.56, .03, .55]) {
        thread([[x+eave*rib,cornice,roofDepth+.07],[x+width*rib*.74,cornice+.20,roofDepth+.11],
          [x+width*rib*.40,tip-.25,roofDepth+.09],[x,tip,roofDepth]], rib === .03 ? 'ice' : 'lilac', roofDepth);
      }
      for (const y of [cornice-.09, cornice+.025]) {
        thread([[x-eave,y],[x+eave,y]], 'sky', depth+.10, 2);
      }
      thread(arch(x-.045, spring-.32, slit, spring, slit*.85, depth+.08), 'ice', depth+.08);
    };

    // Rear ranges, slender keep and offset turrets establish an original stepped silhouette.
    tower({ x: -1.07, width: .47, base: -.76, cornice: 1.27, tip: 2.22, depth: -.34, hue: 'lilac' });
    tower({ x: .36, width: .59, base: -.60, cornice: 1.70, tip: 2.93, depth: -.26, hue: 'sky' });
    tower({ x: 1.39, width: .43, base: -.81, cornice: .94, tip: 1.86, depth: -.21, hue: 'sky' });
    tower({ x: -2.30, width: .54, base: -1.52, cornice: .32, tip: 1.38, depth: .04, hue: 'sky' });
    tower({ x: 2.27, width: .51, base: -1.54, cornice: .09, tip: 1.21, depth: .17, hue: 'lilac' });

    wall(-1.87, -.53, -1.61, -.27, .31, 'sky');
    wall(.49, 1.91, -1.61, -.27, .39, 'lilac');
    for (const x of [-1.49, -1.10, .99, 1.44]) {
      thread(arch(x, -1.02, .105, -.76, .105, .47), 'sky', .47);
    }
    wall(-.69, .65, -.70, .37, .41, 'ice');
    const parapet = [[-.71,.36],[-.71,.56],[-.51,.56],[-.51,.46],[-.32,.46],[-.32,.56],[-.11,.56],
      [-.11,.46],[.11,.46],[.11,.56],[.31,.56],[.31,.46],[.49,.46],[.49,.56],[.67,.56],[.67,.36]];
    thread(parapet, 'ice', .49, 2);
    thread(arch(-.02, -.23, .16, .01, .14, .54), 'sky', .54);

    // Layered archivolts surround an open entrance, with the depth visible along the jambs.
    for (const [width, depth, hue] of [[.39,.35,'indigo'],[.43,.50,'lilac'],[.46,.59,'sky'],[.52,.66,'ice']]) {
      thread(arch(-.02, -1.62, width, -.98, width * .92, depth), hue, depth, 2, .015);
    }
    for (const [left, right, depth] of [[-2.84,-.56,.53],[.51,2.81,.57]]) {
      for (const y of [-1.64,-1.56,-1.48]) thread([[left,y,depth-.22],[left+.32,y,depth],[right,y,depth]], 'lilac', depth);
    }
    return { outlines, panels };
  }

  const castle = {
    id: 'castillo-orlando',
    destinationIds: ['city:ORL','airport:KMCO'],
    name: 'Castillo de Orlando',
    description: 'El castillo es una interpretación visual asociada al imaginario turístico de Orlando; no representa el motivo de viaje de todos sus visitantes.',
    materials: palette,
    ...orlandoArchitecture(),
    embroidery: { rows: 6, mobileRows: 4, depth: .26, outlineRadius: .012 }
  };

  function indexSymbols(symbols) {
    const index = new Map();
    for (const symbol of symbols) {
      for (const id of symbol.destinationIds) {
        if (index.has(id)) throw new Error('Figura duplicada para ' + id);
        index.set(id, symbol);
      }
    }
    return index;
  }

  // Each polygon provides a woven front and a recessed return. Open contours
  // carry the architectural detail without contributing any flight counts.
  function countrySymbol(country, name, silhouette, details) {
    const panels = [];
    const outlines = [];
    silhouette.forEach((polygon, index) => {
      const z = .08 + index * .033;
      const hue = ['sky', 'lilac', 'ice'][index % 3];
      const center = polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length;
      panels.push({ polygon, hue, z, slope: -.07, origin: center, surface: 'face' });
      const back = polygon.map(([x,y]) => [x + .10, y + .055]);
      panels.push({ polygon: back, hue: 'indigo', z: z - .22, slope: -.07, origin: center, surface: 'flank' });
      outlines.push([[...polygon, polygon[0]], hue, z + .08, 2, .016]);
    });
    details.forEach(path => outlines.push([path, 'ice', .35, 2, .013]));
    return {
      id: 'bordado-' + country.toLowerCase(), destinationIds: ['country:' + country], name,
      description: 'Interpretación cultural bordada. El relieve responde a los vuelos observados para el país; la figura no indica el motivo de viaje.',
      materials: palette, panels, outlines,
      embroidery: { rows: 5, mobileRows: 3, depth: .28, outlineRadius: .013 }
    };
  }

  const countries = [
    countrySymbol('FR', 'Torre Eiffel', [
      [[-1.75,-1.55],[-1.12,-1.55],[-.53,-.45],[-.19,1.16],[-.07,2.65],[-.21,2.25],[-.57,.53],[-.98,-.58]],
      [[1.12,-1.55],[1.75,-1.55],[.98,-.58],[.57,.53],[.21,2.25],[.07,2.65],[.19,1.16],[.53,-.45]],
      rectangle(-1.04,1.04,-.51,-.30), rectangle(-.54,.54,.48,.66)
    ], [arch(0,-1.55,1.18,-1.34,.83,.36), [[0,.65],[0,2.83]], [[-.43,.66],[.34,1.34],[-.23,1.70],[.13,2.18]]]),
    countrySymbol('MX', 'Palacio de Bellas Artes', [
      rectangle(-2.45,2.45,-1.45,-.46), rectangle(-2.12,2.12,-.48,.18),
      rectangle(-.86,.86,-1.42,.70),
      [[-1.02,.60],[-.92,1.13],[-.66,1.52],[0,1.76],[.66,1.52],[.92,1.13],[1.02,.60]],
      rectangle(-.12,.12,1.70,2.13)
    ], [-1.68,-.58,.58,1.68].map(x => arch(x,-1.43,.28,-.87,.29,.38))),
    countrySymbol('US', 'Rascacielos', [
      rectangle(-2.34,-1.56,-1.52,.04), rectangle(-1.48,-.83,-1.52,1.05),
      [[-.75,-1.52],[.46,-1.52],[.46,1.06],[.28,1.06],[.28,1.66],[.12,1.66],[.12,2.44],[-.17,2.44],[-.17,1.66],[-.49,1.66],[-.49,.88],[-.75,.88]],
      rectangle(.55,1.23,-1.52,.41), [[1.34,-1.52],[2.29,-1.52],[2.29,.48],[1.68,1.27],[1.34,.48]]
    ], [[[-2.42,-1.53],[2.43,-1.53]], [[-.03,2.42],[-.03,2.80]], [[-.59,.81],[-.59,-1.40]], [[.28,1.05],[.28,-1.42]]]),
    countrySymbol('GB', 'Torre Elizabeth', [
      rectangle(-.70,.70,-1.55,1.05), rectangle(-.84,.84,.72,1.50),
      [[-.80,1.48],[.80,1.48],[.49,1.82],[.34,2.10],[0,2.78],[-.34,2.10],[-.49,1.82]]
    ], [Array.from({length: 25}, (_, i) => [.40*Math.cos(i*Math.PI/12), 1.12+.32*Math.sin(i*Math.PI/12)]),
      [[0,1.34],[0,1.12],[.24,1.04]], [[-.42,-1.45],[-.42,.72]], [[.42,-1.45],[.42,.72]]]),
    countrySymbol('JP', 'Monte Fuji y pagoda', [
      [[-2.65,-1.48],[-1.55,-.87],[-.80,-.10],[-.46,.68],[.04,1.55],[.58,1.57],[1.04,.72],[1.43,.01],[2.38,-.91],[2.70,-1.48]],
      [[-.66,.25],[.04,1.55],[.58,1.57],[1.22,.39],[.66,.61],[.22,.42],[-.13,.54]],
      rectangle(1.07,1.80,-1.46,.02),
      ...[-.74,-.39,-.06,.26].map((y,i) => [[.85+i*.10,y],[2.03-i*.10,y],[1.77-i*.07,y+.11],[1.45,y+.38],[1.10+i*.08,y+.12]])
    ], [[[1.45,.56],[1.45,.93]], [[1.30,-1.48],[1.30,-1.08],[1.57,-1.08],[1.57,-1.48]]]),
    countrySymbol('BR', 'Cristo Redentor', [
      rectangle(-.65,.65,-1.56,-1.15),
      [[-.48,-1.16],[.48,-1.16],[.34,.40],[.44,1.14],[-.44,1.14],[-.34,.40]],
      [[-2.51,1.17],[-2.51,.96],[-.46,.57],[.46,.57],[2.51,.96],[2.51,1.17],[.39,1.16],[-.39,1.16]],
      [[-.27,1.13],[.27,1.13],[.30,1.54],[.17,1.83],[-.17,1.83],[-.30,1.54]]
    ], [[[-.30,-1.15],[-.17,.32],[-.30,.90]], [[.19,-1.15],[.04,.33],[.26,.96]]]),
    countrySymbol('ES', 'Torres de la Sagrada Familia', [
      rectangle(-1.95,1.95,-1.55,-.70),
      ...[[-1.42,1.58],[-.51,2.35],[.51,2.52],[1.42,1.76]].map(([x,tip]) =>
        [[x-.44,-1.20],[x+.44,-1.20],[x+.30,.20],[x+.17,tip-.34],[x,tip],[x-.17,tip-.34],[x-.30,.20]])
    ], [arch(0,-1.55,.65,-.84,.74,.36), ...[-1.42,-.51,.51,1.42].map(x => [[x,-.50],[x,.64]])])
  ];

  const byDestination = indexSymbols([castle, ...countries]);

  function forDestination(id) {
    return byDestination.get(id) ?? null;
  }

  // Arc-length sampling keeps the stitch pattern even through short turns.
  function pathSampler(points) {
    const ends = [0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      ends.push(ends[i - 1] + Math.hypot(...a.map((value, axis) => b[axis] - value)));
    }
    return t => {
      const at = t * ends[ends.length - 1];
      let i = 1;
      while (i < ends.length - 1 && at > ends[i]) i++;
      const fraction = (at - ends[i - 1]) / (ends[i] - ends[i - 1] || 1);
      return points[i - 1].map((value, axis) => value + (points[i][axis] - value) * fraction);
    };
  }

  function scanline(polygon, y) {
    const crossings = [];
    for (let i = 0; i < polygon.length; i++) {
      const [x0,y0] = polygon[i], [x1,y1] = polygon[(i + 1) % polygon.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        crossings.push(x0 + (x1 - x0) * (y - y0) / (y1 - y0));
      }
    }
    return [Math.min(...crossings), Math.max(...crossings)];
  }

  function surfaceDepth(panel, x, u, v) {
    const base = panel.z + (x - (panel.origin ?? 0)) * (panel.slope ?? 0);
    if (panel.surface === 'roof') return base + (1 - v) * (.30 * Math.sin(Math.PI * u) - .105 * u);
    if (panel.surface === 'face') return base + .083 * Math.sin(Math.PI * u);
    return base;
  }

  function isOpening(opening, x, y) {
    if (!opening || y < opening.bottom) return false;
    const across = (x - opening.x) / opening.width;
    return Math.abs(across) < .87 &&
      y < opening.spring + opening.rise * Math.sqrt(1 - across * across);
  }

  // Two perpendicular thread families share a grid. At each crossing the
  // parity changes which thread sits above the other.
  function weavePanel(panel, panelIndex, symbol, figure, layout, quality, relief) {
    if (!panel.surface) return [];
    const ys = panel.polygon.map(point => point[1]);
    const xs = panel.polygon.map(point => point[0]);
    const bottom = Math.min(...ys), height = Math.max(...ys) - bottom;
    const width = Math.max(...xs) - Math.min(...xs);
    const lod = quality.lod ?? 1;
    const rows = Math.max(5, Math.ceil(height * (8 + relief * 18) * lod));
    const columns = Math.max(4, Math.ceil(width * 11 * lod));
    const supports = [];
    for (const crosswise of [true, false]) {
      const lines = crosswise ? rows : columns;
      const knots = crosswise ? columns : rows;
      for (let line = 0; line <= lines; line++) {
        let points = [], run = 0;
        const finish = () => {
          if (points.length < 2) { points = []; return; }
          const path = pathSampler(points);
          const hue = panel.surface === 'flank' ? (crosswise ? 'indigo' : 'plum') :
            crosswise ? panel.hue : panel.surface === 'roof' ? 'indigo' : 'lilac';
          supports.push({
            id: `${symbol.id}:tejido:${panelIndex}:${Number(crosswise)}:${line}:${run++}`,
            system: 'support', group: symbol.id, figure, pickable: false, material: crosswise ? 'cotton' : 'silk',
            color: symbol.materials[hue], radius: (crosswise ? .023 : .014) * (1 + relief * 1.55) / Math.sqrt(lod),
            phase: panelIndex * .9 + line * .43, tension: .88, steps: Math.max(5, (points.length - 1) * 2),
            sample(t) { return layout(...path(t)); }
          });
          points = [];
        };
        for (let knot = 0; knot <= knots; knot++) {
          const u = .025 + .95 * (crosswise ? knot / knots : line / lines);
          const v = .025 + .95 * (crosswise ? line / lines : knot / knots);
          const y = bottom + height * v;
          const [left, right] = scanline(panel.polygon, y);
          const x = left + (right - left) * u;
          if (isOpening(panel.opening, x, y)) { finish(); continue; }
          const lift = (crosswise ? 1 : -1) * ((line + knot) % 2 ? -.016 : .016);
          points.push([x, y + .007 * Math.sin(knot * 1.15 + line * .48),
            surfaceDepth(panel, x, u, v) + lift + .010 * Math.sin(knot * .74 + line) + relief * .20]);
        }
        finish();
      }
    }
    return supports;
  }

  function build(symbol, related, quality) {
    const empty = { fibers: [], supports: [] };
    if (!related.length) return empty;
    const volume = related.reduce((sum, fiber) => sum + fiber.flightInfo.represented, 0);
    const relief = symbol.embroidery.depth * volume / (volume + 100);
    const layout = (x,y,z) => quality.portrait ? [x * .71, y - .2, z * .88] : [x, y - .2, z];
    const figure = { id: symbol.id, name: symbol.name };
    const fibers = related.map((fiber, index) => {
      const panel = symbol.panels[index % symbol.panels.length];
      const order = Math.floor(index / symbol.panels.length);
      const ys = panel.polygon.map(point => point[1]);
      const bottom = Math.min(...ys), height = Math.max(...ys) - bottom;
      const rowFraction = (order * .61803398875 + .5) % 1;
      const rows = quality.portrait ? symbol.embroidery.mobileRows : symbol.embroidery.rows;
      const spread = .60 / (1 + Math.floor(related.length / symbol.panels.length) * .025);
      const start = .03 + rowFraction * (.94 - spread);
      const points = [];
      for (let j = 0; j < rows; j++) {
        const y = bottom + height * (start + spread * j / (rows - 1));
        const [left, right] = scanline(panel.polygon, y);
        const inset = Math.min(.03, (right - left) * .08);
        if (j % 2 === 0) points.push([left + inset,y],[right - inset,y]);
        else points.push([right - inset,y],[left + inset,y]);
      }
      const path = pathSampler(points);
      const routeVolume = fiber.flightInfo.flightCount;
      const pile = relief * (.62 + .38 * routeVolume / (routeVolume + 80));
      return {
        ...fiber, figure, material: index % 13 === 5 ? 'mesh' : index % 9 === 2 ? 'braid' : index % 2 ? 'cotton' : 'silk',
        steps: Math.max(fiber.steps, quality.portrait ? 75 : 130),
        radius: Math.max(.014, fiber.radius * (1.02 + relief)),
        color: symbol.materials[panel.hue],
        sample(t) {
          const [x,y] = path(t);
          const phase = x * 20 + y * 9 + fiber.phase;
          const bulge = Math.sin(t * Math.PI);
          const [left, right] = scanline(panel.polygon, y);
          const depth = surfaceDepth(panel, x, (x - left) / (right - left), (y - bottom) / height);
          return layout(x, y + Math.cos(phase) * .011,
            depth + .041 + pile * bulge * 1.40 + Math.sin(phase) * .015);
        }
      };
    });
    const supports = symbol.outlines.flatMap(([points, hue, depth, plies, radius], index) => {
      const path = pathSampler(points.map(([x,y,z = depth]) => [x,y,z]));
      const count = quality.portrait ? Math.min(plies, 2) : plies;
      return Array.from({ length: count }, (_, ply) => ({
        id: `${symbol.id}:soporte:${index}:${ply}`, system: 'support', group: symbol.id, figure,
        material: ply === 0 && plies > 1 ? 'braid' : 'silk',
        color: symbol.materials[hue], radius: radius ?? symbol.embroidery.outlineRadius,
        phase: index + ply * 1.7, tension: .8, steps: Math.min(140, Math.max(28, points.length * 7)),
        sample(t) {
          const [x,y,z] = path(t);
          return layout(x, y + (ply - .5) * .033 + Math.sin(t * 140 + ply) * .012,
            z + relief * .45 + ply * .033 + Math.cos(t * 140 + ply) * .026);
        }
      }));
    });
    supports.push(...symbol.panels.flatMap((panel, index) => weavePanel(panel, index, symbol, figure, layout, quality, relief)));
    return { fibers, supports };
  }

  return { forDestination, indexSymbols, build };
})();

if (typeof module !== 'undefined') module.exports = LoomEmbroidery;
