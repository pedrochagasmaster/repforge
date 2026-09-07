# Plan 052: Block-transition provenance foundation

Implementation and review use the [evidence protocol](../docs/agents/implementation-evidence.md)
and this plan's [first proof checkpoint](../docs/agents/ui-overhaul-proof-checkpoints.md).
External Herdr workers additionally follow the [Herdr dispatch procedure](../docs/agents/herdr-ui-overhaul-execution.md)
and the [Herdr worker packets](#herdr-worker-packets) section below. The coordinator completes every packet field and
fills live SHAs, thread ID, server origin, and PID into the shared packet template before dispatch; the SHAs, branch
names, and revision numbers written in this plan are historical anchors, not current run state.

- **Plan number:** 052
- **Phase:** 2B — State and lifecycle foundations
- **Status:** Implementation in progress — PR #228 (branch `ui-overhaul/052-transition-provenance`, head
  `d1a84ea098bdba6a16f99a0a80e39e9fcae780f1`); atomic rows 1–2 published. Resume that branch and PR; do not restart the
  transition module or open a second kickoff PR. Revalidate this dated fact before resuming.
- **Owner approval state:** Transition directions and recovery policy version 2
  are approved. Recovery consumes the closed Rule B contract in
  `docs/recovery-week-policy.md`.
- **Depends on:** Plan 049 canonical transition/recovery contracts; Plan 047/048 compiler and entry foundations already on main
- **Blocks:** Plan 056 Progress and block lifecycle
- **Governing G decisions:** G-24, G-27, G-31–G-36, G-53–G-56, G-60–G-61, G-70, G-77
- **Governing UI findings:** Architectural prerequisite beneath UI-10; supports UI-09, UI-11, and UI-12 eligibility semantics
- **Affected surfaces:** Program replacement/archive state, compiler sibling resolution, transition previews, guided repair handoff, recovery-week schedule overlay
- **Complexity:** Very high
- **Risk:** Very high — irreversible program replacement, provenance loss, and unsafe recommendations

## Problem statement

Current block review can label a generic `reduce_volume` and build a successor by choosing an alternate or adding/removing a set. It does not distinguish fewer available days from sessions that are too long, prove that a same-family sibling is reconstructable, preserve a complete transition record, or model a temporary recovery week separately from canonical progression. `commitProgramReplacement()` provides a strong atomic activation/archive boundary, but the proposal and archive do not yet prove exactly how the successor was derived.

Plan 056 cannot safely expose structural actions until this phase makes each proposal reproducible, previewable, stale-safe, and provenance-preserving.

## Approved direction

- Schedule repair first asks whether the constraint is fewer days or sessions that are too long.
- Prefer a reconstructable lower-frequency or shorter-duration sibling in the same family.
- If safe recompilation is unavailable, preserve the exact program and enter a guided editor with the diagnosed constraint highlighted.
- Permanent volume reduction is a separate explicit action and respects protected/minimum work.
- Recovery is an eligible, confirmed, volume-only first week of the next normal block; week two restores the canonical prescription.
- Every structural proposal previews the exact diff, preserves provenance, archives atomically, and cannot activate from insufficient evidence.

## Preserved strengths

Preserve deterministic compiler/family output, stable exercise and progression identity, explicit candidate activation, immutable history/archive facts, existing atomic program/draft replacement, safety-language boundaries, local-first operation, and exact setup-link validation. Recovery remains distinct from proven progression strategies and existing re-entry prescriptions.

## Non-goals

- No Progress navigation/UI, questionnaire copy, chart, or outcome presentation; Plan 056 owns those.
- No general intervention engine, automatic lifecycle optimization, arbitrary program-family search, or silent mutation.
- No new load, RIR, frequency, or progression formula.
- No change to setup-link identity acceptance, fuzzy matching, program-entry candidate semantics, or broad program lifecycle roadmap.
- No recovery implementation may invent a policy outside the approved version
  2 contract or clamp a program's percentage to the acceptance band.

## Current-state audit

