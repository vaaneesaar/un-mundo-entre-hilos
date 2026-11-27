'use strict';

const fiberColors = ['#DCDFFF', '#A9C1FD', '#64B9F4', '#A38BE8', '#F47FA6'];
const svgNamespace = 'http://www.w3.org/2000/svg';

function createTextile(host, viewBox, preserveAspectRatio = 'xMidYMid meet') {
  const svg = document.createElementNS(svgNamespace, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('preserveAspectRatio', preserveAspectRatio);
  host.replaceChildren(svg);

  return function drawFiber(path, color, opacity, width = 1) {
    const fiber = document.createElementNS(svgNamespace, 'path');
    fiber.setAttribute('d', path);
    fiber.setAttribute('fill', 'none');
    fiber.setAttribute('stroke', color);
    fiber.setAttribute('stroke-opacity', opacity);
    fiber.setAttribute('stroke-width', width);
    fiber.setAttribute('stroke-linecap', 'round');
    svg.append(fiber);
  };
}

function mountCurtain(host) {
  const draw = createTextile(host, '0 0 900 780', 'xMidYMid slice');
  for (let index = 0; index < 158; index++) {
    const x = 28 + index * 5.5;
    const drift = Math.sin(index * .19) * 28;
    const length = 490 + 100 * Math.sin(index * .058) + 130 * Math.cos(index * .029) ** 2;
    const highlight = index === 86;
    draw(
      `M ${x} -24 C ${x - drift} 205 ${x + drift * 2} 365 ${x + drift} ${length}`,
      highlight ? '#F7BF3B' : fiberColors[index % fiberColors.length],
      highlight ? .95 : .1 + .32 * Math.cos(index * 1.3) ** 2,
      highlight ? 2 : .65 + .55 * Math.sin(index * 1.8) ** 2
    );
    if (index % 6 === 0) {
      draw(`M ${x + 1.1} -24 C ${x - drift + 2} 205 ${x + drift * 2 - 1} 365 ${x + drift} ${length - 4}`,
        '#A9C1FD', .16, 1);
    }
    if (highlight) draw(`M ${x + drift} ${length - 2} l 0 55`, '#F7BF3B', .65, 1.5);
  }
}

function mountLoomPreview(host) {
  const draw = createTextile(host, '0 0 800 500');
  draw('M 118 82 L 627 60 L 702 377 L 191 418 Z', '#A9C1FD', .48, 1.3);
  draw('M 111 75 L 634 52 L 711 383 L 185 427 Z', '#A9C1FD', .23);
  for (let index = 0; index < 26; index++) {
    const x = 137 + index * 2;
    const y = 154 + index * 7.6;
    draw(
      `M ${x} ${y} C ${x + 155} ${y + 43} ${x + 352} ${y - 34} ${x + 508} ${y - 24}`,
      index % 4 === 0 ? '#F47FA6' : '#A38BE8',
      .14 + .16 * Math.sin(index * .33) ** 2,
      1.25
    );
  }

  for (let index = 0; index < 100; index++) {
    const x = 125 + index * 5;
    const top = 82 - index * .215;
    const bottom = 418 - index * .397;
    const tension = 23 * Math.sin(index * .085);
    draw(
      `M ${x} ${top} C ${x + 55 + tension} 171 ${x + 18 - tension} 305 ${x + 73} ${bottom}`,
      fiberColors[index % fiberColors.length],
      .24 + .38 * Math.sin(index * .46) ** 2
    );
  }
}

function mountClosingWeave(host) {
  const draw = createTextile(host, '0 0 600 600');
  for (let index = 0; index < 124; index++) {
    const ratio = index / 123;
    const y = 82 + ratio * 425;
    const x = 68 + ratio * 450;
    const curve = 88 * Math.sin(ratio * Math.PI * 2);
    draw(
      `M ${66 + curve * .45} ${y} C 202 ${y - 101 + curve} 375 ${y + 95 + curve} ${526 - curve * .42} ${y - 27}`,
      fiberColors[(index + 2) % fiberColors.length], .16 + .42 * Math.sin(index * .25) ** 2
    );
    if (index % 4 === 0) {
      draw(`M ${76 + curve * .42} ${y + 1} C 207 ${y - 103 + curve} 380 ${y + 98 + curve} ${514 - curve * .42} ${y - 25}`,
        '#A9C1FD', .26, 1.15);
    }
    draw(
      `M ${x} ${72 + curve * .4} C ${x + 135 - curve} 192 ${x - 157 - curve} 370 ${x + 21} ${515 + curve * .27}`,
      fiberColors[index % fiberColors.length], .11 + .36 * Math.cos(index * .51) ** 2
    );
  }
}

function initIntro(screen, restart) {
  const card = screen.querySelector('#intro-card');
  const begin = screen.querySelector('#begin');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let transition;

  begin.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || transition) return;
    restart();
    if (reducedMotion.matches) return;
    event.preventDefault();
    if (transition) return;

    screen.classList.add('intro-leaving');
    transition = card.animate(
      [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-6px)' }],
      { duration: 360, easing: 'ease-in-out', fill: 'forwards' }
    );
    transition.addEventListener('finish', () => { location.hash = begin.hash; }, { once: true });
  });

  const thread = screen.querySelector('.intro-thread');
  let drag;
  thread.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    drag = { id: event.pointerId, y: event.clientY };
    thread.setPointerCapture(event.pointerId);
  });
  thread.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const distance = Math.max(-82, Math.min(82, event.clientY - drag.y));
    thread.style.setProperty('--pull', distance + 'px');
  });
  thread.addEventListener('lostpointercapture', () => {
    drag = null;
    thread.style.removeProperty('--pull');
  });
  thread.addEventListener('click', () => begin.click());

  return function resetIntro() {
    transition?.cancel();
    transition = undefined;
    screen.classList.remove('intro-leaving');
  };
}

