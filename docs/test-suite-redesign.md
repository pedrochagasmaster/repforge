# Verification by risk

The owner explicitly authorized a ground-up redesign on 2026-10-18. Important
failure detection is the contract; historical test executables, snapshots and
cross-products are not. This supersedes the old requirement to freshly verify
every catalog image on every CI run. Incremental work and measured evidence
remain reviewable in [#444](https://github.com/pedrochagasmaster/repforge/pull/444).

**Owner decision, 2026-10-21: fast PRs, full on main**
([ADR 0022](adr/0022-fast-pr-full-main-verification.md)). The redesigned
inventory below is the **pull-request lane** (`SUITES`, the `ci` check). The
exhaustive checks it retired from pull requests are **not deleted**. They run in
the **full lane** (`FULL_SUITES`, the `ci-full` check) on every push to `main`,
nightly and on demand, and a failure there is a red check on `main`. This
overrides the original rule below that no slow suite moves to another lane.
The full lane is mandatory for `main`; it just does not gate pull requests.
See "Adoption on current main" at the end for the fair baseline and where every
test that landed after `147e4afa` went.

## Acceptance contract

Original baseline: `147e4afa07fea3243efd42b5b7d167c196c6a7ca`, 208 commands in
195 scheduled executable files. Redesign inventory at that baseline: **97
commands in 97 distinct files**. On current main (fair baseline `651d5a92`,
213 commands in 199 files) the PR lane had **102 commands in 102 files** at
adoption, and the full lane had the other 112 commands (Program Lab later
added 3 and 7). PR-lane reductions are explicit
below; their commands keep running in the full lane.

| Guarantee | Cheapest reliable proof | Real browser boundary retained |
| --- | --- | --- |
| Engine correctness and deterministic prescriptions | Shipped compiler/progression modules, fixed corpus, seeded properties, request/layout/periodization boundaries | Worker/fallback, activation, metric and per-side/bodyweight representatives |
| Workout data integrity and recovery | Draft model/migration properties and shared storage contracts | Both durable replicas, cross-tab races, acknowledged DraftV2/CAS, old-writer replay, pending fields, atomic Finish and history replay |
| Import, export, migrations and transfer | Shared production parsers, allowlists, clone/limit/state-machine negatives | Real credential vault/cookies/IDB, import arbitration, rollback, recovery and older workers |
| Program/editor/navigation | Production entry/day-name/identity contracts | Focused text editing (including incoming #445), destructive custom mutation recovery, import review and activation |
| Offline updates and privacy | Release inventory, routing and telemetry contracts | SW upgrade/error/redirect behavior, offline privacy and hostile telemetry leakage |
| Critical UI and accessibility | Explicit representative matrix, public role checker and metadata validation | Fresh pixel/semantic observations, live role/contrast/labels/targets, narrow/large text and modal focus behavior |

The canonical executable inventory remains `test/suites.mjs`. The
[ledger](test-retirement-ledger.json) maps each baseline execution to the PR
lane, a consolidated owner, or the full lane (with the PR-lane owners that
cover its risk); it is not a second command runner. Independent reviewers assess risk
coverage and measurement methodology separately.

## Guarantees moved off pull requests

The PR lane does not promise pixel parity for every catalog frame, role/contrast
measurement in every state/locale/theme combination, every navigation
permutation, every animation choreography, cosmetic token contracts, or the
emergent interaction sequence of the year-long simulation. Representative
rendering does not prove those omitted combinations equivalent. The full lane
still checks every one of them on each push to `main` and nightly.
Important known data-loss, migration, security and recovery negatives remain
in production-backed proofs. No assertion threshold or expected product value
is relaxed to make a retained test pass.

Guide-modal and corrected device-pixel sampling behavior owned by #435, the
held finding #441, and focused browser-Back editing owned by #445 remain
protected incoming work. Program Lab #432's behavior and selection mappings
must be preserved when integrating. Their current tests are implementation
choices; their failure-detection requirements are not disposable.

## Measurement

Compare the untouched complete original inventory with the complete redesigned
inventory on identical Node/browser/dependencies, fixed seed and 14 browser
workers. Each source runs its own aggregate gate and authoritative matrix.
Never combine a failed initial execution with a successful replay. Report
commands, distinct files, named scenarios, property budgets and rendered cells
separately. Wrappers and scheduling shards do not count as behavioral reduction.

The measured original budgets are **310.059s maximum scope execution wall plus
aggregate gate** and **3,473.969s summed initial runner time**. Queue, setup,
dependency installation and artifact time are reported separately. Final-head
complete CI and a successful paired comparison are required before claiming
either numeric target. Optional extended property campaigns retain their
existing separately named budgets; retired scheduled tests are not hidden in
them. Until measured, these are targets, not achieved results.

## First slice

Keep inexpensive production-module proofs, retain a bounded set of real
browser protocol journeys, replace the historical UI self-test/layout sweep
with one critical matrix owner, and move the already-pure transfer recovery
state-machine oracle from the browser lane to the fast lane. Consolidate the
critical editor reorder/delete proof into its existing mutation-recovery
journey, reusing its actual editor state. Preserve the text-field owner path
so #445's focused Back negatives can integrate directly.

The aggregate must reject missing/duplicate/foreign-source critical cells,
failed initial journeys and failed comparisons. Injected defective artifacts
must fail the actual replacement checker before the healthy slice is accepted.

## Implemented risk owners and evidence

The canonical inventory contains 57 fast commands (including the unchanged
15-case transfer-recovery state machine), 39 real browser commands and one
service command. Three additional important existing browser owners remain:
`management-summary` (post-commit presentation failure),
`per-side-execution-mode-capture-browser` (immutable historical execution mode),
and `program-freeform-import` (private source/clipboard cancellation races).
The retired fast guarantees are DESIGN.md token/prose equality, the historical
Plan 041 manual-helper self-test, and exact runtime payload/bootstrap shape.
Pinned runtime integrity and release/offline behavior remain covered.

The [execution ledger](test-retirement-ledger.json) classifies every original
command exactly once and names retained risk owners separately from explicitly
retired guarantees. The 21 declared representative frames are authoritative in
`tools/critical-ui.mjs`; the old exhaustive render executables/modes retire.
Real entry accessibility still runs through `program-entry-a11y.mjs` inside its
UI owner. The global gate requires source identity and complete initial reports.

Load syntax/unit/limit boundaries now cross the shipped `exercise-metrics.js`
interface used by the app; a missing-interface RED proof precedes the extraction.
The unchanged legal input semantics pass 8,000 conversion checks and explicit
invalid/boundary vectors. Real browser History Save rejects an invalid correction
without writing either replica before preserving its valid-edit/rerender proof.
All real setup/transfer cookie redirect cases share `sw-launch-redirect`'s server
and browser. The critical checker has a DPR2 unreadable-glass RED proof, corrected
pixel scaling, and injected real image/control defects. This sampler correction
overlaps incoming #435 and must reconcile without dropping its stronger cases.

No numeric runtime success is claimed yet. Final-head CI and a complete paired
benchmark remain required; local Chromium 151 is diagnostic and cannot certify
the pinned Chromium 149 screenshot baseline.

Consolidation independently reproduced the already tracked #434/Plan074 canonical editor bug: removing a moved-first
slot filtered the canonical list without renumbering its remaining orders.
Canonical validation refused that edit, while the row projection could later
persist without the removal reaching the definition. The retained real editor
proof failed before the fix and passes after renumbering the remaining slots;
it checks explicit Done, both replicas, canonical identity and reload.

Independent risk and methodology reviews requested additional guide/Why focus
protocols and stricter provenance. Those are now implemented. The aggregate
also requires actual frame bytes matching their hashes and adjacent passing
initial browser evidence for the exact command and clean source. Matching
malformed SHA identities fail. The focused Why, guide replay and retained entry
accessibility protocols pass locally; the guide's Chromium-151 pixel mismatch
remains separately recorded, with normal CI comparison unchanged.

## Overlap provenance and integration

The product fixes below belong to existing work; this task contributes their
retained consolidation proofs and the redesigned execution architecture.

| Existing owner | Provenance | Reconciliation |
| --- | --- | --- |
| [#434](https://github.com/pedrochagasmaster/repforge/issues/434), Plan074 S1 removal | `37ddc40852c800a52bb45b3d797cfcc6ad2b71eb` on `feat/program-editor-a-s1` | Use that canonical renumbering hunk; preserve the moved-first deletion/Done/replica/reload proof when porting to Plan074's renderer. |
| #434 cross-day move | `a99f22389f612e44fe051e60e75779af01614d8c` | Use the existing all-days renumbering follow-up. The retained journey independently fails before that fix when moving a non-last slot across days. |
| #439, approved fix carried by [#435](https://github.com/pedrochagasmaster/repforge/pull/435) | `65ac8a7e6089e0f0744d543a76086661156e3956` | Adopt that exact screenshot sampler implementation; retain the independent DPR2 glass failure proof. No competing sampler fork or unique-fix claim. |

Plan074 owns its renderer, grouped intent reachability, week-specific targets,
Apply/Cancel/Undo, empty-day validation and S2 day-reorder/shape/next-workout
requirements. This PR does not claim those forthcoming changes are certified.
When integrating, move retained editor tests to its controls without weakening
identity, canonical/replica, cancellation or conflict assertions; preserve its
additional important negatives and reconcile cache URLs above current main.

#435 owns native guide timing, first-tap hold/replay, one guide per Focus visit,
all-guide dismissal/replay/focus and anchor-placement behavior. Preserve those
proof requirements when the guide owner joins this architecture; adapt the
current replay cell from inline cue to native dialog. Preserve #441's exact
issue/state/measurement exemption and rejection self-tests; the retired full
selector-never-rendered rule is not implicitly restored. The current 21 cells
do not certify every new guide state. Recompute the ledger, counts and fair
baseline after incoming #432/#435/Plan074 work reaches main; do not silently
reintroduce full render sweeps or discard their meaningful new coverage.

Reconciliation evidence: the cross-day case failed before the existing Plan074
fix (73.449s) and passed after the exact selective port (73.696s); the upstream sampler
passes the same independent DPR2 contrast/image/role fault proof. Both product
fixes were already owned by their originating work. The final benchmark measures
the entire candidate, so its speedup is not attributed exclusively to harness
changes. #435's shared launcher must also preserve live-guide fresh transfer
destinations and clone eligibility; do not seed dismissed guides into those
fresh-destination proofs.

A final targeted adequacy review found that the generic alpha-event inventory
excludes the transfer phase. The retained fast telemetry owner now includes the
retired suite's transfer-specific hostile `capture`/`beforeSend` negatives,
settlement qualification, milestone/reboot suppression and restored disabled
consent. A temporary isolated copy of the complete shipped telemetry module with
a deliberate transfer-only claimId leak fails the actual new assertion; the
healthy production module passes. Existing import and diagnostic-redaction
owners retain the real preboot/identity/freeze and all redaction fixture cases.
No extra executable/browser journey is introduced; counts remain 97/97.

## Architecture migration integration

Integration PR #448 adopts exact redesign source `9448989d` provisionally while its paired benchmark remains an independent acceptance gate. The frozen `acceptedRedesign` command inventory in the retirement ledger preserves that 97-command/97-file numeric experiment. New migration risks add explicitly scheduled commands to the same live inventory; total counts and runtime must be reported as they actually grow. This is not a new claim of ≥50% reduction for every future feature branch, and no historical exhaustive matrix is restored. The runner self-test rejects removal of any accepted risk command; adapting an owner requires an explicit ledger reconciliation.
## Adoption on current main (2026-10-21)

#446 was measured on `147e4afa`. Main then gained #443, #452, #455, #435, #437,
#442, #457, #450 and #459, each adding or changing tests. The redesign was reapplied
onto `651d5a92` (fair baseline: 213 commands, 199 files) as follows.

- **Two lanes.** Every one of the 213 baseline commands is in the PR lane (100),
  consolidated into a named owner (1: the pure transfer-recovery state machine
  runs under `node --test` in `fast`), or in the full lane (112). The PR lane adds
  `test/ui-system-checker.mjs` (below), so it has 102 commands.
- **Production code keeps main's versions.** Main already carries the #434
  canonical renumbering (removal and cross-day move) and the #439 device-pixel
  sampler, so neither is ported again. The only production change left is the
  load-input parser delegation (`app.js` → `exercise-metrics.js`). The PR-lane
  parser contracts need it to test the shipped parser.
- **Checker self-tests stay on PRs.** Main's `test/ui-system.mjs` is the role
  checker's self-test suite. It now lives unchanged in `test/ui-system-checker.mjs`,
  including #457's modal-inert negatives, #435's `renderedHold`/finding exemptions
  and the #439 device-pixel glass fixture. `test/ui-system.mjs` runs the critical
  matrix, which uses that checker.
- **Guide replay cell.** #435 made a replayed guide a native modal dialog. The
  critical `settings/guides-replay` cell asserts it on the dialog, which is modal
  and focused, closes on Escape, returns focus to Replay and persists the
  dismissal. Against the old inline cue, the cell failed on "replayed guide
  receives focus".
- **Editor transaction.** #446's moved-first reorder, cross-day move and removal
  proof in `custom-mutation-recovery` now drives Program editor A (#437): the
  day menu's reorder list, the sheet's Move to day and Remove, and Apply. It
  still checks canonical identity, both replicas and reload. With #434's
  cross-day renumbering reverted, the cross-day assertion fails; with main's fix
  it passes.

Tests that landed on main after `147e4afa`:

| Change | Test | Lane |
| --- | --- | --- |
| #442 day-move shape | `test/program-day-move-shape.mjs` | PR (`fast`) |
| #437 editor A | `test/program-editor-a.mjs` | PR (`entry`) |
| #442 editor A days | `test/program-editor-a-days.mjs` | PR (`entry`) |
| #437 editor A, existing suites adapted | `program-editor-text-fields` (renameBack) | PR (`entry`) |
| #437 editor A, existing suites adapted | `program-editor-sorting`, `-drag-selection`, `program-draft-*`, `program-actions`, `slot-alternates`, `ui-plan-050-editor` and others | full |
| #435 guide modal | `test/guide-modal.mjs` | PR (`workout`) |
| #435 guide states in other suites | `entry-guides`, `progress-guides`, `guide-eligibility`, `journeys-in`, `accessibility` and others | full |
| #435 catalog guide states | `tools/ui-screens/screens-app.mjs` states, verified by `capture-ui-screens --verify` and `check-ui-system` | full (every frame); PR critical cell `settings/guides-replay` |
| #435/#457 checker self-tests (`renderedHold`, modal-inert, #439 sampler) | `test/ui-system-checker.mjs` | PR (`workout`) |
| #435 `UI_SYSTEM_SHARDS=7` | `tools/check-ui-system.mjs --shard k/7` | full |
| #450 free-form import diagnosis | `test/program-freeform-import.mjs` | PR (`entry`) |
| #459 unique day names (`restDayNames`) | `test/program-editor-text-fields.mjs` | PR (`entry`) |
| #443 keyboard-up in Focus | `test/focus-space-summary.mjs` | full |
| #452/#455 layer-status and import-review insets | `test/shell-chrome-clearance.mjs` | full |
| #452 landing-variants observers | `test/landing-variants.mjs` | full |
| #437 simulation adapted to editor A | `test/simulation.mjs` (52 weeks and `--smoke`) | full |

Every full-lane test keeps its failing-first proof. It runs unchanged, now on
`main` rather than on each PR.

### Program Lab (#432)

Program Lab's suites follow the same line: the PR lane guards production. It
runs `programlab-default-parity` (233 corpus/split/prescription cases produce
byte-identical complete results with the engine-policy seam omitted, explicit
or traced), `programlab-native-policy` (the seam's validation and native
policies) and `programlab-store` (Lab storage never touches production
storage). `pages-deploy-boundary` keeps the Lab out of `dist/`. Lab-internal
behaviour (domain planning, archives and their 500 MiB limits, packaging and
the packaged browser journeys, including the corpus run) runs in the full lane.