- `program-compiler.js` implements compiler schema v2 over 20 authored family siblings. Compiler output already carries family, blueprint, compiler, catalogue, rules, context/profile, and recent-consistency provenance plus stable `programStructure` day records and `weekPrescriptions`.
- `ProgramEntryAdapter.compile()` returns a primary candidate and currently `alternative: null`; sibling resolution is not a generic runtime transition API.
- Program metadata carries `entrySource`, progression relations/modifiers/incompatibilities, and program structure. Identity is preserved through library/custom exercise records, not display names.
- `buildBlockReview()` in `app.js` compares current data and emits a simplified recommendation. It can compare a partial active block against the full planned block, which Plan 056 will correct.
- Current successor logic selects the first alternate or increments/decrements sets. It cannot prove a lower-frequency/shorter-session family reconstruction and does not apply compiler protected/optional semantics.
- `commitProgramReplacement()` already archives the outgoing program and uses durable CAS plus `_storageDraftTransaction` to keep active drafts consistent. Archive entries include the old program/meta and review but not a normalized transition-in/out pair.
- Compiler `weekPrescriptions` already models re-entry reductions for some programs. The new recovery week must remain a separate policy so it cannot be mistaken for re-entry or a progression strategy.

## Architecture

Add a dependency-free transition domain module, such as `program-transition.js`, loaded before `app.js`. It operates on validated compiler/program snapshots and has no DOM, storage, locale, or clock access.

```text
diagnose(input) -> eligible diagnoses and evidence reasons
proposeSibling(kind, predecessor, compilerContext, targetConstraint) -> Proposal | Unavailable
proposeVolumeReduction(predecessor, policyVersion) -> Proposal | Unavailable
proposeRecoveryWeek(predecessor, evidence, approvedPolicy) -> Proposal | Ineligible
diff(predecessor, successor/effectiveSchedule) -> StableDiff
validateProposal(proposal, currentPredecessor) -> valid | stale | invalid
commitRecord(proposal, confirmedAt) -> TransitionRecord
```

The module creates immutable proposals. Preview renders the exact proposal; confirmation submits its hash. The storage adapter re-reads predecessor identity/revision/fingerprint under the existing program lock and rejects any stale proposal before invoking `commitProgramReplacement()`.

### Transition record

The Phase 049 schema becomes a concrete versioned document with these minimum fields:

```text
schemaVersion, transitionId, kind, status
createdAt, confirmedAt
predecessor: { programId, fingerprint, durableRevision, source, compilerProvenance }
diagnosis: { kind, answers, eligibleEvidenceIds, insufficientEvidenceReasons }
derivation: { mode, request, compilerContextVersions, policyVersions, slotMapping }
successor: { programId, fingerprint, source, compilerProvenance }
diff: { days[], exercises[], prescriptions[], recoveryWeek? }
progressionContract: { preservedRelations[], resetRelations[], incompatibilities[] }
archiveId, proposalHash
```

`slotMapping` is the exhaustive deterministic predecessor/successor slot
pairing from the Plan 049 contract
(`docs/block-transition-provenance.md`): one-to-one coverage, the three-pass
same-template pairing rule, and canonical array order. It is hashed proposal
data; only its prose fields are excluded from the preimage.

Store transition-in on successor metadata and transition-out/link in the outgoing archive entry. History/log rows remain immutable and continue to point to their original program/session identities. A normal backup round-trip retains both records.

### Same-family sibling resolution

Build a compiler-facing resolver over authored family metadata rather than naming conventions:

- lower-frequency selects only a family sibling whose supported schedule matches the confirmed lower day count;
- shorter-session selects only a sibling/compile result whose explicit duration target is below the predecessor while frequency remains the same;
- current profile, environment, avoidance, priorities, preferred-exercise, and versioned compiler context are carried forward where valid;
- the compiler returns the full successor and provenance; the resolver never edits days/sets after compilation to make a candidate fit;
- candidate identity/progression relations are reconciled by stable library/custom IDs and compiler relation contracts, never fuzzy names;
- if the historical compiler/rules/catalogue version cannot reconstruct safely, return `Unavailable` rather than compile under silently different assumptions.

When unavailable, create a `guided_manual_repair` draft that is an exact copy of the current program and a diagnostic instruction (`fewer_days` or `sessions_too_long`). No archive/replacement occurs until the user makes explicit changes and activates through the existing candidate-draft/commit boundary.

### Permanent volume reduction

Use program/compiler metadata to classify optional, reducible, minimum/protected, and primary work. The policy must:

- remove optional work before reducing protected work;
- never cross ordinary minimum/protected constraints;
- preserve exercise/day identity and progression strategies;
- produce an exact per-exercise set diff and return unavailable when no safe reduction exists;
- never implement the current blanket ±1-set shortcut.

### Recovery-week schedule policy

Represent recovery as an overlay linked from the transition record:

```text
schemaVersion, policyVersion, transitionId, blockId
activePeriod: nextBlockWeek1
eligibilityEvidence
baseProgramFingerprint
entries: [{ slot, movement, movementPattern, baseWorkingSets,
            effectiveWorkingSets, removedOptionalFirst, reason }]
createdAt, confirmedAt, reassessmentDueAt,
reassessmentOutcome: null | "Better" | "About the same" | "Worse"
```

