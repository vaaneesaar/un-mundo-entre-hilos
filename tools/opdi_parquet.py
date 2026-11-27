#!/usr/bin/env python3
"""Audit OPDI Flight List locally. Export only with a documented authorization."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

from build_international_sample import read_airports
from opensky_to_json import catalog, MAX_BYTES, utc

def normalize_time(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
    return utc(value) if isinstance(value, str) else None

def run(args):
    import pyarrow.parquet as pq

    match = re.fullmatch(r"flight_list_(\d{4})(\d{2})\.parquet", args.parquet.name)
    if not match:
        raise ValueError("Nombre mensual de OPDI inválido")
    month = "-".join(match.groups())
    if args.output and not (args.authorization and args.retrieved_at):
        raise ValueError("La exportación requiere --authorization y --retrieved-at")
    base, reference = catalog(), read_airports(args.airports)
    source = pq.ParquetFile(args.parquet)
    fields = ["id", "dof", "first_seen", "adep", "ades", "version"]
    if not set(fields).issubset(source.schema_arrow.names):
        raise ValueError("Esquema no reconocido para OPDI Flight List")
    seen, airports, countries, pairs, versions = set(), set(), set(), set(), set()
    counters = Counter()
    daily = defaultdict(Counter)
    for batch in source.iter_batches(columns=fields, batch_size=32768):
        for row in batch.to_pylist():
            counters["filas"] += 1
            versions.add(row["version"])
            if row["id"] is None:
                counters["sin_id"] += 1
                continue
            if row["id"] in seen:
                counters["id_repetido"] += 1
                continue
            seen.add(row["id"])
            try:
                first, dof = normalize_time(row["first_seen"]), normalize_time(row["dof"])
            except ValueError:
                first = dof = None
            if not first or not dof or first.date() != dof.date() or first.strftime("%Y-%m") != month:
                counters["fecha_fuera_o_incompatible"] += 1
                continue
            origin, target = ((row[field] or "").strip().upper() for field in ("adep","ades"))
            if not origin or not target:
                counters["extremos_incompletos"] += 1
                continue
            if origin == target:
                counters["mismo_aeropuerto"] += 1
                continue
            if any(code not in base and code not in reference for code in (origin, target)):
                counters["fuera_del_catalogo"] += 1
                continue
            counters["validos"] += 1
            airports.update((origin, target))
            countries.update(reference[code][2] for code in (origin,target) if code in reference)
            pairs.add((origin, target))
            daily[first.date().isoformat()][(origin, target)] += 1
    if args.output:
        payload = {"version":1, "airports":{code:reference[code] for code in sorted(airports-base)},
                   "routes":{"provider":"opdi", "url":"https://www.opdi.aero/flight-list-data.html",
                             "authorization":args.authorization, "retrievedAt":utc(args.retrieved_at).isoformat().replace("+00:00","Z"),
                             "definition":"OPDI Flight List v0.0.2, ID mensual único y fecha UTC de primera observación, cotejada con DOF.",
                             "coverage":"Extracto OPDI con ADEP y ADES presentes y resolubles en OurAirports. Región europea y conexiones observadas. Serie independiente de OpenSky v21.12.",
                             "records":[], "daily":{day:[[a,b,n] for (a,b),n in sorted(rows.items())] for day,rows in sorted(daily.items())}}}
        data = json.dumps(payload, ensure_ascii=False, separators=(",",":")).encode()
        if len(data) > MAX_BYTES:
            raise ValueError("El agregado supera 16 MiB")
        args.output.write_bytes(data)
    with args.parquet.open("rb") as stream:
        checksum = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(chunk)
    print(json.dumps({"archivo":args.parquet.name,"bytes":args.parquet.stat().st_size,
                      "sha256":checksum.hexdigest(),"versiones":sorted(str(v) for v in versions),
                      "fechas":len(daily),"aeropuertos":len(airports),"paises_catalogados":len(countries),
                      "rutas":len(pairs),**counters}, indent=2))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("parquet", type=Path)
    parser.add_argument("airports", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--authorization")
    parser.add_argument("--retrieved-at")
    run(parser.parse_args())
