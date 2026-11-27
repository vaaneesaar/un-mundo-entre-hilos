'use strict';

const LoomHistory = (() => {
  const publication = month => month >= '2019-01' && month <= '2021-12' ? 'OpenSky'
    : month >= '2022-01' && month <= '2026-09' ? 'OPDI' : null;
  const labels = {
    available: 'Disponible',
    pending: 'Publicado por OpenSky · mes aún no descargado',
    separate: 'Publicado por OPDI · serie independiente sin cargar',
    unpublished: 'Sin datos publicados en las fuentes revisadas'
  };

  function create(index, load, flights, time) {
    if (index.version !== 1 || !Array.isArray(index.months) || !index.months.length)
      throw Error('Índice histórico inválido.');
    const months = new Map(), counts = new Map();
    for (const entry of index.months) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(entry.month) || publication(entry.month) !== 'OpenSky' ||
          months.has(entry.month) || !/^opensky-[a-z0-9-]+\.json$/.test(entry.file) ||
          !/^flightlist_\d{8}_\d{8}\.csv\.gz$/.test(entry.original) ||
          !/^[a-f0-9]{32}$/.test(entry.md5) || !Array.isArray(entry.days) || !entry.days.length)
        throw Error('Entrada mensual inválida.');
      for (const [day, count] of entry.days) {
        flights.dayBounds(day);
        if (day.slice(0, 7) !== entry.month || !Number.isSafeInteger(count) || count <= 0 || counts.has(day))
          throw Error('Índice diario inválido.');
        counts.set(day, count);
      }
      months.set(entry.month, entry);
    }
    const timeline = [...counts].sort(([a], [b]) => a.localeCompare(b));
    const cache = new Map();
    const airports = { ...flights.airports }, anchors = { ...flights.anchors };
    async function monthSource(entry) {
      const { month, file } = entry;
      if (cache.has(month)) {
        const hit = cache.get(month);
        cache.delete(month);
        cache.set(month, hit);
        return hit;
      }
      const pending = Promise.resolve().then(() => load(file)).then(source => {
        if (source.routes?.id !== 'opensky:routes' || source.world ||
            JSON.stringify(source.timeline) !== JSON.stringify(entry.days)) throw Error('El agregado no coincide con el índice.');
        for (const id of Object.keys(source.airports)) {
          if (!Object.hasOwn(airports, id)) {
            airports[id] = source.airports[id];
            anchors[id] = source.anchors[id];
          } else if (JSON.stringify(anchors[id]) !== JSON.stringify(source.anchors[id])) {
            throw Error('El histórico contiene coordenadas incompatibles para ' + id);
          }
        }
        return source;
      }).catch(error => {
        if (cache.get(month) === pending) cache.delete(month);
        throw error;
      });
      cache.set(month, pending);
      if (cache.size > 3) cache.delete(cache.keys().next().value);
      return pending;
    }

    function status(month) {
      return months.has(month) ? 'available' : publication(month) === 'OpenSky' ? 'pending'
        : publication(month) === 'OPDI' ? 'separate' : 'unpublished';
    }

    return {
      historical: true, timeline, dates: timeline.map(([day]) => day), airports, anchors,
      status, label: month => labels[status(month)],
      hours: () => [],
      async read(period) {
        const start = Date.parse(period.start), end = Date.parse(period.end);
        const chosen = period.type === 'hour' ? [] : [...months.values()].filter(entry => {
          const bounds = time.interval('month', entry.month + '-01');
          return Date.parse(bounds.start) < end && Date.parse(bounds.end) > start;
        });
        const routes = new Map(), destinationIds = new Set(), originIds = new Set();
        let routeSlots = 0, provenance;
        for (const entry of chosen) {
          const source = await monthSource(entry);
          const result = await source.read(period);
          routeSlots += result.routeSlots;
          provenance ??= source.routes;
          for (const route of result.routes) {
            originIds.add(route.originId);
            destinationIds.add(route.destinationId);
            const old = routes.get(route.routeId);
            if (old) old.flightCount += route.flightCount;
            else routes.set(route.routeId, { ...route,
              coverageLabel: 'OpenSky v21.12 · muestra ADS-B con aeropuertos estimados' });
          }
        }
        return { ...time.aggregate(period, [], [], {}), routes: [...routes.values()], routeSlots,
          routeSource: 'opensky:routes', provenance: { routes: provenance }, status: 'observed',
          sourceFiles: chosen, destinationIds: [...destinationIds], originIds: [...originIds] };
      }
    };
  }

  return { create, publication };
})();

if (typeof module !== 'undefined') module.exports = LoomHistory;
