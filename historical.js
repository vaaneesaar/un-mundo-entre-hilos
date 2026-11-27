'use strict';

const LoomHistory = (() => {
  const publication = month => month >= '2019-01' && month <= '2021-12' ? 'OpenSky'
    : month >= '2023-01' && month <= '2026-12' ? 'ADSB.lol' : null;
  const series = {
    OpenSky: { id: 'opensky:routes', file: /^opensky-[a-z0-9-]+\.json$/,
      original: /^flightlist_\d{8}_\d{8}\.csv\.gz$/, checksum: 'md5', hash: /^[a-f0-9]{32}$/,
      coverage: 'OpenSky v21.12 · muestra ADS-B con aeropuertos estimados' },
    'ADSB.lol': { id: 'adsblol:routes', file: /^adsblol-\d{4}-\d{2}\.json$/,
      checksum: 'sha256', hash: /^[a-f0-9]{64}$/ }
  };
  const providerAt = day => publication(day.slice(0, 7));
  const labels = {
    available: 'Disponible',
    pending: 'Publicado por OpenSky · mes aún no descargado',
    pendingAdsb: 'ADSB.lol · sin días validados para el Telar',
    unpublished: 'Sin datos habilitados para publicación'
  };

  function create(index, load, flights, time) {
    if (index.version !== 1 || !Array.isArray(index.months) || !index.months.length)
      throw Error('Índice histórico inválido.');
    const months = new Map(), counts = new Map();
    for (const entry of index.months) {
      const provider = publication(entry.month);
      const expected = series[provider];
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(entry.month) || !expected ||
          months.has(entry.month) || !expected.file.test(entry.file) ||
          !expected.hash.test(entry[expected.checksum]) || !Array.isArray(entry.days) || !entry.days.length ||
          (provider === 'OpenSky' ? !expected.original.test(entry.original)
            : entry.file !== 'adsblol-' + entry.month + '.json' || entry.license !== 'ODbL-1.0'))
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
        if (source.routes?.id !== series[publication(month)].id || source.world ||
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
        : publication(month) === 'ADSB.lol' ? 'pendingAdsb' : 'unpublished';
    }

    return {
      historical: true, providerAt,
      cacheKey: period => [period.id, providerAt(period.anchorDay ?? period.start)],
      timeline, dates: timeline.map(([day]) => day), airports, anchors,
      status, label: month => labels[status(month)],
      hours: () => [],
      async read(period) {
        const start = Date.parse(period.start), end = Date.parse(period.end);
        const expected = series[providerAt(period.anchorDay ?? period.start)];
        const chosen = !expected || period.type === 'hour' ? [] : [...months.values()].filter(entry => {
          if (series[publication(entry.month)] !== expected) return false;
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
              coverageLabel: expected.coverage ?? source.routes.coverage });
          }
        }
        return { ...time.aggregate(period, [], [], {}), routes: [...routes.values()], routeSlots,
          routeSource: provenance?.id, provenance: { routes: provenance }, status: 'observed',
          sourceFiles: chosen, destinationIds: [...destinationIds], originIds: [...originIds] };
      }
    };
  }

  return { create, publication };
})();

if (typeof module !== 'undefined') module.exports = LoomHistory;
