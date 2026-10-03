# Retained and omitted audit artifacts

This directory keeps the audit's narrative, contract, verification records,
set-level summary and one-row-per-program inventories. The large generated
artifacts linked from the two README files are **not committed** because they
total about 36 MB and are fully reproducible:

| Omitted file | Size | Regenerate with |
|---|---:|---|
| `programs.json`, `probes.json`, `explorer.html`, `individual-evaluations.md`, `exercises.csv` | 15 MB | `node tools/audit-program-generation.mjs /tmp/program-generation-audit-replay` |
| `coaching/program-reviews.md`, `coaching/coaching-evidence.json`, `coaching/individual-assessments.json`, `coaching/priority-counterfactuals.json` | 5.6 MB | `python3 docs/audits/program-generation-2026-10-03/coaching/coaching-inventory.py` and `build-program-reviews.py` against the replayed `programs.json` |

Replay into a separate directory, as above, so this committed record stays the
immutable baseline. A replay on `main` at `a781f83` reproduced the audit's
semantic digest `92f9e0bece87b4aba07c379f86208b66175f1b2417273d4f8ee8d3c21bae41e0`
exactly, with the same 4 + 14 contract failures.

The plan that acts on these findings is
[`plans/065-program-generation-engine-overhaul.md`](../../../plans/065-program-generation-engine-overhaul.md).
