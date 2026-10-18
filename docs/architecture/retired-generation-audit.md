# Retired family-generation audit executable

Slice 20 removes `tools/audit-program-generation.mjs`. It exercised the retired
pre-067 `familyId` / `frequency` / `sessionMinutes` compiler request, not the
source-backed generation contract consumed by the shipped application. Adapting
its imports would leave its requests and conclusions invalid. No compatibility
facade remains for this historical tool.

The dated artifacts under `docs/audits/program-generation-2026-10-03/` and
`docs/audits/program-generation-compiler-3/` remain historical evidence. Their
recorded replay commands require their recorded historical source revision.

Current retained verification owns these responsibilities:

| Responsibility | Current production-interface proof |
| --- | --- |
| Complete deterministic output and identity parity | `test/program-generation-parity.mjs`, immutable 233-case fixture |
| Actual native worker, fallback and catalog readiness | `test/program-engine-worker.mjs`, `test/training-worker-modules.mjs` |
| Source-derived candidate order, allocations and duration | `test/generation-source-matrix.mjs`, `test/generation-candidates.mjs`, `test/generation-layout.mjs` |
| Set-count, per-side/repless metrics, periodization and first/last deload | `test/generation-source-dose-boundaries.mjs`, `test/generation-periodization.mjs` |
| Canonicalization, malformed input and varied generated requests | `test/generative/` CI profile and independent property oracles |

The old cohort verdicts, HTML explorer and descriptive statistics are not a
continuing guarantee. Their saved artifacts are retained; the production risks
above are verified against actual native public modules without UMD evaluation,
private-function extraction or injected compiler/layout substitutes.
