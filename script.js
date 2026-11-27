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
  const draw = createTextile(host, '0 0 1440 800', 'none');
  const svg = host.firstElementChild;
  svg.insertAdjacentHTML('afterbegin', `<defs>
    <filter id="intro-soft"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="intro-amber"><feGaussianBlur stdDeviation="4"/></filter>
    <radialGradient id="intro-contact">
      <stop stop-color="#ffca68" stop-opacity=".47"/><stop offset=".32" stop-color="#ff9e38" stop-opacity=".21"/>
      <stop offset="1" stop-color="#ff9e38" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="intro-steel" x2="0" y2="1">
      <stop stop-color="#676c86"/><stop offset=".19" stop-color="#c7c9d6"/>
      <stop offset=".38" stop-color="#fff7e9"/><stop offset=".56" stop-color="#a5b0c6"/>
      <stop offset=".78" stop-color="#58536b"/><stop offset=".91" stop-color="#bb8468"/>
      <stop offset="1" stop-color="#312945"/>
    </linearGradient>
  </defs>`);
  const palette = ['#9f94db', '#648fda', '#f27cb6', '#b38df0', '#cdd9f7'];
  const polyline = points => points.map(([x,y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  for (let i = 0; i < 32; i++) {
    const x = i < 16 ? 12 + i * 19 : 1102 + (i - 16) * 23;
    const color = palette[(i * 3 + Math.floor(i / 5)) % palette.length];
    const thickness = 1.8 + (i % 6) * .76;
    const points = Array.from({length: 104}, (_, j) => {
      const t = j / 103;
      return [x + (18 + (i % 9) * 4) * Math.sin(t * 3.8 + i * 2.4) + 12 * t * Math.cos(i), -25 + 850 * t];
    });
    draw(polyline(points), color, .25 + (i % 4) * .11, thickness);
    for (let ply = 0; ply < 3; ply++) {
      draw(polyline(points.map(([px,y], j) =>
        [px + Math.sin(j * .83 + ply * 2.094) * thickness * .43, y])), color, .36, .64);
    }
    if (i % 4 === 0) {
      draw(polyline(points.map(([px,y], j) => [px + Math.sin(j * 1.8) * thickness * .56, y])), '#e8ddff', .33, .65);
    }
  }

  const eye = 1260;
  const knots = [[-30,695,-.66],[325,620,.01],[755,678,.07],[1060,655,-.53],[eye,492,-.68],[1301,486,.43],[1470,565,.03]];
  const samples = knots.slice(0,-1).flatMap(([x,y,slope], i) => {
    const [endX,endY,endSlope] = knots[i+1];
    const length = endX - x;
    return Array.from({length: Math.ceil(length / 2.8) + 1}, (_, j) => {
      const t = Math.min(1,j * 2.8 / length);
      const a = t*t*(3-2*t);
      return [x + length*t, y * (1-a) + endY * a + length*t*(1-t)*(slope*(1-t)-endSlope*t)];
    });
  });
  const yarn = [];
  function strand(color, opacity, width, twist = 0, phase = 0, bloom = false) {
    draw('', color, opacity, width);
    const node = svg.lastElementChild;
    if (bloom) node.setAttribute('filter','url(#intro-amber)');
    yarn.push({node, twist, phase});
  }
  strand('#FF9E33', .44, 12, 0, 0, true);
  strand('#95601e', .95, 6.2);
  strand('#F7BF3B', .95, 4.15);
  strand('#FFB443', .9, 1.55, 2.15);
  strand('#FFE5A0', .94, 1.35, 1.85, 2.1);
  strand('#fff2c8', .85, .82, 1.5, 4.2);
  strand('#FFE5A0', .77, .62, 2.82, .7);

  draw('', '#f4a445', .34, .62);
  const fluff = svg.lastElementChild;
  svg.insertAdjacentHTML('beforeend', `<g class="intro-needle-art">
    <ellipse cx="1260" cy="492" rx="71" ry="77" fill="url(#intro-contact)"/>
    <path d="M1060 646 Q1120 606 1259 492" stroke="#f9ae48" stroke-width="14" opacity=".17" filter="url(#intro-amber)" fill="none"/>
    <g transform="translate(1060 646) rotate(-38)">
      <path d="M0 0 Q36-3 66-6 L241-7 Q260-7 261 0 Q260 8 241 8 L66 6 Q36 3 0 0Z
        M225 0 Q241-5 254-2 Q259 0 254 3 Q241 6 225 0Z" fill="url(#intro-steel)" fill-rule="evenodd"/>
      <path d="M15-.45 Q71-2.8 220-5 M226-1 Q243-5 254-2" fill="none" stroke="#fff7e9" opacity=".77" stroke-width="1"/>
    </g>
  </g>`);
  const needle = svg.lastElementChild;
  const eyeThread = document.createElementNS(svgNamespace,'path');
  eyeThread.setAttribute('d','M1251 496 Q1258 491 1266 489');
  eyeThread.setAttribute('fill','none');
  eyeThread.setAttribute('stroke','#FFE5A0');
  eyeThread.setAttribute('stroke-linecap','round');
  eyeThread.setAttribute('stroke-width','2.5');
  needle.append(eyeThread);

  for (const [path,color,width] of [
    ['M-45 800 C20 630 48 320 140 -35','#aa8feb',9],
    ['M-58 738 C88 753 205 824 370 843','#8d75d6',12],
    ['M1030 834 C1200 771 1319 714 1475 654','#c6b8f1',10],
    ['M1110 831 C1260 751 1358 776 1475 806','#d76bb3',8]
  ]) {
    draw(path,color,.51,width);
    svg.lastElementChild.setAttribute('filter','url(#intro-soft)');
  }

  function drawPull(pixels) {
    const pull = pixels * 800 / Math.max(1,host.clientHeight);
    const deform = (x,y) => y + pull * Math.exp(-(((x-eye)/185)**2));
    for (const {node,twist,phase} of yarn) {
      node.setAttribute('d',polyline(samples.map(([x,y]) =>
        [x,deform(x,y) + Math.sin(x * .59 + phase) * twist + .25 * Math.sin(x * 1.1)])));
    }
    fluff.setAttribute('d',samples.filter((_,i) => i % 3 === 0).map(([x,y],i) => {
      const side = i % 2 ? 1 : -1;
      const base = deform(x,y);
      const tip = (4 + 3 * Math.sin(i * 7.4)) * side;
      return `M${x.toFixed(1)} ${base.toFixed(1)} q2 ${tip.toFixed(1)} 5 ${(tip * .85).toFixed(1)}`;
    }).join(' '));
    needle.setAttribute('transform', `translate(0 ${pull})`);
  }
  drawPull(0);
  let frame = 0;
  let displacement = 0;
  host.addEventListener('intro-pull', event => {
    displacement = event.detail;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      drawPull(displacement);
    });
  });
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
  const draw = createTextile(host, '0 0 1440 800', 'none');
  const svg = host.firstElementChild;
  const defs = document.createElementNS(svgNamespace, 'defs');
  svg.prepend(defs);
  const palette = ['#F47FA6', '#E94399', '#A38BE8', '#DCDFFF', '#64B9F4', '#A9C1FD', '#F7BF3B', '#FF9138'];
  const tau = Math.PI * 2;
  const path = points => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const samples = (length, make) => Array.from({ length }, (_, i) => make(i / (length - 1)));
  function panel(hue, id, outline, dense) {
    const gradient = document.createElementNS(svgNamespace, 'linearGradient');
    gradient.id = `closing-yarn-${id}`;
    gradient.setAttribute('x2', '.65');
    gradient.setAttribute('y2', '1');
    for (const [offset, color, opacity] of [[0, hue, .24], [.29, hue, .73], [.49, '#20112e', .48],
      [.65, hue, .82], [.84, hue, .36], [1, hue, .06]]) {
      const stop = document.createElementNS(svgNamespace, 'stop');
      stop.setAttribute('offset', offset);
      stop.setAttribute('stop-color', color);
      stop.setAttribute('stop-opacity', opacity);
      gradient.append(stop);
    }
    defs.append(gradient);
    draw(outline, hue, .18, 2);
    const face = svg.lastElementChild;
    face.setAttribute('fill', `url(#${gradient.id})`);
    face.setAttribute('fill-opacity', dense ? '.94' : '.39');
  }

  for (let i = 0; i < 87; i++) {
    const x = i * 6.4 + 4 * Math.sin(i * 2.4);
    const drift = 7 * Math.sin(i * .89);
    const end = 450 + 410 * Math.sin(i * .48) ** 2;
    const hue = palette[i % palette.length];
    draw(`M${x} -15 C${x + drift} 180 ${x - drift} 400 ${x + drift * .8} ${end}`, hue, .23 + .26 * Math.sin(i * 2.1) ** 2, .65 + i % 5 * .16);
  }

  // Centerlines have independent Bézier trajectories and asymmetric envelopes.
  const drapes = [
    [[77,-35, 185,40, 91,385, 236,805], 77, 1, true],
    [[276,-20, 185,95, 389,379, 264,710], 56, 6, true],
    [[385,12, 284,190, 465,265, 405,524], 67, 3, true],
    [[-95,96, 236,29, 133,270, 620,315], 72, 2, false],
    [[-80,400, 102,156, 178,280, 397,730], 94, 4, false],
    [[77,90, 385,98, 194,394, 630,451], 84, 0, true],
    [[-88,578, 315,380, 297,501, 548,666], 90, 7, false],
    [[-70,385, 111,304, 122,682, 349,826], 89, 2, true],
    [[160,253, 278,570, 502,433, 647,756], 78, 2, false],
    [[-60,558, 222,648, 86,370, 367,668], 91, 1, true],
    [[-70,200, 98,361, 317,541, 688,688], 84, 5, false],
    [[102,594, 403,816, 331,614, 673,803], 83, 7, false],
    [[-38,66, 129,23, 119,305, 360,243], 67, 3, false],
    [[290,378, 372,352, 451,491, 584,455], 53, 0, true]
  ];
  const bezier = (a,b,c,d,t) => a*(1-t)**3 + 3*b*t*(1-t)**2 + 3*c*t*t*(1-t) + d*t**3;
  for (const [index, [p, width, hueIndex, dense]] of drapes.entries()) {
    const hue = palette[hueIndex];
    const phase = index * 1.37;
    const center = t => [
      bezier(p[0],p[2],p[4],p[6],t) + 13 * Math.sin(t * 16 + phase) * Math.sin(t * Math.PI),
      bezier(p[1],p[3],p[5],p[7],t) + 24 * Math.sin(t * 14 + phase) * Math.sin(t * Math.PI)
    ];
    const point = (t, u) => {
      const [x,y] = center(t);
      const [xx,yy] = center(t + .001);
      const length = Math.hypot(xx-x, yy-y) || 1;
      const roll = Math.cos(phase + t * (3.5 + index % 4));
      const hem = 1 + .086 * Math.sin(t * 89 + phase + u * 4) + .06 * Math.cos(t * 173 + u * 7);
      const gather = 1 - .45 * Math.exp(-(((t - .54) / .095) ** 2));
      const spread = width * (.48 + .50 * Math.sin(t * Math.PI)) * (1 - .95 * t ** 6) * gather * hem;
      const dome = (1 - u*u) * spread * .37 * Math.sin(t * 12 + phase);
      return [x + (yy-y)/length * u * spread * roll + dome * .58,
        y - (xx-x)/length * u * spread * roll + dome];
    };
    const outline = path(samples(99, t => point(t,-1)).concat(samples(99, t => point(1-t,1)))) + 'Z';
    panel(hue, index, outline, dense);
    const filaments = dense ? 42 : 24 + index % 4 * 3;
    for (let j = 0; j < filaments; j++) {
      const u = 2*j/(filaments-1) - 1;
      const strand = path(samples(104, t => point(t, u + .019 * Math.sin(t * 104 + j * 1.6))));
      draw(strand, j % 5 === 0 ? '#fff1f6' : hue, j % 5 === 0 ? .63 : .63 + .28 * Math.sin(j) ** 2, j % 5 === 0 ? .66 : 1);
    }
    for (let j = 1; j < 77; j++) {
      const t = (j + .29 * Math.sin(j * 1.4)) / 77;
      draw(path(samples(23, u => point(t + .003 * Math.cos(u * 27 + j * .39), 2*u-1))),
        j % 8 ? hue : '#fff4dd', dense ? .53 : .76, j % 8 ? .82 : .59);
    }
  }

  for (const [cx,cy,hue,size] of [[90,568,palette[0],49],[340,396,palette[2],50],[9,359,palette[2],47],[241,583,palette[7],33]]) {
    for (let loop = 0; loop < 28; loop++) {
      const angle = loop * 2.39996;
      const span = size * (.5 + .46 * Math.sin(loop * 1.86) ** 2);
      const curl = path(samples(46,t => {
        const radius = span * Math.sin(Math.PI * t);
        const twist = angle + .78 * Math.sin(t * tau);
        return [cx + Math.cos(twist) * radius, cy + Math.sin(twist) * radius * 1.21];
      }));
      draw(curl,'#241337', .68, 4.5);
      draw(curl,hue,.89, 2.9);
      draw(curl,'#fff2eb',.56,.69);
    }
  }
  for (let i = 0; i < 14; i++) {
    const x = 160 + i * 12;
    const y = 698 + 47 * Math.sin(i * .57);
    const end = i < 5 ? 1380 - i * 42 : 690 + (i - 5) * 36;
    const ribbon = path(samples(106, t => [
      x + (end - x) * t,
      y * (1 - t) + (731 + 18 * Math.sin(i * .36)) * t
        + Math.sin(t * 17 + i * .27) * (15 + 13 * Math.sin(t * Math.PI)) * Math.sin(t * Math.PI)
    ]));
    draw(ribbon, palette[i % palette.length], i < 5 ? .73 : .40, i < 5 ? 1.45 : .75);
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
  const art = screen.querySelector('.intro-art');
  const setPull = distance => {
    thread.style.setProperty('--pull', distance + 'px');
    art.dispatchEvent(new CustomEvent('intro-pull', { detail: distance }));
  };
  let drag;
  thread.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    drag = { id: event.pointerId, y: event.clientY };
    thread.setPointerCapture(event.pointerId);
  });
  thread.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const distance = Math.max(-82, Math.min(82, event.clientY - drag.y));
    setPull(distance);
  });
  thread.addEventListener('pointerup', event => {
    if (drag?.id === event.pointerId) begin.click();
  });
  thread.addEventListener('lostpointercapture', () => {
    drag = null;
    if (!transition) setPull(0);
  });
  thread.addEventListener('click', event => {
    if (event.detail === 0) begin.click();
  });

  return function resetIntro() {
    transition?.cancel();
    transition = undefined;
    screen.classList.remove('intro-leaving');
    setPull(0);
  };
}