function initNavigation(loom) {
  const screens = new Map(Array.from(document.querySelectorAll('main > .screen'), (screen) => [screen.id, screen]));
  const navLinks = document.querySelectorAll('nav a');
  const resetIntro = initIntro(screens.get('inicio'), loom.restartExperience);
  let activeScreen;

  function showScreen({ moveFocus = false } = {}) {
    const requested = location.hash.slice(1);
    const next = screens.get(requested) ?? screens.get('inicio');
    if (next === activeScreen) return;
    resetIntro();
    screens.forEach((screen) => { screen.hidden = screen !== next; });
    navLinks.forEach((link) => {
      if (link.hash === `#${next.id}`) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    activeScreen = next;
    document.body.classList.toggle('intro-view', next.id === 'inicio');
    document.querySelector('#method-footer').hidden = next.id === 'inicio';
    document.body.classList.toggle('loom-view', next.id === 'telar');
    loom.setVisible(next.id === 'telar');
    if (moveFocus) {
      next.querySelector('h1').focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }

  window.addEventListener('hashchange', () => showScreen({ moveFocus: true }));
  showScreen();
}

function initLoomFilters() {
  const panel = document.querySelector('#loom-controls');
  const trigger = document.querySelector('#loom-more');
  const close = document.querySelector('#loom-controls-close');
  const bar = trigger.closest('.loom-filter-bar');
  function position() {
    if (!panel.matches(':popover-open')) return;
    const top = bar.getBoundingClientRect().bottom + 6;
    const right = document.documentElement.clientWidth - trigger.getBoundingClientRect().right;
    panel.style.setProperty('--filters-top', `${top}px`);
    panel.style.setProperty('--filters-right', `${Math.max(8, right)}px`);
  }

  panel.addEventListener('toggle', () => {
    const open = panel.matches(':popover-open');
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      position();
      close.focus({ preventScroll: true });
    }
  });
  panel.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    panel.hidePopover();
    trigger.focus({ preventScroll: true });
  });
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, { passive: true });
  return () => { if (panel.matches(':popover-open')) panel.hidePopover(); };
}

