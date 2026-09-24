# Test execution and CI

`test/suites.mjs` is the single executable command inventory. The static app has no root package manager. Browser-only dependencies live under `test/`.

## Which command should I run?

| Purpose | Command | Meaning |
| --- | --- | --- |
| Fix one contract | `node tools/run-tests.mjs <lane> --suite-id <id>` | Exact command; the failure output prints its ID. |
| Edit | `node tools/run-tests.mjs edit` | Dirty worktree, or the latest commit if clean; fail fast. Feedback only. |
| Packet | `node tools/run-tests.mjs packet --base <packet-start-sha>` | Coherent changes since an explicit base, plus dirty files; fail fast. |
| Branch diagnostic | `node tools/run-tests.mjs branch --base origin/main` | Conservative merge-base impact. `affected` remains an alias. |
| Candidate (diagnostic) | `node tools/run-tests.mjs candidate` | Complete local inventory except the external service gate; use only to diagnose verification machinery, not for normal handoff. |
| Inventory | `node tools/run-tests.mjs --check` | Reconcile every scheduled/support script. |

Use `--list` for exact commands and `--explain` for files, reasons and scope. Unknown executable inputs widen to all commands. Suite metadata (`domains`, `tier`, `cost`) is scheduling policy; direct test edits and high-risk persistence inputs retain strict proof. The complete candidate gate keeps the long simulation and race tests.

## Edit, packet and candidate

During correction, run the exact owning suite or `edit`. Commit a coherent packet, then run `packet --base <sha>` where `<sha>` predates that packet. A clean source can capture focused provenance **in that same execution** with `--evidence /tmp/proof.json`; it records the exact command, outcome and before/after source identity, not semantic approval. `tools/record-verification.mjs` remains available for arbitrary commands. Normal handoff does **not** run the exhaustive local `candidate` first: the exact-SHA remote candidate is the completion boundary and executes independent lanes in parallel. Reserve local `candidate` for diagnosing CI/selector behavior or a concrete failure that cannot be reproduced with its owning suite.

At handoff, dispatch the candidate workflow at the stable SHA:

```sh
gh workflow run simulation.yml --ref <branch> -f mode=candidate -f expected_sha=<40-character-head-sha>
```

The plan job rejects a ref that no longer matches the expected SHA before installing browsers. Ready PRs and main pushes run candidate automatically. Draft PRs run feedback CI; **Feedback CI passed** is not merge evidence. Candidate runs emit the stable `simulation` aggregate; feedback runs emit `simulation-feedback`. A manually dispatched candidate and automatic PR feedback for the same branch share one concurrency group, so the candidate supersedes redundant feedback instead of running a second broad matrix beside it. A source change invalidates the final same-candidate gate. Inspect one concise remote status snapshot, continue independent work while it runs, and inspect failed artifacts promptly. Do not repeatedly poll Actions or retry a red run to seek green.

## Browser preview and visual evidence

In a fresh checkout, run `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` once. Normal browser and screenshot commands leave `REPFORGE_URL` unset: `tools/local-preview.mjs` generates an analytics-disabled isolated current-worktree server on a fresh loopback port, verifies identity and cleans up. Explicit local URLs must serve the same worktree.

Use `node tools/capture-ui-screens.mjs --list-affected` to inspect the visual plan; `--affected --accept-visual-change` captures complete variants for selected screens and records an intentional baseline update. Without acceptance, a changed baseline fails comparison. PR feedback and PR candidate runs use the reviewed affected-screen selector; global CSS, unannotated shared source, the actual screen-capture fixture, capture-harness changes and unknown rendered inputs widen to the full catalog. Pushes to `main` retain the exhaustive full-catalog sweep. A manually dispatched PR candidate derives its comparison base from the branch merge-base when GitHub does not provide one. The source-to-visual mapping is in `tools/visual-domains.mjs`, independent of suite selection. CI preserves the committed baseline, recaptures and checks registration, pixels and semantics.

## GitHub jobs and artifacts

`tools/ci-plan.mjs` writes `.ci-results/ci-plan.json` before dependency installation. Feedback selects commands by ID from the central inventory; browser and visual jobs do not install Chromium when unselected. Candidate mode still runs the complete fast, state, entry, workout, privacy and applicable service contract inventory. Visual scope is independent: PR candidates use change-proportional evidence with conservative widening, while `main` pushes capture the full catalog. The exact plan, full logs, timings, preview logs and traces are retained as artifacts. `simulation` requires every selected candidate job; `simulation-feedback` accepts only properly skipped unselected jobs.

