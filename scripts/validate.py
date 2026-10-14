#!/usr/bin/env python3
"""Validate dataset YAML files.

Usage:
    python scripts/validate.py              # all files in datasets/
    python scripts/validate.py FILE [...]   # specific files (plus duplicate checks against the rest)
"""
from __future__ import annotations

import sys
from pathlib import Path

from catalogue import dataset_files, validate_entries


def main(argv: list[str]) -> int:
    all_files = dataset_files()
    targets = [Path(a).resolve() for a in argv] if argv else all_files
    # Always validate the full set so duplicate checks see everything,
    # but only report errors for the targeted files when files are given.
    paths = sorted(set(all_files) | set(targets))
    entries, errors = validate_entries(paths)
    if argv:
        names = {str(t.name) for t in targets}
        errors = [e for e in errors if e.split(":", 1)[0].split("/")[-1] in names]

    if errors:
        print(f"✗ {len(errors)} problem(s):")
        for e in errors:
            print(f"  - {e}")
        return 1
    print(f"✓ {len(targets)} dataset file(s) valid")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
