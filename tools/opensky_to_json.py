#!/usr/bin/env python3
"""Convert the CC BY OpenSky v21.12 CSV export into Phase 9 route JSON."""
import argparse
from collections import Counter
import csv
from datetime import date, datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

PROJECT = Path(__file__).resolve().parents[1]
MAX_BYTES = 16 * 1024 * 1024
SOURCE = "https://opensky-network.org/data/scientific"
CREDIT = ("CC BY 4.0 · Xavier Olive, Martin Strohmeier y Jannis Lübbe; The OpenSky Network · "
          "https://doi.org/10.5281/zenodo.5815448 · https://creativecommons.org/licenses/by/4.0/ · "
          "Adaptación: selección, deduplicación y conversión a JSON.")

def catalog():
    return set(json.loads(subprocess.check_output(
        ["node", "-e", "console.log(JSON.stringify(Object.keys(require('./flights.js').airports)))"],
        cwd=PROJECT, text=True)))

def utc(value):
    value = value.strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})?", value):
        raise ValueError("Se esperaba una fecha con hora ISO 8601")
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)  # The source documents firstseen as UTC.
    stamp = stamp.astimezone(timezone.utc)
    if stamp.microsecond % 1000:
        raise ValueError("Precisión no compatible con el importador")
    return stamp

