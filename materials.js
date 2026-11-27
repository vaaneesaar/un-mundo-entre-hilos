'use strict';

const LoomMaterials = (() => {
  const names = { cotton: 0, silk: 1, braid: 2, mesh: 3, band: 4 };
  const tau = Math.PI * 2;

  function routeMaterial(index, seed) {
    if (index === 0) return ['mesh', 'band', 'braid', 'silk'][seed % 4];
    if (index % 13 === 0) return seed % 2 ? 'mesh' : 'band';
    if (index % 7 === 3) return 'braid';
    return index % 3 === 0 ? 'silk' : 'cotton';
  }

  function profile(kind = 'cotton', radius, strength = .5, lod = 1) {
    const part = (side, depth, width, shade, turns = 0, phase = 0) =>
      ({ side, depth, radius: width, shade, turns, phase });
    if (typeof kind === 'object') {
      const { lane, concentration, connectivity } = kind;
      const styles = [
        { width: .34, code: 5 }, { width: .24, code: 6 },
        { width: .14, code: 5, cord: [.14, .80] }, { width: .34, code: 5 },
        { width: .21, code: 6, cord: [.24, .76] }, { width: .31, code: 5 },
        { width: .10, code: 5, cord: [.21, .73] }, { width: .25, code: 6 }
      ];
      const style = styles[lane];
      const width = style.width * (.65 + .68 * strength + .12 * connectivity);
      const parts = [{ ...part(0, 0, width, 1), gauze: true, code: style.code }];
      const patch = [.24 + .04 * (lane % 4), .61 + .07 * (lane % 3)];
      if (lane % 2 === 0 || lane === 5) {
        parts.push({ ...part(width * .14, .065, width * .63, .93), gauze: true, code: 6, window: patch });
      }
      for (const edge of [-1, 1]) {
        parts.push({ ...part(width * edge * 1.06, .027, radius * .29, .84), code: 7, hem: true });
      }
      if (lod >= .8 || lane % 2 === 0) {
        parts.push({ ...part(width * .68, -.065, radius * .27, 1.1), code: 7, hem: true, loose: true });
      }
      if (style.cord) {
        const plyRadius = (.018 + .017 * strength + .009 * concentration);
        for (let ply = 0; ply < 3; ply++) {
          parts.push({ ...part(plyRadius * 1.06, plyRadius * 1.18, plyRadius * 1.15, [.80, 1.01, 1.16][ply], 19, tau * ply / 3),
            cordSide: width * .57, code: 2, window: style.cord });
        }
      }
      if (lane === 1 || lane === 3 || lane === 5 || lane === 7) {
        const knot = .29 + (lane % 4) * .12;
        for (const side of [-1, 1]) {
          parts.push({ ...part(width * .32 * side, -.065, width * .62, side > 0 ? .91 : 1.08),
            gauze: true, code: 8, window: [knot - .10, knot + .10], fold: side });
        }
      }
      return { kind: 'corridor', code: style.code, steps: style.cord ? (lod < .8 ? 112 : 152) : 84, parts };
    }
    if (kind === 'braid') {
      const turns = lod < .8 ? 8 : 12;
      const plies = [0, 1, 2].map(i =>
        ({ ...part(radius * 1.54, radius * 1.40, radius * 1.14, [.80, 1.00, 1.13][i], turns, tau * i / 3),
          gathering: strength }));
      return { kind, code: names[kind], steps: turns * 7, parts: [part(0, 0, radius, .66), ...plies] };
    }
    if (kind === 'mesh' || kind === 'band') {
      const open = kind === 'mesh';
      const width = (open ? .19 : .108) + (open ? .29 : .19) * strength;
      const count = lod < .8 ? 3 : open ? 8 : 9;
      const turns = lod < .8 ? 4 : open ? 6 : 8;
      const parts = Array.from({ length: count }, (_, i) => {
        const across = i * 2 / (count - 1) - 1;
        return { ...part(width * across, (1 - across ** 2) * width * .24,
          radius * (open ? .47 : .69), i % 2 ? .87 : 1.05),
          ribbon: width, strand: i, weaveFrequency: turns };
      });
      parts.push({ ...part(width, width * .24, radius * .57, 1.13, turns), binding: count });
      if (lod >= .8) parts.push({ ...part(width, width * .24, radius * .52, .84, turns, Math.PI), binding: count });
      return { kind, code: names[kind], steps: turns * 8, parts };
    }
    return { kind, code: names[kind], steps: 0, parts: [part(0, 0, radius, 1)] };
  }

  function offset(part, t) {
    if (part.hem) {
      if (!part.loose) return [part.side + .008 * Math.sin(t * 72), part.depth];
      return [part.side + .12 * Math.sin(t * tau * 1.8) * Math.sin(t * Math.PI),
        part.depth + .115 * Math.sin(t * tau * 1.3)];
    }
    if (part.cordSide !== undefined) {
      const angle = (t + .006 * Math.sin(t * 21)) * part.turns * tau + part.phase;
      return [part.cordSide + part.side * Math.cos(angle), -.115 + part.depth * Math.sin(angle)];
    }
    const taper = Math.min(1, Math.sin(t * Math.PI) * 4.5);
    const knot = part.gathering === undefined ? 0 : Math.exp(-((t - .54) ** 2) / .014) * part.gathering;
    const angle = (t + knot * .035 * Math.sin((t - .54) * 8)) * part.turns * tau + part.phase;
    const side = part.turns ? part.side * Math.cos(angle) : part.side;
    const depth = part.turns ? part.depth * Math.sin(angle) : part.depth;
    // Keep the openings in the net. The binding crosses each longitudinal yarn
    // on alternating sides of the ribbon's curved section.
    if (part.binding) {
      const across = Math.cos(angle);
      const arc = (1 - across ** 2) * part.depth;
      const weave = Math.cos((across + 1) * Math.PI * (part.binding - 1) * .5);
      return [side * taper, (arc + part.radius * 1.18 * weave * Math.sin(angle)) * taper];
    }
    if (part.ribbon) {
      const ripple = Math.sin(t * tau * part.weaveFrequency + part.strand * Math.PI);
      return [side * taper, (depth + ripple * part.radius * .7) * taper];
    }
    return [side * taper * (1 + knot * .6), depth * taper * (1 + knot * .6)];
  }

  return { routeMaterial, profile, offset };
})();

if (typeof module !== 'undefined') module.exports = LoomMaterials;
