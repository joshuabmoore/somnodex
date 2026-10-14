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
</p>

## Catalogue

This table is regenerated from `datasets/` on every build.

<!-- CATALOGUE:START -->
| Dataset | Host | Access | Subjects | Recordings | Modalities | Staging |
|---|---|---|---:|---:|---|---|
| [HMC](https://physionet.org/content/hmc-sleep-staging/) | PhysioNet | open | – | 151 | eeg, eog, emg, ecg | AASM |
| [ISRUC](https://sleeptight.isr.uc.pt/) | ISR, University of Coimbra | open | 118 | 126 | eeg, eog, emg, ecg, respiratory, spo2, position | AASM |
| [SHHS](https://sleepdata.org/datasets/shhs) | NSRR | dua | 5,804 | 8,444 | eeg, eog, emg, ecg, respiratory, spo2, position | R&K |
| [Sleep-EDF](https://physionet.org/content/sleep-edfx/1.0.0/) | PhysioNet | open | 100 | 197 | eeg, eog, emg, respiratory, temperature | R&K |
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
