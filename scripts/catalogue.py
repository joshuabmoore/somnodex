"""Shared helpers: load, normalise and validate dataset and pipeline entries."""
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
PIPELINES_DIR = ROOT / "pipelines"
PIPELINE_SCHEMA_PATH = ROOT / "schema" / "pipeline.schema.json"


def _normalise(obj):
    """YAML parses bare dates into date objects; the schema expects ISO strings."""
    if isinstance(obj, (dt.date, dt.datetime)):
        return obj.isoformat()[:10]
    if isinstance(obj, dict):
        return {k: _normalise(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_normalise(v) for v in obj]
    return obj


def load_schema(path: Path = SCHEMA_PATH) -> dict:
    return json.loads(path.read_text())


def load_entry(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return _normalise(data or {})


def dataset_files(directory: Path = DATASETS_DIR) -> list[Path]:
    return sorted(p for p in directory.glob("*.y*ml") if p.suffix in {".yaml", ".yml"})


def pipeline_files() -> list[Path]:
    return dataset_files(PIPELINES_DIR)


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


def validate_pipelines(paths: list[Path], datasets: dict[str, dict]) -> tuple[list[dict], list[str]]:
    """Validate pipeline entries against their schema, each other, and the datasets they reference.

    `datasets` maps dataset id -> dataset entry.
    """
    validator = Draft202012Validator(load_schema(PIPELINE_SCHEMA_PATH), format_checker=FormatChecker())
    entries, errors = [], []
    seen_ids, seen_keys, seen_sources, seen_subsets = {}, {}, {}, {}

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
        if eid in seen_ids:
            errors.append(f"{rel}: duplicate id (also in {seen_ids[eid]})")
        elif eid:
            seen_ids[eid] = rel

        ds = entry.get("dataset")
        if ds and ds not in datasets:
            errors.append(f"{rel}: dataset: '{ds}' is not an id in datasets/")

        # A subset can't be bigger than the dataset it comes from.
        subset = entry.get("subset") or {}
        pop = (datasets.get(ds) or {}).get("population") or {}
        for field in ("n_subjects", "n_recordings"):
            n, total = subset.get(field), pop.get(field)
            if isinstance(n, int) and isinstance(total, int) and n > total:
                errors.append(f"{rel}: subset/{field}: {n} exceeds the dataset's {field} ({total})")

        # A subset name means the same thing everywhere, so it belongs to one dataset.
        sname = subset.get("name")
        if sname and ds:
            if sname in seen_subsets and seen_subsets[sname][0] != ds:
                other_ds, other_rel = seen_subsets[sname]
                errors.append(f"{rel}: subset/name '{sname}' is used for dataset '{other_ds}' in {other_rel}")
            else:
                seen_subsets.setdefault(sname, (ds, rel))

        # The same source applied to the same subset of the same dataset should be one file.
        src = entry.get("source") or {}
        src_key = (src.get("doi") or "").lower() or _norm_url(src.get("url")) or (src.get("title") or "").lower()
        key = (src_key, ds, (entry.get("subset") or {}).get("name"))
        if src_key and key in seen_keys:
            errors.append(f"{rel}: same source, dataset and subset as {seen_keys[key]}")
        elif src_key:
            seen_keys[key] = rel

        # Files describing the same source (one per dataset) must describe it the same way.
        if src_key:
            if src_key in seen_sources:
                other_src, other_rel = seen_sources[src_key]
                for field in ("type", "title", "short_name", "authors", "year", "venue", "doi"):
                    a, b = _norm_text(src.get(field)), _norm_text(other_src.get(field))
                    if a is not None and b is not None and a != b:
                        errors.append(f"{rel}: source/{field} differs from {other_rel} for the same source")
            else:
                seen_sources[src_key] = (src, rel)

        for name, step in (entry.get("steps") or {}).items():
            if not isinstance(step, dict):
                continue
            params = set(step) - {"status", "source", "discrepancy", "notes"}
            if step.get("status") in {"none", "not_reported"} and params:
                errors.append(f"{rel}: steps/{name}: status '{step['status']}' but has parameters {sorted(params)}")

        entries.append(entry)

    by_id = {e["id"]: e for e in entries if isinstance(e.get("id"), str)}
    for e in entries:
        parent = e.get("based_on")
        if not parent:
            continue
        if parent not in by_id:
            errors.append(f"pipelines/{e.get('id')}.yaml: based_on: '{parent}' is not a pipeline id")
            continue
        chain, cur = [e["id"]], parent
        while cur in by_id:
            if cur in chain:
                errors.append(f"pipelines/{e['id']}.yaml: based_on cycle: {' -> '.join(chain + [cur])}")
                break
            chain.append(cur)
            cur = by_id[cur].get("based_on")
    return entries, errors


def _norm_text(value):
    return " ".join(value.split()) if isinstance(value, str) else value


def _norm_url(url):
    if not isinstance(url, str):
        return None
    return re.sub(r"^https?://(www\.)?", "", url.strip().lower()).rstrip("/")


def slugify(text: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return re.sub(r"-{2,}", "-", text)
