#!/usr/bin/env python3
"""Scaffold a new dataset file with every field stubbed out.

Usage:
    python scripts/new_dataset.py "Dataset Name" https://example.org/dataset [--short NAME]
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys

from catalogue import DATASETS_DIR, slugify

TEMPLATE = """\
id: {id}
name: {name}
short_name: {short}
description: >
  TODO
url: {url}
# doi: 10.xxxx/xxxxx
host: TODO            # PhysioNet, NSRR, OpenNeuro, Zenodo, figshare, OSF, ...
access: open          # open | registration | dua | on-request
# license: CC-BY-4.0
# year_released: 2024
citations:
  - text: TODO
    # doi: 10.xxxx/xxxxx
population:
  species: human
  # n_subjects: 0
  # n_recordings: 0
  # total_hours: 0
  # age_range: [18, 80]
  groups: []          # healthy, osa, insomnia, narcolepsy, rbd, paediatric, ...
recording:
  type: [psg]         # psg | hsat | eeg-headband | wearable | intracranial | scalp-eeg | other
  setting: [lab]      # lab | home | hospital | icu | ambulatory | other
  modalities: [eeg]   # eeg eog emg ecg respiratory spo2 ppg actigraphy accelerometry position temperature audio video ...
  # eeg_channels: 0
  # eeg_montage: C3-M2, C4-M1
  # sampling_rate_hz: 256
annotations:
  staging: aasm       # aasm | rk | both | other | none
  epoch_s: 30
  # n_scorers: 1
  events: []          # arousals, apneas, hypopneas, spindles, k-complexes, ...
formats: [edf]
tags: []
verified: false
date_added: {today}
last_checked: {today}
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("url")
    ap.add_argument("--short", default="")
    args = ap.parse_args()

    did = slugify(args.short or args.name)
    path = DATASETS_DIR / f"{did}.yaml"
    if path.exists():
        print(f"✗ {path} already exists")
        return 1
    path.write_text(TEMPLATE.format(id=did, name=args.name, short=args.short or args.name,
                                    url=args.url, today=dt.date.today().isoformat()))
    print(f"✓ Created {path} — fill in the TODOs, then run scripts/validate.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
