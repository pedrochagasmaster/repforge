# Complete quantitative and qualitative audit evidence

The two main reports are readable directly in GitHub:

- [Quantitative / contract audit](README.md)
- [Qualitative coaching audit](coaching/README.md)

The complete evidence snapshot includes all **200 programs**, **3,354 exercise
entries**, **308 supported-choice probes**, both sets of individual reviews,
CSV exports, the offline explorer, priority comparisons, verification records,
and their audit/rendering scripts. Source revision:
`c1d643206d1c472b34d3f0c0e4b7cb425f571329`. The snapshot is historical evidence;
it does not claim to evaluate subsequent changes to the engine.

Large generated artifacts are stored in a losslessly compressed archive split
into small binary parts under [evidence-parts](evidence-parts). This keeps the
evidence publishable through the available GitHub connection. No results were
dropped or resampled. The [manifest](evidence-manifest.json) records each
original path, byte count and SHA-256, plus checksums for the archive and parts.
Smaller reports, tables, scripts and verification records are also committed
directly. Links to the larger raw files in the reports resolve after restoration.

From a checkout containing this PR, run:

```sh
python3 docs/audits/program-generation-2026-10-03/restore-evidence.py
```

This verifies all archive parts and every original file before writing missing
files. It preserves matching existing files and refuses to overwrite changed
ones. No dependencies, network access, or production-engine execution are needed.
To inspect the snapshot without restoring files into the checkout:

```sh
python3 docs/audits/program-generation-2026-10-03/restore-evidence.py --destination /tmp/program-generation-audit-snapshot
```

Then open `docs/audits/program-generation-2026-10-03/explorer.html` under that
destination, or read the individual qualitative reviews in
`docs/audits/program-generation-2026-10-03/coaching/program-reviews.md`.

Restore ignored generated artifacts before running the coaching inventory or
review renderers. To reproduce generation itself, use the production sources
at the audited revision alongside the included audit script; a newer engine
produces a new audit rather than a replay of this snapshot.
