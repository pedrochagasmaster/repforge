# Test execution and CI

`test/suites.mjs` is the single executable command inventory. The static app has no root package manager. Browser-only dependencies live under `test/`.

## Which command should I run?

| Purpose | Command | Meaning |
| --- | --- | --- |
| Fix one contract | `node tools/run-tests.mjs <lane> --suite-id <id>` | Exact command; the failure output prints its ID. |
| Edit | `node tools/run-tests.mjs edit` | Dirty worktree, or the latest commit if clean; fail fast. Feedback only. |
| Packet | `node tools/run-tests.mjs packet --base <packet-start-sha>` | Coherent changes since an explicit base, plus dirty files; fail fast. |
| Branch diagnostic | `node tools/run-tests.mjs branch --base origin/main` | Conservative merge-base impact. `affected` remains an alias. |
| Candidate | `node tools/run-tests.mjs candidate` | Complete local inventory except the external service gate; keep going. |
| Inventory | `node tools/run-tests.mjs --check` | Reconcile every scheduled/support script. |

Use `--list` for exact commands and `--explain` for files, reasons and scope. Unknown executable inputs widen to all commands. Suite metadata (`domains`, `tier`, `cost`) is scheduling policy; direct test edits and high-risk persistence inputs retain strict proof. The complete candidate gate keeps the long simulation and race tests.

## Edit, packet and candidate

During correction, run the exact owning suite or `edit`. Commit a coherent packet, then run `packet --base <sha>` where `<sha>` predates that packet. A clean source can capture focused provenance **in that same execution** with `--evidence /tmp/proof.json`; it records the exact command, outcome and before/after source identity, not semantic approval. `tools/record-verification.mjs` remains available for arbitrary commands.

At handoff, dispatch the candidate workflow at the stable SHA:

```sh
gh workflow run simulation.yml --ref <branch> -f mode=candidate -f expected_sha=<40-character-head-sha>
```

The plan job rejects a ref that no longer matches the expected SHA before installing browsers. Ready PRs and main pushes run candidate automatically. Draft PRs run feedback CI; **Feedback CI passed** is not merge evidence. Candidate runs emit the stable `simulation` aggregate; feedback runs emit `simulation-feedback`. A source change invalidates the final same-candidate gate. Inspect one concise remote status snapshot, continue independent work while it runs, and inspect failed artifacts promptly. Do not retry a red run to seek green.

## Browser preview and visual evidence

In a fresh checkout, run `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` once. Normal browser and screenshot commands leave `REPFORGE_URL` unset: `tools/local-preview.mjs` generates an analytics-disabled isolated current-worktree server on a fresh loopback port, verifies identity and cleans up. Explicit local URLs must serve the same worktree.

Use `node tools/capture-ui-screens.mjs --list-affected` to inspect the visual plan; `--affected --accept-visual-change` captures complete variants for selected screens and records an intentional baseline update. Without acceptance, a changed baseline fails comparison. Candidate/main retain full catalog capture while domain selector recall is observed. Global CSS, unannotated shared source, capture fixtures and unknown inputs still select full capture. The source-to-visual mapping is in `tools/visual-domains.mjs`, independent of suite selection. CI preserves the committed baseline, recaptures and checks registration, pixels and semantics.

## GitHub jobs and artifacts

`tools/ci-plan.mjs` writes `.ci-results/ci-plan.json` before dependency installation. Feedback selects commands by ID from the central inventory; browser and visual jobs do not install Chromium when unselected. Candidate/main run fast, state, entry, workout, privacy, the applicable service gate, and full visual evidence. The exact plan, full logs, timings, preview logs and traces are retained as artifacts. `simulation` requires every candidate job; `simulation-feedback` accepts only properly skipped unselected jobs.

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

Property runs now shrink failures with a bounded per-property budget. Budget
interruptions fail rather than passing a partially sampled property. Output
includes the master seed, suite seed, minimized counterexample, path and exact
`--property` replay command. `--filter` remains useful for exploration; `--path`
requires an exact property and seed. Seed zero is valid. Profile sample counts
remain 100 / 300 / 1,000 / 5,000.

## Coverage reconciliation and limits

Every directly scheduled test command from revision `ae6f7dc` is retained, with
these intentional deduplications: vendor pin verification is already invoked
inside `vendor-runtimes.mjs`; `exercise-library.mjs` and the vendor suite run once;
the recorder's self-test runs once rather than inside a separate workflow wrapper.
Syntax checking also covers nested generative, fixture, tool and script files
missed by the old shallow glob.

Previously orphaned standalone suites are now explicit: shared-setup unit and
flow tests, program day-name unit/browser tests, entry fixture-service and
rules-recovery tests, and the existing Plan 050 focused UI/fixture tests. Entry
accessibility is imported and executed by `accessibility.mjs`, not run twice.
No historical scenario is deleted merely because a focused suite overlaps it.
The restored shared-link suite reads visible preview content instead of the
removed review-grid layout selector. Expected concurrent-head rejections wait
for the conflict notice, not five swallowed ten-second success timeouts; their
no-partial-write and replica-equality assertions still run. Unexpected activation
timeouts now fail, and duration checks also require the expected day count.

Motion vocabulary values and live reduced-motion/disposal behavior are read from
the actual exported layer in a small VM fixture instead of relying on declaration
spacing or property order. Boundary/source guards, offline pins, physics limits,
translated drag announcements and modal contracts remain.

This architecture reduces serial waiting and unrelated capture work; it does not
assert an unmeasured speedup or claim lower billed runner-minutes. More independent
jobs trade some setup overhead for faster feedback. Use the per-suite reports to
rebalance lanes and identify measured overlap before deleting regressions. This
remains Chromium automation, not physical-device iOS or Android validation.