def convert(args, known):
    start, end = args.start, args.end
    airports = set(args.airports)
    if start > end:
        raise ValueError("La fecha inicial debe ser anterior o igual a la final.")
    unknown = airports - known
    if unknown:
        raise ValueError("Aeropuertos del filtro fuera del catálogo: " + ", ".join(sorted(unknown)))
    monthly = re.fullmatch(r"flightlist_(\d{8})_(\d{8})\.csv(?:\.gz)?", args.csv.name)
    if monthly:
        first, last = (datetime.strptime(value, "%Y%m%d").date() for value in monthly.groups())
        if start < first or end > last:
            raise ValueError(f"El nombre del archivo indica el intervalo {first} a {last}.")
    if args.csv.resolve() == args.output.resolve():
        raise ValueError("El archivo de salida debe ser distinto del CSV.")
    retrieved = utc(args.retrieved_at).isoformat(timespec="seconds").replace("+00:00", "Z")
    coverage = (f"Muestra OpenSky v21.12; {start} a {end} inclusive por firstseen UTC. "
                f"Filtro ICAO: {', '.join(sorted(airports)) or 'todo el catálogo local'}. "
                f"Máximo {args.limit}; hasta {args.per_day} por día. Aeropuertos estimados; "
                "solo extremos del catálogo. Archivo agrupado por última observación; cobertura parcial.")
    metadata = dict(provider="opensky", url=SOURCE, authorization=CREDIT,
                    definition="Vuelos reconstruidos de OpenSky. departureUtc conserva firstseen "
                               "(primera observación UTC), sin indicar hora de despegue confirmada.",
                    coverage=coverage, retrievedAt=retrieved)
    header = '{"version":1,"routes":' + json.dumps(metadata, ensure_ascii=False)[:-1] + ',"records":[\n'
    footer = "\n]}}\n"
    counters, missing, days, endpoints, routes = (Counter() for _ in range(5))
    for name in ("leidos", "aceptados", "firstseen_invalido", "fuera_de_fechas", "fuera_del_filtro",
                 "extremos_no_utilizables", "sin_identificador", "duplicados", "fuera_del_cupo"):
        counters[name] = 0
    seen = {}
    opener = gzip.open if args.csv.suffix == ".gz" else open
    written = len((header + footer).encode())
    output = args.output
    tmp = None
    try:
        with opener(args.csv, "rt", encoding="utf-8-sig", newline="") as source, \
                tempfile.NamedTemporaryFile(mode="wb", dir=output.parent, delete=False) as destination:
            tmp = Path(destination.name)
            reader = csv.DictReader(source)
            required = {"aircraft_uid", "firstseen", "origin", "destination"}
            if not required.issubset(reader.fieldnames or []):
                raise ValueError("Faltan columnas OpenSky CC BY: " + ", ".join(sorted(required - set(reader.fieldnames or []))))
            destination.write(header.encode())
            for row in reader:
                counters["leidos"] += 1
                try:
                    stamp = utc(row["firstseen"] or "")
                except ValueError:
                    counters["firstseen_invalido"] += 1
                    continue
                if not start <= stamp.date() <= end:
                    counters["fuera_de_fechas"] += 1
                    continue
                origin, target = ((row[name] or "").strip().upper() for name in ("origin", "destination"))
                if airports and airports.isdisjoint((origin, target)):
                    counters["fuera_del_filtro"] += 1
                    continue
                outside = {code for code in (origin, target) if code and code not in known}
                missing.update(outside)
                if not origin or not target or origin == target or outside:
                    counters["extremos_no_utilizables"] += 1
                    continue
                uid = (row["aircraft_uid"] or "").strip()
                if not uid:
                    counters["sin_identificador"] += 1
                    continue
                ts = stamp.isoformat(timespec="milliseconds" if stamp.microsecond else "seconds").replace("+00:00", "Z")
                record_id = "opensky-5815448-" + hashlib.sha256(f"{uid}\0{ts}".encode()).hexdigest()[:32]
                previous = seen.get(record_id)
                if previous is not None:
                    if previous != (origin, target):
                        raise ValueError(f"Extremos contradictorios para {record_id}. Revisa el extracto.")
                    counters["duplicados"] += 1
                    continue
                if counters["aceptados"] >= args.limit or days[stamp.date().isoformat()] >= args.per_day:
                    counters["fuera_del_cupo"] += 1
                    continue
                entry = dict(recordId=record_id, departureUtc=ts, originId=origin, destinationId=target)
                row_bytes = ((",\n" if counters["aceptados"] else "") + json.dumps(entry, separators=(",", ":"))).encode()
                if written + len(row_bytes) > MAX_BYTES:
                    raise ValueError("La salida excedería 16 MiB. Baja --limit o separa el intervalo por fechas sin solapamiento.")
                destination.write(row_bytes)
                written += len(row_bytes)
                seen[record_id] = (origin, target)
                counters["aceptados"] += 1
                days[stamp.date().isoformat()] += 1
                endpoints.update(code for code in (origin, target) if code in airports)
                routes[f"{origin} → {target}"] += 1
            if not counters["aceptados"]:
                raise ValueError("No se encontraron vuelos utilizables. Resumen: " + json.dumps(dict(counters)) +
                                 ". ICAO fuera del catálogo: " + json.dumps(dict(missing.most_common())))
            destination.write(footer.encode())
        tmp.replace(output)
    finally:
        if tmp is not None:
            tmp.unlink(missing_ok=True)
    return {"archivo": str(output), "bytes": written, "conteos": dict(counters),
            "por_fecha_utc": dict(sorted(days.items())), "extremos_filtrados": dict(endpoints),
            "rutas": dict(routes.most_common()), "icao_fuera_del_catalogo": dict(missing.most_common())}

def positive(value):
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError("debe ser un entero positivo")
    return number

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path, help="CSV o CSV.GZ de la edición CC BY 4.0")
    parser.add_argument("--start", type=date.fromisoformat, required=True)
    parser.add_argument("--end", type=date.fromisoformat, required=True)
    parser.add_argument("--airports", nargs="+", type=str.upper, default=[], metavar="ICAO")
    parser.add_argument("--limit", type=positive, default=1000)
    parser.add_argument("--per-day", type=positive, default=1000)
    parser.add_argument("--retrieved-at", required=True, help="Fecha y hora de obtención real (UTC)")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        report = convert(args, catalog())
    except (OSError, ValueError, csv.Error, EOFError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Error: {error}\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