const textileRenderers = { curtain: mountCurtain, loom: mountLoomPreview, weave: mountClosingWeave };
document.querySelectorAll('[data-textile]').forEach((host) => {
  textileRenderers[host.dataset.textile](host);
});
const closeLoomFilters = initLoomFilters();
function initDemoFlights() {
  const activity = document.querySelector('#demo-activity');
  const trigger = document.querySelector('#demo-date');
  const total = document.querySelector('#demo-world-total');
  const metricMeta = document.querySelector('#demo-world-meta');
  const direction = document.querySelector('#destination-direction');
  const country = document.querySelector('#flight-country');
  const origin = document.querySelector('#flight-origin');
  const historyControls = document.querySelector('#history-controls');
  const historyCoverage = document.querySelector('#history-coverage');
  const historyKey = 'telar:historical-selection';
  let originCountry = '';
  let historyDate = '', historyPeriod = 'day';
  try {
    const saved = JSON.parse(sessionStorage.getItem(historyKey));
    if (saved && /^20(19|2[0-6])-/.test(saved.date)) {
      FlightData.dayBounds(saved.date);
      historyDate = saved.date;
      if (['day','week','month','year'].includes(saved.period)) historyPeriod = saved.period;
    }
  } catch { /* Storage may be disabled or contain older data. */ }
  const countryPlaces = document.querySelector('#country-places');
  let historicalAirports = new Set();
  const destinationAvailable = place => place.airportIds.some(id => historicalAirports.has(id));
  const layers = document.querySelector('#destination-layer');
  const restore = document.querySelector('#destination-restore');
  const context = document.querySelector('#destination-context');
  const visualization = document.querySelector('#loom-visualization');
  const figureOption = visualization.querySelector('[value="figure"]');
  const note = document.querySelector('#visualization-note');
  const airportDisclosure = document.querySelector('#destination-airports-disclosure');
  const embroideryCaption = document.querySelector('#embroidery-caption');
  const embroideryName = document.querySelector('#embroidery-name');
  const embroideryCount = document.querySelector('#embroidery-count');
  const embroideryDescription = document.querySelector('#embroidery-description');
  const compactDescription = document.querySelector('#embroidery-description-compact');
  const catalog = LoomDestinations.buildCatalog(FlightData.airports);
  const sampleMetric = document.querySelector('#loom-sample-metric');
  const sampleSeries = document.querySelector('#loom-sample-series');
  const defaultDay = FlightData.days[0];
  let state = LoomDestinations.createState(new Date().toISOString().slice(0, 10));
  const demoSource = LoomTime.demoSource(FlightData);
  let realSource = LoomProviders.unavailable(LoomTime), source = realSource, queries = LoomTime.cache(source);
  const mode = document.querySelector('#flight-mode');
  const importer = document.querySelector('#flight-import');
  const realEmpty = document.querySelector('#loom-real-empty');
  const sourceStatus = document.querySelector('#flight-source-status');
  let importSequence = 0, manualSource = false;
  let loadingLocalSource = true;
  let localSourceStatus = 'Cargando la muestra histórica local de OpenSky…';
  const isDemo = () => mode.value === 'demo';
  const periodSelect = document.querySelector('#loom-period');
  const hourA = document.querySelector('#period-hour'), hourB = document.querySelector('#comparison-hour');
  const toggleCompare = document.querySelector('#compare-toggle');
  const comparisonPanel = document.querySelector('#loom-comparison');
  const compareDay = document.querySelector('#comparison-day');
  const compareDayA = document.querySelector('#comparison-day-a');
  const compareDate = new Intl.DateTimeFormat('es-MX', {dateStyle: 'long', timeZone: 'UTC'});
  const switchPane = document.querySelector('#comparison-switch');
  const comparisonActions = document.querySelector('#comparison-actions');
  const loomActions = document.querySelector('.loom-actions');
  const panels = ['a', 'b'].map(id => document.querySelector('#comparison-' + id));
  const sceneA = document.querySelector('#loom-art-a'), stage = sceneA.closest('.loom-stage');
  const compactCompare = matchMedia('(max-width: 700px)');
  const metricLabel = document.querySelector('#demo-world-label');
  const temporalNote = document.querySelector('#temporal-note');
  const reset = document.querySelector('#loom-reset');
  let dataset, comparisonResult, periodType = 'day', comparing = false, showingB = false, visible = false;
  let secondary, sceneB, paused = false, editedA = false, editedB = false, request = 0;
  const emptyData = { ...FlightData.toLoomData(FlightData.getDemo(defaultDay, state.activity)), routes: [] };
  compareDay.value = state.day;
  const format = FlightData.countFormat;
  const fields = Object.fromEntries(['name','type','period','count','coverage','airports','origins'].map(
    name => [name, document.querySelector('#destination-' + name)]
  ));

  function flightsFor(result, scale) {
    const input = FlightData.toLoomData({ ...result, airports: source.airports ?? FlightData.airports, anchors: source.anchors ?? FlightData.anchors,
      seed: emptyData.seed, metadata: { status: result.status ?? 'demo' } });
    return scale ? { ...input, flightsPerStrand: scale } : input;
  }

  const metric = result => ['day', 'hour'].includes(result.period.type) ? result.total : result.average;
  const display = value => value === null ? '—' : format.format(Math.round(value * 100) / 100);
  function coverage(result) {
    if (result.coverage === 'missing') return 'Sin datos mundiales para este periodo';
    if (result.period.type === 'hour') return 'Cobertura horaria disponible';
    return `${result.coverage === 'partial' ? 'Cobertura parcial' : 'Cobertura completa'}: ${result.count} de ${result.slots} días con datos` +
      (result.partialDays ? ` · ${result.partialDays} día(s) con observación incompleta` : '');
  }

  const routeVolume = routes => routes.reduce((sum, route) => sum + route.flightCount, 0);

  let timelineSource, timelineMonth;
  function renderTimeline() {
    if (timelineSource === source && timelineMonth === state.day.slice(0, 7)) return;
    timelineSource = source;
    timelineMonth = state.day.slice(0, 7);
    const timeline = (source.timeline ?? []).filter(([date]) => date.slice(0, 7) === state.day.slice(0, 7));
    const peak = Math.max(1, ...timeline.map(([, count]) => count));
    sampleSeries.replaceChildren(...timeline.map(([date, count]) => {
      const bar = document.createElement('button');
      bar.type = 'button';
      bar.dataset.sampleDate = date;
      bar.title = `${date} UTC · ${display(count)} vuelos de la muestra`;
      bar.setAttribute('aria-label', bar.title);
      bar.style.setProperty('--sample-level', `${count / peak * 100}%`);
      return bar;
    }));
    sampleSeries.hidden = !timeline.length;
  }

  sampleSeries.addEventListener('click', event => {
    const day = event.target.closest('button')?.dataset.sampleDate;
    if (!day) return;
    state.day = day;
    periodType = periodSelect.value = 'day';
    calendar.setSelectedDate(day);
    changeTime();
  });

  function renderSample(result) {
    sampleMetric.hidden = false;
    sampleMetric.querySelector('[data-sample-label]').textContent = isDemo() ? 'Vuelos de demostración' : 'Vuelos observados';
    const sourceName = isDemo() ? 'Simulación' : result.provenance?.routes?.name ?? 'Sin fuente de rutas';
    const partial = result.routeSlots > 0 && result.routeSlots < result.slots;
    const sampleCoverage = partial ? ` · ${result.routeSlots} de ${result.slots} días con datos` : '';
    sampleMetric.querySelector('[data-sample-source]').textContent = sourceName + ' · ' + result.period.label + sampleCoverage;
    const airports = new Set(result.routes.flatMap(route => [route.originId, route.destinationId]));
    const registry = source.airports ?? FlightData.airports;
    const arrivals = new Set(result.routes.map(route => registry[route.destinationId].country));
    const departures = new Set(result.routes.map(route => registry[route.originId].country));
    const count = routeVolume(result.routes);
    sampleMetric.querySelector('strong').textContent = result.routeSlots ? display(count) : '—';
    sampleMetric.querySelector('[data-sample-detail]').textContent = result.routeSlots
      ? `${departures.size} países de salida · ${arrivals.size} de llegada · ${display(result.routes.length)} rutas · ${display(airports.size)} aeropuertos`
      : 'Sin rutas en la muestra para este periodo';

    const timeline = source.timeline ?? [];
    const end = Date.parse(result.period.end), start = Date.parse(result.period.start);
    let variation = '';
    if (timeline.length && result.period.type !== 'hour' && result.period.days === result.routeSlots) {
      const previousDay = new Date(start - 86400000).toISOString().slice(0, 10);
      const previous = LoomTime.interval(result.period.type, previousDay);
      const rows = timeline.filter(([day]) => day >= previous.start.slice(0, 10) && day < previous.end.slice(0, 10));
      if (rows.length === result.period.days && previous.days === result.period.days) {
        const prior = rows.reduce((sum, [, value]) => sum + value, 0);
        if (prior > 0) {
          const change = (count - prior) / prior * 100;
          variation = `${change > 0 ? '+' : ''}${display(change)} % vs. periodo anterior · muestra`;
        }
      }
    }
    sampleMetric.querySelector('[data-sample-change]').textContent = variation;
    if (source.historical) {
      const month = state.day.slice(0, 7);
      historyCoverage.textContent = result.routeSlots
        ? `OpenSky · ${result.routeSlots} de ${result.slots} días con datos${result.routeSlots < result.slots ? ' · cobertura temporal parcial' : ''}`
        : source.status(month) === 'available' ? 'Sin registros para este intervalo en el extracto local.' : source.label(month);
    }
    for (const bar of sampleSeries.children) {
      const stamp = Date.parse(bar.dataset.sampleDate);
      bar.setAttribute('aria-pressed', String(stamp >= start && stamp < end));
    }
  }

  function renderMetric(result, dailyReference) {
    total.textContent = display(metric(result));
    const kind = result.period.type;
    metricLabel.textContent = kind === 'day' ? 'Cantidad de vuelos diarios registrados'
      : kind === 'hour' ? 'Vuelos registrados durante la hora seleccionada'
        : result.coverage === 'complete' ? 'Promedio diario del periodo' : 'Promedio diario de los días disponibles';
    renderSample(result);
    const world = result.provenance?.world;
    metricMeta.textContent = result.period.label + (isDemo() ? ' · Fuente: simulación mundial'
      : world ? ` · ${world.name} · ${world.definition}` : ' · Sin fuente mundial');
    const sourceLabel = isDemo() ? 'Simulación de datos de vuelos · Total mundial independiente'
      : result.status === 'unavailable' ? 'Datos reales sin acceso configurado' : 'Importación de datos reales · Total mundial independiente';
    document.querySelector('#demo-world-note').textContent = sourceLabel;
    document.querySelector('#comparison-source-name').textContent = result.provenance?.routes?.name ?? world?.name ?? sourceLabel;
    const reference = kind === 'hour' && dailyReference?.total != null
      ? ` · Total del día: ${display(dailyReference.total)} vuelos`
      : !['day','hour'].includes(kind) && result.total !== null ? ` · Acumulado observado: ${display(result.total)} vuelos` : '';
    temporalNote.textContent = (result.expired ? 'Hay fuentes desactualizadas; importa un archivo vigente. · ' : '') + coverage(result) + reference +
      (result.routeSlots ? ` · Muestra de rutas: ${result.routeSlots} de ${result.slots} ${kind === 'hour' ? 'horas' : 'días'}` : ' · Sin registros de rutas') +
      (result.excluded ? ` · ${result.excluded} vuelos excluidos por aeropuertos incompletos o fuera del catálogo` : '') +
      (result.routeSlots && result.provenance?.routes ? ` · Rutas: ${result.provenance.routes.name}` : '') +
      (world && result.total !== null ? ` · Obtención: ${world.retrievedAt}` : '') +
      (result.status === 'unavailable' ? ' · ' + localSourceStatus : '');
  }

  function syncReset() { reset.disabled = !(editedA || (comparing && editedB)); }
  const loom = TextileLoom.mount(sceneA, [activity, trigger], document.querySelector('#loom-status'), emptyData, fiber => {
    state.fiberId = fiber?.id ?? null;
    state.routeId = fiber?.flightInfo?.routeId ?? null;
  }, {
    onEdits(has) { editedA = has; syncReset(); },
    onPause(value) { paused = value; secondary?.setPaused(value); }
  });
  reset.addEventListener('click', () => {
    loom.clearEdits(true);
    if (comparing) secondary?.clearEdits(true);
  });

  function addSecondLoom() {
    if (secondary) return;
    sceneB = sceneA.cloneNode(true);
    sceneB.id = 'loom-art-b';
    sceneB.classList.remove('needle-active');
    sceneB.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    sceneB.querySelector('.thread-info').hidden = true;
    sceneB.querySelector('.needle-cursor').hidden = true;
    sceneB.querySelector('canvas').setAttribute('aria-label', 'Telar del periodo B');
    const statusB = document.createElement('span');
    statusB.className = 'comparison-render-status';
    statusB.hidden = true;
    sceneB.append(statusB);
    stage.append(sceneB);
    secondary = TextileLoom.mount(sceneB, [], statusB, emptyData, undefined, {
      secondary: true, onEdits(has) { editedB = has; syncReset(); }
    });
    secondary.setComparison(true);
    secondary.setPaused(paused);
  }

  let aVisible, bVisible;
  function syncCanvases() {
    const compact = compactCompare.matches;
    const nextA = visible && !(comparing && compact && showingB);
    const nextB = visible && comparing && (!compact || showingB);
    if (aVisible !== nextA) { aVisible = nextA; loom.setVisible(nextA); }
    if (secondary && bVisible !== nextB) { bVisible = nextB; secondary.setVisible(nextB); }
    if (sceneB) sceneB.hidden = !comparing;
    if (comparing) sceneA.querySelector('canvas').setAttribute('aria-label', 'Telar del periodo A');
    else sceneA.querySelector('canvas').setAttribute('aria-label', 'Telar interactivo. Acerca la aguja a una hebra y arrastra para tensarla.');
    const switched = comparing && compact && showingB;
    stage.classList.toggle('compare-b', switched);
    comparisonPanel.classList.toggle('compare-b', switched);
    switchPane.textContent = switched ? 'Mostrar periodo A' : 'Mostrar periodo B';
  }
  switchPane.addEventListener('click', () => { showingB = !showingB; syncCanvases(); });
  compactCompare.addEventListener('change', syncCanvases);

  function anchorPopover(trigger, panel, alignEnd = false) {
    function position() {
      if (!panel.matches(':popover-open')) return;
      const anchor = trigger.getBoundingClientRect();
      const width = panel.offsetWidth;
      const left = Math.max(8, Math.min(alignEnd ? anchor.right - width : anchor.left, document.documentElement.clientWidth - width - 8));
      const top = anchor.bottom + 6;
      panel.style.setProperty('--panel-x', left + 'px');
      panel.style.setProperty('--panel-y', top + 'px');
    }
    panel.addEventListener('toggle', () => {
      trigger.setAttribute('aria-expanded', String(panel.matches(':popover-open')));
      position();
    });
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, { passive: true });
  }
  const placePanel = document.querySelector('#place-panel');
  anchorPopover(document.querySelector('#place-toggle'), placePanel);
  const emotionPanel = document.querySelector('#emotion-panel');
  const emotionToggle = document.querySelector('#emotion-toggle');
  const disclosure = document.querySelector('#emotion-disclosure');
  const emotionOptions = document.querySelector('#emotion-options');
  let activeEmotion = 'neutral';
  anchorPopover(emotionToggle, emotionPanel, true);
  const treatments = {
    nostalgia: ['#A38BE8', 'Lila y movimiento pausado'],
    anticipation: ['#64B9F4', 'Azul vivo y pulso de anticipación'],
    reunion: ['#F47FA6', 'Rosa cálido en los cruces'],
    joy: ['#F7BF3B', 'Luz dorada y ritmo abierto'],
    neutral: ['#DCDFFF', 'Volver al tejido original']
  };
  for (const [id, [color, description]] of Object.entries(treatments)) {
    const option = document.createElement('button');
    option.type = 'button';
    option.dataset.emotion = id;
    option.setAttribute('aria-pressed', String(id === activeEmotion));
    option.style.setProperty('--emotion-color', color);
    const name = document.createElement('strong');
    name.textContent = LoomInterpretations.get(id).label;
    const summary = document.createElement('span');
    summary.textContent = description;
    option.append(name, summary);
    emotionOptions.append(option);
  }
  function applyEmotion(id) {
    activeEmotion = id;
    const preset = LoomInterpretations.get(id);
    disclosure.hidden = id === 'neutral';
    disclosure.textContent = preset.label + ' · Interpretación artística';
    disclosure.title = preset.description ?? '';
    for (const option of emotionOptions.children) {
      option.setAttribute('aria-pressed', String(option.dataset.emotion === id));
    }
    document.querySelector('#telar').dataset.emotion = id;
    for (const label of document.querySelectorAll('.thread-emotion span')) label.textContent = preset.label;
    loom.setEmotion(id);
    secondary?.setEmotion(id);
  }
  emotionOptions.addEventListener('click', event => {
    const option = event.target.closest('button[data-emotion]');
    if (!option) return;
    applyEmotion(option.dataset.emotion);
    emotionPanel.hidePopover();
    emotionToggle.focus({ preventScroll: true });
  });

  const emptySurvey = document.querySelector('#survey-empty');
  const surveyCard = document.querySelector('#survey-card');
  const category = document.querySelector('#survey-category');
  const surveyValue = document.querySelector('#survey-value');
  let survey;
  function renderSurveyValue() {
    const entry = survey?.categories.find(item => item.id === category.value);
    surveyValue.textContent = entry ? format.format(entry.value) + (survey.units === 'percent' ? ' %' : ' personas') : '';
  }
  category.addEventListener('change', renderSurveyValue);
  function renderSurvey() {
    const start = dataset.period.start.slice(0, 10);
    const last = new Date(Date.parse(dataset.period.end) - 1).toISOString().slice(0, 10);
    const next = LoomInterpretations.compatibleSurvey(state.destinationId, start);
    const applicable = isDemo() && next === LoomInterpretations.compatibleSurvey(state.destinationId, last) ? next : undefined;
    if (applicable === survey) return;
    survey = applicable;
    emptySurvey.hidden = Boolean(survey);
    surveyCard.hidden = !survey;
    if (!survey) {
      category.replaceChildren();
      renderSurveyValue();
      return;
    }
    document.querySelector('#survey-title').textContent = survey.surveyTitle;
    document.querySelector('#survey-coverage').textContent = [
      survey.dataStatus === 'synthetic' ? 'Demostración sintética · Fuente: simulación del proyecto' : survey.sourceId,
      survey.geographicCoverage, survey.referencePeriod.label, survey.population,
      survey.sampleSize ? 'Muestra: ' + format.format(survey.sampleSize) : ''
    ].filter(Boolean).join(' · ');
    document.querySelector('#survey-method').textContent = survey.methodology + ' ' + survey.limitations;
    category.replaceChildren(...survey.categories.map(entry => new Option(entry.label, entry.id)));
    renderSurveyValue();
  }

  function updateHistoricalAirports() {
    const ids = isDemo() ? FlightData.days.flatMap(day =>
      FlightData.getDemo(day, state.activity).routes.map(route => route.destinationId)) : source.destinationIds ?? [];
    historicalAirports = new Set(ids);
  }

  function routesFromOrigin(result) {
    const registry = source.airports ?? FlightData.airports;
    return originCountry ? result.routes.filter(route => registry[route.originId]?.country === originCountry) : result.routes;
  }

  function renderCountries(place, routes) {
    if (source.historical) {
      const airports = new Set(dataset.originIds ?? []);
      const current = new Set(dataset.routes.map(route => route.originId));
      const origins = LoomDestinations.destinationCountries(catalog, airports);
      origin.replaceChildren(new Option('Todos los países', ''), ...origins.map(item => new Option(
        item.name + (item.airportIds.some(id => current.has(id)) ? '' : ' · Sin vuelos en este periodo'), item.iso
      )));
      if (originCountry && !origins.some(item => item.iso === originCountry)) {
        const item = catalog.get('country:' + originCountry);
        if (item) origin.add(new Option(item.name + ' · Sin vuelos en este periodo', originCountry));
      }
      origin.value = originCountry;
    }
    const current = new Set(routes.flatMap(route => [route.originId, route.destinationId]));
    const countries = LoomDestinations.destinationCountries(catalog, historicalAirports);
    if (place && !countries.some(item => item.iso === place.iso)) {
      const previous = catalog.get('country:' + place.iso);
      if (previous) countries.push(previous);
    }
    countries.sort((a, b) => a.name.localeCompare(b.name, 'es-MX'));
    country.replaceChildren(new Option('Todos los países', ''), ...countries.map(item => new Option(
      item.name + (item.airportIds.some(id => current.has(id)) ? '' : ' · Sin vuelos en este periodo'), item.id
    )));
    const selectedCountry = place && countries.find(item => item.iso === place.iso);
    country.value = selectedCountry?.id ?? '';
    countryPlaces.closest('label').hidden = !selectedCountry;
    if (!selectedCountry) return;
    const places = [...catalog.values()].filter(item =>
      item.type !== 'country' && item.iso === selectedCountry.iso && destinationAvailable(item));
    places.sort((a, b) => a.name.localeCompare(b.name, 'es-MX'));
    countryPlaces.replaceChildren(new Option('Elegir ciudad o aeropuerto', ''), ...places.map(item =>
      new Option(`${item.name} · ${item.icao ?? 'Ciudad'}`, item.id)
    ));
    countryPlaces.value = place.type === 'country' ? '' : place.id;
  }

  function renderDestination() {
    if (!dataset) return;
    renderSurvey();
    const destination = catalog.get(state.destinationId);
    const place = destination ?? catalog.get('country:' + originCountry);
    const eligible = routesFromOrigin(dataset);
    renderCountries(destination, eligible);
    const sense = destination ? (originCountry ? 'arrivals' : state.direction) : 'departures';
    const matches = LoomDestinations.connections(eligible, place, sense);
    context.hidden = !place;
    restore.hidden = !place;
    direction.closest('label').hidden = false;
    direction.value = destination ? sense : 'both';
    direction.disabled = !destination || Boolean(originCountry);
    Array.from(layers.options).slice(1).forEach(option => { option.disabled = !place; });
    layers.value = state.layer;
    const symbol = LoomEmbroidery.forDestination(state.destinationId);
    if (!symbol) state.visualization = 'connections';
    if (symbol && !matches.flightCount) state.visualization = 'connections';
    const showingFigure = state.visualization === 'figure' && Boolean(symbol);
    const routeIds = new Set(matches.matched.keys());
    figureOption.disabled = !symbol || !matches.flightCount;
    visualization.value = state.visualization;
    note.hidden = Boolean(symbol && matches.flightCount);
    note.textContent = !destination ? 'Selecciona un país para descubrir su figura bordada.'
      : !symbol ? 'Este destino todavía no cuenta con una figura bordada.'
        : !matches.flightCount ? 'La figura requiere vuelos observados para esta selección.' : 'Figura bordada disponible: ' + symbol.name + '.';
    embroideryCaption.hidden = !showingFigure;
    compactDescription.hidden = !showingFigure;
    if (showingFigure) {
      embroideryName.textContent = symbol.name;
      embroideryDescription.textContent = compactDescription.textContent = symbol.description;
      embroideryCount.textContent = matches.flightCount
        ? `${format.format(matches.flightCount)} ${isDemo() ? 'vuelos de demostración' : 'vuelos de la muestra'} del destino`
        : 'No hay conexiones para bordar en el periodo y sentido seleccionados.';
    }
    loom.setFigure(showingFigure ? symbol : null, routeIds);
    loom.setLayer(state.layer, routeIds);
    if (comparing) renderComparisonPanel(panels[0], dataset, place ? matches : null);
    if (comparing && comparisonResult) {
      const other = LoomDestinations.connections(routesFromOrigin(comparisonResult), place, sense);
      const otherIds = new Set(other.matched.keys());
      secondary.setFigure(showingFigure ? symbol : null, otherIds);
      secondary.setLayer(state.layer, otherIds);
      renderComparisonPanel(panels[1], comparisonResult, place ? other : null);
      if (source.historical && dataset.routeSlots === dataset.slots &&
          comparisonResult.routeSlots === comparisonResult.slots && dataset.slots === comparisonResult.slots) {
        document.querySelector('#comparison-difference').textContent =
          'Misma serie OpenSky y duración comparable · ' + sampleDifference(dataset, comparisonResult);
      }
    }
    if (!place) return;

    const airportLabel = id => {
      const airport = (source.airports ?? FlightData.airports)[id];
      return airport ? `${airport.city} (${airport.code || id})` : id;
    };
    fields.name.textContent = place.name;
    fields.type.textContent = [LoomDestinations.typeNames[place.type], place.city, place.country,
      place.iata ? `${place.iata} / ${place.icao}` : null
    ].filter(Boolean).join(' · ');
    fields.period.textContent = dataset.period.label + (originCountry ? ' · Origen: ' + (catalog.get('country:' + originCountry)?.name ?? originCountry) : '');
    const flightsLabel = matches.flightCount === 1 ? 'vuelo' : 'vuelos';
    const airportCount = matches.recordedAirports.size;
    const airportsLabel = airportCount === 1 ? 'aeropuerto' : 'aeropuertos';
    const routesLabel = matches.matched.size === 1 ? 'ruta' : 'rutas';
    fields.count.textContent = matches.matched.size
      ? `${format.format(matches.flightCount)} ${flightsLabel} · ${format.format(matches.matched.size)} ${routesLabel} · ${format.format(airportCount)} ${airportsLabel}`
      : 'No hay conexiones para este destino en el periodo seleccionado.';
    fields.coverage.textContent = `${isDemo() ? 'Datos de demostración' : dataset.provenance?.routes?.name ?? 'Sin fuente de rutas'} · Muestra de rutas: ${dataset.routeSlots} de ${dataset.slots} ${periodType === 'hour' ? 'horas' : 'días'}`;
    airportDisclosure.hidden = !airportCount;
    if (!airportCount) airportDisclosure.open = false;
    fields.airports.replaceChildren(...[...matches.recordedAirports].map(airportLabel)
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map(label => {
        const airport = document.createElement('li');
        airport.textContent = label;
        return airport;
      }));
    fields.origins.hidden = !matches.origins.length;
    fields.origins.textContent = 'Principales orígenes: ' + matches.origins.slice(0, 3).map(([id, count]) =>
      `${airportLabel(id)} · ${format.format(count)}`
    ).join('; ');
  }

  function renderComparisonPanel(panel, result, matches = null, status = 'Elige una fecha válida') {
    const field = name => panel.querySelector(`[data-period-${name}]`);
    const type = result?.period.type;
    field('date').textContent = result?.period.label ?? status;
    field('value').textContent = result ? display(result.routeSlots ? (matches?.flightCount ?? routeVolume(result.routes)) : metric(result)) : '—';
    field('unit').textContent = !result ? '' : result.routeSlots ? 'vuelos observados · ' + (catalog.get(state.destinationId)?.name ?? catalog.get('country:' + originCountry)?.name ?? 'Todos los países') : type === 'hour' ? 'vuelos en la hora'
      : type === 'day' ? 'vuelos en el día' : result.coverage === 'partial' ? 'vuelos por día disponible' : 'vuelos por día';
    field('coverage').textContent = result ? coverage(result) : '';
    field('destination').hidden = !matches && !result?.routeSlots;
    if (matches) field('destination').textContent =
      `${result.routeSlots ? display(matches.flightCount) : '—'} vuelos de la selección en la muestra`;
    else if (result?.routeSlots) field('destination').textContent = `${display(routeVolume(result.routes))} vuelos de la muestra`;
  }

  function sampleDifference(a, b) {
    const place = catalog.get(state.destinationId);
    const direction = originCountry ? 'arrivals' : state.direction;
    const count = result => {
      const eligible = routesFromOrigin(result);
      return place ? LoomDestinations.connections(eligible, place, direction).flightCount : routeVolume(eligible);
    };
    const prior = count(a);
    const delta = count(b) - prior;
    const signed = value => (value > 0 ? '+' : '') + display(value);
    return signed(delta) + ' vuelos (B − A)' + (prior ? ' · ' + signed(delta / prior * 100) + ' %' : '') + '.';
  }

  function updateHours() {
    const available = source.hours(state.day);
    const option = periodSelect.querySelector('[value="hour"]');
    option.hidden = !available.length;
    option.disabled = !available.length && periodType !== 'hour';
    option.textContent = available.length ? 'Hora' : 'Hora · Sin datos';
    for (const [select, hours] of [[hourA, available], [hourB, source.hours(compareDay.value)]]) {
      const value = select.value;
      select.replaceChildren(...hours.map(hour => new Option(String(hour).padStart(2, '0') + ':00', hour)));
      if (hours.includes(Number(value)) && value !== '') select.value = value;
      select.closest('label').hidden = periodType !== 'hour';
      select.disabled = !hours.length;
    }
  }

  async function reloadData() {
    const token = ++request;
    const showBoth = comparing;
    const difference = document.querySelector('#comparison-difference');
    const scaleNote = document.querySelector('#comparison-scale');
    stage.setAttribute('aria-busy', 'true');
    temporalNote.textContent = 'Consultando el periodo…';
    if (showBoth) {
      for (const panel of panels) renderComparisonPanel(panel, null, null, 'Consultando…');
      difference.textContent = scaleNote.textContent = '';
    }
    try {
      if (source.expired) { queries.invalidate(); calendar.setAvailableDates(source.dates); updateHistoricalAirports(); }
      realEmpty.hidden = isDemo() || source.dates.length > 0 || loadingLocalSource;
      updateHours();
      compareDayA.value = state.day;
      const periodA = LoomTime.interval(periodType, state.day, Number(hourA.value));
      const periodB = showBoth && compareDay.value && source.dates.includes(compareDay.value)
        ? LoomTime.interval(periodType, compareDay.value, Number(hourB.value)) : null;
      const [a, b, daily] = await Promise.all([
        queries.read(periodA, state.activity), periodB && queries.read(periodB, state.activity),
        periodType === 'hour' && queries.read(LoomTime.interval('day', state.day), state.activity)
      ]);
      if (token !== request) return;
      dataset = a;
      comparisonResult = b;
      if (source.historical) {
        historicalAirports = new Set([...a.destinationIds, ...a.originIds]);
        const activeCatalog = LoomDestinations.buildCatalog(source.airports);
        catalog.clear();
        for (const [id, place] of activeCatalog) catalog.set(id, place);
        search.close();
        historyDate = state.day;
        historyPeriod = periodType;
        try { sessionStorage.setItem(historyKey, JSON.stringify({ date: historyDate, period: historyPeriod })); }
        catch { /* Storage can be disabled. */ }
        renderTimeline();
      }
      renderMetric(a, daily);
      if (source.historical) describeSources();
      const scale = b ? LoomTime.sharedScale(a, b) : null;
      loom.setData(flightsFor(a, scale));
      if (showBoth) {
        secondary.setData(b ? flightsFor(b, scale) : emptyData);
        renderComparisonPanel(panels[1], b);
        const delta = !a.partialDays && !b?.partialDays ? LoomTime.compare(a, b) : null;
        const basis = periodType === 'hour' ? 'por hora' : 'por día con datos';
        difference.textContent = delta
          ? `B − A: ${delta.difference > 0 ? '+' : ''}${display(delta.difference)} vuelos ${basis}${delta.percent === null ? '' : ` (${delta.percent > 0 ? '+' : ''}${display(delta.percent)} %)`}. `
          : source.historical && a.routeSlots && b?.routeSlots
            ? (a.routeSlots === a.slots && b.routeSlots === b.slots && a.slots === b.slots
              ? 'Misma serie OpenSky y duración comparable · diferencia de la muestra: ' +
                sampleDifference(a, b)
              : 'Misma serie OpenSky · cobertura o duración diferente; sin diferencia directa.')
            : 'Diferencia no disponible con esta cobertura. ';
        scaleNote.textContent = scale ? ` · Trama acumulada: ≈ ${scale} vuelos de la muestra por hebra` : '';
      }
      renderDestination();
    } catch (error) {
      if (token !== request) return;
      total.textContent = '—';
      temporalNote.textContent = 'No se pudo consultar el periodo. Elige otra fecha para reintentar.';
      if (showBoth) {
        for (const panel of panels) renderComparisonPanel(panel, null, null, 'Periodo no disponible');
        difference.textContent = scaleNote.textContent = '';
        secondary.setData(emptyData);
      }
      loom.setData(emptyData);
      console.warn('Consulta temporal:', error);
    } finally {
      if (token === request) stage.removeAttribute('aria-busy');
    }
  }

  function changeTime() {
    loom.clearEdits();
    secondary?.clearEdits();
    reloadData();
  }
  function setComparison(value) {
    comparing = value;
    showingB = false;
    comparisonPanel.hidden = !value;
    stage.classList.toggle('is-comparing', value);
    if (value) comparisonActions.append(loomActions, context);
    else {
      stage.prepend(loomActions);
      stage.querySelector('.loom-metric').insertBefore(context, disclosure);
    }
    toggleCompare.setAttribute('aria-pressed', String(value));
    toggleCompare.textContent = value ? 'Salir de comparación' : 'Comparar';
    if (value) {
      compareDayA.value = state.day;
      addSecondLoom();
      secondary.setEmotion(activeEmotion);
    } else secondary?.clearEdits();
    loom.setComparison(value);
    syncReset();
    syncCanvases();
    reloadData();
  }
  toggleCompare.addEventListener('click', () => setComparison(!comparing));
  periodSelect.addEventListener('change', () => { periodType = periodSelect.value; changeTime(); });
  compareDayA.addEventListener('change', () => { state.day = compareDayA.value; calendar.setSelectedDate(state.day); changeTime(); });
  for (const control of [hourA, hourB, compareDay]) control.addEventListener('change', changeTime);

  function choose(place, sense = 'arrivals') {
    const id = place?.id ?? null;
    if (id !== state.destinationId) { loom.clearEdits(); secondary?.clearEdits(); }
    state.destinationId = id;
    state.direction = sense;
    state.layer = place ? 'highlight' : 'all';
    context.open = false;
    airportDisclosure.open = false;
    renderDestination();
  }

  const search = LoomDestinations.mountSearch(document.querySelector('#destination-search'), catalog, choose,
    place => isDemo() || destinationAvailable(place));
  country.addEventListener('change', () => {
    const place = catalog.get(country.value);
    search.setValue(place);
    choose(place);
  });
  countryPlaces.addEventListener('change', () => {
    const place = catalog.get(countryPlaces.value || country.value);
    search.setValue(place);
    choose(place, state.direction);
    context.open = true;
    countryPlaces.focus({ preventScroll: true });
  });
  visualization.addEventListener('change', () => {
    if (state.visualization !== visualization.value) { loom.clearEdits(); secondary?.clearEdits(); }
    state.visualization = visualization.value;
    renderDestination();
  });
  layers.addEventListener('change', () => { state.layer = layers.value; renderDestination(); });
  direction.addEventListener('change', () => {
    state.direction = direction.value;
    renderDestination();
  });
  restore.addEventListener('click', () => {
    originCountry = '';
    search.setValue(null);
    choose(null);
    document.querySelector('#destination-input').focus({ preventScroll: true });
  });
  activity.addEventListener('change', () => { state.activity = activity.value; updateHistoricalAirports(); reloadData(); });
  const calendar = LoomCalendar.mount(trigger, document.querySelector('#demo-calendar'), {
    dates: source.dates,
    initialDate: state.day,
    onSelect(date) {
      state.day = date;
      changeTime();
    }
  });
  function restartExperience() {
    historyDate = '';
    historyPeriod = 'day';
    state = LoomDestinations.createState(realSource.dates[0] ?? defaultDay);
    originCountry = '';
    periodType = periodSelect.value = 'day';
    if (comparing) setComparison(false);
    activity.value = state.activity;
    search.setValue(null);
    context.open = false;
    closeLoomFilters();
    const emotions = document.querySelector('#emotion-panel');
    if (emotions.matches(':popover-open')) emotions.hidePopover();
    applyEmotion('neutral');
    loom.clearEdits();
    secondary?.clearEdits();
    loom.restart();
    secondary?.restart();
    mode.value = 'real';
    selectSource();
  }
  function describeSources() {
    const provenance = document.querySelector('#flight-provenance');
    const entries = isDemo() ? [] : [source.historical ? dataset?.provenance?.routes : realSource.world,
      source.historical ? null : realSource.routes].filter(Boolean);
    provenance.replaceChildren(...entries.map(entry => {
      const paragraph = document.createElement('p');
      const link = document.createElement('a');
      link.href = entry.url;
      link.textContent = entry.name;
      paragraph.append(link, ` · ${entry.definition} · Cobertura: ${entry.coverage} · Obtención: ${entry.retrievedAt} · Referencia de autorización: ${entry.authorization}`);
      return paragraph;
    }));
    for (const file of source.historical ? dataset?.sourceFiles ?? [] : []) {
      const note = document.createElement('p');
      note.textContent = `${file.original} · MD5 ${file.md5}`;
      provenance.append(note);
    }
    sourceStatus.textContent = isDemo() ? 'Simulación de datos de vuelos.'
      : !entries.length ? source.historical ? historyCoverage.textContent : localSourceStatus
        : realSource.expired ? 'Una serie excede la vigencia admitida y queda excluida.'
          : manualSource ? 'Archivo local validado. La procedencia y el permiso son los declarados en el archivo.'
            : 'Muestra histórica local de OpenSky validada y cargada automáticamente.';
  }
  function selectSource() {
    source = isDemo() ? demoSource : realSource;
    queries = LoomTime.cache(source, source.historical ? 4 : 12);
    updateHistoricalAirports();
    const place = catalog.get(state.destinationId);
    originCountry = '';
    if (!source.historical && !isDemo() && place && !destinationAvailable(place)) {
      search.setValue(null);
      state.destinationId = null;
      state.layer = 'all';
      context.open = false;
    }
    activity.closest('.loom-demo-controls').hidden = !isDemo();
    document.querySelector('#demo-date-label').textContent = isDemo() ? 'Fecha de demostración (UTC)' : 'Fecha de consulta (UTC)';
    state.day = source.historical && source.dates.includes(historyDate)
      ? historyDate : source.dates[0] ?? state.day;
    historyControls.hidden = !source.historical;
    if (source.historical) periodType = periodSelect.value = historyPeriod;
    for (const select of [compareDayA, compareDay]) {
      select.replaceChildren(...source.dates.map(day => new Option(compareDate.format(new Date(day + 'T00:00:00Z')), day)));
    }
    compareDayA.value = state.day;
    compareDay.value = source.dates.find(day => day !== state.day) ?? state.day;
    calendar.setAvailableDates(source.dates);
    calendar.setSelectedDate(state.day);
    describeSources();
    const activeCatalog = LoomDestinations.buildCatalog(source.airports ?? FlightData.airports);
    catalog.clear();
    for (const [id, place] of activeCatalog) catalog.set(id, place);
    search.close();
    renderTimeline();
    changeTime();
  }
  origin.addEventListener('change', () => {
    originCountry = origin.value;
    loom.clearEdits();
    secondary?.clearEdits();
    if (originCountry) state.layer = 'highlight';
    else if (!state.destinationId) state.layer = 'all';
    renderDestination();
  });

  mode.addEventListener('change', selectSource);
  document.querySelector('#loom-show-demo').addEventListener('click', () => {
    mode.value = 'demo';
    periodType = periodSelect.value = 'day';
    selectSource();
    trigger.focus({ preventScroll: true });
  });
  importer.addEventListener('change', async () => {
    const sequence = ++importSequence;
    const file = importer.files[0];
    if (!file) return;
    sourceStatus.textContent = 'Validando el archivo…';
    try {
      if (file.size > 16 * 1024 * 1024) throw Error('El archivo supera 16 MB. Importa un intervalo más corto.');
      const next = LoomProviders.imported(JSON.parse(await file.text()), FlightData, LoomTime);
      if (sequence !== importSequence) return;
      realSource = next;
      manualSource = true;
      loadingLocalSource = false;
      mode.value = 'real';
      selectSource();
    } catch (error) {
      if (sequence === importSequence) sourceStatus.textContent = 'Archivo rechazado: ' + error.message;
    } finally {
      if (sequence === importSequence) importer.value = '';
    }
  });
  async function loadBundledRoutes() {
    try {
      async function json(path, cache = 'default') {
        const response = await fetch('data/' + path, { cache, redirect: 'error', signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw Error('Recurso local no disponible');
        return response.json();
      }
      const manifest = await json('history.json', 'no-cache');
      const next = LoomHistory.create(manifest,
        async file => LoomProviders.imported(await json(file), FlightData, LoomTime), FlightData, LoomTime);
      if (manualSource) return;
      realSource = next;
    } catch {
      if (manualSource) return;
      localSourceStatus = 'La muestra histórica local no está disponible. Puedes importar un archivo desde Ajustes → Fuentes.';
    }
    loadingLocalSource = false;
    if (!isDemo()) selectSource();
  }
  selectSource();
  loadBundledRoutes();
  return {
    restartExperience,
    setVisible(value) {
      visible = value;
      if (!visible) {
        search.close();
        closeLoomFilters();
        const emotions = document.querySelector('#emotion-panel');
        if (emotions.matches(':popover-open')) emotions.hidePopover();
        if (placePanel.matches(':popover-open')) placePanel.hidePopover();
        const calendar = document.querySelector('#demo-calendar');
        if (calendar.matches(':popover-open')) calendar.hidePopover();
      }
      syncCanvases();
    }
  };
}

initNavigation(initDemoFlights());