`slot` is the stable program slot identity (compiler `slotId`);
`movement` is the library/custom movement identity in `library:` form.
`movementPattern` stores the canonical primary pattern class (`knee-dominant`,
`horizontal press`, or `hip/hinge`), or `null` for a non-primary slot. The raw
first-listed compiler template token is an input to the policy mapping and is
not persisted in the overlay. Repeated movements in different slots — the
fixtures contain protected and reducible leg-press slots for the same movement — must never share an entry.

It applies only to working-set volume. It retains at least one working set for each approved primary movement pattern, may cross ordinary `minSets` under this named policy, and restores base prescriptions in week two without a data migration. Plan 049 policy version 2 is the input. The canonical primary patterns are `knee-dominant`, `horizontal press`, and `hip/hinge`; `proposeRecoveryWeek` accepts only sufficient `maintained` or `declined` evidence across at least two of them plus a local checkpoint `Yes` answer to the approved recovery question. `No` and `Not sure` are ineligible. It applies Rule B unchanged, including the two version-allowlisted fixture misses, and rejects unreviewed program versions outside the 40–60% band. It does not clamp percentages or alter the canonical prescription.
`reassessmentOutcome` is persisted as `null` until week one ends and then as
exactly one of `Better`, `About the same`, or `Worse`. Week two always restores
the canonical prescription; `About the same` and `Worse` route to ordinary
Review without automatic mutation, and no recovery extension or repeat is
allowed in the same block. A future recovery requires a future block boundary,
fresh evidence, and a fresh `Yes` answer.

## Domain/state model

Transition kinds are closed: `same_family_sibling`, `lower_frequency_sibling`, `shorter_session_sibling`, `guided_manual_repair`, `reduce_training_volume`, `recovery_week`, and any already approved no-structure action such as repeat/continue. UI action vocabulary (`progress`, `repeat`, `review`) is presentation; observed outcomes (`improved`, `maintained`, `declined`) are evidence. `insufficient` is not an outcome and cannot satisfy eligibility.

Proposal status is `preview`, `stale`, `confirmed`, `committed`, or `failed-before-commit`. There is no partly committed successor. Stable diff entries name identity, before, after, and reason; prose-only diffs are invalid.

## Migrations

- Add optional transition fields to program metadata/archive schema with backward-compatible parsing. Historical programs without them remain valid and are labeled `legacy/no transition record`, not reconstructed speculatively.
- Add the versioned recovery overlay section; absence means canonical schedule.
- Extend backup/export/import validation and shared-setup boundaries deliberately. Active transition history/provenance belongs to device durable state and backup; setup proposals carry only the active program's safe compiler provenance, not private outcome/readiness evidence or archive history.
- Preserve existing re-entry `weekPrescriptions` exactly.
- Any generated/compiler fixture updates come from the authoritative builder; do not hand-edit generated artifacts.

## UX state specification

This foundation exposes test hooks/adapters, not final Progress UI. It must nevertheless define consumer states:

- eligible sibling proposal with reconstructable exact diff;
- no safe sibling, with exact-program guided repair candidate;
- safe/unsafe permanent-volume proposal;
- recovery ineligible because evidence is insufficient, fewer than two
  qualifying primary patterns exist, the checkpoint answer is `No` or `Not
  sure`, or the answer is missing;
- recovery eligible, preview, confirmed, active week one, canonical week two, and reassessment due with a persisted `null`-before-reassessment or closed outcome;
- proposal stale because program/revision/context changed;
- commit in progress, complete with archive link, or failed without mutation.

## Accessibility

The domain provides structured before/after rows and reasons so Plan 056 can announce them without color. Proposal eligibility/unavailability has machine-readable reason codes for complete localized messages and disabled reasons. Confirmation focus cannot advance on stale/failed proposals.

## Localization

No localized strings enter records, hashes, diagnoses, or diffs. Codes map to complete EN/PT-BR messages at the UI adapter. Program/exercise display names may be captured for historical readability but never serve as identity.

## Responsive behavior

No visual layout ships. Structured diffs must support summary rows and drill-in rather than requiring a wide table, including 320px and 200% text.

## Light/dark

No theme dependency.

## Offline/PWA

Diagnosis, proposal, preview data, and commit remain offline. The compiler and transition module are cached in the service-worker shell with current lockstep revisions. No transition depends on the install-transfer backend.

