'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const providers = require('../providers.js');
const flights = require('../flights.js');
const time = require('../temporal.js');

const directory = path.resolve(__dirname, '../data');
const manifest = path.join(directory, 'history.json');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const index = read(manifest);
const [cache, ...days] = process.argv.slice(2);
if (!cache || !days.length) throw Error('Uso: node tools/index_adsb.cjs CACHÉ AAAA-MM-DD [...]');

const changes = new Map();
for (const day of new Set(days.sort())) {
  flights.dayBounds(day);
  const releaseDay = day.replaceAll('-', '.');
  const fromCache = suffix => read(path.join(cache, releaseDay + suffix + '.json'));
  const payload = fromCache('');
  const audit = fromCache('-audit');
  const release = fromCache('-release');
  const tag = 'v' + releaseDay + '-planes-readsb-prod-0';
  const expectedUrl = 'https://github.com/adsblol/globe_history_' + day.slice(0, 4) + '/releases/tag/' + tag;
  const routes = payload.routes.daily[day];
  const candidate = providers.imported(payload, flights, time);
  if (release.html_url !== expectedUrl || !release.body.includes('Open Database License') ||
      !release.assets.length || audit.date !== day || audit.bytes !== release.assets.reduce((sum, asset) => sum + asset.size, 0) ||
      candidate.world || candidate.routes.id !== 'adsblol:routes' || candidate.timeline.length !== 1 ||
      candidate.timeline[0][0] !== day || candidate.timeline[0][1] !== audit.flights || routes.length !== audit.routes ||
      audit.audit.truncated_prefix || audit.audit.duplicate_or_missing_aircraft || audit.audit.duplicate_flights)
    throw Error('Auditoría diaria no reconciliada: ' + day);

  const month = day.slice(0, 7);
  const file = 'adsblol-' + month + '.json';
  const original = index.months.find(row => row.month === month);
  if (!changes.has(month)) {
    const old = original && fs.readFileSync(path.join(directory, file), 'utf8');
    if (old && (original.file !== file || original.license !== 'ODbL-1.0' || hash(old) !== original.sha256))
      throw Error('El agregado publicado difiere de su manifiesto: ' + month);
    changes.set(month, {
      data: old ? JSON.parse(old) : { ...payload, airports: {}, routes: { ...payload.routes, daily: {} } },
      releases: original?.releases ?? (original ? Object.fromEntries(original.days.map(([date]) => [date, original.original])) : {})
    });
  }
  const { data, releases } = changes.get(month);
  const prior = data.routes.daily[day];
  if (prior && (JSON.stringify(prior) !== JSON.stringify(routes) || releases[day] !== expectedUrl))
    throw Error('El día ya publicado difiere de la auditoría: ' + day);
  releases[day] = expectedUrl;
  data.routes.daily[day] = routes;
  for (const [code, airport] of Object.entries(payload.airports)) {
    if (data.airports[code] && JSON.stringify(data.airports[code]) !== JSON.stringify(airport))
      throw Error('El aeropuerto difiere del agregado existente: ' + code);
    data.airports[code] = airport;
  }
  if (payload.routes.retrievedAt > data.routes.retrievedAt)
    data.routes.retrievedAt = payload.routes.retrievedAt;
  console.log(JSON.stringify({ day, bytes: audit.bytes, flights: audit.flights, routes: audit.routes,
    airports: Object.keys(payload.airports).length, traces: audit.audit.traces, release: expectedUrl }));
}

for (const [month, { data, releases }] of changes) {
  const sorted = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
  data.airports = sorted(data.airports);
  data.routes.daily = sorted(data.routes.daily);
  const content = JSON.stringify(data) + '\n';
  const file = 'adsblol-' + month + '.json';
  const source = providers.imported(data, flights, time);
  const entry = { month, file, license: 'ODbL-1.0', sha256: hash(content), releases: sorted(releases), days: source.timeline };
  index.months = [...index.months.filter(row => row.month !== month), entry].sort((a, b) => a.month.localeCompare(b.month));
  fs.writeFileSync(path.join(directory, file) + '.tmp', content);
}
fs.writeFileSync(manifest + '.tmp', JSON.stringify(index, null, 2) + '\n');
for (const month of changes.keys()) {
  const file = path.join(directory, 'adsblol-' + month + '.json');
  fs.renameSync(file + '.tmp', file);
}
fs.renameSync(manifest + '.tmp', manifest);
