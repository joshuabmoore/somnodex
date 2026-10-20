# TODO

## Features

- [ ] **Time-series feature comparison across papers.** Alongside preprocessing pipelines, record and compare the time-series features each paper uses (where applicable), e.g.:
  - Spectral: band power (delta, theta, alpha, sigma, beta, gamma), relative power, band ratios, spectral edge frequency, spectral entropy
  - Nonlinear: sample/permutation entropy, fractal dimension, Lempel-Ziv complexity, Hurst exponent, detrended fluctuation analysis (DFA)
  - Symbolic: symbolic dynamics, ordinal patterns
  - Temporal/statistical: Hjorth parameters, zero-crossings, moments
  - Likely needs: a feature schema (`schema/`), per-paper feature records, and a site tab or view for side-by-side comparison, like the Pipelines tab. Papers that learn features end to end (deep learning) should be marked as such rather than left blank.