## Failure and recovery

- Compiler/version unavailable: return guided repair; preserve exact active program.
- Stale preview: reject under lock, mutate nothing, regenerate only after explicit user review.
- Crash before durable transaction: predecessor remains active.
- Crash during archive/successor/draft transaction: existing boot replay completes one coherent outcome; add faults proving archive, successor, and draft agree.
- Duplicate confirm: transition ID/proposal hash makes commit idempotent; exactly one archive entry.
- Recovery overlay corrupt/unknown: do not guess reduced volume; render canonical prescription with an explicit recoverable warning and retain raw evidence for support/export.
- Week boundary/reload/time-zone change: derive period from existing block/week semantics, not a client timeout.

## Privacy

Readiness/corroboration answers and outcome evidence stay in local durable state/backup. Setup sharing excludes them. Logs and telemetry never include proposal/program contents or answers.

## Telemetry

No event is added here. Plan 056 may use only approved coarse task outcomes after Phase 049 schema review; recommendation evidence and user answers are excluded.

## Testing and executable evidence

### Pure/compiler tests

- Resolve the correct lower-frequency and shorter-duration sibling for every authored family where one exists; return unavailable for no sibling, custom/imported/manual, rules drift, and unsupported historical compiler versions.
- Exact reconstruction is deterministic for identical inputs/provenance.
- Stable diff covers every day/exercise/order/set/prescription change and no unchanged identity is lost.
- Progression relations/strategies survive compatible transitions; incompatible/reset decisions are explicit.
- Permanent volume protects minimum work and removes optional work first.
- Recovery eligibility rejects insufficient/untested evidence, fewer than two
  qualifying primary patterns, `improved` outcomes, `No`/`Not sure` answers,
  and missing checkpoint data. Approved policy satisfies target and retained-
  primary invariants, records `Better`/`About the same`/`Worse` locally after
  week one, restores canonical week two, and permits no same-block extension
  or repeat.

### Adversarial/storage tests

- Stale proposal, two tabs confirming, duplicate confirm, crash at every archive/successor/draft boundary, retry, old archive schema, backup round-trip, and service-worker upgrade.
- Guided repair never modifies/archive current program before explicit activation.
- Transition proposal hash changes if any predecessor/context/diff fact changes.

### Production-backed proof

Use a hidden/test-only adapter to propose and commit each transition through actual storage. Verify current program, outgoing archive, active draft disposition, history identity, transition-in/out links, reload, and backup restore. Do not expose final Progress controls in this phase.

## Screen catalog changes

- **New states:** none; final consumer states are Plan 056.
- **Removed states:** none.
- **Changed states:** none expected.
- **Matrix expansion:** none. If a recoverable corruption state must be public now, add it in EN/PT, light/dark, compact/200% and record why it could not wait.

## Owner gates

The recovery constants are closed by Plan 049 policy version 2. The recovery
slice must preserve that version and its version-specific allowlist. Owner
review still covers the resulting transition previews and physical UI evidence;
no implementation may silently reinterpret the policy.

## STOP conditions

- Stop if a sibling cannot be reconstructed from explicit family/compiler metadata.
- Stop if an identity match would require fuzzy/display-name matching.
- Stop if a volume action crosses protected/minimum work, except the separately approved recovery policy.
- Stop recovery work if the policy version, eligibility question/answers,
  pattern evidence, allowlist, or week-two restoration contract drifts.
- Stop if a transition would silently change progression strategy, load/RIR/frequency, history, or active draft.
- Stop before adding final Progress UI or a general intervention framework.

## Rollback

New schema fields are optional to older state, but rollback code must preserve unknown transition/recovery sections rather than strip them. Transition activation can be feature-disabled while records remain readable. Each compiler/proposal/storage slice is independently revertible before any production-created successor depends on it. After shipping, roll forward parser fixes; never revert to code that misreads an active recovery overlay.

## Atomic commit sequence

