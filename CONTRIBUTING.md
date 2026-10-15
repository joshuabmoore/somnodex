# Contributing

Thanks for helping keep this catalogue complete and accurate.

## Suggest a new dataset

Use the **Add a dataset** issue form. It opens a PR for you, so you don't need to touch YAML.

## Fix or extend an entry

Every dataset page on the site has a *Suggest an edit* button that opens the YAML file in GitHub's editor. Alternatively, edit `datasets/<id>.yaml` directly and open a PR.

## Inclusion criteria

- Contains sleep recordings: PSG, sleep EEG, home sleep testing, sleep-annotated wearables, intracranial sleep recordings, and so on. Human or animal.
- Accessible to external researchers: open download, free registration, a data use agreement, or a documented request process. "Available from the authors on reasonable request" with no process doesn't count.
- Has a stable landing page or DOI.

## Field conventions

- `id`: lowercase slug, usually the dataset's common short name (`shhs`, `mass-ss3`).
- Counts (`n_subjects`, `n_recordings`) are what's actually downloadable, not what was originally collected. Explain any differences in `notes`.
- Lists such as `groups`, `events` and `tags` use lowercase-hyphenated values. Reuse existing values where possible; the site's filter menus show what's already in use.
- Set `verified: true` only after checking the entry against the dataset's own documentation, and update `last_checked` when you do.

## Adding a preprocessing pipeline

Add `pipelines/<id>.yaml`, one file per source per dataset, following [`schema/pipeline.schema.json`](schema/pipeline.schema.json). The existing files are worked examples.

- `id`: usually `<method>-<dataset-variant>`, e.g. `deepsleepnet-sleep-edf-20`.
- Use `subset.name` for the commonly used subsets (`sleep-edf-20`, `sleep-edf-78`, `shhs1`) so entries can be grouped.
- Separate "not checked" from "not reported": leave a step out if you haven't looked; use `status: not_reported` if the source doesn't say; use `status: none` if it says the step isn't done.
- Cite where each step's values came from in `source`. If you read values from code, set `source.code.commit`.
- If the paper and code disagree, record what the code does and describe the difference in `discrepancy`.
- Drafts produced with LLM help are welcome, but leave `verified: false` until a person has checked every step against the source.

Run `python scripts/validate.py` before opening a PR; CI runs the same check.
