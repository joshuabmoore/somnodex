<p align="center">
  <img src="assets/somnodex-logo.svg" alt="SomnoDex logo" width="600">
</p>

<h1 align="center">SomnoDex</h1>

<p align="center"><em>A catalogue of open-access sleep datasets.</em></p>

Open-access sleep datasets are often scattered far and wide across a range of online resources, from the National Sleep Research Resource (NSRR) to PhysioNet, making it challenging for researchers to keep track of new additions to the sleep literature.
SomnoDex is a curated, searchable index of open-access sleep datasets: polysomnography, EEG, wearables and more. Each dataset is described with structured metadata (population, signals, annotations, access) so you can filter for exactly what your analysis needs.

<p align="center">
  <a href="https://joshuabmoore.github.io/somnodex"><img src="https://img.shields.io/badge/🔍_Browse-the_catalogue-4c8bf5?style=for-the-badge" alt="Browse"></a>
  <a href="https://joshuabmoore.github.io/somnodex/data/datasets.csv"><img src="https://img.shields.io/badge/⬇️_Download-CSV-2ea44f?style=for-the-badge" alt="Download CSV"></a>
  <a href="https://joshuabmoore.github.io/somnodex/data/datasets.json"><img src="https://img.shields.io/badge/⬇️_Download-JSON-2ea44f?style=for-the-badge" alt="Download JSON"></a>
  <a href="../../issues/new?template=add-dataset.yml"><img src="https://img.shields.io/badge/➕_Suggest-a_dataset-f39c12?style=for-the-badge" alt="Suggest a dataset"></a>
  <a href="https://doi.org/10.5281/zenodo.23382719"><img src="https://zenodo.org/badge/1419838765.svg" alt="DOI"></a>
</p>

## Catalogue

This table is regenerated from `datasets/` on every build.

