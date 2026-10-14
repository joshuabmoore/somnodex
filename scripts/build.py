#!/usr/bin/env python3
"""Build the static site and data exports.

Outputs (in _site/):
    index.html, app.js, style.css   copied from site/
    data/datasets.json              all entries + summary stats
    data/datasets.csv               flat table for spreadsheets / pandas

Also refreshes the summary table in README.md between the CATALOGUE markers.

Usage:
    python scripts/build.py [--out _site] [--no-readme]
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
import shutil
import sys
from collections import Counter
from pathlib import Path

from catalogue import ROOT, dataset_files, validate_entries

SITE_SRC = ROOT / "site"
README = ROOT / "README.md"

STAGING_LABEL = {"aasm": "AASM", "rk": "R&K", "both": "AASM + R&K", "other": "other", "none": "none"}

CSV_COLUMNS = [
    "id", "name", "short_name", "host", "access", "license", "url", "doi", "year_released",
    "n_subjects", "n_recordings", "total_hours", "age_min", "age_max", "groups",
    "type", "setting", "modalities", "eeg_channels", "eeg_montage", "sampling_rate_hz",
    "staging", "epoch_s", "n_scorers", "events", "formats", "size_gb", "tags",
    "verified", "date_added", "last_checked",
]


def flatten(e: dict) -> dict:
    pop, rec, ann = e.get("population") or {}, e.get("recording") or {}, e.get("annotations") or {}
    age = pop.get("age_range") or [None, None]
    join = lambda xs: "; ".join(str(x) for x in xs) if isinstance(xs, list) else (xs if xs is not None else "")
    return {
        "id": e.get("id"), "name": e.get("name"), "short_name": e.get("short_name", ""),
        "host": e.get("host"), "access": e.get("access"), "license": e.get("license", ""),
        "url": e.get("url"), "doi": e.get("doi", ""), "year_released": e.get("year_released", ""),
        "n_subjects": pop.get("n_subjects", ""), "n_recordings": pop.get("n_recordings", ""),
        "total_hours": pop.get("total_hours", ""), "age_min": age[0] if age[0] is not None else "",
        "age_max": age[1] if age[1] is not None else "", "groups": join(pop.get("groups", [])),
        "type": join(rec.get("type", [])), "setting": join(rec.get("setting", [])),
        "modalities": join(rec.get("modalities", [])), "eeg_channels": rec.get("eeg_channels", ""),
        "eeg_montage": rec.get("eeg_montage", ""), "sampling_rate_hz": join(rec.get("sampling_rate_hz", "")),
        "staging": ann.get("staging", ""), "epoch_s": ann.get("epoch_s", ""),
        "n_scorers": ann.get("n_scorers", ""), "events": join(ann.get("events", [])),
        "formats": join(e.get("formats", [])), "size_gb": e.get("size_gb", ""),
        "tags": join(e.get("tags", [])), "verified": bool(e.get("verified", False)),
        "date_added": e.get("date_added", ""), "last_checked": e.get("last_checked", ""),
    }


def summarise(entries: list[dict]) -> dict:
    def count(get):
        c = Counter()
        for e in entries:
            for v in get(e) or []:
                c[v] += 1
        return dict(c.most_common())

    pop = lambda e: e.get("population") or {}
    return {
        "n_datasets": len(entries),
        "n_subjects": sum(pop(e).get("n_subjects") or 0 for e in entries),
        "n_recordings": sum(pop(e).get("n_recordings") or 0 for e in entries),
        "n_verified": sum(1 for e in entries if e.get("verified")),
        "by_access": count(lambda e: [e.get("access")]),
        "by_host": count(lambda e: [e.get("host")]),
        "by_modality": count(lambda e: (e.get("recording") or {}).get("modalities")),
        "by_group": count(lambda e: pop(e).get("groups")),
        "by_staging": count(lambda e: [(e.get("annotations") or {}).get("staging") or "unknown"]),
        "by_tag": count(lambda e: e.get("tags")),
    }


def readme_table(entries: list[dict]) -> str:
    rows = ["| Dataset | Host | Access | Subjects | Recordings | Modalities | Staging |",
            "|---|---|---|---:|---:|---|---|"]
    for e in entries:
        pop, rec, ann = e.get("population") or {}, e.get("recording") or {}, e.get("annotations") or {}
        name = e.get("short_name") or e["name"]
        fmt = lambda n: f"{n:,}" if isinstance(n, int) else "–"
        rows.append(
            f"| [{name}]({e['url']}) | {e['host']} | {e['access']} | {fmt(pop.get('n_subjects'))} | "
            f"{fmt(pop.get('n_recordings'))} | {', '.join(rec.get('modalities', []))} | "
            f"{STAGING_LABEL.get(ann.get('staging'), '–')} |"
        )
    return "\n".join(rows)


def update_readme(entries: list[dict]) -> None:
    if not README.exists():
        return
    text = README.read_text(encoding="utf-8")
    pattern = re.compile(r"(<!-- CATALOGUE:START -->).*?(<!-- CATALOGUE:END -->)", re.S)
    if not pattern.search(text):
        return
    new = pattern.sub(lambda m: f"{m.group(1)}\n{readme_table(entries)}\n{m.group(2)}", text)
    if new != text:
        README.write_text(new, encoding="utf-8")
        print("  updated README.md table")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "_site"))
    ap.add_argument("--no-readme", action="store_true")
    args = ap.parse_args()

    entries, errors = validate_entries(dataset_files())
    if errors:
        print("✗ Validation failed; run scripts/validate.py for details:")
        for err in errors:
            print(f"  - {err}")
        return 1

    entries.sort(key=lambda e: (e.get("short_name") or e["name"]).lower())
    out = Path(args.out)
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(SITE_SRC, out)
    (out / "data").mkdir(exist_ok=True)

    payload = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "stats": summarise(entries),
        "datasets": entries,
    }
    (out / "data" / "datasets.json").write_text(json.dumps(payload, indent=1, ensure_ascii=False), encoding="utf-8")
    with (out / "data" / "datasets.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        w.writeheader()
        w.writerows(flatten(e) for e in entries)
    (out / ".nojekyll").touch()

    if not args.no_readme:
        update_readme(entries)
    print(f"✓ Built {len(entries)} dataset(s) into {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