| # | Exact commit message | Contract delivered | Likely files | Prerequisite | Focused proof | Broader regression | Catalog impact | PR-body update | Rollback boundary |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `test(program): characterize replacement and compiler provenance` | Baseline archive/identity/compiler behavior and failure fixtures | program/compiler/archive tests | Plan 049 schemas | Existing behavior fixtures and unsupported cases | Compiler/program-entry tests | None | Record exact current gaps | Tests only |
| 2 | `feat(program): add immutable transition proposals and diffs` | Closed kinds, proposal hash, stable exact diff, validation | new `program-transition.js`, pure tests, script/cache inventory | Commit 1 | Determinism/staleness/diff unit+property tests | Generative/compiler smoke | None | Record schema/API/version | Revert module before storage integration |
| 3 | `feat(program): resolve safe family schedule transitions` | Lower-frequency/shorter-session recompilation and guided repair fallback | compiler/adapter/transition module, family fixtures/tests | Commit 2 | All-family matrix and unsupported-version cases | Plan 047/048 suites | None | Record supported/unavailable matrix | Revert resolver; proposals remain unused |
| 4 | `feat(program): propose protected volume reductions` | Optional-first permanent reduction respecting constraints | transition module, compiler metadata/tests | Commit 2 | Protected/minimum property tests | Compiler/generative CI | None | Record policy version/invariants | Revert volume kind only |
| 5 | `feat(program): model approved recovery-week overlays` | Policy v2 eligibility/allocation, provenance, week-two restoration | transition/schedule modules, fixtures/tests | Commit 2 plus Plan 049 policy v2 | Representative families, eligibility negatives, boundary/time/reassessment tests | Compiler/progression/generative suites | None | Link policy version and exact proofs | Feature-disable overlay; retain parser |
| 6 | `feat(program): commit transitions with atomic provenance` | Successor/archive links, idempotent CAS, backup round-trip, draft-safe commit | `app.js` storage adapter, transition module, backup/race tests | Commits 3–5 as applicable | Crash/two-tab/duplicate/stale fault matrix | Thermonuclear, backup, program-entry suites | None | Record each fault point and SHA | Roll forward parser; disable new commits if needed |
| 7 | `test(program): prove transition recovery across upgrades` | Old/new schema, corrupt overlay, SW upgrade, guided repair no-mutation evidence | tests, `sw.js`/script revisions, docs | Commits 2–6 | Upgrade/recovery matrix | Full browser/generative regression | None | Complete handoff and recovery limits | Revert evidence/cache only with consumer disablement |

After each row: mark 🟡; implement only that contract; run its focused proof; inspect the complete diff; remove unrelated changes; commit; push immediately; update the PR; proceed only from a reconstructable remote boundary.

## Herdr worker packets

The atomic commit sequence above is the delivery contract and does not change. Each row is dispatched to a less capable
external worker as one or more **self-contained packets** built with the
[Herdr dispatch procedure](../docs/agents/herdr-ui-overhaul-execution.md). The coordinator fills every field of that
procedure's packet template — base/head SHA, resume facts, read/write/forbidden paths, oracle, proof-first assertion
locations, focused commands, STOP, reviewer gate — before dispatch. No packet asks a worker to design a phase.

Rules for every packet in this plan:

- **Tests land before or with production.** A packet's PLANNED assertion file is written with its independent expected
  values before the implementation edit; a test-only commit is used whenever it can pass alone.
- **Anchors are concrete.** Each packet names the existing producer, consumer, and test file it builds on. Paths that do
  not exist yet are marked **NEW** (created by this plan) or **PR228-only** (published on
  `ui-overhaul/052-transition-provenance`, absent from main `c3491c5e`). Do not present a NEW or PR228-only command as
  runnable on main.
- **The oracle is independent.** Expected pairing, order, allocation, and eligibility values come from
  `docs/block-transition-provenance.md` and `docs/recovery-week-policy.md`, never from the module under test.
- **Every packet carries a deliberate failing case** and stops at its STOP boundary. The coordinator reproduces the
  risky assertion before the next packet of that row is dispatched.

### PR #228 is in progress — resume, do not restart

