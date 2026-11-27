'use strict';

const FlightData = (() => {
  /** @typedef {{id:string, dateUtc:string, timeUtc?:string, originId:string, destinationId:string,
   * originCountry?:string, destinationCountry?:string, originCoordinates?:[number, number],
   * destinationCoordinates?:[number, number], status?:'available'|'unavailable', sourceId:string}} Flight */
  /** @typedef {{routeId:string, originId:string, destinationId:string, periodStart:string, periodEnd:string,
   * flightCount:number, sourceId:string, coverageStatus:string}} FlightRoute */
  /** @typedef {{dateUtc:string, flightCount:number, sourceId:string, coverage:string,
   * updatedAt:string, status:'demo'|'observed'}} DailyTotal */

  // Geographic reference only: https://github.com/davidmegginson/ourairports-data
  const airportRows = [
    ['MMMX', 'MEX', 'Ciudad de México', 'MX', 19.435822, -99.070330],
    ['KJFK', 'JFK', 'Nueva York', 'US', 40.639447, -73.779317],
    ['KMCO', 'MCO', 'Orlando', 'US', 28.429399, -81.308998],
    ['EGLL', 'LHR', 'Londres', 'GB', 51.470748, -.459909],
    ['LFPG', 'CDG', 'París', 'FR', 49.008960, 2.554117],
    ['LEMD', 'MAD', 'Madrid', 'ES', 40.493407, -3.572249],
    ['RJTT', 'HND', 'Tokio', 'JP', 35.549678, 139.786958],
    ['KLAX', 'LAX', 'Los Ángeles', 'US', 33.942501, -118.407997],
    ['SBGR', 'GRU', 'São Paulo', 'BR', -23.431274, -46.469954]
  ];
  const airports = Object.freeze(Object.fromEntries(airportRows.map(([id, code, city, country, lat, lon]) => [
    id, Object.freeze({ id, code, city, cityId: country + ':' + city, country, lat, lon, level: 'airport' })
  ])));
  const countFormat = new Intl.NumberFormat('es-MX');
  const dateFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' });
  const seed = 48291;
  const colors = ['#A38BE8', '#A9C1FD', '#474292', '#6B467A', '#DCDFFF', '#A9C1FD', '#6B467A', '#64B9F4'];

  function hash(text, initial = seed) {
    let value = initial;
    for (const char of text) value = Math.imul(value ^ char.codePointAt(0), 16777619);
    return value >>> 0;
  }

  function plotAnchor(place) {
    const { id, lat, lon } = place;
    if (!id || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
      throw new RangeError('Coordenadas de anclaje inválidas');
    }
    const jitter = channel => hash(channel + ':' + id) / 4294967296 - .5;
    const r = Math.PI / 180;
    return [
      3.85 * Math.tanh((lon + 27) / 86) + jitter('x') * 1.20,
      1.32 * Math.sin((lat - 22) * r * 1.6) + .52 * Math.sin((lon + 22) * r * 2) + jitter('y') * 1.75,
      .37 * Math.sin((lat + lon * .36) * r * 2) + jitter('z') * .68
    ];
  }
  const anchors = Object.freeze(Object.fromEntries(Object.values(airports).map(place => [
    place.id, Object.freeze(plotAnchor(place))
  ])));

  function distanceKm(a, b) {
    if (!a || !b || ![a.lat, a.lon, b.lat, b.lon].every(Number.isFinite)) return null;
    const r = Math.PI / 180;
    const h = Math.sin((b.lat - a.lat) * r / 2) ** 2
      + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2;
    return Math.round(12742 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h)))));
  }

  function dayBounds(day) {
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new RangeError('Fecha UTC inválida');
    const start = new Date(day + 'T00:00:00Z');
    if (!Number.isFinite(+start) || start.toISOString().slice(0, 10) !== day) throw new RangeError('Fecha UTC inválida');
    return [start.toISOString(), new Date(+start + 86400000).toISOString()];
  }

  const routeId = (source, origin, destination) => [source, origin, destination].map(encodeURIComponent).join(':');

  /** @param {Flight[]} records */
  function aggregateFlights(records, dateUtc, catalog = airports) {
    const [periodStart, periodEnd] = dayBounds(dateUtc);
    const seen = new Set();
    const routes = new Map();
    for (const flight of records) {
      const { id, originId, destinationId, sourceId, status, timeUtc } = flight;
      const fullTime = timeUtc && /^\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z?$/.test(timeUtc)
        ? `${flight.dateUtc}T${timeUtc.replace(/Z$/, '')}Z` : timeUtc;
      const instant = fullTime && /(?:Z|[+-]\d{2}:\d{2})$/i.test(fullTime) ? Date.parse(fullTime) : NaN;
      const onDay = timeUtc ? instant >= Date.parse(periodStart) && instant < Date.parse(periodEnd) : flight.dateUtc === dateUtc;
      if (!id || !sourceId || !onDay || status === 'unavailable' || originId === destinationId ||
          !Object.hasOwn(catalog, originId) || !Object.hasOwn(catalog, destinationId)) continue;
      const key = JSON.stringify([sourceId, id]);
      if (seen.has(key)) continue;
      seen.add(key);
      const keyRoute = routeId(sourceId, originId, destinationId);
      if (!routes.has(keyRoute)) routes.set(keyRoute, {
        routeId: keyRoute, originId, destinationId, periodStart, periodEnd,
        flightCount: 0, sourceId, coverageStatus: 'sample'
      });
      routes.get(keyRoute).flightCount++;
    }
    return [...routes.values()].sort((a, b) => a.routeId.localeCompare(b.routeId));
  }

  // Each row declares an independent directional route count for a synthetic day.
  const samples = new Map([
    ['2026-01-14', { totals: [53400, 87400, 119500], routes: [
      ['KLAX','RJTT',180], ['MMMX','EGLL',110], ['KJFK','LFPG',156], ['SBGR','LEMD',120],
      ['KMCO','EGLL',84], ['LEMD','RJTT',72], ['LFPG','KLAX',62], ['MMMX','KMCO',50], ['RJTT','SBGR',65]
    ] }],
    ['2026-01-21', { totals: [55300, 91600, 126200], routes: [
      ['KLAX','EGLL',160], ['MMMX','EGLL',142], ['KJFK','LFPG',111], ['SBGR','LEMD',164],
      ['KMCO','LEMD',108], ['RJTT','LEMD',96], ['EGLL','KLAX',76], ['MMMX','KMCO',48], ['LFPG','RJTT',72]
    ] }]
  ]);
  const days = Object.freeze([...samples.keys()].sort());

  function getDemo(dateUtc, activity) {
    const sample = samples.get(dateUtc);
    const level = ['low', 'medium', 'high'].indexOf(activity);
    if (!sample || level < 0) throw new RangeError('Escenario desconocido');
    const [periodStart, periodEnd] = dayBounds(dateUtc);
    const updatedAt = periodEnd;
    const sourceId = 'sim-routes-v1';
    const routes = sample.routes.slice(0, [5, 7, 9][level]).map(([originId, destinationId, count]) => ({
      routeId: routeId(sourceId, originId, destinationId), originId, destinationId, periodStart, periodEnd,
      flightCount: Math.round(count * [.41, 1, 2.35][level]), sourceId, coverageStatus: 'sample'
    }));
    /** @type {DailyTotal} */
    const daily = {
      dateUtc, flightCount: sample.totals[level],
      sourceId: 'sim-world-v1', coverage: 'Total mundial simulado independiente',
      updatedAt, status: 'demo'
    };
    return {
      daily, routes, airports, anchors, seed,
      metadata: { sourceId, periodStart, periodEnd, updatedAt, coverage: 'Muestra sintética de rutas',
        status: 'demo', limitations: 'Los recuentos son ficticios y la muestra no representa el total mundial.' }
    };
  }

  /** Reserve one strand per selected route, then distribute proportional seats by largest remainder. */
  function allocate(routes, budget) {
    const sorted = routes.filter(route => route.flightCount > 0).sort((a, b) =>
      b.flightCount - a.flightCount || a.routeId.localeCompare(b.routeId));
    const visible = sorted.slice(0, budget);
    const reserve = visible.length;
    const capacity = visible.reduce((total, route) => total + route.flightCount - 1, 0);
    const extra = Math.min(capacity, budget - reserve);
    const shares = visible.map(route => {
      const quota = capacity ? extra * (route.flightCount - 1) / capacity : 0;
      return { route, count: 1 + Math.floor(quota), fraction: quota % 1 };
    });
    let remaining = extra - shares.reduce((total, share) => total + share.count - 1, 0);
    const ranked = [...shares].sort((a, b) => b.fraction - a.fraction || a.route.routeId.localeCompare(b.route.routeId));
    for (const share of ranked) {
      if (!remaining) break;
      if (share.count < share.route.flightCount) { share.count++; remaining--; }
    }
    return { shares, omitted: sorted.slice(reserve) };
  }

  // A dense sample needs room for multiple filaments along its strongest routes.
  function allocateFocused(routes, budget, focus) {
    function allocateGroup(group, seats) {
      if (seats < 2 || group.length <= seats) return allocate(group, seats);
      const ordered = [...group].sort((a, b) => b.flightCount - a.flightCount || a.routeId.localeCompare(b.routeId));
      const routeLimit = Math.max(1, Math.floor(seats * .65));
      const retained = new Set(ordered.slice(0, Math.ceil(routeLimit / 2)));
      const score = route => route.flightCount * (.45 + 3 * (route.textile?.distance ?? 0));
      const links = ordered.filter(route => !retained.has(route))
        .sort((a, b) => score(b) - score(a) || a.routeId.localeCompare(b.routeId));
      for (const route of links.slice(0, routeLimit - retained.size)) retained.add(route);
      const result = allocate([...retained], seats);
      return { shares: result.shares, omitted: ordered.filter(route => !retained.has(route)) };
    }
    if (budget < 1 || !focus?.size || routes.length <= budget) return allocateGroup(routes, budget);
    const foreground = routes.filter(route => focus.has(route.routeId));
    const background = routes.filter(route => !focus.has(route.routeId));
    const priority = allocateGroup(foreground, background.length ? Math.max(1, Math.floor(budget * .75)) : budget);
    const used = priority.shares.reduce((sum, share) => sum + share.count, 0);
    const context = allocateGroup(background, Math.max(0, budget - used));
    return { shares: [...priority.shares, ...context.shares], omitted: [...priority.omitted, ...context.omitted] };
  }

  function toLoomData(dataset) {
    const ids = new Set();
    for (const route of dataset.routes) {
      if (!route.routeId || ids.has(route.routeId) || !Number.isSafeInteger(route.flightCount) || route.flightCount < 0 ||
          route.originId === route.destinationId || !Object.hasOwn(dataset.anchors, route.originId) ||
          !Object.hasOwn(dataset.anchors, route.destinationId)) throw new TypeError('Conjunto de rutas inválido');
      ids.add(route.routeId);
    }
    const routes = dataset.routes.map(route => {
      const origin = dataset.airports[route.originId];
      const destination = dataset.airports[route.destinationId];
      const km = distanceKm(origin, destination);
      const intensity = route.flightCount / (route.flightCount + 120);
      const style = hash(route.routeId);
      return {
        id: route.routeId, from: route.originId, to: route.destinationId, flights: route.flightCount,
        concentration: intensity, distance: km === null ? .5 : Math.min(1, km / 12500),
        lift: .20 + intensity * (1.0 + style % 7 * .09),
        width: .26 + intensity * .31, color: colors[style % colors.length],
        info: { ...route, origin, destination, distanceKm: km, status: dataset.metadata.status }
      };
    }).sort((a, b) => a.id.localeCompare(b.id));
    return { seed: dataset.seed, anchors: dataset.anchors, routes };
  }

  function strandCount(total, quality) {
    return Math.min(Math.floor(180 * quality.lod), Math.round(Math.sqrt(total) * 4.1 * quality.lod));
  }

  return { airports, anchors, days, countFormat, dateFormat, plotAnchor, distanceKm, dayBounds,
    getDemo, aggregateFlights, allocate, allocateFocused, toLoomData, strandCount, hash };
})();

if (typeof module !== 'undefined') module.exports = FlightData;
