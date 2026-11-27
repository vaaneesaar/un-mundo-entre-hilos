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
