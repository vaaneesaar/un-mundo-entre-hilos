const LoomInterpretations = (() => {
  const neutral = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0];
  const treatment = (palette, finish, grain, contrast, speed, amplitude, spread, crossing) => [
    1, ...palette.flatMap(hex => hex.match(/../g).map(channel => parseInt(channel, 16) / 255)),
    finish, grain, contrast, speed, amplitude, spread, crossing
  ];
  const presets = new Map([
    ['neutral', { label: 'Sin interpretación', values: neutral }],
    ['joy', { label: 'Felicidad', description: 'La luz se abre entre los hilos. Los tonos cálidos y la seda luminosa celebran las conexiones que un viaje hace posibles.', values: treatment(
      ['D16AB7', 'FF987A', 'FFE797'], .82, -.035, .02, 1.32, 1.55, .090, .043) }],
    ['nostalgia', { label: 'Nostalgia', description: 'En lilas y violetas, los hilos toman un ritmo más lento. La distancia deja espacio para recordar lugares y personas.', values: treatment(
      ['636F9E', 'B6A0DA', 'F0CFEB'], -.76, .067, -.025, .45, .52, .034, .025) }],
    ['anticipation', { label: 'Expectativa', description: 'El azul eléctrico y los acentos dorados marcan un pulso de anticipación. Las fibras sugieren la tensión de lo que está por comenzar.', values: treatment(
      ['474292', '64B9F4', 'F7BF3B'], .12, .072, .075, 1.25, 1.16, .021, .109) }],
    ['reunion', { label: 'Reencuentro', description: 'Los rosas cálidos destacan los cruces. Las hebras parecen acercarse, como vínculos que vuelven a encontrarse.', values: treatment(
      ['9977CC', 'F47FA6', 'FFDEAE'], .33, .035, .19, .88, 1.14, .042, .073) }],
    ['farewell', { label: 'Despedida', description: 'Las tramas se separan con un pulso lento y un reflejo frío. Entre ellas queda el espacio de lo que se aleja.', values: treatment(
      ['304F9E', '6FBBE4', 'D2E4FF'], -.28, .035, .09, .66, 1.10, .128, .047) }]
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

  /** @typedef {{surveyId:string, sourceId:string, surveyTitle:string, country:string,
   * geographicCoverage:string, destinationId:string, referencePeriod:{start:string,end:string,label:string},
   * population:string, sampleSize?:number, categories:{id:string,label:string,value:number}[],
   * units:'percent'|'people', methodology:string, limitations:string,
   * dataStatus:'synthetic'|'verified', sourceUrl?:string}} Survey
   */
  /** @type {Survey[]} */
  const surveys = [{
    surveyId: 'demo-mx-2026-01', sourceId: 'simulation-project', surveyTitle: 'Distribución ilustrativa de motivos',
    country: 'MX', geographicCoverage: 'México · alcance nacional ilustrativo', destinationId: 'country:MX',
    referencePeriod: { start: '2026-01-01', end: '2026-01-31', label: 'Enero de 2026' },
    population: 'Personas viajeras de una población ficticia', units: 'percent', dataStatus: 'synthetic',
    categories: [{ id: 'leisure', label: 'Ocio o vacaciones', value: 50 },
      { id: 'business', label: 'Negocios', value: 20 },
      { id: 'visits', label: 'Visitas a familiares o amigos', value: 30 }],
    methodology: 'Valores creados por el proyecto para demostrar el control.',
    limitations: 'Distribución del periodo completo, sin estimación diaria ni correspondencia con los vuelos del telar.'
  }];
  function compatibleSurvey(destinationId, day, sources = surveys) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
    return sources.find(survey => survey.destinationId === destinationId &&
      survey.referencePeriod.start <= day && day <= survey.referencePeriod.end);
  }

  return { presets, get, transition, compatibleSurvey };
})();
