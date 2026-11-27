#!/usr/bin/env python3
"""Audit ADSB.lol readsb traces and export directional daily aggregate routes."""

import argparse
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
import gzip
import json
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
import re
import tarfile

LICENSE = "https://opendatacommons.org/licenses/odbl/1-0/"
SOURCE = "https://www.adsb.lol/docs/open-data/historical"


def airport_catalog(directory):
    airports = {}
    for month in json.loads((directory / "history.json").read_text())["months"]:
        if month["month"] <= "2021-12":
            airports.update(json.loads((directory / month["file"]).read_text()).get("airports", {}))
    return airports


def index_airports(airports):
    cells = defaultdict(list)
    for code, (_, _, _, lat, lon, _) in airports.items():
        cells[int(lat // 1)].append((code, lat, lon))
    return cells


def ground_airport(point, cells):
    _, lat, lon = point[:3]
    possible = []
    for cell in range(int(lat // 1) - 1, int(lat // 1) + 2):
        for code, a, b in cells[cell]:
            if abs(lat - a) > .019:
                continue
            h = sin(radians(lat - a) / 2) ** 2 + cos(radians(lat)) * cos(radians(a)) * sin(radians(lon - b) / 2) ** 2
            distance = 12742 * asin(min(1, sqrt(h)))
            if distance <= 2:
                possible.append(code)
    return possible[0] if len(possible) == 1 else None


def observed_segments(points, cells, audit):
    before = None
    active = None
    last = None
    for point in points:
        if len(point) < 4 or not all(isinstance(v, (float, int)) for v in point[:3]):
            continue
        stamp, lat, lon, altitude = point[:4]
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        if last is not None:
            if stamp <= last:
                audit["unordered_or_repeated_points"] += 1
                continue
            if stamp - last > 600:
                if active is not None:
                    audit["coverage_gap"] += 1
                active = before = None
        last = stamp
        if altitude == "ground":
            if active is not None:
                start, origin, peak, samples = active
                destination = ground_airport(point, cells)
                if stamp - start < 240 or peak < 1500 or samples < 5:
                    audit["insufficient_airborne_evidence"] += 1
                elif not origin or not destination:
                    audit["unidentified_or_ambiguous_airport"] += 1
                elif origin == destination:
                    audit["same_airport"] += 1
                else:
                    yield start, stamp, origin, destination
                active = None
            before = point
        elif isinstance(altitude, (int, float)):
            if active is None:
                origin = ground_airport(before, cells) if before is not None and altitude <= 3500 else None
                active = (stamp, origin, altitude, 1)
            else:
                start, origin, peak, samples = active
                active = (start, origin, max(peak, altitude), samples + 1)
            before = None
    if active is not None:
        audit["no_observed_landing"] += 1


def scan(archive, day, cells, audit, prefix):
    daily = Counter()
    aircraft = set()
    ids = set()
    with tarfile.open(archive) as tar:
        while True:
            try:
                member = tar.next()
                if member is None:
                    break
                if not member.isfile() or not re.search(r"/trace_full_[^/]+\.json(?:\.gz)?$", member.name):
                    continue
                raw = tar.extractfile(member).read()
                if len(raw) != member.size:
                    raise tarfile.ReadError("Traza truncada")
            except (tarfile.ReadError, OSError):
                if not prefix:
                    raise
                audit["truncated_prefix"] += 1
                break
            trace = json.loads(gzip.decompress(raw) if raw.startswith(b"\x1f\x8b") else raw)
            audit["traces"] += 1
            plane = trace.get("icao")
            if not plane or plane in aircraft:
                audit["duplicate_or_missing_aircraft"] += 1
                continue
            aircraft.add(plane)
            for start, end, origin, destination in observed_segments(trace["trace"], cells, audit):
                departure = trace["timestamp"] + start
                arrival = trace["timestamp"] + end
                if any(datetime.fromtimestamp(stamp, timezone.utc).date() != day for stamp in (departure, arrival)):
                    audit["outside_utc_day"] += 1
                    continue
                key = (plane, departure)
                if key in ids:
                    audit["duplicate_flights"] += 1
                    continue
                ids.add(key)
                daily[origin, destination] += 1
    return daily


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("day", type=date.fromisoformat)
    parser.add_argument("--prefix", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.prefix and args.output:
        parser.error("Una muestra truncada no es publicable")
    airports = airport_catalog(Path(__file__).resolve().parents[1] / "data")
    audit = Counter()
    daily = scan(args.archive, args.day, index_airports(airports), audit, args.prefix)
    print(json.dumps({"date": str(args.day), "bytes": args.archive.stat().st_size,
                      "flights": sum(daily.values()), "routes": len(daily),
                      "airports": len({code for pair in daily for code in pair}),
                      "countries": len({airports[code][2] for pair in daily for code in pair}),
                      "audit": dict(audit)}, indent=2))
    if args.output and daily:
        used = {code for route in daily for code in route}
        payload = {"version": 1, "airports": {code: airports[code] for code in sorted(used)}, "routes": {
            "provider": "adsblol", "url": SOURCE, "authorization": "ADSB.lol · base derivada ODbL 1.0 · " + LICENSE,
            "definition": "Trayectos ADS-B reconstruidos con ambos extremos observados en tierra y un aeropuerto inequívoco.",
            "coverage": "Muestra ADSB.lol · archivo prod-0 · excluye trayectos incompletos, sin extremos verificables o entre días UTC.",
            "retrievedAt": datetime.fromtimestamp(args.archive.stat().st_mtime, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "records": [], "daily": {str(args.day): [[a, b, daily[a, b]] for a, b in sorted(daily)]}}}
        args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
