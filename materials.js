'use strict';

const LoomMaterials = (() => {
  const names = { cotton: 0, silk: 1, braid: 2, mesh: 3, band: 4 };
  const tau = Math.PI * 2;

  function routeMaterial(index, seed) {
    if (index % 13 === 0) return seed % 2 ? 'mesh' : 'band';
    if (index % 9 === 3) return 'braid';
    return index % 3 === 0 ? 'silk' : 'cotton';
  }

  function profile(kind = 'cotton', radius, strength = .5, lod = 1) {
    const part = (side, depth, width, shade, turns = 0, phase = 0) =>
      ({ side, depth, radius: width, shade, turns, phase });
    if (kind === 'braid') {
      const turns = lod < .8 ? 8 : 12;
      return { kind, code: names[kind], steps: turns * 7, parts: [0, 1, 2].map(i =>
        ({ ...part(radius * .92, radius * .92, radius * .67, [.86, 1.03, 1.15][i], turns, tau * i / 3),
          gathering: strength })) };
    }
    if (kind === 'mesh' || kind === 'band') {
      const open = kind === 'mesh';
      const width = (open ? .105 : .067) + (open ? .16 : .11) * strength;
      const count = lod < .8 ? 3 : open ? 4 : 6;
      const turns = lod < .8 ? 4 : open ? 6 : 8;
      const parts = Array.from({ length: count }, (_, i) => {
        const across = i * 2 / (count - 1) - 1;
        return part(width * across, (1 - across ** 2) * width * .32,
          radius * (open ? .54 : .66), i % 2 ? .91 : 1.05);
      });
      parts.push(part(width, width * .31, radius * .52, 1.14, turns, 0));
      if (lod >= .8) parts.push(part(width, width * .31, radius * .48, .86, turns, Math.PI));
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
    return [side * taper * (1 + knot * .6), depth * taper * (1 + knot * .6)];
  }

  return { routeMaterial, profile, offset };
})();

if (typeof module !== 'undefined') module.exports = LoomMaterials;