function initNavigation(loom) {
  const screens = new Map(Array.from(document.querySelectorAll('main > .screen'), (screen) => [screen.id, screen]));
  const navLinks = document.querySelectorAll('nav a');
  const resetIntro = initIntro(screens.get('inicio'), loom.beginExperience);
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
    loom.setScreen(next);
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
  const visualization = document.querySelector('#loom-visualization');
  const figureOption = visualization.querySelector('[value="figure"]');
  const note = document.querySelector('#visualization-note');
  const infoBody = document.querySelector('.loom-info-body');
  const infoMotion = matchMedia('(prefers-reduced-motion: reduce)');
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
  const fields = Object.fromEntries(['name','type','period','count','stats','coverage','airports','origins'].map(
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
    const sampleLabel = sampleMetric.querySelector('[data-sample-label]');
    sampleLabel.textContent = isDemo() ? 'Vuelos de demostración'
      : result.routeSource === 'adsblol:routes' ? 'Trayectos reconstruidos · muestra'
      : 'Vuelos observados · muestra total';
    const sourceName = isDemo() ? 'Simulación' : result.provenance?.routes?.name ?? 'Sin fuente de rutas';
    const partial = result.routeSlots > 0 && result.routeSlots < result.slots;
    const sampleCoverage = partial ? ` · ${result.routeSlots} de ${result.slots} días con datos` : '';
    sampleMetric.querySelector('[data-sample-source]').textContent = sourceName + ' · ' + result.period.label + sampleCoverage;
    const airports = new Set(result.routes.flatMap(route => [route.originId, route.destinationId]));
    const registry = source.airports ?? FlightData.airports;
    const arrivals = new Set(result.routes.map(route => registry[route.destinationId].country));
    const departures = new Set(result.routes.map(route => registry[route.originId].country));
    const count = routeVolume(result.routes);
    const sampleCount = sampleMetric.querySelector('strong');
    sampleCount.textContent = result.routeSlots ? display(count) : '—';
    sampleCount.toggleAttribute('data-long-count', sampleCount.textContent.length > 8);
    emotionFacts.textContent = result.routeSlots
      ? `${sampleCount.textContent} ${isDemo() ? 'vuelos simulados' : 'vuelos observados'} · ${display(result.routes.length)} rutas disponibles en el periodo.`
      : 'Sin rutas disponibles para este periodo.';
    sampleMetric.querySelector('[data-sample-detail]').textContent = result.routeSlots
      ? `${departures.size} países de salida · ${arrivals.size} de llegada · ${display(result.routes.length)} rutas · ${display(airports.size)} aeropuertos`
      : 'Sin rutas en la muestra para este periodo';

    const timeline = source.timeline ?? [];
    const end = Date.parse(result.period.end), start = Date.parse(result.period.start);
    let variation = '';
    if (timeline.length && result.period.type !== 'hour' && result.period.days === result.routeSlots) {
      const previousDay = new Date(start - 86400000).toISOString().slice(0, 10);
      const previous = LoomTime.interval(result.period.type, previousDay);
      const rows = timeline.filter(([day]) => day >= previous.start.slice(0, 10) && day < previous.end.slice(0, 10)
        && (!source.providerAt || source.providerAt(day) === source.providerAt(result.period.anchorDay ?? result.period.start)));
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
        ? `${result.provenance?.routes?.name ?? 'Muestra histórica'} · ${result.routeSlots} de ${result.slots} días con datos${result.routeSlots < result.slots ? ' · cobertura temporal parcial' : ''}`
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

  const audioPanel = document.querySelector('#loom-audio-panel');
  const audioControl = document.querySelector('#loom-audio-control');
  const audioActions = audioControl.parentElement;
  const audioStage = audioPanel.parentElement;
  const audioPanelNext = audioPanel.nextElementSibling;
  const screenAudio = document.createElement('div');
  screenAudio.className = 'screen-audio';
  const textileAudio = LoomAudio.mount(document.querySelector('#loom-audio-toggle'),
    document.querySelector('#loom-audio-volume'), document.querySelector('#loom-audio-status'), audioControl);
  const constructionPanel = sceneA.querySelector('.loom-construction');
  const skipConstruction = constructionPanel.querySelector('button');
  const selectedFibers = new Map();
  function syncReset() { reset.disabled = !(editedA || (comparing && editedB)); }
  const loom = TextileLoom.mount(sceneA, [activity, trigger], document.querySelector('#loom-status'), emptyData, fiber => {
    state.fiberId = fiber?.id ?? null;
    state.routeId = fiber?.flightInfo?.routeId ?? null;
    selectScenarioFiber(sceneA, fiber);
  }, {
    onConstruction(active) {
      const returnFocus = document.activeElement === skipConstruction;
      constructionPanel.hidden = !active;
      if (!active && returnFocus) sceneA.querySelector('canvas').focus({ preventScroll: true });
    },
    onWeave: textileAudio.build,
    onGesture: textileAudio.gesture,
    onEdits(has) { editedA = has; syncReset(); },
    onPause(value) { paused = value; secondary?.setPaused(value); }
  });
  skipConstruction.addEventListener('click', loom.finishConstruction);
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
    sceneB.querySelector('.loom-construction').remove();
    sceneB.querySelector('.thread-info').hidden = true;
    sceneB.querySelector('.needle-cursor').hidden = true;
    sceneB.querySelector('canvas').setAttribute('aria-label', 'Telar del periodo B');
    const statusB = document.createElement('span');
    statusB.className = 'comparison-render-status';
    statusB.hidden = true;
    sceneB.append(statusB);
    stage.append(sceneB);
    secondary = TextileLoom.mount(sceneB, [], statusB, emptyData, fiber => selectScenarioFiber(sceneB, fiber), {
      secondary: true, onGesture: textileAudio.gesture, onEdits(has) { editedB = has; syncReset(); }
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

  function anchorPopover(trigger, panel, alignEnd = false, fitHeight = false) {
    function position() {
      if (!panel.matches(':popover-open')) return;
      const anchor = trigger.getBoundingClientRect();
      const width = panel.offsetWidth;
      const left = Math.max(8, Math.min(alignEnd ? anchor.right - width : anchor.left, document.documentElement.clientWidth - width - 8));
      const below = anchor.bottom + 6;
      const top = fitHeight && below + panel.offsetHeight > document.documentElement.clientHeight - 8
        ? Math.max(8, anchor.top - panel.offsetHeight - 6) : below;
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
  anchorPopover(audioControl, audioPanel, true, true);
  const placePanel = document.querySelector('#place-panel');
  anchorPopover(document.querySelector('#place-toggle'), placePanel);
  const emotionPanel = document.querySelector('#emotion-panel');
  const emotionToggle = document.querySelector('#emotion-toggle');
  const disclosure = document.querySelector('#emotion-disclosure');
  const emotionOptions = document.querySelector('#emotion-options');
  let activeEmotion = 'neutral';
  anchorPopover(emotionToggle, emotionPanel, true);
  const emotionStory = disclosure.querySelector('details');
  const emotionFacts = disclosure.querySelector('[data-emotion-facts]');
  const scenarioCard = document.querySelector('#emotion-scenario');
  const scenarioForm = document.querySelector('#scenario-form');
  const scenarioInput = document.querySelector('#scenario-percent');
  const scenarioClear = document.querySelector('#scenario-clear');
  const scenarioResults = document.querySelector('#scenario-results');
  const scenarioReference = document.querySelector('#scenario-reference');
  const scenarioVariation = document.querySelector('#scenario-variation');
  const scenarioAssumptions = new Map();
  // Illustrative starting point, separately editable for each emotion.
  const initialScenarioPercent = 20;
  const scenarioPercent = () => activeEmotion === 'neutral' ? null : scenarioAssumptions.has(activeEmotion)
    ? scenarioAssumptions.get(activeEmotion) : initialScenarioPercent;

  function selectScenarioFiber(scene, fiber) {
    if (fiber) selectedFibers.set(scene, fiber);
    else selectedFibers.delete(scene);
    renderFiberScenario(scene, fiber);
  }

  function renderFiberScenario(scene, fiber) {
    const section = scene.querySelector('.thread-scenario');
    const band = fiber?.corridor;
    const route = fiber?.flightInfo;
    const observed = band?.flightCount ?? (route?.status !== 'demo' ? route?.flightCount : null);
    section.hidden = activeEmotion === 'neutral' || isDemo() || observed == null;
    if (section.hidden) return;
    const preset = LoomInterpretations.get(activeEmotion);
    const percent = scenarioPercent();
    section.querySelector('[data-thread-scenario-title]').textContent = 'Lectura interpretativa · ' + preset.label;
    section.querySelector('[data-thread-scenario-value]').textContent = percent === null ? 'Sin proporción aplicada.'
      : scenarioFormatter.format(percent) + ' % hipotético · '
        + display(LoomScenarios.quantity(observed, percent)) + ' equivalentes interpretativos '
        + (band ? 'del grupo de rutas' : 'de la conexión');
    section.querySelector('[data-thread-scenario-story]').textContent = preset.quote;
  }
  const scenarioDates = new Map();
  const scenarioChart = document.querySelector('#scenario-chart');
  const scenarioFormatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
  const scenarioPreview = document.querySelector('#emotion-scenario-preview');

  function scenarioSample(result, place, sense) {
    if (!result) return null;
    const observed = !result.routeSlots ? null : place
      ? LoomDestinations.connections(routesFromOrigin(result), place, sense).flightCount : routeVolume(result.routes);
    return { observed, covered: result.routeSlots, slots: result.slots, type: result.period.type };
  }
  const signedScenario = value => (value > 0 ? '+' : '') + scenarioFormatter.format(value);
  let scenarioRequest = 0, scenarioPeriod = '', scenarioSource;

  function renderScenarioChart(period, bins, comparisonLabel = '') {
    scenarioChart.hidden = !bins.some(bin => bin.quantity !== null);
    if (scenarioChart.hidden) return;
    const peak = Math.max(1, ...bins.map(bin => bin.quantity ?? 0));
    document.querySelector('#scenario-chart-label').textContent = comparisonLabel || (period.type === 'day'
      ? 'Escenario diario · siete días UTC alrededor de la fecha' : 'Escenario acumulado por tramo del periodo UTC');
    const bars = document.createDocumentFragment();
    const labels = document.createDocumentFragment();
    for (const bin of bins) {
      const bar = document.createElement('span');
      const from = bin.label ?? new Date(bin.start).toISOString().slice(0, 10);
      bar.style.setProperty('--bar-height', (bin.quantity ?? 0) / peak * 100 + '%');
      bar.toggleAttribute('data-missing', bin.quantity === null);
      const label = document.createElement('li');
      label.textContent = from + ' · ' + (bin.quantity === null ? 'sin datos'
        : scenarioFormatter.format(bin.quantity) + ' equivalentes' + (bin.coverage < bin.days ? ` · ${bin.coverage}/${bin.days} días` : ''));
      bar.title = label.textContent;
      bars.append(bar);
      labels.append(label);
    }
    scenarioChart.querySelector('.scenario-bars').replaceChildren(bars);
    scenarioChart.querySelector('ol').replaceChildren(labels);
  }

  function syncScenarioReference(period) {
    if (scenarioSource === source && scenarioPeriod === period.id) return;
    scenarioSource = source;
    scenarioPeriod = period.id;
    scenarioDates.clear();
    const unique = new Set([period.id]);
    for (const day of source.dates) {
      const option = LoomTime.interval(period.type, day, Number(period.start.slice(11, 13)));
      if (unique.has(option.id)) continue;
      unique.add(option.id);
      scenarioDates.set(day, option);
    }
    scenarioReference.replaceChildren(new Option('Seleccionar referencia', ''), ...[...scenarioDates].map(([day, option]) => new Option(option.label, day)));
    scenarioReference.disabled = !scenarioDates.size;
    const earlier = [...scenarioDates].filter(([, option]) => option.start < period.start).at(-1)?.[0];
    scenarioReference.value = earlier ?? '';
  }

  async function renderScenario() {
    const token = ++scenarioRequest;
    const percent = scenarioPercent();
    for (const [scene, fiber] of selectedFibers) renderFiberScenario(scene, fiber);
    const enabled = percent !== null && !isDemo() && activeEmotion !== 'neutral';
    const { place, sense } = routeScope();
    const result = dataset;
    const sample = enabled ? scenarioSample(result, place, sense) : null;
    const current = LoomScenarios.quantity(sample?.observed ?? null, percent);
    loom.setScenario(LoomScenarios.intensity(current ?? 0), Boolean(place));
    if (secondary) {
      const other = enabled && comparing ? scenarioSample(comparisonResult, place, sense) : null;
      const equivalents = LoomScenarios.quantity(other?.observed ?? null, percent);
      secondary.setScenario(LoomScenarios.intensity(equivalents ?? 0), Boolean(place));
    }
    scenarioPreview.hidden = !enabled;
    scenarioCard.hidden = isDemo();
    scenarioClear.hidden = percent === null;
    scenarioResults.hidden = !enabled;
    document.querySelector('#scenario-reading').hidden = !enabled;
    document.querySelector('#scenario-head').hidden = !enabled;
    document.querySelector('#scenario-note').hidden = enabled;
    if (!enabled) return;
    const scopeLabel = place ? place.name + (sense === 'both' ? ' · llegadas y salidas'
      : sense === 'arrivals' ? ' · llegadas' : ' · salidas') : 'Todos los países';
    const headline = current === null ? 'Sin datos observados' : display(current) + ' equivalentes interpretativos';
    const assumption = scenarioFormatter.format(percent) + (scenarioAssumptions.has(activeEmotion)
      ? ' % hipotético' : ' % ilustrativo · editable');
    const preview = LoomInterpretations.get(activeEmotion).label + ' · ' + headline + ' · ' + assumption;
    scenarioPreview.textContent = preview;
    document.querySelector('#scenario-total').textContent = headline;
    document.querySelector('#scenario-assumption').textContent = '· ' + assumption;
    document.querySelector('#scenario-narrative').textContent = LoomInterpretations.get(activeEmotion).quote;
    document.querySelector('#scenario-emotion').textContent = LoomInterpretations.get(activeEmotion).label;
    document.querySelector('#scenario-base').textContent = scopeLabel
      + (sample?.observed != null ? ' · ' + display(sample.observed) + ' vuelos observados' : '');
    document.querySelector('#scenario-source').textContent =
      'Fuente de los vuelos: ' + (result?.provenance?.routes?.name ?? 'sin datos de rutas disponibles') + '.';
    const coverageNote = document.querySelector('#scenario-coverage');
    coverageNote.hidden = !sample;
    if (sample) coverageNote.textContent = sample.covered + '/' + sample.slots
      + (sample.type === 'hour' ? ' horas con datos de rutas' : ' días con datos de rutas');
    scenarioChart.hidden = true;
    if (!result) scenarioReference.disabled = true;
    scenarioVariation.textContent = 'Sin datos suficientes para comparar.';
    if (!result) return;
    if (!place) renderScenarioChart(result.period, LoomScenarios.series(source.timeline?.filter(([day]) => !source.providerAt ||
      source.providerAt(day) === source.providerAt(result.period.anchorDay ?? result.period.start)), result.period, percent));
    syncScenarioReference(result.period);
    const compareWithB = comparing && comparisonResult;
    const referencePeriod = compareWithB ? comparisonResult.period : scenarioDates.get(scenarioReference.value);
    if (!referencePeriod) return;
    scenarioVariation.textContent = 'Consultando el periodo de referencia…';
    try {
      const reference = compareWithB ? comparisonResult : await queries.read(referencePeriod, state.activity);
      if (token !== scenarioRequest) return;
      if (result.provenance?.routes?.name !== reference.provenance?.routes?.name) {
        scenarioVariation.textContent = 'Fuentes distintas o cobertura sin verificar. Variación no disponible.';
        return;
      }
      const other = scenarioSample(reference, place, sense);
      const delta = LoomScenarios.compare(sample, other, percent);
      if (!delta) {
        scenarioVariation.textContent = 'Sin cobertura suficiente para calcular la variación.';
        return;
      }
      if (delta.normalized) {
        const observedDaily = periodSample =>
          scenarioFormatter.format(periodSample.observed / periodSample.covered)
          + ' vuelos observados por día · ' + periodSample.covered + '/' + periodSample.slots + ' días con datos';
        coverageNote.textContent = result.period.label + ' · ' + observedDaily(sample)
          + '. ' + reference.period.label + ' · ' + observedDaily(other) + '.';
        coverageNote.hidden = false;
      }
      const direction = delta.difference > 0 ? '↑' : delta.difference < 0 ? '↓' : '→';
      const amount = direction + ' ' + signedScenario(delta.difference);
      const percentage = delta.percent !== null ? ' (' + signedScenario(delta.percent) + ' %)' : '';
      const unit = delta.normalized ? ' equivalentes por día con datos' : ' equivalentes';
      const normalizedNote = delta.normalized
        ? ' Los acumulados no son directamente comparables. A: ' + scenarioFormatter.format(delta.current) + unit + '.' : '';
      scenarioVariation.textContent = 'Referencia: ' + scenarioFormatter.format(delta.reference) + unit
        + '. ' + amount + unit + percentage + '.'
        + (delta.percent === null ? ' Variación porcentual sin base positiva.' : '') + normalizedNote;
      scenarioPreview.textContent = preview + ' · ' + amount + unit + percentage;
      if (place || scenarioChart.hidden) {
        const pair = [
          { label: result.period.label, start: Date.parse(result.period.start), quantity: delta.current, coverage: sample.covered, days: sample.slots },
          { label: reference.period.label, start: Date.parse(reference.period.start), quantity: delta.reference, coverage: other.covered, days: other.slots }
        ].sort((a, b) => a.start - b.start);
        renderScenarioChart(result.period, pair, delta.normalized ? 'Comparación por día con datos' : 'Comparación de periodos UTC');
      }
    } catch {
      if (token === scenarioRequest) scenarioVariation.textContent = 'No se pudo consultar el periodo de referencia.';
    }
  }

  scenarioForm.addEventListener('submit', event => {
    event.preventDefault();
    const percent = LoomScenarios.proportion(scenarioInput.value);
    if (percent === null || isDemo() || activeEmotion === 'neutral') return;
    scenarioAssumptions.set(activeEmotion, percent);
    renderScenario();
  });
  scenarioClear.addEventListener('click', () => {
    scenarioAssumptions.set(activeEmotion, null);
    scenarioInput.value = '';
    renderScenario();
  });
  scenarioReference.addEventListener('change', renderScenario);

  for (const [id, { label, color, summary }] of LoomInterpretations.presets) {
    const option = document.createElement('button');
    option.type = 'button';
    option.dataset.emotion = id;
    option.setAttribute('aria-pressed', String(id === activeEmotion));
    option.style.setProperty('--emotion-color', color);
    const name = document.createElement('strong');
    name.textContent = label;
    const hint = document.createElement('span');
    hint.textContent = summary;
    option.append(name, hint);
    emotionOptions.append(option);
  }
  function applyEmotion(id, animate = true) {
    const changed = id !== activeEmotion;
    activeEmotion = id;
    textileAudio.setEmotion(id);
    const preset = LoomInterpretations.get(id);
    disclosure.hidden = id === 'neutral';
    emotionStory.open = false;
    scenarioInput.value = scenarioPercent() ?? '';
    document.querySelector('#scenario-narrative').textContent = preset.quote ?? '';
    disclosure.querySelector('[data-emotion-active]').textContent = id === 'neutral' ? '' : preset.label;
    disclosure.querySelector('[data-emotion-title]').textContent = preset.title ?? '';
    disclosure.querySelector('[data-emotion-quote]').textContent = preset.quote ?? '';
    disclosure.querySelector('[data-emotion-description]').textContent = preset.description ?? '';
    emotionToggle.title = id === 'neutral' ? '' : 'Interpretación activa: ' + preset.label;
    for (const option of emotionOptions.children) {
      option.setAttribute('aria-pressed', String(option.dataset.emotion === id));
    }
    document.querySelector('#telar').dataset.emotion = id;
    loom.setEmotion(id);
    secondary?.setEmotion(id);
    if (!stage.hasAttribute('aria-busy')) {
      renderScenario();
      if (animate && changed) animateWeave();
    }
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
    const next = TravelSurveys.compatibleSurvey(state.destinationId, start);
    const applicable = isDemo() && next === TravelSurveys.compatibleSurvey(state.destinationId, last) ? next : undefined;
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

  function routeScope() {
    const destination = catalog.get(state.destinationId);
    const place = destination ?? catalog.get('country:' + originCountry);
    const sense = destination ? (originCountry ? 'arrivals' : state.direction) : 'departures';
    return { destination, place, sense };
  }

  function renderDestination() {
    if (!dataset) return;
    renderSurvey();
    const { destination, place, sense } = routeScope();
    const eligible = routesFromOrigin(dataset);
    renderCountries(destination, eligible);
    const matches = LoomDestinations.connections(eligible, place, sense);
    textileAudio.setScene(isDemo() ? [] : place ? matches.matched.values() : eligible,
      JSON.stringify([dataset.routeSource, dataset.period.id, place?.id, sense, originCountry,
        eligible.length, matches.flightCount]));
    restore.hidden = !place;
    direction.closest('label').hidden = false;
    direction.value = destination ? sense : 'both';
    direction.disabled = !destination || Boolean(originCountry);
    Array.from(layers.options).slice(1).forEach(option => { option.disabled = !place; });
    layers.value = state.layer;
    const symbol = destination ? LoomEmbroidery.forDestination(destination.id) : null;
    if (!symbol) state.visualization = 'connections';
    if (symbol && !matches.flightCount) state.visualization = 'connections';
    const showingFigure = state.visualization === 'figure' && Boolean(symbol);
    const routeIds = new Set(matches.matched.keys());
    figureOption.disabled = !symbol || !matches.flightCount;
    visualization.value = state.visualization;
    note.hidden = !place;
    note.textContent = !place ? '' : !symbol ? 'Sin figura bordada para esta selección.'
      : !matches.flightCount ? 'Figura bordada: ' + symbol.name + ' · requiere vuelos observados.'
      : 'Figura bordada: ' + symbol.name + (showingFigure ? '' : ' · disponible en Visualización.');
    embroideryCaption.hidden = !showingFigure;
    compactDescription.hidden = !showingFigure;
    if (showingFigure) {
      embroideryName.textContent = symbol.name;
      embroideryDescription.textContent = 'Lectura poética de ' + destination.name;
      compactDescription.textContent = symbol.description;
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
      if (source.historical && dataset.routeSource && dataset.routeSource === comparisonResult.routeSource && dataset.routeSlots === dataset.slots &&
          comparisonResult.routeSlots === comparisonResult.slots && dataset.slots === comparisonResult.slots) {
        document.querySelector('#comparison-difference').textContent =
          'Misma serie y duración comparable · ' + sampleDifference(dataset, comparisonResult);
      }
    }
    renderScenario();
    const airportLabel = id => {
      const airport = (source.airports ?? FlightData.airports)[id];
      return airport ? `${airport.city} (${airport.code || id})` : id;
    };
    const senseLabel = { arrivals: 'Llegadas (destino)', departures: 'Salidas (origen)', both: 'Llegadas y salidas' };
    fields.name.textContent = place?.name ?? 'Vista general';
    fields.type.textContent = place ? [senseLabel[sense], place.iata ? `${place.iata} / ${place.icao}` : null]
      .filter(Boolean).join(' · ') : 'Todos los países';
    fields.period.textContent = dataset.period.label + (originCountry && destination
      ? ' · Origen: ' + (catalog.get('country:' + originCountry)?.name ?? originCountry) : '');
    const registry = source.airports ?? FlightData.airports;
    const relatedIds = place ? matches.recordedAirports : new Set(eligible.flatMap(route => [route.originId, route.destinationId]));
    const airportCount = relatedIds.size;
    const observed = place ? matches.flightCount : routeVolume(eligible);
    const routeCount = place ? matches.matched.size : eligible.length;
    const countryCount = place ? null : new Set([...relatedIds].map(id => registry[id]?.country).filter(Boolean)).size;
    const stat = (count, one, many) => format.format(count) + ' ' + (count === 1 ? one : many);
    const tally = !dataset.routeSlots ? 'Sin registros para este periodo'
      : dataset.routeSource === 'adsblol:routes' ? stat(observed, 'trayecto reconstruido', 'trayectos reconstruidos')
      : stat(observed, 'vuelo', 'vuelos') + (isDemo() ? ' de demostración' : observed === 1 ? ' observado' : ' observados');
    if (fields.count.textContent !== tally) {
      fields.count.textContent = tally;
      if (!infoMotion.matches) {
        fields.count.getAnimations().forEach(animation => animation.cancel());
        fields.count.animate([{ opacity: .60 }, { opacity: 1 }], { duration: 250, easing: 'ease-out' });
      }
    }
    fields.stats.textContent = dataset.routeSlots ? [
      stat(routeCount, 'ruta', 'rutas'),
      ...(countryCount === null ? [] : [stat(countryCount, 'país conectado', 'países conectados')]),
      stat(airportCount, 'aeropuerto', 'aeropuertos')
    ].join(' · ') : '';
    fields.coverage.textContent = `${isDemo() ? 'Datos de demostración' : dataset.provenance?.routes?.name ?? 'Sin fuente de rutas'} · ${dataset.routeSlots} de ${dataset.slots} ${periodType === 'hour' ? 'horas' : 'días'} con datos`;
    airportDisclosure.hidden = !place || !airportCount;
    if (airportDisclosure.hidden) airportDisclosure.open = false;
    fields.airports.replaceChildren(...(place ? [...relatedIds] : []).map(airportLabel)
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
    field('unit').textContent = !result ? '' : result.routeSlots ? (result.routeSource === 'adsblol:routes' ? 'trayectos reconstruidos · ' : 'vuelos observados · ') + (catalog.get(state.destinationId)?.name ?? catalog.get('country:' + originCountry)?.name ?? 'Todos los países') : type === 'hour' ? 'vuelos en la hora'
      : type === 'day' ? 'vuelos en el día' : result.coverage === 'partial' ? 'vuelos por día disponible' : 'vuelos por día';
    const routeProvider = result?.provenance?.routes?.name;
    field('coverage').textContent = result?.routeSlots && routeProvider
      ? `${routeProvider} · ${result.routeSlots} de ${result.slots} días con datos`
      : result ? coverage(result) : '';
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

  function animateWeave() {
    loom.reweave();
    if (comparing) secondary?.reweave();
  }

  function updateDestination(animate) {
    if (stage.hasAttribute('aria-busy')) return;
    renderDestination();
    if (animate) animateWeave();
  }

  async function reloadData(animate = true) {
    const token = ++request;
    ++scenarioRequest;
    if (!scenarioResults.hidden) scenarioVariation.textContent = 'Consultando el periodo…';
    const showBoth = comparing;
    const difference = document.querySelector('#comparison-difference');
    const scaleNote = document.querySelector('#comparison-scale');
    stage.setAttribute('aria-busy', 'true');
    temporalNote.textContent = 'Consultando el periodo…';
    fields.count.textContent = 'Consultando el periodo…';
    fields.stats.textContent = '';
    fields.coverage.textContent = '';
    fields.origins.hidden = airportDisclosure.hidden = note.hidden = true;
    compactDescription.hidden = true;
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
            ? (a.routeSource !== b.routeSource ? 'Fuentes distintas · diferencias de cobertura y método; se muestran por separado.'
              : a.routeSlots === a.slots && b.routeSlots === b.slots && a.slots === b.slots
              ? 'Misma serie y duración comparable · diferencia de la muestra: ' +
                sampleDifference(a, b)
              : 'Misma serie · cobertura o duración diferente; sin diferencia directa.')
            : 'Diferencia no disponible con esta cobertura. ';
        scaleNote.textContent = source.historical
          ? ' · Ambos telares usan la misma escala de vuelos acumulados.'
          : scale ? ` · Trama acumulada: ≈ ${scale} vuelos de la muestra por hebra` : '';
      }
      renderDestination();
      if (!a.routes.length) loom.finishConstruction();
      else if (animate) animateWeave();
    } catch (error) {
      if (token !== request) return;
      total.textContent = '—';
      emotionFacts.textContent = 'No se pudieron consultar los datos del periodo.';
      dataset = null;
      textileAudio.setScene([], 'sin-datos');
      fields.count.textContent = 'Datos del periodo no disponibles';
      fields.period.textContent = '';
      renderScenario();
      temporalNote.textContent = 'No se pudo consultar el periodo. Elige otra fecha para reintentar.';
      if (showBoth) {
        for (const panel of panels) renderComparisonPanel(panel, null, null, 'Periodo no disponible');
        difference.textContent = scaleNote.textContent = '';
        secondary.setData(emptyData);
      }
      loom.setData(emptyData);
      loom.finishConstruction();
      console.warn('Consulta temporal:', error);
    } finally {
      if (token === request) stage.removeAttribute('aria-busy');
    }
  }

  function changeTime(animate = true) {
    infoBody.scrollTop = 0;
    loom.clearEdits();
    secondary?.clearEdits();
    reloadData(animate);
  }
  function setComparison(value, refresh = true) {
    comparing = value;
    showingB = false;
    comparisonPanel.hidden = !value;
    stage.classList.toggle('is-comparing', value);
    if (value) comparisonActions.append(loomActions);
    else stage.prepend(loomActions);
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
    if (refresh) reloadData();
  }
  toggleCompare.addEventListener('click', () => setComparison(!comparing));
  periodSelect.addEventListener('change', () => { periodType = periodSelect.value; changeTime(); });
  compareDayA.addEventListener('change', () => { state.day = compareDayA.value; calendar.setSelectedDate(state.day); changeTime(); });
  for (const control of [hourA, hourB, compareDay]) control.addEventListener('change', () => changeTime());

  function choose(place, sense = 'arrivals', forceAnimation = false) {
    const id = place?.id ?? null;
    const changed = id !== state.destinationId || sense !== state.direction || state.layer !== (place ? 'highlight' : 'all');
    if (id !== state.destinationId) {
      loom.clearEdits();
      secondary?.clearEdits();
      infoBody.scrollTop = 0;
    }
    state.destinationId = id;
    state.direction = sense;
    state.layer = place ? 'highlight' : 'all';
    airportDisclosure.open = false;
    updateDestination(changed || forceAnimation);
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
    countryPlaces.focus({ preventScroll: true });
  });
  visualization.addEventListener('change', () => {
    const changed = state.visualization !== visualization.value;
    if (changed) { loom.clearEdits(); secondary?.clearEdits(); }
    state.visualization = visualization.value;
    updateDestination(changed);
  });
  layers.addEventListener('change', () => { state.layer = layers.value; updateDestination(true); });
  direction.addEventListener('change', () => {
    state.direction = direction.value;
    updateDestination(true);
  });
  restore.addEventListener('click', () => {
    const hadOrigin = Boolean(originCountry);
    originCountry = '';
    search.setValue(null);
    choose(null, 'arrivals', hadOrigin);
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
  function restartExperience(animate = true) {
    historyDate = '';
    historyPeriod = 'day';
    state = LoomDestinations.createState(realSource.dates[0] ?? defaultDay);
    originCountry = '';
    periodType = periodSelect.value = 'day';
    if (comparing) setComparison(false, false);
    activity.value = state.activity;
    search.setValue(null);
    for (const details of stage.closest('#telar').querySelectorAll('details[open]')) details.open = false;
    closeExplorationPanels();
    scenarioAssumptions.clear();
    scenarioPeriod = '';
    scenarioReference.replaceChildren();
    applyEmotion('neutral', false);
    loom.clearEdits();
    secondary?.clearEdits();
    loom.restart();
    secondary?.restart();
    mode.value = 'real';
    selectSource(animate);
  }
  function closeExplorationPanels() {
    search.close();
    closeLoomFilters();
    for (const panel of [placePanel, audioPanel, document.querySelector('#emotion-panel'), document.querySelector('#demo-calendar')]) {
      if (panel.matches(':popover-open')) panel.hidePopover();
    }
  }

  const restartStatus = document.querySelector('#loom-restart-status');
  let restartNoticeTimer;
  document.querySelector('#loom-restart').addEventListener('click', () => {
    restartExperience();
    restartStatus.textContent = 'Exploración reiniciada';
    clearTimeout(restartNoticeTimer);
    restartNoticeTimer = setTimeout(() => { restartStatus.textContent = ''; }, 2400);
  });

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
      if (file.license === 'ODbL-1.0') {
        const { start, end } = dataset.period;
        const releases = file.releases ?? { [file.days[0][0]]: file.original };
        note.textContent = `ADSB.lol · ${file.file} · ODbL 1.0 · SHA-256 ${file.sha256}`;
        for (const [day, url] of Object.entries(releases)) {
          if (day < start.slice(0, 10) || day >= end.slice(0, 10)) continue;
          const link = document.createElement('a');
          link.href = url;
          link.textContent = day;
          note.append(' · ', link);
        }
      } else note.textContent = `${file.original} · MD5 ${file.md5}`;
      provenance.append(note);
    }
    sourceStatus.textContent = isDemo() ? 'Simulación de datos de vuelos.'
      : !entries.length ? source.historical ? historyCoverage.textContent : localSourceStatus
        : realSource.expired ? 'Una serie excede la vigencia admitida y queda excluida.'
          : manualSource ? 'Archivo local validado. La procedencia y el permiso son los declarados en el archivo.'
            : 'Muestra histórica validada y cargada automáticamente.';
  }
  function selectSource(animate = true) {
    const nextSource = isDemo() ? demoSource : realSource;
    if (nextSource !== source) {
      source = nextSource;
      queries = LoomTime.cache(source, source.historical ? 4 : 12);
    }
    updateHistoricalAirports();
    const place = catalog.get(state.destinationId);
    originCountry = '';
    if (!source.historical && !isDemo() && place && !destinationAvailable(place)) {
      search.setValue(null);
      state.destinationId = null;
      state.layer = 'all';
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
    changeTime(animate);
  }
  origin.addEventListener('change', () => {
    originCountry = origin.value;
    loom.clearEdits();
    secondary?.clearEdits();
    if (originCountry) state.layer = 'highlight';
    else if (!state.destinationId) state.layer = 'all';
    updateDestination(true);
  });

  mode.addEventListener('change', () => selectSource());
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
    if (!isDemo()) selectSource(false);
  }
  selectSource(false);
  loadBundledRoutes();
  return {
    beginExperience() {
      restartExperience(false);
      loom.startConstruction();
    },
    setScreen(screen) {
      visible = screen.id === 'telar';
      textileAudio.setScreen(screen.id);
      if (audioPanel.matches(':popover-open')) audioPanel.hidePopover();
      if (visible) {
        audioActions.prepend(audioControl);
        audioStage.insertBefore(audioPanel, audioPanelNext);
        screenAudio.remove();
      } else {
        closeExplorationPanels();
        screen.prepend(screenAudio);
        screenAudio.append(audioControl, audioPanel);
      }
      syncCanvases();
    }
  };
}

initNavigation(initDemoFlights());
