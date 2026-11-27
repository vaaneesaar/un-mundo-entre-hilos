'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const providers = require('../providers.js');
const flights = require('../flights.js');
const time = require('../temporal.js');

async function indexMonth(args) {
  const [month, aggregate, original, expected] = args;
  if (!/^20(19|20|21)-(0[1-9]|1[0-2])$/.test(month) || !/^[a-f0-9]{32}$/.test(expected) ||
      !path.basename(original).startsWith('flightlist_' + month.replace('-', '')))
    throw Error('Uso: node tools/index_history.cjs AAAA-MM AGREGADO.json ORIGINAL.csv.gz MD5_DE_PUBLICACIÓN');
  const hash = crypto.createHash('md5');
  for await (const chunk of fs.createReadStream(original)) hash.update(chunk);
  if (hash.digest('hex') !== expected) throw Error('El original no coincide con el MD5 publicado.');
  const file = path.basename(aggregate);
  const directory = path.resolve(__dirname, '../data');
  if (path.dirname(path.resolve(aggregate)) !== directory || !/^opensky-[a-z0-9-]+\.json$/.test(file))
    throw Error('Coloca el agregado OpenSky en data/ con un nombre válido.');
  const source = providers.imported(JSON.parse(fs.readFileSync(aggregate, 'utf8')), flights, time);
  if (source.routes?.id !== 'opensky:routes' || source.world || !source.timeline.length ||
      source.timeline.some(([day]) => !day.startsWith(month + '-')))
    throw Error('El agregado debe contener solo rutas OpenSky del mes indicado.');
  const manifest = path.join(directory, 'history.json');
  const index = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : { version: 1, months: [] };
  const entry = { month, file, original: path.basename(original), md5: expected, days: source.timeline };
  index.months = [...index.months.filter(row => row.month !== month), entry].sort((a, b) => a.month.localeCompare(b.month));
  fs.writeFileSync(manifest + '.tmp', JSON.stringify(index, null, 2) + '\n');
  fs.renameSync(manifest + '.tmp', manifest);
  const result = await source.read(time.interval('month', month + '-01'));
  const countries = new Set(source.destinationIds.map(id => source.airports[id].country));
  console.log(JSON.stringify({ month, flights: result.routes.reduce((n, r) => n + r.flightCount, 0),
    countries: countries.size, days: source.timeline.length, routes: result.routes.length }));
}

indexMonth(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
