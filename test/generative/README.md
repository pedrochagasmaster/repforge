# Taurifer generative properties

These properties exercise the current browser-free production modules with
fast-check. They cover protocol and algorithm boundaries that are costly to
enumerate in a browser. Product journeys remain in the production-backed
Playwright suites.

The test dependency is pinned under `test/`. The app gains no dependency,
build step, or served file.

## Running

```bash
cd test
node generative/run.mjs
node generative/run.mjs --profile ci
node generative/run.mjs --profile deep
node generative/run.mjs --profile campaign
node generative/run.mjs --list
node generative/run.mjs --filter "setup links" --seed 12345
```

The default profile runs 100 examples. CI runs 300. Deep and campaign profiles
run 1,000 and 5,000. `REPFORGE_GENERATIVE_PROFILE` selects the default profile;
`REPFORGE_GENERATIVE_SEED` pins the master seed. CI derives a stable seed from
the exact source SHA when no explicit seed is supplied. A property failure
prints its seed and shrink path for replay.

These tests use pure Node and do not start a browser or static server.

## Test surface

`adapters/domain-adapter.mjs` loads `shared-setup.js`, `program-compiler.js`,
`progression-engine.js`, `exercise-metrics.js`, and the committed
`assets/exercise-catalog.json`. The compiler receives that same raw UUID
snapshot and remains the sole owner of ProgramDefinition validation. Metric
IDs, definitions, units, and compositions come from `exercise-metrics.js`.
No property scrapes `app.js`.

| Property module | Contract exercised |
| --- | --- |
| `canonicalization.mjs` | Canonicalization is idempotent, independent of input key order, preserves keys and array order, does not mutate input, and rejects unsafe leaves. |
| `setup-links.mjs` | v4 encode/decode preserves the canonical proposal, validates to a fixed point, refuses performed/device-state pollution, and respects the hard size ceiling. |
| `schema-boundaries.mjs` | Current settings and ProgramDefinition numeric fields stay finite and bounded; junk, dangerous keys, versions, and deep structures fail safely. |
| `identity.mjs` | Exact raw exercise UUIDs, source metric order, and compiler-approved custom definitions survive v4; unknown IDs and retired short aliases never resolve. |
| `malformed-inputs.mjs` | v4 decode is total over hostile input, over-limit envelopes fail early, and unsupported v1/v2/v3 inputs preserve their exact source string. |
| `progression-metrics.mjs` | The current metric recommendation API is deterministic and pure over source metric compositions, preserves actual value records, and never invents load/repetition targets for time/distance movements. |
| `program-compiler.mjs` | The actual compiler replays seeded requests against the raw UUID catalog, validates every result, preserves exact source metrics and null coefficients, and returns typed failures for arbitrary JSON. |

The setup arbitraries create small complete seven-day ProgramDefinitions so
the v4 lossless properties usually exercise successful URL encodes. Larger
payload refusal and the representative ≤700-character URL are proven in
`test/shared-setup-unit.mjs`.

## Failure records

When search finds a real defect, add a readable deterministic test beside the
production module when possible. Keep a seed/path record only for failures that
depend on a pathological shape, long action sequence, or rare ordering. A
regression fixture must describe a current production contract; old fixture
schemas do not stay merely because they once had a property.

`model/canonicalize.mjs` remains independent of `shared-setup.js`, so equality
checks do not trust the implementation under test to define its own oracle.
