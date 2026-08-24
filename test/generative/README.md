# Taurifer generative & model-based testing

This directory is Taurifer's second testing paradigm. The deterministic
Playwright/simulation suites in `test/*.mjs` answer *"does this known
scenario behave correctly?"*; this layer answers a different question:

> Given all valid — and strategically invalid — states and action sequences
> Taurifer can encounter, can an automated search find a counterexample to
> the product's invariants?

The engine is [fast-check](https://fast-check.dev), installed as a pinned
test-only dependency in `test/package.json` alongside Playwright. Nothing
here adds a production dependency, a build step, or any file served by the
app.

## Status

**Phase 0 (testability audit) and Phase 1 (fast-check foundation) are done.**
Phases 2–7 are scoped below and intentionally not started.

## Running

```bash
cd test

node generative/run.mjs                      # smoke profile (100 runs) — default
node generative/run.mjs --profile ci         # 300 runs, what CI executes
node generative/run.mjs --profile deep       # 1000 runs, local exploration
node generative/run.mjs --profile campaign   # 5000 runs, adversarial search
node generative/run.mjs --list               # list suites
node generative/run.mjs --filter "setup links" --seed 12345
```

Profiles: `REPFORGE_GENERATIVE_PROFILE` selects the default;
`REPFORGE_GENERATIVE_SEED` pins the master seed. Every suite derives its own
seed from `(masterSeed ^ fnv1a(suiteName))` so runs are reproducible and
suites stay independent.

Everything here is pure Node: no browser, no static server, no `python3`.

## Layout

```
generative/
├── run.mjs                    profile-driven runner + failure reports
├── arbitraries/
│   ├── numbers.mjs            boundary-biased ints/doubles, hostile numerics
│   ├── setup-payload.mjs      valid setup payloads + privacy-polluted twins
│   └── malformed.mjs          junk JSON, mutation ops, envelope attack shapes
├── model/
│   └── canonicalize.mjs       stableStringify/deepEqual oracle, path utils
├── adapters/
│   └── domain-adapter.mjs     Node-reachable domain surface (today: shared-setup.js, exercises.js)
├── properties/                Phase 1 property suites (see below)
└── regressions/               frozen counterexamples from real findings
```

`model/canonicalize.mjs` is deliberately independent of
`shared-setup.js`'s own `canonicalize`: an oracle must not trust the code
under test to define equality.

## Property catalogue (Phase 1)

| Suite | Invariant |
| --- | --- |
| `canonicalization.mjs` | canonical form is idempotent, independent of input key order, preserves key sets/array order, never mutates input, rejects JSON-unsafe leaves with `TypeError` |
| `setup-links.mjs` | decode(encode(p)) equals validate(p) exactly; hand-built v1 ≡ selected envelope (v1/v2 differential); history/UI/storage pollution never reaches the shared document (**INV-013**); size ceilings fail only with typed codes; validate is idempotent |
| `schema-boundaries.mjs` | hostile numerics are rejected or bounded; arbitrary junk gets typed results without throwing or mutating; prototype-dangerous keys anywhere → `invalid-schema`, no global pollution; version fuzzing is typed |
| `identity.mjs` | library ids survive the whole pipeline verbatim (**INV-005**); unknown ids and legacy aliases rejected; custom refs require carried definitions (**INV-006**); unreferenced customs dropped; customs cannot shadow built-ins |
| `malformed-inputs.mjs` | decode is total over adversarial envelopes — typed result or well-formed success, never a throw; oversize inputs rejected up front |

The full invariant numbering (INV-001 … INV-016) lives in the architecture
proposal; suites reference it in comments as they come to cover it.

## Failure reproducibility

Failures print a standardized block:

```
PROPERTY / PROFILE / MASTER SEED / SUITE SEED
COUNTEREXAMPLE / DETAILS   ← fast-check's shrunk counterexample + seed/path
REPLAY                     ← exact command to reproduce
```

Replaying uses the master seed; the runner re-derives per-suite seeds, so a
single number reproduces every suite deterministically.

### Regression corpus policy (`regressions/`)

When generative search finds a real bug:

1. Fix the bug.
2. Prefer converting the minimized counterexample into a **readable
   deterministic test** next to its subject (e.g. `test/shared-setup-unit.mjs`)
   — those are useful forever.
3. If the case only makes sense generatively (e.g. a pathological generated
   shape), freeze its seed/path as a skipped-until-broken regression file
   here instead.

Seeds reproduce; human-readable tests remember.

## Test-surface map (Phase 0 audit)

Node-reachable today (used by Phase 1):

- `shared-setup.js` — UMD module: `validate`, `encode`, `decode`,
  `canonicalize`, fragment/cookie helpers. Pure, promise-based for
  encode/decode, fully schema-typed error codes.
- `exercises.js` — `EXERCISE_LIBRARY`, `LEGACY_LIBRARY_IDS` (legacy→current
  map). Frozen identity vocabulary.

Pending seams (still embedded in `app.js`; do **not** scrape internals):

- progression/recommendation engine (determinism, provenance, monotonicity)
- backup export/import round trip (INV-011, INV-012)
- workout draft lifecycle and destructive-program transactions (INV-016)
- persistence replicas / write-ahead journal (INV-010)

Long term these should be exposed through a small intentional test surface
(continuing the `window.__repforge*` precedent) or extracted into
dependency-free modules — never by importing app.js into Node.

## Roadmap

| Phase | Scope | Layer |
| --- | --- | --- |
| ~~0~~ | ~~Testability audit (this map)~~ | — |
| ~~1~~ | ~~Pure properties over shared-setup/exercises~~ | L2 |
| 2 | Workout state machine: StartWorkout/LogSet/EditSet/DeleteSet/Reload/Finish/Cancel via fast-check `fc.commands`; model = programs, workout state, sessions, hasDraft | L3 |
| 3 | Program/history interaction: rename, add/remove/reorder exercises, custom exercise lifecycle vs completed history | L3 |
| 4 | Import/export state machine: atomicity, non-mutation on rejection | L3/L5 |
| 5 | Persistence model: localStorage mirror, IndexedDB, revision, pending writes | L4 |
| 6 | Scheduler/race exploration with fast-check's async scheduler | L4 |
| 7 | Cross-tab generation over two Playwright contexts | L4/L5 |

Command profiles then follow the proposal: separate *workout lifecycle*,
*program mutation*, *history stability*, *import/export*, and *persistence*
machines rather than one giant command set, with per-profile run budgets
(smoke ≈100 runs/≤20 commands, main ≈500–1000/≤50, campaign ≥10k/≤250).

Browser-backed generation stays selective: thousands of examples through
the domain adapter, tens-to-hundreds through Playwright.

## Principles

1. Model Taurifer's truths, not Taurifer's implementation — no duplicated
   algorithms inside models or oracles.
2. Don't assert implementation details (`state._someArray.length`) — assert
   observable semantics ("four completed sessions remain").
3. Keep hostile values out of valid-state generators; robustness properties
   get their own arbitraries so "must preserve semantics" and "must fail
   safely" never blur.
4. Boundary-biased generation beats uniform randomness: min/min+1/max−1/max,
   zero, empty, huge, Unicode, duplicates.
5. Track what the search explores, not line coverage; if `FinishWorkout`
   executes 0.3% of the time, tune the generator.
6. A discovered bug graduates into the deterministic corpus — generative
   discovery, regression memory.