Rows 1–2 are already published on branch `ui-overhaul/052-transition-provenance` (PR #228), head
`d1a84ea098bdba6a16f99a0a80e39e9fcae780f1`, four commits:
`chore(plan-052): start implementation` → `test(program): characterize replacement and compiler provenance` (row 1)
→ `feat(program): add immutable transition proposals and diffs` (row 2)
→ `fix(program): validate complete sibling proposal contract` (row 2 follow-up).
They add `program-transition.js`, `test/program-transition.mjs`, and `test/program-transition-compiler-provenance.mjs`
(all **PR228-only**). `program-transition.js` exposes `RepForgeProgramTransition` with `SCHEMA_VERSION`,
`SLOT_MAPPING_SCHEMA_VERSION`, `canonicalProposalJson`, `hashProposal`, `fingerprintCompilerInstance`,
`fingerprintCompilerContext`, `buildSlotMapping`, `buildExactDiff`, `createSiblingProposal`, and `validateProposal`.

Do not open a second PR, recreate the module, or introduce new `rawDraft` replacement semantics. Storage packets use the
current DraftV2 `flush`/`checkpoint`/`read` authority on `window.__repforgeWorkoutDraft` and the existing
`commitProgramReplacement()` / `commitProposedState()` source unchanged. Later shared-storage packets (P6, P7) begin by
explicitly merging `origin/main` (Plans 050/051, merged) into the existing branch; that merge is not part of resuming
rows 1–2 and must not modify PR #228 now.

### Row → packet map

| Packet | Maps rows | Bounded objective · mode | Existing anchors (main unless noted) | Proof-first: PLANNED assertion + independent oracle + deliberate failure | Commands: baseline now → planned | STOP · reviewer gate |
|---|---|---|---|---|---|---|
| 052-P0 | 1–2 | Review and resume published rows 1–2: determinism, staleness rejection, exact-diff completeness, proposal-hash sensitivity, and the "complete sibling proposal contract" fix · **plan (read-only)** | PR228-only `program-transition.js`, `test/program-transition.mjs`, `test/program-transition-compiler-provenance.mjs` at `d1a84ea0` | No new assertion; coordinator re-reads both suites and reproduces one staleness rejection and one hash-mismatch rejection from `validateProposal` | baseline: `node --check program-transition.js` on the branch → planned: `node test/program-transition.mjs && node test/program-transition-compiler-provenance.mjs` (branch only, not main) | STOP if a row-1/2 acceptance item is unproven — reduce it to its failing case rather than patch around it · reviewer: coordinator records technical agreement in PR #228 before 052-P3a dispatch |
| 052-P3a | 3 | `proposeSibling(kind, predecessor, compilerContext, targetConstraint)` — lower-frequency and shorter-session resolution over authored family metadata; returns `Proposal \| Unavailable` · **build** | producer `program-compiler.js` (schema v2, 20 authored siblings), `ProgramEntryAdapter.compile()` in `program-entry-adapter.js` (`alternative: null`); tests `test/program-family-fixtures.mjs`, `test/program-compiler-runtime.mjs` | NEW `test/program-transition-siblings.mjs`: for one real family pair, the resolved sibling's supported day count / duration target equals the value in `test/program-family-fixtures.mjs` (oracle = family fixture, not resolver output). Failure: a shorter-session request that only a lower-frequency sibling satisfies must return `Unavailable` | baseline: `node test/program-family-fixtures.mjs` → planned: `node test/program-transition-siblings.mjs` | STOP if a sibling would need fuzzy or display-name matching, or post-compile day/set editing · reviewer: reproduces one resolved pair and one `Unavailable` |
| 052-P3b | 3 | All-family supported/unavailable matrix plus `guided_manual_repair` exact-copy fallback through the existing candidate-draft path · **build** | consumer `commitProposedState()` (`app.js:3638`), `program-editor.js`; `tools/exercise-curation.json`, `tools/build-program-family-fixtures.mjs` | extend `test/program-transition-siblings.mjs`: every authored family classified against a list hand-derived from the curation JSON. Failure: custom or imported program, rules drift, and unsupported historical compiler version each return `Unavailable`, never a silent recompile | baseline: `node tools/build-program-family-fixtures.mjs --check` → planned: `node test/program-transition-siblings.mjs` | STOP if guided repair archives or mutates the program before explicit activation · reviewer: full matrix plus a no-mutation trace |
| 052-P4 | 4 | `proposeVolumeReduction(predecessor, policyVersion)` — optional-before-protected classification, per-exercise set diff, `Unavailable` when no safe cut exists · **build** | replaces the `successorProgramList()` ±1 shortcut (`app.js:3334`; do not reuse it); compiler protected / `minSets` metadata | NEW `test/program-transition-volume.mjs`: property test — protected and `minSets` slots are never reduced, optional work is removed first; expected classification from compiler metadata. Failure: a cut crossing `minSets` is rejected with a reason code | baseline: `node test/generative/run.mjs --profile ci` → planned: `node test/program-transition-volume.mjs` | STOP if any cut crosses protected/minimum work (recovery, 052-P5, is the only exception) · reviewer: reproduces the rejected cut |
| 052-P5a | 5 | `proposeRecoveryWeek(...)` eligibility gate — `maintained`/`declined` across two of `knee-dominant`/`horizontal press`/`hip/hinge` plus a local `Yes` checkpoint; otherwise `Ineligible` · **build** | `docs/recovery-week-policy.md` (Rule B, closed); evidence shape from `buildBlockReview()` (`app.js:3220`) and `blockSnapshot()` (`app.js:3254`) | NEW `test/program-transition-recovery.mjs`: eligibility truth table transcribed from the policy doc, independent of the function. Failure: one qualifying pattern; an `improved` outcome; a `No`/`Not sure`/missing checkpoint — each returns `Ineligible` | baseline: `node test/program-entry-rules-recovery.mjs` → planned: `node test/program-transition-recovery.mjs` | STOP if the eligibility question, its answers, or the pattern set drift from policy version 2 · reviewer: reproduces two `Ineligible` reasons and one eligible result |
| 052-P5b | 5 | Rule B allocation — `removedOptionalFirst`, one working set retained per approved primary pattern, named-policy `minSets` crossing allowed, two version-allowlisted misses, reject versions outside the 40–60% band, no percentage clamp; overlay schema per this plan · **build** | `docs/recovery-week-policy.md`; overlay field list in this plan; slot identity from compiler `slotId` | extend `test/program-transition-recovery.mjs`: per-slot `effectiveWorkingSets` equals the policy doc's worked example; a movement in two slots gets two entries. Failure: a program version outside the band is accepted; a clamped percentage; one shared entry for a duplicated movement | baseline: `node test/progression-fixtures.mjs` → planned: `node test/program-transition-recovery.mjs` | STOP on any clamp or band reinterpretation · reviewer: reproduces the two allowlisted-miss fixtures |
| 052-P5c | 5 | Recovery lifecycle — week-one active marker, canonical week-two restoration with no migration, `reassessmentOutcome` `null` → `Better`/`About the same`/`Worse`, no same-block extension or repeat · **build** | this plan's overlay; `mesocycleLifecycle()` (`app.js:3168`) week/block semantics (period is derived, not a client timeout) | extend `test/program-transition-recovery.mjs`: the week-two prescription equals the pre-recovery canonical prescription exactly; a second recovery in the same block is refused. Failure: week two still reduced; an extension is allowed | baseline: `node test/schedule.mjs` → planned: `node test/program-transition-recovery.mjs` | STOP if week two does not restore canonical work · reviewer: reproduces the week-1 → week-2 boundary |
| 052-P6 | 6 | Atomic commit through storage — re-read predecessor identity/revision/fingerprint under the existing program lock, reject a stale proposal by hash, call `commitProgramReplacement()`, write the TransitionRecord (transition-in on successor meta, transition-out/link on the archive entry), idempotent by `transitionId`/`proposalHash`, draft-safe via `_storageDraftTransaction` · **build** | `commitProgramReplacement()` (`app.js:3362`), `captureProgramReplacement()`, `commitProposedState()` (`app.js:3638`), the `window.__repforgeDraftFault` seam (`app.js:510`); tests `test/thermonuclear-races.mjs`, `test/persistence.mjs`, `test/persistence-race.mjs` | NEW `test/program-transition-commit.mjs`: fault list enumerated up front — crash at the archive / successor / draft boundary, two-tab confirm, duplicate confirm, stale hash; after each, exactly one archive entry and predecessor-or-successor, never mixed. Failure: a duplicate confirm creates a second archive entry | baseline: `node test/thermonuclear-races.mjs` → planned: `node test/program-transition-commit.mjs` | STOP if any boundary yields partial state or a second successor · reviewer: reproduces the archive-crash and duplicate-confirm cases before 052-P7 |
| 052-P7 | 7 | Recovery across upgrades — old/new schema parse, corrupt overlay → canonical prescription plus a recoverable warning, service-worker/script-revision lockstep bump, backup round-trip retains both records, guided-repair no-mutation evidence · **build** | `sw.js` `CACHE = "repforge-v188"` and `?v=188` in `index.html` / `sw.js` `ASSETS`, held in lockstep by `test/exercise-library.mjs`; `test/sw-upgrade.mjs`, backup suites | extend `test/program-transition-commit.mjs` and NEW `test/program-transition-sw-upgrade.mjs`: after a revision bump an old worker cannot execute the new record schema; a corrupt overlay renders the canonical prescription with a warning, never a guessed reduction | baseline: `node test/exercise-library.mjs && node test/sw-upgrade.mjs` → planned: `node test/program-transition-sw-upgrade.mjs` | STOP if rollback code would strip an unknown transition/recovery section · reviewer: reproduces the corrupt-overlay fallback |

### Early vertical slice (optional reorder, scope unchanged)

If safely separable, the coordinator may dispatch a thin **one-real-sibling-pair** slice — compile a sibling via
`program-compiler.js` and the entry adapter, call `createSiblingProposal`, commit through the 052-P6 storage adapter,
reload, and inspect the successor and the archive — as a first `052-P3a` + `052-P6` proof before the full all-family
matrix (052-P3b) and the full fault matrix. This changes dispatch order only: every acceptance item in original rows 3
and 6 is still closed before the completion gate, and the final Progress UI stays in Plan 056. This exists to stop a
large row-6 surprise after weeks of pure-model tests.

## Implementation-agent operating protocol

### Branch/worktree contract

- **Branch:** `ui-overhaul/052-transition-provenance` (exists; PR #228 head `d1a84ea0`, rows 1–2 published)
- **Worktree:** `../repforge-ui-052-transitions`
- **Base:** current `origin/main` (`c3491c5e`, Plans 049/050/051 merged); merge it into the branch before 052-P6/P7
- **Dependency gate:** Plan 049 merged with recovery policy version 2
- **Primary files:** new transition module, compiler/entry adapters and fixtures, `app.js` commit adapter, backup/race tests, script/cache inventory
- **Shared hotspots:** `app.js`, `program-compiler.js`, `program-entry-adapter.js`, `sw.js`, backup/storage tests
- **Conflicting phases:** Plan 056 consumes this and must not define a competing proposal/archive model
- **Safe parallelism:** Plan 051 workout state and Plan 050 UI fixes; serialize `app.js`, cache, and generated fixture merges
- **Integration order:** 049 → 052 → 056; Plan 052 should merge before Progress UI starts its transition-action slice

Fetch/inspect main, branches, worktrees, and PRs; resume existing work. Use one dedicated worktree, keep coordination checkout clean, never copy uncommitted files or delete others' work. PR #228 and its `chore(plan-052): start implementation` commit already exist — resume that PR; do not re-run the kickoff. Target main. When prerequisites merge, fetch and explicitly merge `origin/main`, resolve deliberately, rerun affected verification, push, and update the PR. Never rebase published history.

### Required implementation PR body

```markdown
## Objective
## Scope boundary
### In this PR
### Explicitly out of scope
## Dependencies
- Depends on:
- Blocks:
- Required main state:
- Current dependency status:
## Planned commit sequence
| # | Status | Atomic commit | SHA | Focused verification |
|---|---|---|---|---|
<!-- ⬜ planned; 🟡 in progress; ✅ pushed and verified; ⛔ blocked; ↪ changed -->
## Current state
- Current slice:
- Last pushed SHA:
- Worktree:
- Worktree clean:
- Relationship to main:
- Active blocker:
- Owner decision required:
- Completion-gate status:
## Completed work
## Verification evidence
| Check | Result | SHA |
|---|---|---|
## Risks and decisions
### Confirmed decisions
### Assumptions
### Newly discovered risks
### Outstanding owner decisions
## Next exact steps
1.
2.
3.
## Future plan steps
## Handoff
- Branch:
- Worktree:
- PR:
- Base:
- Current main SHA:
- Last known-good SHA:
- Latest focused tests:
- Latest full regression:
- Latest catalog evidence:
- Latest physical-device evidence:
- Files owned:
- Shared hotspots:
- Blocked on:
- Owner approval required:
- Exact next action:
- Last updated:
```

### Push, history, and handoff discipline

Push each coherent tested slice immediately and update the PR row/evidence/next steps. Never amend, rebase, force-push, silently rewrite, or use a stash as handoff after publication. Do not checkpoint known-broken behavior; return to the previous pushed boundary if a slice cannot close. Do not duplicate prerequisites or copy/cherry-pick unpublished sibling work. Record policy version and all test seeds/fault points in the repository/PR. Before stopping, run `git status --short`; handoff requires clean state. Unless authorized, stop at owner review rather than merge.

## Completion gate

- Transition and recovery primitives are durable, versioned, reconstructable, stale-safe, and recoverable.
- Each sibling proposal comes from explicit compiler provenance or falls back to exact-program guided repair.
- Permanent volume reduction respects protected/minimum work.
- Recovery runs only under the approved deterministic contract, eligible evidence, corroboration, preview, and confirmation; week two restores canonical work.
- Every committed structural transition has exact diff, source/version provenance, one atomic archive, preserved history/identity/strategy contracts, and idempotent retry.
- Insufficient evidence can never create a proposal.
- Crash, duplicate, stale, two-tab, backup, upgrade, and corruption tests pass.
- No final Progress UI/general lifecycle architecture was added.
- Branch/PR are pushed, current, clean, and stopped at owner review.