<!-- CATALOGUE:START -->
| Dataset | Host | Access | Subjects | Recordings | Modalities | Staging |
|---|---|---|---:|---:|---|---|
| [ANPHY-Sleep](https://osf.io/r26fh/) | OSF | open | 28 | 28 | eeg, eog, emg, ecg | AASM |
| [BAI-Dementia](https://bdsp.io/content/v83ha57g3u22jz0eznrf/1.0.0/) | BDSP (AWS S3) | dua | 5,144 | – | eeg | AASM |
| [BOAS](https://openneuro.org/datasets/ds005555) | OpenNeuro | open | 100 | 128 | eeg, eog, emg, respiratory, spo2, ppg, accelerometry | AASM |
| [CAPSLPDB](https://physionet.org/content/capslpdb/) | PhysioNet | open | 108 | 108 | eeg, eog, emg, ecg, respiratory, spo2 | R&K |
| [DCSM](https://erda.ku.dk/public/archives/db553715ecbe1f3ac66c1dc569826eef/published-archive.html) | ERDA (University of Copenhagen) | open | – | 255 | eeg, eog, emg | AASM |
| [DOD](https://zenodo.org/records/15900394) | Zenodo | open | 80 | 81 | eeg, eog, emg, ecg | AASM |
| [DREAMS](https://zenodo.org/records/2650142) | Zenodo | open | 47 | 47 | eeg, eog, emg, ecg, respiratory | AASM + R&K |
| [HK1K](https://zenodo.org/records/17138539) | Zenodo | open | 1,032 | 1,032 | eeg, ecg | none |
| [HMC](https://physionet.org/content/hmc-sleep-staging/) | PhysioNet | open | 151 | 151 | eeg, eog, emg, ecg | AASM |
| [HSP](https://bdsp.io/content/hsp/3.0/) | BDSP (AWS S3) | dua | 90,166 | 119,234 | eeg, eog, emg, ecg, respiratory, spo2 | AASM |
| [ISRUC](https://sleeptight.isr.uc.pt/) | ISR, University of Coimbra | open | 118 | 126 | eeg, eog, emg, ecg, respiratory, spo2, position | AASM |
| [Luna/GRINS](https://sleepdata.org/datasets/luna-grins) | NSRR | dua | 20 | 20 | eeg | AASM |
| [MASS](http://ceams-carsm.ca/mass/) | Borealis (Canadian Dataverse), CÉAMS | dua | 200 | 200 | eeg, eog, emg, ecg, respiratory, spo2 | AASM + R&K |
| [MESA Sleep](https://sleepdata.org/datasets/mesa) | NSRR | dua | 2,056 | 2,056 | eeg, eog, emg, ecg, respiratory, spo2, ppg, position, actigraphy | AASM |
| [MNC](https://sleepdata.org/datasets/mnc) | NSRR | dua | – | – | eeg, eog, emg, ecg, respiratory, spo2, ppg, position | other |
| [PhysioNet 2018 Challenge](https://physionet.org/content/challenge-2018/) | PhysioNet | open | 1,983 | 1,983 | eeg, eog, emg, ecg, respiratory, spo2 | AASM |
| [REM temporal structure (Watson lab)](https://deepblue.lib.umich.edu/data/concern/data_sets/5h73pw60m) | Deep Blue Data (University of Michigan) | open | 9 | – | eeg, eog, ecg, respiratory, intracranial-eeg, video, other | AASM |
| [RichSleep](https://data.mendeley.com/datasets/35dp3db8yj/1) | Mendeley Data | open | 24 | 24 | eeg, eog, emg, ecg, respiratory, spo2, other | – |
| [SHHS](https://sleepdata.org/datasets/shhs) | NSRR | dua | 5,804 | 8,444 | eeg, eog, emg, ecg, respiratory, spo2, position | R&K |
| [Sleep-EDF](https://physionet.org/content/sleep-edfx/1.0.0/) | PhysioNet | open | 100 | 197 | eeg, eog, emg, respiratory, temperature | R&K |
| [Surrey cEEGrid](https://openneuro.org/datasets/ds005207) | OpenNeuro | open | 20 | 20 | eeg, eog, emg, ecg, actigraphy | AASM |
| [UESTC multi-night](https://osf.io/gx36m/) | OSF | open | 20 | 60 | eeg, eog, emg | AASM |
| [WSC](https://sleepdata.org/datasets/wsc) | NSRR | dua | 1,122 | 2,567 | eeg, eog, emg, ecg, respiratory, spo2 | R&K |
<!-- CATALOGUE:END -->

## How it works

```
datasets/*.yaml ──► scripts/validate.py ──► scripts/build.py ──► _site/ (GitHub Pages)
      ▲                 (JSON Schema)          index.html + data/datasets.{json,csv}
      │
 issue form ──► Action ──► pull request
```

- **One YAML file per dataset** in [`datasets/`](datasets). The file name must equal the `id`.
- **[`schema/dataset.schema.json`](schema/dataset.schema.json)** defines every field and its allowed values. CI rejects anything that doesn't conform, along with duplicate URLs or DOIs and inconsistent numbers.
- **The site** is a single static page that loads `data/datasets.json`. It supports full-text search, faceted filters (access, modality, host, population, staging, events, tags…), sortable columns, per-dataset detail views with citations, and a statistics tab that updates with the filters. Filter state lives in the URL, so any view can be shared.
- **`verified: false`** marks entries that haven't been checked against the source documentation yet; they show an *unverified* badge.

## Preprocessing pipelines

Papers preprocess the same dataset in very different ways, and those choices change the results. [`pipelines/`](pipelines) records how each paper, repo or toolbox prepared a dataset: one YAML file per (source × dataset) pair, with structured steps (channels, filtering, resampling, epoching, label mapping, wake trimming, normalisation, artefact rejection, exclusion, splits, class balancing). [`schema/pipeline.schema.json`](schema/pipeline.schema.json) defines the fields.

- Each step has a `status`: `done`, `none` (explicitly not done) or `not_reported` (the source is silent). A missing step means it hasn't been extracted yet.
- `source` on each step says where the value came from (paper section, code file); `discrepancy` records where the paper and code disagree.
- `based_on` points to another pipeline the source says it follows, so derived pipelines only record what differs.
- `dataset` must be an `id` in `datasets/`; CI checks this.

Build output includes `data/pipelines.json`.

## Adding a dataset

**From anywhere (phone included):** open the [Add a dataset](../../issues/new?template=add-dataset.yml) issue form. Only name, URL, access and modalities are required. An Action converts the issue into `datasets/<id>.yaml`, validates it, and opens a PR. Editing the issue updates the PR.

**Locally:**

```bash
pip install -r requirements.txt
python scripts/new_dataset.py "Montreal Archive of Sleep Studies" https://... --short MASS
# edit datasets/mass.yaml
python scripts/validate.py
python scripts/build.py && python -m http.server -d _site 8000   # preview at http://localhost:8000
```

## Using the catalogue in code

```python
import pandas as pd
df = pd.read_csv("https://joshuabmoore.github.io/somnodex/data/datasets.csv")
df[(df.access == "open") & df.modalities.str.contains("eeg") & (df.staging == "aasm")]
```

## Maintenance

- **Monthly link check:** a scheduled Action checks every URL and DOI and opens an issue listing any that fail.
- **`last_checked`:** bump this date when you re-verify an entry.

## Citing

See [`CITATION.cff`](CITATION.cff). Please also cite the original papers for any dataset you use; they're listed on each dataset's entry.

## Licence

Catalogue metadata: [CC BY 4.0](LICENSE-DATA). Code: [MIT](LICENSE). Each dataset is governed by its own licence or data use agreement, as listed in its entry.
