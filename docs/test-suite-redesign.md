# Verification by risk

The owner explicitly authorized a ground-up redesign on 2026-10-18. Important
failure detection is the contract; historical test executables, snapshots and
cross-products are not. This supersedes the old requirement to freshly verify
every catalog image on every CI run. Incremental work and measured evidence
remain reviewable in [#444](https://github.com/pedrochagasmaster/repforge/pull/444).

## Acceptance contract

Original baseline: `147e4afa07fea3243efd42b5b7d167c196c6a7ca`, 208 commands in
195 scheduled executable files. Redesign inventory: **97 commands in 97 distinct files**,
including every required verification lane. No unchanged historical suite is
moved to an optional lane to manufacture a speedup. Retired guarantees are
explicit below; the design catalog remains an authoring artifact.

| Guarantee | Cheapest reliable proof | Real browser boundary retained |
| --- | --- | --- |
| Engine correctness and deterministic prescriptions | Shipped compiler/progression modules, fixed corpus, seeded properties, request/layout/periodization boundaries | Worker/fallback, activation, metric and per-side/bodyweight representatives |
| Workout data integrity and recovery | Draft model/migration properties and shared storage contracts | Both durable replicas, cross-tab races, acknowledged DraftV2/CAS, old-writer replay, pending fields, atomic Finish and history replay |
| Import, export, migrations and transfer | Shared production parsers, allowlists, clone/limit/state-machine negatives | Real credential vault/cookies/IDB, import arbitration, rollback, recovery and older workers |
| Program/editor/navigation | Production entry/day-name/identity contracts | Focused text editing (including incoming #445), destructive custom mutation recovery, import review and activation |
| Offline updates and privacy | Release inventory, routing and telemetry contracts | SW upgrade/error/redirect behavior, offline privacy and hostile telemetry leakage |
| Critical UI and accessibility | Explicit representative matrix, public role checker and metadata validation | Fresh pixel/semantic observations, live role/contrast/labels/targets, narrow/large text and modal focus behavior |

The canonical executable inventory remains `test/suites.mjs`. A retirement
ledger maps each former execution to retained owners or an explicitly reduced
guarantee; it is not a second command runner. Independent reviewers assess risk
coverage and measurement methodology separately.

## Deliberately reduced guarantees

The new suite does not promise pixel parity for all 1,118 historical catalog
frames, role/contrast measurement in all 772 state/locale/theme combinations,
every navigation permutation, every animation choreography, cosmetic token
contracts, or the emergent interaction sequence of the year-long simulation.
Representative rendering does not prove those omitted combinations equivalent.
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
