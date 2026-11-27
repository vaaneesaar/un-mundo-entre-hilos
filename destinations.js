'use strict';

const LoomDestinations = (() => {
  const countryNames = new Intl.DisplayNames(['es-MX'], { type: 'region' });
  const typeNames = { country: 'País', city: 'Ciudad', airport: 'Aeropuerto' };
  const airportNames = {
    MMMX: ['MEX', 'Aeropuerto Internacional Benito Juárez'],
    KJFK: ['NYC', 'John F. Kennedy International Airport'],
    KMCO: ['ORL', 'Orlando International Airport'],
    EGLL: ['LON', 'Aeropuerto de Londres-Heathrow'],
    LFPG: ['PAR', 'Aeropuerto de París-Charles de Gaulle'],
    LEMD: ['MAD', 'Aeropuerto Adolfo Suárez Madrid-Barajas'],
    RJTT: ['TYO', 'Aeropuerto de Tokio-Haneda'],
    KLAX: ['LAX', 'Aeropuerto Internacional de Los Ángeles'],
    SBGR: ['SAO', 'Aeropuerto Internacional de São Paulo-Guarulhos']
  };

  function normalize(text) {
    return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  function buildCatalog(airports) {
    const places = new Map();
    for (const airport of Object.values(airports)) {
      const [cityCode, airportName] = airportNames[airport.id] ?? [];
      const country = countryNames.of(airport.country);
      const countryId = 'country:' + airport.country;
      const cityId = 'city:' + (cityCode ?? airport.cityId);
      const countryPlace = places.get(countryId) ?? {
        id: countryId, type: 'country', name: country, country, iso: airport.country, airportIds: [], cityIds: new Set()
      };
      const city = places.get(cityId) ?? {
        id: cityId, type: 'city', name: airport.city, country, iso: airport.country, airportIds: [],
        lat: airport.lat, lon: airport.lon
      };
      countryPlace.airportIds.push(airport.id);
      countryPlace.cityIds.add(cityId);
      city.airportIds.push(airport.id);
      places.set(countryId, countryPlace);
      places.set(cityId, city);
      places.set('airport:' + airport.id, {
        id: 'airport:' + airport.id, type: 'airport', name: airport.name ?? airportName ?? airport.city,
        city: airport.city, cityId, country, iso: airport.country, iata: airport.code, icao: airport.id,
        lat: airport.lat, lon: airport.lon, airportIds: [airport.id], availability: airport.availability ?? 'catalogued'
      });
    }
    return places;
  }

  function destinationCountries(catalog, airportIds) {
    const countries = new Set();
    for (const id of airportIds) {
      const airport = catalog.get('airport:' + id);
      if (airport) countries.add(catalog.get('country:' + airport.iso));
    }
    return [...countries].sort((a, b) => a.name.localeCompare(b.name, 'es-MX'));
  }

  function search(catalog, query, available = () => true) {
    const text = normalize(query);
    if (!text) return [];
    const tokens = text.split(' ');
    const results = [];
    for (const place of catalog.values()) {
      if (!available(place)) continue;
      const name = normalize(place.name);
      const tokensInPlace = normalize([place.name, place.city, place.country, place.iata, place.icao, place.iso].filter(Boolean).join(' '));
      if (!tokens.every(token => tokensInPlace.includes(token))) continue;
      const exactCode = [place.iata, place.icao, place.type === 'country' ? place.iso : null]
        .some(code => code && normalize(code) === text);
      const score = exactCode ? 0 : name === text ? 1 : name.startsWith(text) ? 2 : name.includes(text) ? 3 : 4;
      results.push({ place, score });
    }
    return results.sort((a, b) => a.score - b.score || a.place.name.localeCompare(b.place.name, 'es-MX') ||
      a.place.id.localeCompare(b.place.id)).slice(0, 12).map(result => result.place);
  }

  function connections(routes, destination, direction = 'both') {
    const airports = new Set(destination?.airportIds ?? []);
    const matched = new Map();
    const origins = new Map();
    const recordedAirports = new Set();
    let flightCount = 0;
    for (const route of routes) {
      if (route.flightCount <= 0 || matched.has(route.routeId)) continue;
      const inbound = direction !== 'departures' && airports.has(route.destinationId);
      const outbound = direction !== 'arrivals' && airports.has(route.originId);
      if (!inbound && !outbound) continue;
      matched.set(route.routeId, route);
      flightCount += route.flightCount;
      origins.set(route.originId, (origins.get(route.originId) ?? 0) + route.flightCount);
      if (inbound) recordedAirports.add(route.destinationId);
      if (outbound) recordedAirports.add(route.originId);
    }
    return { matched, flightCount, recordedAirports,
      origins: [...origins].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) };
  }

  function createState(day) {
    return { day, activity: 'medium', destinationId: null, direction: 'both', layer: 'all',
      routeId: null, fiberId: null, visualization: 'connections' };
  }

  function layerOpacity(mode, matched, structural) {
    if (mode === 'all' || matched) return 1;
    if (structural) return mode === 'isolate' ? .26 : .54;
    return mode === 'isolate' ? 0 : .16;
  }

  function layerPickable(mode, matched, structural) {
    return layerOpacity(mode, matched, structural) > 0 && !(mode === 'isolate' && structural);
  }

  function mountSearch(root, catalog, onSelect, available) {
    const input = root.querySelector('input');
    const list = root.querySelector('[role=listbox]');
    const clear = root.querySelector('[data-destination-clear]');
    const status = root.querySelector('[role=status]');
    let options = [], index = -1;

    function close() {
      index = -1;
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      if (options.length) status.textContent = '';
    }

    function show() {
      options = search(catalog, input.value, available);
      index = -1;
      input.removeAttribute('aria-activedescendant');
      if (!normalize(input.value)) {
        status.textContent = '';
        close();
        return;
      }

      list.replaceChildren(...options.map((place, position) => {
        const element = document.createElement('li');
        const title = document.createElement('strong');
        const detail = document.createElement('span');
        element.id = 'destination-option-' + position;
        element.dataset.index = position;
        element.setAttribute('role', 'option');
        element.setAttribute('aria-selected', 'false');
        title.textContent = place.name;
        detail.textContent = [typeNames[place.type], place.country,
          place.type === 'airport' ? [place.iata, place.icao].filter(Boolean).join(' / ') : place.iso
        ].filter(Boolean).join(' · ');
        element.append(title, detail);
        return element;
      }));
      status.textContent = options.length ? `${options.length} sugerencias` : 'Sin coincidencias en los destinos disponibles.';
      list.hidden = !options.length;
      input.setAttribute('aria-expanded', String(options.length > 0));
    }

    function activate(position) {
      index = position;
      [...list.children].forEach((item, i) => item.setAttribute('aria-selected', String(i === index)));
      const item = list.children[index];
      input.setAttribute('aria-activedescendant', item.id);
      item.scrollIntoView({ block: 'nearest' });
    }

    function setValue(place) {
      input.value = place?.name ?? '';
      clear.hidden = !place;
      status.textContent = '';
      close();
    }

    function choose(place) {
      setValue(place);
      onSelect(place);
    }

    input.addEventListener('input', () => {
      clear.hidden = !input.value;
      show();
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        status.textContent = '';
        close();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (list.hidden) show();
        if (list.hidden) return;
        event.preventDefault();
        const down = event.key === 'ArrowDown';
        activate(index < 0 ? (down ? 0 : options.length - 1) : (index + (down ? 1 : options.length - 1)) % options.length);
      } else if (event.key === 'Enter' && !list.hidden && index >= 0 && !event.isComposing) {
        event.preventDefault();
        choose(options[index]);
      }
    });
    list.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse') event.preventDefault();
    });
    list.addEventListener('click', event => {
      const option = event.target.closest('[data-index]');
      if (option) choose(options[Number(option.dataset.index)]);
    });
    clear.addEventListener('click', () => {
      choose(null);
      input.focus({ preventScroll: true });
    });
    root.addEventListener('focusout', event => {
      if (event.relatedTarget && !root.contains(event.relatedTarget)) close();
    });
    document.addEventListener('pointerdown', event => {
      if (!root.contains(event.target)) close();
    });

    return { setValue, close };
  }

  return { buildCatalog, normalize, search, destinationCountries, connections, typeNames, createState, layerOpacity, layerPickable, mountSearch };
})();

if (typeof module !== 'undefined') module.exports = LoomDestinations;
