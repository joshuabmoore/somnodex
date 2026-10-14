"""Shared helpers: load, normalise and validate dataset entries."""
from __future__ import annotations

import datetime as dt
import json
import re
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent.parent
DATASETS_DIR = ROOT / "datasets"
SCHEMA_PATH = ROOT / "schema" / "dataset.schema.json"


def _normalise(obj):
    """YAML parses bare dates into date objects; the schema expects ISO strings."""
    if isinstance(obj, (dt.date, dt.datetime)):
        return obj.isoformat()[:10]
    if isinstance(obj, dict):
        return {k: _normalise(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_normalise(v) for v in obj]
    return obj


def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text())


def load_entry(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return _normalise(data or {})


def dataset_files(directory: Path = DATASETS_DIR) -> list[Path]:
    return sorted(p for p in directory.glob("*.y*ml") if p.suffix in {".yaml", ".yml"})


def validate_entries(paths: list[Path]) -> tuple[list[dict], list[str]]:
    """Validate entries against the schema plus cross-file checks.

    Returns (entries, errors). Entries are returned even if some are invalid so
    callers can decide what to do.
    """
    validator = Draft202012Validator(load_schema(), format_checker=FormatChecker())
    entries, errors = [], []
    seen_ids, seen_urls, seen_dois = {}, {}, {}

    for path in paths:
        rel = path.relative_to(ROOT) if path.is_relative_to(ROOT) else path
        try:
            entry = load_entry(path)
        except (yaml.YAMLError, ValueError) as exc:
            errors.append(f"{rel}: YAML parse error: {exc}")
            continue
        if not isinstance(entry, dict):
            errors.append(f"{rel}: top level must be a mapping")
            continue

        for err in sorted(validator.iter_errors(entry), key=lambda e: list(e.path)):
            loc = "/".join(str(p) for p in err.path) or "(root)"
            errors.append(f"{rel}: {loc}: {err.message}")

        eid = entry.get("id")
        if eid and eid != path.stem:
            errors.append(f"{rel}: id '{eid}' must match the file name '{path.stem}'")

        age = (entry.get("population") or {}).get("age_range")
        if isinstance(age, list) and len(age) == 2 and all(isinstance(a, (int, float)) for a in age):
            if age[0] > age[1]:
                errors.append(f"{rel}: population/age_range: min {age[0]} > max {age[1]}")

        pop = entry.get("population") or {}
        if pop.get("n_subjects") and pop.get("n_recordings") and pop["n_recordings"] < pop["n_subjects"]:
            errors.append(f"{rel}: population: n_recordings ({pop['n_recordings']}) < n_subjects ({pop['n_subjects']})")

        for key, seen, label in ((eid, seen_ids, "id"),
                                 (_norm_url(entry.get("url")), seen_urls, "url"),
                                 ((entry.get("doi") or "").lower() or None, seen_dois, "doi")):
            if key:
                if key in seen:
                    errors.append(f"{rel}: duplicate {label} (also in {seen[key]})")
                else:
                    seen[key] = rel

        entries.append(entry)
    return entries, errors


def _norm_url(url):
    if not isinstance(url, str):
        return None
    return re.sub(r"^https?://(www\.)?", "", url.strip().lower()).rstrip("/")


def slugify(text: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return re.sub(r"-{2,}", "-", text)
