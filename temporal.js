'use strict';

const LoomTime = (() => {
  const DAY = 86400000, HOUR = DAY / 24;
  const dateFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' });
  const key = date => date.toISOString().slice(0, 10);

  function interval(type, day, hour = 0) {
    const from = new Date(day + 'T00:00:00Z');
    if (!Number.isFinite(+from) || key(from) !== day || from.getUTCFullYear() < 1 ||
        !['hour','day','week','month','year'].includes(type)) throw new RangeError('Periodo UTC inválido');
    if (type === 'hour') {
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('Hora UTC inválida');
      from.setUTCHours(hour);
    }
    if (type === 'week') from.setUTCDate(from.getUTCDate() - (from.getUTCDay() + 6) % 7);
    if (type === 'month' || type === 'year') from.setUTCDate(1);
    if (type === 'year') from.setUTCMonth(0);
    const to = new Date(from);
    if (type === 'month') to.setUTCMonth(to.getUTCMonth() + 1);
    else if (type === 'year') to.setUTCFullYear(to.getUTCFullYear() + 1);
    else to.setTime(+from + (type === 'hour' ? HOUR : type === 'week' ? 7 * DAY : DAY));
    const start = from.toISOString(), end = to.toISOString();
    return { id: [type, start, end].join('/'), type, start, end, anchorDay: day,
      days: (+to - +from) / DAY, label: type === 'hour'
        ? `${dateFormat.format(from)} · ${start.slice(11,16)}–${end.slice(11,16)} UTC`
        : type === 'day' ? dateFormat.format(from) + ' UTC'
          : `${dateFormat.format(from)} – ${dateFormat.format(new Date(+to - DAY))} UTC` };
  }

  function aggregate(period, records, routeRecords, { worldSource, routeSource }) {
    const precision = period.type === 'hour' ? 'hour' : 'day';
    const contains = record => record.periodType === precision &&
      Date.parse(record.periodStart) >= Date.parse(period.start) &&
      Date.parse(record.periodEnd) <= Date.parse(period.end) &&
      Date.parse(record.periodEnd) - Date.parse(record.periodStart) === (precision === 'hour' ? HOUR : DAY) &&
      Date.parse(record.periodStart) % (precision === 'hour' ? HOUR : DAY) === 0 &&
      Number.isSafeInteger(record.flightCount) && record.flightCount >= 0;
    const world = new Map(), uniqueRoutes = new Map(), routes = new Map();
    for (const record of records) {
      if (record.sourceId === worldSource && contains(record)) world.set(Date.parse(record.periodStart), record.flightCount);
    }
    for (const record of routeRecords) {
      if (record.sourceId === routeSource && contains(record)) {
        uniqueRoutes.set(JSON.stringify([Date.parse(record.periodStart), record.originId, record.destinationId]), record);
      }
    }
    for (const record of uniqueRoutes.values()) {
      const previous = routes.get(record.routeId);
      routes.set(record.routeId, { ...record, periodStart: period.start, periodEnd: period.end,
        flightCount: (previous?.flightCount ?? 0) + record.flightCount, periodLabel: period.label });
    }
    const slots = precision === 'hour' ? 1 : period.days;
    const count = world.size;
    const total = count ? [...world.values()].reduce((sum, value) => sum + value, 0) : null;
    const average = count && precision === 'day' ? total / count : null;
    const routeSlots = new Set([...uniqueRoutes.values()].map(record => Date.parse(record.periodStart))).size;
    return { period, total, average, count, slots, routeSlots, routes: [...routes.values()],
      worldSource, routeSource, coverage: count === slots ? 'complete' : count ? 'partial' : 'missing' };
  }

  function demoSource(flights) {
    return {
      dates: flights.days, hours: () => [],
      live: { status: 'disconnected', lastUpdated: null, cadenceMs: null, lagMs: null, coverage: null, error: null },
      async read(period, activity) {
        const datasets = period.type === 'hour' ? [] : flights.days
          .filter(day => {
            const stamp = Date.parse(day + 'T00:00:00Z');
            return stamp >= Date.parse(period.start) && stamp < Date.parse(period.end);
          })
          .map(day => flights.getDemo(day, activity));
        return aggregate(period, datasets.map(({ daily, metadata }) => ({
          ...daily, periodType: 'day', periodStart: metadata.periodStart, periodEnd: metadata.periodEnd
        })), datasets.flatMap(({ routes }) => routes.map(route => ({ ...route, periodType: 'day' }))),
        { worldSource: 'sim-world-v1', routeSource: 'sim-routes-v1' });
      }
    };
  }

  function cache(source, limit = 12) {
    const entries = new Map();
    return {
      read(period, scenario) {
        const id = JSON.stringify([source.cacheKey?.(period) ?? period.id, scenario]);
        if (!entries.has(id)) {
          const pending = Promise.resolve().then(() => source.read(period, scenario)).catch(error => {
            if (entries.get(id) === pending) entries.delete(id);
            throw error;
          });
          entries.set(id, pending);
          if (entries.size > limit) entries.delete(entries.keys().next().value);
        }
        return entries.get(id);
      },
      invalidate() { entries.clear(); }
    };
  }

  function compare(a, b) {
    if (!a || !b) return null;
    const hourly = a.period.type === 'hour' || b.period.type === 'hour';
    if (hourly && a.period.type !== b.period.type) return null;
    const left = hourly ? a.total : a.average;
    const right = hourly ? b.total : b.average;
    if (left === null || right === null || a.worldSource !== b.worldSource) return null;
    const difference = right - left;
    return { difference, percent: left > 0 ? difference / left * 100 : null };
  }

  function sharedScale(a, b) {
    const volume = result => result.routes.reduce((sum, route) => sum + route.flightCount, 0);
    return Math.max(1, Math.ceil(Math.max(volume(a), volume(b)) / 100));
  }

  return { interval, aggregate, demoSource, cache, compare, sharedScale };
})();

if (typeof module !== 'undefined') module.exports = LoomTime;
