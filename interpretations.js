const LoomInterpretations = (() => {
  const neutral = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0];
  const treatment = (palette, finish, grain, contrast, speed, mode) => [
    1, ...palette.flatMap(hex => hex.match(/../g).map(channel => parseInt(channel, 16) / 255)),
    finish, grain, contrast, speed, ...Array.from({ length: 4 }, (_, i) => Number(i === mode))
  ];
  const presets = new Map([
    ['neutral', { label: 'Sin interpretación', color: '#DCDFFF', summary: 'Volver al tejido original', values: neutral }],
    ['nostalgia', {
      label: 'Nostalgia', title: 'Los hilos de la memoria', color: '#A38BE8', summary: 'Tul abierto y respiración lenta',
      quote: 'Hay distancias que permanecen incluso después de regresar.',
      description: 'El tul deja pasar más aire y las hebras del fondo se desvanecen suavemente, como recuerdos de vínculos que permanecen.',
      values: treatment(['636F9E', 'B6A0DA', 'F0CFEB'], -.76, .025, -.035, .30, 0)
    }],
    ['joy', {
      label: 'Felicidad', title: 'Los hilos de la celebración', color: '#F7BF3B', summary: 'Expansión y reflejos de seda',
      quote: 'Algunos viajes comienzan con la emoción de lo que está por venir.',
      description: 'Las capas se abren y las cintas recogen reflejos cálidos. Su ritmo evoca celebración y posibilidades.',
      values: treatment(['D16AB7', 'FF987A', 'FFE797'], .92, -.04, .035, 1.08, 1)
    }],
    ['anticipation', {
      label: 'Expectativa', title: 'Los hilos de lo posible', color: '#64B9F4', summary: 'Trama tensa y pulsos direccionales',
      quote: 'Cada partida abre posibilidades que todavía no conocemos.',
      description: 'La ondulación se recoge y un reflejo recorre algunas hebras. La tensión sugiere el instante previo a un viaje.',
      values: treatment(['474292', '64B9F4', 'F7BF3B'], .32, .045, .05, .73, 2)
    }],
    ['reunion', {
      label: 'Reencuentro', title: 'Los hilos que vuelven a unirse', color: '#F47FA6', summary: 'Cruces que acercan las capas',
      quote: 'Hay viajes cuyo destino no es un lugar, sino alguien.',
      description: 'En varios puntos las capas se acercan y el tejido se vuelve más visible, como un abrazo entre personas que vuelven a encontrarse.',
      values: treatment(['9977CC', 'F47FA6', 'FFDEAE'], .38, .048, .14, .51, 3)
    }]
  ]);
  const get = id => presets.get(id) ?? presets.get('neutral');

  // Blends from the current rendered values, including interrupted transitions.
  function transition() {
    let from = neutral, target = neutral, current = new Float32Array(neutral), progress = 1;
    return {
      select(values) {
        if (values === target) return;
        from = current.slice();
        target = values;
        progress = 0;
      },
      advance(seconds, reduced) {
        progress = reduced ? 1 : Math.min(1, progress + seconds / .48);
        const weight = progress * progress * (3 - 2 * progress);
        current.forEach((_, i) => {
          const material = i >= 1 && i <= 12;
          const start = material && from[0] === 0 ? target[i] : from[i];
          const end = material && target[0] === 0 ? start : target[i];
          current[i] = start * (1 - weight) + end * weight;
        });
        return current;
      },
      get active() { return progress < 1; }
    };
  }

  return { presets, get, transition };
})();
