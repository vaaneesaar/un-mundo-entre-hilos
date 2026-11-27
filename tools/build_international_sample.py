#!/usr/bin/env python3
"""Audit and aggregate the licensed OpenSky monthly CSV against OurAirports."""
import argparse
from collections import Counter, defaultdict
import csv
import gzip
import json
from pathlib import Path
import re
import subprocess

from opensky_to_json import CREDIT, MAX_BYTES, PROJECT, SOURCE, utc

def read_airports(path):
    by_code = {}
    ambiguous = set()
    with path.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            code = row["icao_code"].strip().upper()
            if not re.fullmatch("[A-Z]{4}", code) or not re.fullmatch("[A-Z]{2}", row["iso_country"]):
                continue
            lat, lon = float(row["latitude_deg"]), float(row["longitude_deg"])
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            entry = [row["iata_code"], row["municipality"] or row["name"], row["iso_country"], lat, lon, row["name"]]
            if code in by_code and entry != by_code[code]:
                ambiguous.add(code)
            by_code[code] = entry
    return {code: row for code, row in by_code.items() if code not in ambiguous}

def build(args):
    month = re.fullmatch(r"flightlist_(\d{4})(\d{2})\d{2}_\d{8}\.csv\.gz", args.csv.name)
    if not month:
        raise ValueError("Se requiere un archivo mensual oficial de OpenSky.")
    month = "-".join(month.groups())
    old = set(json.loads(subprocess.check_output(
        ["node", "-e", "console.log(JSON.stringify(Object.keys(require('./flights.js').airports)))"],
        cwd=PROJECT, text=True)))
    airports = read_airports(args.airports)
    audits = {"previo": Counter(), "ampliado": Counter()}
    missing = Counter()
    daily = defaultdict(Counter)
    seen = set()
    with gzip.open(args.csv, "rt", encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            try:
                stamp = utc(row["firstseen"])
            except ValueError:
                for audit in audits.values():
                    audit["primera_observacion_invalida"] += 1
                continue
            day = stamp.date().isoformat()
            origin, target = row["origin"].strip().upper(), row["destination"].strip().upper()
            uid = row["aircraft_uid"].strip()
            reason = ""
            if day[:7] != month:
                reason = "fuera_del_periodo"
            elif not origin and not target:
                reason = "ambos_desconocidos"
            elif not origin:
                reason = "origen_desconocido"
            elif not target:
                reason = "destino_desconocido"
            elif origin == target:
                reason = "mismo_aeropuerto"
            elif not uid:
                reason = "sin_identificador"
            if reason:
                for audit in audits.values():
                    audit[reason] += 1
                continue
            pair = (origin, target)
            old_missing = any(code not in old for code in pair)
            new_missing = any(code not in old and code not in airports for code in pair)
            if old_missing:
                audits["previo"]["fuera_del_catalogo"] += 1
            if new_missing:
                audits["ampliado"]["fuera_del_catalogo"] += 1
                missing.update(code for code in set(pair) if code not in old and code not in airports)
                continue
            identity = (uid, stamp.isoformat())
            if identity in seen:
                audits["ampliado"]["duplicados"] += 1
                if not old_missing:
                    audits["previo"]["duplicados"] += 1
                continue
            seen.add(identity)
            daily[day][pair] += 1
            audits["ampliado"]["vuelos"] += 1
            if not old_missing:
                audits["previo"]["vuelos"] += 1
    pairs = {pair for day in daily.values() for pair in day}
    codes = {code for pair in pairs for code in pair}
    payload = {
        "version": 1, "airports": {code: airports[code] for code in sorted(codes - old)},
        "routes": {
            "provider": "opensky", "url": SOURCE, "authorization": CREDIT,
            "definition": "Vuelos reconstruidos, agrupados por par direccional y día UTC de primera observación.",
            "coverage": f"OpenSky v21.12, {month}, pares con ICAO válido. Aeropuertos estimados y cobertura parcial ADS-B. Catálogo complementario OurAirports (dominio público).",
            "retrievedAt": utc(args.retrieved_at).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "records": [], "daily": {day: [[a, b, n] for (a,b),n in sorted(rows.items())] for day,rows in sorted(daily.items())}
        }
    }
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    if len(data) > MAX_BYTES:
        raise ValueError("El agregado mensual excede el límite de importación.")
    if args.output:
        args.output.write_bytes(data)
    return {**{name:dict(audit) for name,audit in audits.items()}, "aeropuertos":len(codes), "rutas":len(pairs),
            "paises_destino": len({airports[b][2] for _,b in pairs if b in airports}),
            "fechas":len(daily),"bytes":len(data),"sin_icao_frecuentes":missing.most_common(10)}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument("airports", type=Path)
    parser.add_argument("--retrieved-at", required=True)
    parser.add_argument("--output", type=Path)
    print(json.dumps(build(parser.parse_args()), ensure_ascii=False, indent=2))
