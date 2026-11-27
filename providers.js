'use strict';

const LoomProviders = (() => {
  const authorities = {
    fr24: { name: 'Flightradar24', hosts: ['www.flightradar24.com', 'fr24api.flightradar24.com'] },
    opensky: { name: 'OpenSky Network', hosts: ['opensky-network.org', 'openskynetwork.github.io'] },
    adsblol: { name: 'ADSB.lol', hosts: ['www.adsb.lol', 'adsb.lol'] },
    opdi: { name: 'OPDI / EUROCONTROL', hosts: ['www.opdi.aero', 'www.eurocontrol.int'] }
  };
  const text = value => typeof value === 'string' && value.trim() && value.length <= 600;
  const instant = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return null;
    const stamp = new Date(value);
    return Number.isFinite(+stamp) && stamp.toISOString() === (value.includes('.') ? value : value.slice(0, -1) + '.000Z') ? stamp.toISOString() : null;
  };

  function provenance(series, kind) {
    if (series == null) return null;
    const official = Object.hasOwn(authorities, series.provider) && authorities[series.provider];
    let url;
    try { url = new URL(series.url); } catch { throw Error('URL oficial inválida.'); }
    if (!official || url.protocol !== 'https:' || !official.hosts.includes(url.hostname) || url.username || url.password || url.port ||
        !text(series.authorization) || !text(series.definition) || !text(series.coverage) ||
        !instant(series.retrievedAt) || !Array.isArray(series.records)) {
      throw Error('Faltan datos válidos de procedencia o autorización.');
    }
    if (kind === 'world' && (series.provider !== 'fr24' || !['tracked', 'commercial'].includes(series.category))) {
      throw Error('El total mundial requiere una serie diaria de Flightradar24 y su categoría.');
    }
    return { id: kind === 'world' ? 'fr24:' + series.category : series.provider + ':routes',
      name: official.name, url: url.href, definition: series.definition, coverage: series.coverage,
      retrievedAt: instant(series.retrievedAt), authorization: series.authorization,
      expiresAt: series.provider === 'fr24' ? new Date(Date.parse(series.retrievedAt) + 30 * 86400000).toISOString() : null };
  }

  function imported(payload, flights, time, now = Date.now) {
    if (payload?.version !== 1) throw Error('El archivo debe usar el formato de importación versión 1.');
    const world = provenance(payload.world, 'world'), routes = provenance(payload.routes, 'routes');
    if (!world && !routes) throw Error('El archivo debe incluir una serie mundial o una muestra de rutas.');
    const airports = { ...flights.airports }, anchors = { ...flights.anchors };
    for (const [id, values] of Object.entries(payload.airports ?? {})) {
      if (Object.hasOwn(airports, id)) continue;
      if (!/^[A-Z]{4}$/.test(id) || !Array.isArray(values) || values.length !== 6) throw Error('Aeropuerto adicional inválido.');
      const [code, city, country, lat, lon, name] = values;
      if (!/^(?:[A-Z]{3})?$/.test(code) || !text(city) || !/^[A-Z]{2}$/.test(country) ||
          !text(name) || !Number.isFinite(lat) || !Number.isFinite(lon)) throw Error('Ficha de aeropuerto inválida.');
      const airport = { id, code, city, cityId: country + ':' + city, country, lat, lon, name, level: 'airport' };
      anchors[id] = flights.plotAnchor(airport);
      airports[id] = airport;
    }
    const worldByDay = new Map(), uniqueFlights = new Map(), routeByDay = new Map(), excluded = new Map();
    for (const row of payload.world?.records ?? []) {
      const [periodStart, periodEnd] = flights.dayBounds(row.dateUtc);
      const updatedAt = row.updatedAt == null ? world.retrievedAt : instant(row.updatedAt);
      if (!Number.isSafeInteger(row.flightCount) || row.flightCount < 0 || !text(row.recordId) || !updatedAt || !['complete','partial'].includes(row.coverageStatus))
        throw Error('Hay un total diario inválido.');
      const prior = worldByDay.get(row.dateUtc);
      if (prior?.updatedAt === updatedAt && (prior.flightCount !== row.flightCount || prior.coverageStatus !== row.coverageStatus))
        throw Error('Dos totales distintos tienen la misma fecha de actualización.');
      if (!prior || prior.updatedAt <= updatedAt) worldByDay.set(row.dateUtc, {
        recordId: row.recordId, periodType: 'day', periodStart, periodEnd, flightCount: row.flightCount,
        sourceId: world.id, updatedAt, coverageStatus: row.coverageStatus
      });
    }
    for (const row of payload.routes?.records ?? []) {
      const stamp = instant(row.departureUtc);
      if (!text(row.recordId) || !stamp) throw Error('Cada vuelo necesita un identificador y una salida UTC válida.');
      const prior = uniqueFlights.get(row.recordId);
      const candidate = { stamp, origin: row.originId, destination: row.destinationId };
      if (prior && JSON.stringify(prior) !== JSON.stringify(candidate)) throw Error('Un vuelo repetido tiene campos contradictorios.');
      uniqueFlights.set(row.recordId, candidate);
    }
    for (const { stamp, origin, destination } of uniqueFlights.values()) {
      const day = stamp.slice(0, 10);
      if (origin === destination || !Object.hasOwn(airports, origin) || !Object.hasOwn(airports, destination)) {
        excluded.set(day, (excluded.get(day) ?? 0) + 1);
        continue;
      }
      addRoute(day, origin, destination, 1);
    }

    if (payload.routes?.daily) {
      if (uniqueFlights.size) throw Error('Usa registros individuales o agregados, en series separadas.');
      for (const [day, rows] of Object.entries(payload.routes.daily)) {
        if (!Array.isArray(rows)) throw Error('Agregado diario inválido.');
        for (const row of rows) {
          if (!Array.isArray(row) || row.length !== 3) throw Error('Agregado de ruta inválido.');
          const [origin, destination, count] = row;
          const pair = origin + destination;
          if (!Number.isSafeInteger(count) || count <= 0 || origin === destination ||
              !Object.hasOwn(airports, origin) || !Object.hasOwn(airports, destination) ||
              routeByDay.get(day)?.has(pair)) throw Error('Agregado de ruta inválido o duplicado.');
          addRoute(day, origin, destination, count);
        }
      }
    }

    function addRoute(day, origin, destination, count) {
      const pair = origin + destination;
      if (!routeByDay.has(day)) {
        flights.dayBounds(day);
        routeByDay.set(day, new Map());
      }
      const dayRows = routeByDay.get(day);
      const total = (dayRows.get(pair) ?? 0) + count;
      if (!Number.isSafeInteger(total)) throw Error('Recuento de ruta fuera de rango.');
      dayRows.set(pair, total);
    }
    const destinations = new Set(), origins = new Set();
    const timeline = [...routeByDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, rows]) => {
      let count = 0;
      for (const [pair, volume] of rows) {
        origins.add(pair.slice(0, 4));
        destinations.add(pair.slice(4));
        count += volume;
      }
      return [day, count];
    });
    const destinationIds = [...destinations], originIds = [...origins];
    const active = source => source && (!source.expiresAt || Date.parse(source.expiresAt) > now());
    const within = (day, period) => {
      const stamp = Date.parse(day + 'T00:00:00Z');
      return period.type !== 'hour' && stamp >= Date.parse(period.start) && stamp < Date.parse(period.end);
    };
    return {
      world, routes, airports, anchors,
      get timeline() {
        return active(routes) ? timeline : [];
      },
      get expired() { return Boolean((world && !active(world)) || (routes && !active(routes))); },
      get dates() {
        return [...new Set([...(active(world) ? worldByDay.keys() : []), ...(active(routes) ? routeByDay.keys() : [])])].sort();
      },
      get destinationIds() { return active(routes) ? destinationIds : []; },
      get originIds() { return active(routes) ? originIds : []; },
      hours: () => [],
      async read(period) {
        const totals = active(world) ? [...worldByDay].filter(([day]) => within(day, period)).map(([, row]) => row) : [];
        const volumes = new Map();
        let routeSlots = 0;
        if (active(routes)) {
          for (const [day, rows] of routeByDay) {
            if (!within(day, period)) continue;
            routeSlots++;
            for (const [pair, volume] of rows) volumes.set(pair, (volumes.get(pair) ?? 0) + volume);
          }
        }
        const sample = Array.from(volumes, ([pair, flightCount]) => {
          const originId = pair.slice(0, 4), destinationId = pair.slice(4);
          return { routeId: [routes.id, originId, destinationId].map(encodeURIComponent).join(':'),
            sourceId: routes.id, sourceName: routes.name, originId, destinationId,
            endpointStatus: routes.id === 'opensky:routes' ? 'Aeropuertos estimados por OpenSky' : '',
            periodStart: period.start, periodEnd: period.end, periodType: 'day', periodLabel: period.label,
            coverageStatus: 'sample', coverageLabel: routes.coverage, flightCount };
        });
        const summary = time.aggregate(period, totals, [], { worldSource: world?.id, routeSource: routes?.id });
        const partialDays = totals.filter(row => row.coverageStatus === 'partial').length;
        return { ...summary, routes: sample, routeSlots, coverage: partialDays ? 'partial' : summary.coverage, partialDays,
          status: 'observed', provenance: { world, routes }, expired: this.expired,
          excluded: active(routes) ? [...excluded].filter(([day]) => within(day, period)).reduce((sum, [, value]) => sum + value, 0) : 0 };
      }
    };
  }

  function unavailable(time) {
    return { dates: [], hours: () => [], async read(period) {
      return { ...time.aggregate(period, [], [], {}), status: 'unavailable', provenance: {}, excluded: 0 };
    } };
  }

  return { imported, unavailable };
})();

if (typeof module !== 'undefined') module.exports = LoomProviders;
