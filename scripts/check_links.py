#!/usr/bin/env python3
"""Check that every dataset URL and DOI still resolves.

Prints a Markdown report; exits 1 if anything is broken (used by the monthly
link-check workflow to open an issue).
"""
from __future__ import annotations

import concurrent.futures as cf
import sys

import requests

from catalogue import dataset_files, load_entry

HEADERS = {"User-Agent": "sleep-datasets-link-check/1.0 (+https://github.com)"}


def check(url: str) -> tuple[str, str | None]:
    try:
        r = requests.head(url, headers=HEADERS, allow_redirects=True, timeout=30)
        if r.status_code in (403, 405, 501) or r.status_code >= 500:
            r = requests.get(url, headers=HEADERS, allow_redirects=True, timeout=30, stream=True)
        if r.status_code >= 400:
            return url, f"HTTP {r.status_code}"
        return url, None
    except requests.RequestException as exc:
        return url, type(exc).__name__


def main() -> int:
    targets = []
    for path in dataset_files():
        e = load_entry(path)
        if e.get("url"):
            targets.append((e["id"], "url", e["url"]))
        if e.get("doi"):
            targets.append((e["id"], "doi", f"https://doi.org/{e['doi']}"))

    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        results = dict(pool.map(lambda t: check(t[2]), targets))

    broken = [(i, kind, u, results[u]) for i, kind, u in targets if results.get(u)]
    if not broken:
        print(f"All {len(targets)} links OK.")
        return 0
    print(f"{len(broken)} of {len(targets)} links failed:\n")
    print("| Dataset | Field | URL | Problem |\n|---|---|---|---|")
    for i, kind, u, err in broken:
        print(f"| `{i}` | {kind} | {u} | {err} |")
    return 1


if __name__ == "__main__":
    sys.exit(main())