The short simulation covers twelve deterministic weeks and the real save/domain lifecycle through Phase 1; the complete 52-week simulation remains candidate-tier. Privacy contracts are scheduled separately as pure catalogue/oracle, entry UI, offline service-worker, and share-flow checks. Accessibility remains an integrated candidate-tier sweep because its cross-surface focus and touch-target assertions do not yet have equivalent narrower owners. Strict persistence, stale-tab and recovery race tests remain intact.

## Failures and performance evidence

Every script writes its command, initial result, duration and complete stdout /
stderr under `.ci-results/<lane>/`; the terminal shows only a bounded failure
excerpt unless `--verbose` is used. Reports are updated after each script, not
only at successful job completion. Local edit/packet/exact-suite runs fail fast;
candidate and CI lanes keep going to collect failures. Unexecuted suites have
`not-run-after-failure` status rather than being counted as passed.
Per-script timeouts terminate the process group, including abandoned browsers.
GitHub summaries show timings; artifacts upload with `if: always()` and expire
after seven days. `.ci-results/` is ignored by git.

Normal browser execution does not record traces. In CI, a failing browser script
is replayed once with diagnostic tracing (`REPFORGE_DIAGNOSTIC_REPLAY=1`). The
**initial failure remains authoritative even if the replay passes**. This is not
a retry-to-green policy. Both outcomes are recorded, exposing potential flakes.
Timed-out or cancelled scripts are not replayed. Successful runs pay no tracing
cost. For a targeted local trace:

```sh
REPFORGE_TRACE=1 node tools/run-tests.mjs entry --suite program-editor-sorting
```

The shared launcher writes page screenshots, bounded console/page-error records
and traces before context/browser closure on a trace run. Abrupt process exits
or killed browsers may prevent a complete trace; the original logs and result
remain. Fixtures are synthetic. Do not point diagnostic runs at a real user's
workout database or production telemetry configuration. The privacy fixture
intercepts `posthog-config.js` as well as its fake SDK, so a generated local
preview config cannot overwrite the fixture or redirect its requests. Its SDK
failure case also proves that a load was actually attempted.

On visual failure, retain the immutable baseline and current catalog alongside
capture/comparison logs. `visual-status.txt` distinguishes a successful fresh
capture from a failed transactional capture that left committed images untouched.
The existing capture tool's frame retries are unchanged and remain visible in
its log; no comparison failure is retried away.

Property runs shrink failures with a bounded per-property budget. Budget
interruptions fail rather than passing a partially sampled property. Required CI
runs derive the master seed deterministically from `CI_SOURCE_SHA`, so the same
candidate exercises the same sample instead of receiving a new random merge
gate on every execution; an explicit `--seed` or `REPFORGE_GENERATIVE_SEED`
still overrides it. Ordinary local runs without either value remain randomized
for exploration. Output includes the master seed, suite seed, minimized
counterexample, path and exact `--property` replay command. `--filter` remains
useful for exploration; `--path` requires an exact property and seed. Seed zero
is valid. Profile sample counts remain 100 / 300 / 1,000 / 5,000.

## Test retention and limits

Tests are retained for unique bug-detection value, not historical existence,
coverage percentage or implementation-plan provenance. New isolated tests are
failure-first: enumerate the failure space and write the failing proof before the
implementation; never add a post-hoc unit test for code already written. Product behavior should
normally be asserted through a production-backed browser journey. Isolated tests
remain appropriate when the failure space is materially cheaper or more
deterministic outside the browser: serialization/canonicalization, migrations,
algorithmic boundaries, protocol fault injection, durable-state recovery,
concurrency/races and verification-tool self-tests.

The September 2026 signal cleanup removed seven checks whose assertions were about
fake fixture behavior or source/implementation shape rather than production
outcomes: the program-entry fixture-service self-test, the Plan 050 progress
fixture credibility check, the Focus source-ownership regex, the telemetry
call-site source scan, the motion-polish CSS regex suite and the Apple-design
follow-up source-shape suite, plus the standalone telemetry-fixture
self-test after its meaningful schema-coverage assertion was consolidated into
the production telemetry contract. Runtime behavior remains owned by the existing
production adapter/browser/generative, Focus, motion, accessibility and telemetry
runtime suites. The telemetry facade restriction that is genuinely an
architecture/privacy invariant now lives in `tools/check-production-syntax.mjs`
rather than masquerading as a product test.

Support-file selection follows actual ownership. Static fixtures select their
scheduled importers; dynamically loaded generative adapters/arbitraries/models,
properties and regression cases select the generative runner and its inventory
self-test. An unknown executable input still widens safely. A deleted test selects
the inventory checker instead of forcing an unrelated full product matrix.

Long simulations, persistence/race suites, migration compatibility, privacy,
offline behavior and accessibility remain because they cover distinct failure
modes. Any future deletion should name the stronger retained evidence that catches
the same plausible production bug. This remains Chromium automation, not
physical-device iOS or Android validation.
