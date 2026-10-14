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

Run `python scripts/validate.py` before opening a PR; CI runs the same check.
