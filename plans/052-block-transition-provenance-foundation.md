# Plan 052: Block-transition provenance foundation

Implementation and review use the [evidence protocol](../docs/agents/implementation-evidence.md)
and this plan's [first proof checkpoint](../docs/agents/ui-overhaul-proof-checkpoints.md).

- **Plan number:** 052
- **Phase:** 2B — State and lifecycle foundations
- **Status:** Planned; implementation has not started
- **Owner approval state:** Transition directions are approved; exact recovery-week allocation remains the Plan 049 owner gate
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
- No implementation of recovery until the Plan 049 exact-allocation owner gate is recorded.

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
createdAt, confirmedAt, reassessmentDueAt
```

`slot` is the stable program slot identity (compiler `slotId`);
`movement` is the library/custom movement identity in `library:` form.
Repeated movements in different slots — the fixtures contain protected and
reducible leg-press slots for the same movement — must never share an entry.

It applies only to working-set volume. It retains at least one working set for each approved primary movement pattern, may cross ordinary `minSets` under this named policy, and restores base prescriptions in week two without a data migration. Plan 049's selected deterministic allocation/rounding rule is an input; absent that version, `proposeRecoveryWeek` is disabled.

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
- recovery ineligible because evidence is insufficient, no stagnation/decline, or no corroboration;
- recovery eligible, preview, confirmed, active week one, canonical week two, and reassessment due;
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
- Recovery eligibility rejects insufficient/untested evidence and missing corroboration; approved policy satisfies target/retained-primary invariants and restores canonical week two.

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

The exact recovery-week allocation/rounding/primary-pattern policy version from Plan 049 must be approved before the recovery slice. Sibling, permanent-volume, and provenance work may proceed independently. No agent may choose the constant to unblock itself.

## STOP conditions

- Stop if a sibling cannot be reconstructed from explicit family/compiler metadata.
- Stop if an identity match would require fuzzy/display-name matching.
- Stop if a volume action crosses protected/minimum work, except the separately approved recovery policy.
- Stop recovery work without the owner-approved deterministic rule.
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
| 5 | `feat(program): model approved recovery-week overlays` | Owner-selected eligibility/allocation, provenance, week-two restoration | transition/schedule modules, fixtures/tests | Commit 2 plus owner gate | Representative families, boundary/time/reassessment tests | Compiler/progression/generative suites | None | Link owner decision and policy version | Feature-disable overlay; retain parser |
| 6 | `feat(program): commit transitions with atomic provenance` | Successor/archive links, idempotent CAS, backup round-trip, draft-safe commit | `app.js` storage adapter, transition module, backup/race tests | Commits 3–5 as applicable | Crash/two-tab/duplicate/stale fault matrix | Thermonuclear, backup, program-entry suites | None | Record each fault point and SHA | Roll forward parser; disable new commits if needed |
| 7 | `test(program): prove transition recovery across upgrades` | Old/new schema, corrupt overlay, SW upgrade, guided repair no-mutation evidence | tests, `sw.js`/script revisions, docs | Commits 2–6 | Upgrade/recovery matrix | Full browser/generative regression | None | Complete handoff and recovery limits | Revert evidence/cache only with consumer disablement |

After each row: mark 🟡; implement only that contract; run its focused proof; inspect the complete diff; remove unrelated changes; commit; push immediately; update the PR; proceed only from a reconstructable remote boundary.

## Implementation-agent operating protocol

### Branch/worktree contract

- **Branch:** `ui-overhaul/052-transition-provenance`
- **Worktree:** `../repforge-ui-052-transitions`
- **Base:** current `origin/main`
- **Dependency gate:** Plan 049 merged; recovery slice additionally waits on its owner selection
- **Primary files:** new transition module, compiler/entry adapters and fixtures, `app.js` commit adapter, backup/race tests, script/cache inventory
- **Shared hotspots:** `app.js`, `program-compiler.js`, `program-entry-adapter.js`, `sw.js`, backup/storage tests
- **Conflicting phases:** Plan 056 consumes this and must not define a competing proposal/archive model
- **Safe parallelism:** Plan 051 workout state and Plan 050 UI fixes; serialize `app.js`, cache, and generated fixture merges
- **Integration order:** 049 → 052 → 056; Plan 052 should merge before Progress UI starts its transition-action slice

Fetch/inspect main, branches, worktrees, and PRs; resume existing work. Use one dedicated worktree, keep coordination checkout clean, never copy uncommitted files or delete others' work. Push `chore(plan-052): start implementation`, open a draft PR, and populate it before substantive code. Target main. When prerequisites merge, fetch and explicitly merge `origin/main`, resolve deliberately, rerun affected verification, push, and update the PR. Never rebase published history.

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

Push each coherent tested slice immediately and update the PR row/evidence/next steps. Never amend, rebase, force-push, silently rewrite, or use a stash as handoff after publication. Do not checkpoint known-broken behavior; return to the previous pushed boundary if a slice cannot close. Do not duplicate prerequisites or copy/cherry-pick unpublished sibling work. Record owner recovery selection and all test seeds/fault points in the repository/PR. Before stopping, run `git status --short`; handoff requires clean state. Unless authorized, stop at owner review rather than merge.

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
