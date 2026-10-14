#!/usr/bin/env python3
"""Convert an "Add a dataset" GitHub issue form body into datasets/<id>.yaml.

Usage:
    python scripts/issue_to_yaml.py BODY_FILE [--issue-number N] [--force]

Writes `path=...` and `id=...` to $GITHUB_OUTPUT when running in Actions.
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import sys
from pathlib import Path

import yaml

from catalogue import DATASETS_DIR, slugify

NO_RESPONSE = {"", "_no response_", "none", "n/a", "na", "-"}


def parse_sections(body: str) -> dict[str, str]:
    """Split an issue-form body into {heading: value}."""
    sections, current, buf = {}, None, []
    for line in body.replace("\r\n", "\n").split("\n"):
        m = re.match(r"^###\s+(.+?)\s*$", line)
        if m:
            if current is not None:
                sections[current] = "\n".join(buf).strip()
            current, buf = m.group(1).strip().lower(), []
        elif current is not None:
            buf.append(line)
    if current is not None:
        sections[current] = "\n".join(buf).strip()
    return {k: ("" if v.strip().lower() in NO_RESPONSE else v.strip()) for k, v in sections.items()}


def as_list(value: str) -> list[str]:
    return [p.strip() for p in re.split(r"[,;\n]", value) if p.strip()]


def as_slug_list(value: str) -> list[str]:
    seen = []
    for item in as_list(value):
        s = slugify(item)
        if s and s not in seen:
            seen.append(s)
    return seen


def as_int(value: str):
    v = value.replace(",", "").replace("~", "").strip()
    return int(float(v)) if re.fullmatch(r"\d+(\.\d+)?", v) else None


def as_number(value: str):
    v = value.replace(",", "").strip()
    if re.fullmatch(r"\d+(\.\d+)?", v):
        f = float(v)
        return int(f) if f.is_integer() else f
    return None


def as_age_range(value: str):
    nums = re.findall(r"\d+(?:\.\d+)?", value)
    if len(nums) >= 2:
        lo, hi = (as_number(n) for n in nums[:2])
        return [lo, hi]
    return None


def as_sampling(value: str):
    nums = [as_number(n) for n in re.findall(r"\d+(?:\.\d+)?", value)]
    nums = [n for n in nums if n]
    if not nums:
        return None
    return nums[0] if len(nums) == 1 else nums


STAGING_MAP = {"aasm": "aasm", "r&k": "rk", "rk": "rk", "rechtschaffen": "rk",
               "both": "both", "other": "other", "none": "none", "no": "none"}


def build_entry(s: dict[str, str]) -> dict:
    g = lambda key: s.get(key, "")
    name = g("dataset name")
    if not name or not g("url"):
        raise ValueError("Issue is missing the required 'Dataset name' or 'URL' fields.")

    short = g("short name")
    entry: dict = {
        "id": slugify(short or name),
        "name": name,
        "short_name": short or None,
        "description": g("description") or None,
        "url": g("url"),
        "doi": re.sub(r"^(https?://(dx\.)?doi\.org/|doi:\s*)", "", g("doi"), flags=re.I) or None,
        "host": g("host") or "Unknown",
        "access": (g("access") or "open").split()[0].lower(),
        "license": g("license") or None,
        "year_released": as_int(g("year released")) if g("year released") else None,
    }

    cit = g("citation")
    if cit:
        doi_m = re.search(r"(10\.\d{4,9}/[^\s,;]+)", cit)
        c = {"text": " ".join(cit.split())}
        if doi_m:
            c["doi"] = doi_m.group(1).rstrip(".")
        entry["citations"] = [c]

    entry["population"] = {
        "species": "human",
        "n_subjects": as_int(g("number of subjects")) if g("number of subjects") else None,
        "n_recordings": as_int(g("number of recordings")) if g("number of recordings") else None,
        "age_range": as_age_range(g("age range")) if g("age range") else None,
        "groups": as_slug_list(g("population groups")) or None,
    }
    entry["recording"] = {
        "type": as_slug_list(g("recording type")) or None,
        "setting": as_slug_list(g("setting")) or None,
        "modalities": as_slug_list(g("modalities")),
        "eeg_channels": as_int(g("eeg channels")) if g("eeg channels") else None,
        "eeg_montage": g("eeg montage") or None,
        "sampling_rate_hz": as_sampling(g("eeg sampling rate (hz)")) if g("eeg sampling rate (hz)") else None,
    }
    staging = STAGING_MAP.get(g("sleep staging").lower().split(" ")[0], None) if g("sleep staging") else None
    entry["annotations"] = {
        "staging": staging,
        "epoch_s": as_number(g("epoch length (s)")) if g("epoch length (s)") else None,
        "events": as_slug_list(g("annotated events")) or None,
    }
    entry["formats"] = [slugify(f) if f.lower() != "edf+" else "edf+" for f in as_list(g("file formats"))] or None
    entry["tags"] = as_slug_list(g("tags")) or None
    entry["verified"] = False
    today = dt.date.today().isoformat()
    entry["date_added"] = today
    entry["last_checked"] = today
    entry["notes"] = g("notes") or None
    return prune(entry)


def prune(obj):
    if isinstance(obj, dict):
        out = {k: prune(v) for k, v in obj.items()}
        return {k: v for k, v in out.items() if v not in (None, "", [], {})}
    if isinstance(obj, list):
        return [prune(v) for v in obj]
    return obj


class _Dumper(yaml.SafeDumper):
    pass


def _str_rep(dumper, data):
    style = ">" if len(data) > 80 else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style=style)


def _list_rep(dumper, data):
    flow = all(isinstance(x, (str, int, float)) for x in data)
    return dumper.represent_sequence("tag:yaml.org,2002:seq", data, flow_style=flow)


_Dumper.add_representer(str, _str_rep)
_Dumper.add_representer(list, _list_rep)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("body_file")
    ap.add_argument("--issue-number")
    ap.add_argument("--force", action="store_true", help="overwrite an existing file")
    args = ap.parse_args()

    body = Path(args.body_file).read_text(encoding="utf-8")
    try:
        entry = build_entry(parse_sections(body))
    except ValueError as exc:
        print(f"✗ {exc}")
        return 1

    path = DATASETS_DIR / f"{entry['id']}.yaml"
    if path.exists() and not args.force:
        print(f"✗ {path.name} already exists. Edit that file instead, or choose a different short name.")
        return 1

    header = f"# Added from issue #{args.issue_number}\n" if args.issue_number else ""
    path.write_text(header + yaml.dump(entry, Dumper=_Dumper, sort_keys=False, allow_unicode=True, width=80),
                    encoding="utf-8")
    print(f"✓ Wrote {path}")

    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as f:
            f.write(f"path=datasets/{path.name}\nid={entry['id']}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
