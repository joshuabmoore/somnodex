#!/usr/bin/env python3
"""Validate dataset and pipeline YAML files.

Usage:
    python scripts/validate.py              # all files in datasets/ and pipelines/
    python scripts/validate.py FILE [...]   # specific files (plus duplicate checks against the rest)
"""
from __future__ import annotations

import sys
from pathlib import Path

from catalogue import dataset_files, pipeline_files, validate_entries, validate_pipelines


def main(argv: list[str]) -> int:
    all_datasets, all_pipelines = dataset_files(), pipeline_files()
    targets = [Path(a).resolve() for a in argv] if argv else all_datasets + all_pipelines
    # Always validate the full set so duplicate and cross-reference checks see
    # everything, but only report errors for the targeted files when files are given.
    pipeline_targets = {t for t in targets if t.parent.name == "pipelines"}
    entries, errors = validate_entries(sorted(set(all_datasets) | (set(targets) - pipeline_targets)))
    datasets = {e["id"]: e for e in entries if isinstance(e.get("id"), str)}
    _, pipeline_errors = validate_pipelines(sorted(set(all_pipelines) | pipeline_targets), datasets)
    errors += pipeline_errors
    if argv:
        names = {str(t.name) for t in targets}
        errors = [e for e in errors if e.split(":", 1)[0].split("/")[-1] in names]

    if errors:
        print(f"✗ {len(errors)} problem(s):")
        for e in errors:
            print(f"  - {e}")
        return 1
    n_pipe = sum(1 for t in targets if t.parent.name == "pipelines")
    print(f"✓ {len(targets) - n_pipe} dataset file(s) and {n_pipe} pipeline file(s) valid")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
