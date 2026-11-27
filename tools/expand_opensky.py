#!/usr/bin/env python3
"""Download, verify and index up to three months of OpenSky v21.12 per run."""
import argparse
import hashlib
import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from build_international_sample import build, read_airports

ROOT = Path(__file__).resolve().parents[1]
RECORD = "https://zenodo.org"
DOI = "10.5281/zenodo.5815448"
ARCHIVE = ROOT / "data" / "history.json"


def digest(path, algorithm="md5"):
    with path.open("rb") as stream:
        result = hashlib.new(algorithm)
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def fetch(url, output, *options):
    subprocess.run(["curl", "--fail", "--location", "--silent", "--show-error",
                    "--connect-timeout", "20", "--max-time", "360",
                    *options, "--output", str(output), url], check=True)


def verified_original(cache, item, allow_download):
    filename = item["key"]
    expected = item["checksum"].removeprefix("md5:")
    path = cache / filename
    if not re.fullmatch("[a-f0-9]{32}", expected):
        raise ValueError("El archivo carece de un MD5 publicado: " + filename)
    if path.is_file():
        if path.stat().st_size == item["size"] and digest(path) == expected:
            return path, expected
        raise ValueError("El original en caché no coincide con Zenodo: " + str(path))
    if not allow_download:
        raise ValueError("Original ausente. Usa --download para obtener " + filename)
    temp = path.with_suffix(".gz.part")
    url = f"{RECORD}/records/5815448/files/{quote(filename)}"
    last_error = None
    for query in ["?download=1", "?download=1&source=telar", "?download=1&source=archive"]:
        try:
            size = temp.stat().st_size if temp.is_file() else 0
            if size != item["size"]:
                options = ("--continue-at", "-") if 0 < size < item["size"] else ()
                fetch(url + query, temp, *options)
            if temp.stat().st_size != item["size"] or digest(temp) != expected:
                raise ValueError("Tamaño o MD5 distinto del publicado: " + filename)
            temp.replace(path)
            return path, expected
        except ValueError as error:
            last_error = error
            temp.unlink(missing_ok=True)
        except subprocess.CalledProcessError as error:
            last_error = error
            if error.returncode == 33:  # El servidor rechazó la solicitud parcial.
                temp.unlink(missing_ok=True)
    raise last_error


def integrate(month, verified, args, catalog_sha256, airports):
    original, checksum = verified
    output = ROOT / "data" / f"opensky-{month}.json"
    args.output = None
    args.csv = original
    args.retrieved_at = datetime.fromtimestamp(original.stat().st_mtime, timezone.utc).isoformat(timespec="seconds")
    audit, payload = build(args, airport_catalog=airports, return_payload=True)
    indexed = {entry["month"]: entry for entry in json.loads(ARCHIVE.read_text())["months"]}
    known_airports = {}
    for entry in indexed.values():
        data = json.loads((ROOT / "data" / entry["file"]).read_text())
        known_airports.update(data.get("airports", {}))
    for code, row in payload["airports"].items():
        if code in known_airports and row[2:5] != known_airports[code][2:5]:
            raise ValueError(f"{code}: el catálogo difiere del histórico; usa la misma versión de OurAirports")
    temp = output.with_suffix(".json.tmp")
    try:
        temp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        temp.replace(output)
        summary = json.loads(subprocess.check_output(
            ["node", "tools/index_history.cjs", month, str(output), str(original), checksum],
            cwd=ROOT, text=True))
    except Exception:
        temp.unlink(missing_ok=True)
        if month not in indexed:
            output.unlink(missing_ok=True)
        raise
    summary.update({"original": original.name, "md5": checksum, "doi": DOI,
                    "ourairports_sha256": catalog_sha256, "bytes": output.stat().st_size,
                    "audit": audit})
    with (args.cache / "opensky-imports.jsonl").open("a", encoding="utf-8") as ledger:
        ledger.write(json.dumps(summary, ensure_ascii=False) + "\n")
    print(json.dumps(summary, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("months", nargs="*", metavar="YYYY-MM")
    parser.add_argument("--cache", type=Path, required=True, help="Directorio local para los originales")
    parser.add_argument("--airports", type=Path, required=True, help="CSV de OurAirports usado por el histórico")
    parser.add_argument("--metadata", type=Path, help="Copia local de la ficha API de Zenodo")
    parser.add_argument("--download", action="store_true", help="Permitir descargar únicamente los originales faltantes")
    args = parser.parse_args()
    if len(set(args.months)) != len(args.months) or len(args.months) > 3:
        parser.error("Indica hasta tres meses distintos por lote.")
    args.cache = args.cache.resolve()
    args.cache.mkdir(parents=True, exist_ok=True)
    metadata = args.metadata or args.cache / "zenodo-5815448.json"
    if args.metadata is None and not metadata.exists():
        fetch(RECORD + "/api/records/5815448", metadata)
    record = json.loads(metadata.read_text())
    if record["id"] != 5815448 or record["doi"] != DOI:
        raise ValueError("La ficha debe corresponder a la edición v21.12.")
    available = {}
    for item in record["files"]:
        match = re.fullmatch(r"flightlist_(20(?:19|20|21))(\d{2})\d{2}_\d{8}\.csv\.gz", item["key"])
        if match:
            available["-".join(match.groups())] = item
    indexed = {row["month"] for row in json.loads(ARCHIVE.read_text())["months"]}
    if not args.months:
        print("Integrados:", " ".join(sorted(indexed)))
        print("Pendientes:", " ".join(sorted(available.keys() - indexed)))
        return
    unknown = set(args.months) - available.keys()
    if unknown:
        parser.error("Meses ausentes de Zenodo: " + ", ".join(sorted(unknown)))
    airports = read_airports(args.airports)
    catalog_sha256 = digest(args.airports, "sha256")
    failed = []
    pending = sorted(set(args.months) - indexed)
    for month in sorted(set(args.months) & indexed):
        print(f"{month}: ya integrado. Se conserva.", flush=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        originals = {month: pool.submit(verified_original, args.cache, available[month], args.download)
                     for month in pending}
        for month, original in originals.items():
            try:
                integrate(month, original.result(), args, catalog_sha256, airports)
            except (OSError, ValueError, subprocess.CalledProcessError) as error:
                failed.append(month)
                print(f"{month}: {error}", flush=True)
    if failed:
        raise SystemExit("Meses pendientes del lote: " + ", ".join(failed))


if __name__ == "__main__":
    main()
