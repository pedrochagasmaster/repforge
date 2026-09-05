# Plan 051: Workout draft state foundation

Implementation and review use the [evidence protocol](../docs/agents/implementation-evidence.md)
and this plan's [first proof checkpoint](../docs/agents/ui-overhaul-proof-checkpoints.md).

- **Plan number:** 051
- **Phase:** 2A — State and lifecycle foundations
- **Status:** Planned; implementation has not started
- **Owner approval state:** Focus-only direction and state-ownership requirement are approved
- **Depends on:** Plan 049 state contract; may develop beside Plan 050 but merges after any shared cache/index changes are reconciled
- **Blocks:** Plan 055 Focus-only workout and Plan 053 logical-clone implementation
- **Governing G decisions:** G-08, G-22, G-41–G-44, G-69, G-77, G-84
- **Governing UI findings:** Architectural prerequisite beneath UI-18; preserves relevant UI-23 behavior
- **Affected surfaces:** Workout draft persistence, List and Focus renderers, save/summary boundary, reload/resume, cross-tab behavior, backup/transfer schema
- **Complexity:** Very high
- **Risk:** Very high — workout data loss or silent stale-tab overwrite

## Problem statement

Focus currently reads and writes values through hidden List-mode inputs. `saveDraft()` scrapes `#workout input[data-k]`; `readSetCandidate()` queries the DOM; off-screen exercises remain hidden markup that acts as the session's data store. In-memory Sets/Maps separately own completed, touched, warm-up, skipped, and substitution state. Removing List now would lose workout truth.

This phase moves all active-session truth into one explicit, versioned draft. Both current renderers become projections of that state until Plan 055 deletes List. It is a data-model migration, not a visual redesign.

## Approved direction

- The DOM renders state and dispatches operations; it never owns durable workout truth.
- Preserve every approved workout capability and the Today → workout → save → summary loop.
- Draft updates survive reload/crash, reject silent stale-tab overwrites, and retain the existing local-only boundary.
- Set completion can be corrected/uncommitted; skip/restore and substitution are reversible; set order is stable.
- Program replacement and draft removal continue to use the existing atomic draft transaction protocol.

## Preserved strengths

Preserve the Today → workout → atomic save → centered summary loop, Focus's one-exercise hierarchy, `Why this weight?`, deterministic recommendations, adjacent set validation, pain/discomfort boundaries, explicit program activation, local-only draft storage, both themes/media contracts, and catalog-backed regression evidence. State refactoring must initially render current List and Focus behavior equivalently.

## Non-goals

- No Focus-only layout, List route deletion, immersive shell, Today preview, or session-sheet redesign.
- No change to progression formulas, `Why this weight?`, program compiler, history schema, or saved-log meaning.
- No cloud draft storage, account, sync, automatic conflict merge, or generalized state framework.
- No new workout capability beyond what parity requires.

## Current-state audit

- `repforge_draft_v1` is an unversioned localStorage object with metadata plus flat keys shaped like `${exerciseId}_${set}_${load|reps|rir|effort}` and marker suffixes including `__done`, `__touched`, `__warm`, `__skipped`, `__substituted`, `__substitutedRef`, and `__exnotes`.
- `saveDraft()` serializes live inputs and Focus effort controls. Reload code reconstructs DOM, Sets, Maps, and substitutions from those flat keys.
- `readSetCandidate()` and save/session-summary paths read input elements. Values for non-current Focus exercises exist only because the List tree remains mounted.
- Current in-memory state includes committed/touched/warm-up sets, skipped exercises, substitutions, session date, bodyweight, notes, selected exercise, rest state, and preview/tour flags. Rest timer countdown itself is volatile and need not survive a crash; completed rest configuration still comes from settings.
- `DraftStore` and `_storageDraftTransaction` already protect draft replacement/removal during program activation. Pending and closing sidecars resolve races across tabs.
- Saved history rows remain the canonical completed-session format; the draft must compile into those rows without changing their interpretation.
- Browser suites `test/focus-mode.mjs`, `test/simulation.mjs`, `test/draft-transaction-races.mjs`, `test/program-draft-set-reduction.mjs`, and `test/thermonuclear-races.mjs` cover much of the current behavior but assume DOM ownership in helpers.

## Architecture

Add a cacheable, dependency-free `workout-draft.js` before `app.js`. It exposes a frozen global such as `RepForgeWorkoutDraft` with pure functions. `app.js` owns I/O/adaptation only.

Required public boundary:

```text
create(programContext, sessionSelection, previousSessionFacts) -> DraftV2
parse(raw, currentProgramContext) -> { kind: valid|legacy|stale|invalid, ... }
migrateLegacy(raw, renderedProgramSnapshot) -> DraftV2 | MigrationError
reduce(draft, command) -> DraftV2 | DomainError
toHistoryRows(draft, completedAt) -> rows
validateForSave(draft) -> issues
serialize(draft) -> JSON-safe document
logicalCloneSection(draft) -> transfer-safe document
```

The module must not inspect `document`, localStorage, current time, locale, or mutable globals. Callers pass generated IDs/timestamps. Commands are exhaustive and tested.

`app.js` maintains one `activeWorkoutDraft` value. Event handlers dispatch a command, persist the resulting revision, then render the affected projection. A failed persist does not show the optimistic result as durable; the user receives an adjacent retry/status action. Rendering List during the migration phase and Focus from the same state proves parity.

### DraftV2 schema

```text
schemaVersion: 2
draftId: random stable ID
revision: non-negative integer
writer: { installationId, tabId, operationId }
program: { programId, programFingerprint, durableRevision, dayId, dayLabel,
           scheduleDate, unit, rirMode }
session: { startedAt, updatedAt, bodyweight, notes, selectedExerciseId,
           status: active|finishing }
exerciseOrder: exerciseInstanceId[]
exercises[exerciseInstanceId]: {
  exerciseInstanceId, sourceExerciseId, libraryId?, displayName,
  programmed: { order, sets, minReps, maxReps, targetRir?, notes,
                progressionStrategy, movementPattern?, sourceFingerprint },
  substitution: null | { original snapshot, replacement snapshot, selectedAt },
  status: active|skipped,
  setupNotes,
  setOrder: setId[],
  sets[setId]: {
    setId, ordinal, role: working|warmup,
    programmed: { suggestedLoad?, minReps?, maxReps?, targetRir? },
    edited: { load, reps, rir?, effort? },
    touched: { load, reps, effort },
    completion: pending | { completedAt } 
  }
}
```

Use existing stable exercise IDs/instance identities; do not derive identity from display names. Preserve programmed snapshots so a later program edit cannot rewrite the active session. Bodyweight and load values use the same canonical/storage units as current history; presentation conversion stays at the boundary.

### Commands and invariants

Commands cover `editSetField`, `completeSet`, `uncommitSet`, `markWarmup`, `markWorking`, `skipExercise`, `restoreExercise`, `substituteExercise`, `restoreOriginalExercise`, `repeatPreviousSetValues`, `setExerciseNotes`, `setSessionNotes`, `setBodyweight`, `selectExercise`, `reorderExercises`, and `beginFinish`/`cancelFinish`.

- A set has one stable identity and ordinal within its exercise. Reordering exercises never reorders sets.
- Completion requires the same required fields as current save semantics; uncommit retains edited values.
- Skip retains the entire exercise subtree; restore reveals the prior edits/completions.
- Substitution records original and replacement identity/provenance and does not reuse a different exercise's historical identity.
- Repeat-last copies eligible values as an explicit edit and records touch state; it never marks the set complete.
- Warm-up status is explicit per set and excluded from working-set analysis exactly as today.
- Early finish operates on a snapshot revision; save rejects if the draft changed after confirmation opened.
- `toHistoryRows()` is deterministic and cannot read the DOM.

### Persistence and cross-tab protocol

Persist the whole validated V2 document under the historical `repforge_draft_v1` key to keep storage scope stable. Use the existing draft Web Lock/sidecar transaction boundary and add compare-and-swap on `draftId + revision`.

1. Each command names a unique `operationId` and expected revision.
2. Under the draft lock, re-read the live document.
3. If expected revision matches, write revision + 1 atomically and read it back.
4. If the same `operationId` is already applied, return success idempotently.
5. If revisions conflict, never last-write-wins or auto-merge. Return a stale-tab state, preserve the winning draft, and offer reload; the stale tab may export/copy its unsaved field value before rerender.
6. Draft removal carries the expected `draftId` and revision so a stale close/save cannot resurrect a cleared draft.

Throttle/coalesce text-field persistence only within one operation stream and flush on blur, visibility change, navigation, and `pagehide`. Completion, skip, substitution, session metadata, and finish transitions persist immediately.

## Domain/state model

DraftV2 is the sole active-session aggregate. Its closed commands and invariants are defined above; UI-only state may remember an open sheet, focus target, pointer gesture, or animation, but it cannot duplicate values required for reload/save. Program and prior-session facts are immutable inputs captured by identity. Saved History remains a separate durable aggregate produced only by `toHistoryRows()` at explicit finish. A draft is active or absent—there is no hidden second List/Focus copy.

## Migrations

On boot, parse in this order: valid V2; legacy V1-shaped flat object; absent; invalid.

- Legacy migration runs once using the captured program/day snapshot and the same substitution/library resolution rules current code uses.
- Convert every flat field and marker, including values on hidden/off-screen List inputs; preserve date/bodyweight/notes/selected exercise where present.
- After validation, write V2 with a migration operation ID and re-read before rendering. A repeated boot is idempotent.
- If a legacy exercise/set cannot be mapped without guessing, retain the raw draft in a recovery slot, show a fail-closed recovery message, and do not silently clear it.
- Keep legacy read support for one cache-upgrade window so an older controlling worker cannot destroy the draft. Remove it only in a separately proven later commit, not Plan 055.
- Backup round-trip must preserve ordinary durable state and history; active drafts remain outside standard backups unless Phase 049's canonical backup contract is explicitly changed. The install-transfer logical clone does include V2.

## UX state specification

This phase keeps existing List/Focus presentation while adding only state integrity states:

- active, clean draft;
- persisting and persisted (usually silent, announced only if delayed);
- recoverable persist failure with Retry;
- stale tab with Reload latest and non-destructive copy/export of the pending field;
- program mismatch/stale draft with explicit discard or return to matching program where possible;
- legacy migration in progress/success;
- invalid legacy recovery without data deletion;
- finish validation issues adjacent to affected sets;
- save in progress, committed summary, or save failure returning to the same draft.

The draft must not mint a session merely by previewing Today. Plan 055 consumes `create()` only on Start workout.

## Accessibility

State rerenders preserve logical focus by stable exercise/set/field identity and restore it after DOM replacement. Persist failure, stale-tab conflict, completed/uncommitted changes, skip/restore, and save result have polite/assertive announcements proportional to urgency. Validation is adjacent and linked. Keyboard and screen-reader control names include exercise, set ordinal, field, value, and completion state without depending on visual position.

## Localization

Domain values are locale-neutral. Only adapters generate EN/PT-BR messages. Recovery/conflict/invalid-draft copy uses complete localized messages. Never persist translated role labels or parse localized visible text back into state.

## Responsive behavior

No intended visual change. Prove both current modes at 320px, canonical phone, 430px, applicable desktop, 200% text, and PT-BR demanding cases because state-driven rerender must not change geometry or focus.

## Light/dark

No theme logic in the domain module. Existing token-swap output must remain equivalent in both modes.

## Offline/PWA

Draft creation, editing, reload, and save remain fully offline. Add the new script to the service-worker asset inventory and current lockstep revision set. Test an upgrade where an older worker wrote legacy V1 and the new worker/app migrates it once.

## Failure and recovery

- Crash between command and write: old complete revision remains.
- Crash after write before render: boot reads the new complete revision.
- Persist quota/error: live durable revision remains; UI marks unsaved operation and offers retry.
- Stale tab: winning revision preserved; no implicit merge.
- Draft removal race: closing marker/expected ID prevents resurrection.
- Save crash: existing durable-state write-ahead and draft transaction make either the session commit with draft cleared or the prior draft recoverable; add an end-to-end fault point for each boundary.
- Program replacement: current `_storageDraftTransaction` captures/reconciles exactly the V2 draft.

## Privacy

The draft remains localStorage-only and contains sensitive training/free-text data. Never log its content or add it to telemetry. Transfer serialization is an explicit Phase 053 boundary and strips writer/tab/operation metadata that is not logical user state.

## Telemetry

None. State integrity errors may be counted only if a later approved schema uses coarse error codes without workout content; that is not authorized here.

## Testing and executable evidence

### Pure model

- Creation and exhaustive command transition tests, including illegal transitions.
- Stable set/exercise identity, ordering, skip/restore, substitution restore, warm-up, repeat-last, correction/uncommit, session notes/bodyweight, and deterministic history compilation.
- Property tests: serialize/parse round-trip; command replay idempotence; no command mutates input; reordering preserves set order/content; skip/restore and substitute/restore preserve prior state.

### Persistence/adversarial

- Legacy migration with every marker/field and off-screen exercise.
- Crash before/after write, quota failure, corrupt/unknown schema, partial local write, retry, and read-back mismatch.
- Two tabs editing same revision, stale completion, stale draft removal, duplicate operation, closing-marker race, and program activation race.
- Service-worker old/new script interaction and reload while Focus is on a non-first exercise.

### Production-backed journeys

- List and Focus show identical V2 values throughout the migration phase.
- Repeat last, substitution, warm-ups, notes, bodyweight, skip/restore, uncommit, early finish, reload/resume, save, summary, history, and Progress facts remain correct.
- Browser suites must stop filling/querying hidden List inputs as their test API; use visible controls or an explicit test-only state hook that calls the domain module.

Run pure Node tests first, then draft/race suites, `test/focus-mode.mjs`, `test/session-summary.mjs`, history/Progress integration, full browser regression, and the generative suite. Record exact fault-injection results.

## Screen catalog changes

- **New states:** stale-tab draft; recoverable invalid/legacy draft only if these are user-visible rather than test-only.
- **Removed states:** none.
- **Changed states:** current List, Focus, note, timer, and summary frames should be visually unchanged except integrity messages intentionally captured.
- **Matrix expansion:** new error states receive EN/PT light, dark, compact, and 200% coverage as their risk demands.

## Owner gates

None. The state contract is an implementation prerequisite, not a new product choice. Owner review should compare behavior parity, not select a storage design.

## STOP conditions

- Stop if any workout value still requires a DOM query to save, resume, navigate, or compile history.
- Stop if migration would discard an unmappable draft, guess an exercise identity, or change saved-log semantics.
- Stop if stale-tab handling requires silent last-write-wins or an unreviewed field-level merge.
- Stop before deleting List markup/routes/styles/tests; Plan 055 owns that after parity proof.
- Stop before expanding backup/cloud behavior or changing progression math.

## Rollback

Keep the legacy parser and dual renderer through this phase. The final activation commit can switch reads/writes back to legacy only if no V2-only user operation has shipped; once V2 ships, rollback code must continue to read V2 and render/recover it. Never deploy an older app that treats V2 as invalid and clears it. Each persistence/schema commit includes forward-compatible read behavior and cache rollback notes.

## Atomic commit sequence

| # | Exact commit message | Contract delivered | Likely files | Prerequisite | Focused proof | Broader regression | Catalog impact | PR-body update | Rollback boundary |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `test(workout): capture List and Focus state parity` | Characterization of every approved capability and current history output | `test/focus-mode.mjs`, draft/session/race helpers, parity fixture | Plan 049 contract | Existing app passes parity matrix | Relevant browser suites | None | Record baseline outputs and gaps | Tests only; revert safely |
| 2 | `feat(workout): add versioned draft domain model` | Pure DraftV2 schema, commands, validation, history compiler | new `workout-draft.js`, pure Node/property tests | Commit 1 | Pure tests and property seeds | Generative smoke | None | Record schema/API and seed replay | Revert module/tests before integration |
| 3 | `feat(workout): migrate legacy drafts without loss` | Parser, idempotent V1→V2 conversion, recovery slot/error | domain module, `app.js` adapter, migration/fault tests, script/cache inventory | Commit 2 | Marker-complete fixtures, invalid/unknown cases, old-worker boot | Draft/race suites | Recovery state if visible | Record migration fixtures and cache version | Keep reader when reverting later slices |
| 4 | `feat(workout): persist draft operations with revision checks` | CAS/idempotent operations, stale-tab and removal semantics | `app.js`, draft storage adapter/module, race tests | Commit 3 | Two-tab/fault matrix | Thermonuclear/draft transaction suites | Stale state added | Record fault points/results | Revert writer switch while retaining V2 reader |
| 5 | `refactor(workout): render List and Focus from draft state` | DOM projection and event commands; no hidden-input ownership | `app.js`, `index.html` only if bindings change, focused CSS/tests, cache | Commit 4 | Parity suite and DOM-query guard | Focus/accessibility/simulation | Existing workout frames regenerated | Record capability parity and visual diff | Revert renderer, retain compatible storage reader |
| 6 | `refactor(workout): compile saves from draft state` | Save/early finish/summary/history use deterministic V2 snapshot | `app.js`, domain module, summary/history tests | Commit 5 | Crash/save/retry and exact row equivalence | Session/history/Progress/full browser | Summary only if output changes intentionally | Record save fault evidence | Revert compiler adapter, never clear V2 |
| 7 | `test(workout): prove crash reload and upgrade recovery` | Complete adversarial, SW upgrade, backup/transfer-section round-trip evidence | tests, catalog scenarios/docs, `sw.js` revisions if not earlier | Commits 3–6 | Named required adversarial matrix | Full browser + generative CI | New recovery states captured | Fill completion/handoff evidence | Evidence/cache slice reverts as unit |

After each row: mark 🟡; implement only it; run focused proof; inspect the full diff; remove unrelated changes; commit; push immediately; update the draft PR; proceed only from a truthful remote checkpoint.

## Implementation-agent operating protocol

### Branch/worktree contract

- **Branch:** `ui-overhaul/051-workout-draft-state`
- **Worktree:** `../repforge-ui-051-workout-state`
- **Base:** current `origin/main`
- **Dependency gate:** Plan 049 merged; reconcile Plan 050 if it changed `app.js`, catalog helpers, cache, or tests
- **Primary files:** new workout draft domain module, focused `app.js` adapters, draft/race/focus/session tests, service-worker/script inventory
- **Shared hotspots:** `app.js`, `index.html`, `sw.js`, focus/session tests, catalog manifest
- **Conflicting phases:** Plan 055 cannot modify workout rendering until this merges; Plan 053 consumes the clone section after this schema is stable
- **Safe parallelism:** Plan 052 transition module and Plan 050 independent UI fixes; serialize cache/index edits and merge main before final verification
- **Integration order:** 049 → 051 → 055; 051 → 053 clone implementation

Fetch main and inspect existing branches, worktrees, and PRs. Resume, do not replace, existing Plan 051 work. Use the dedicated worktree; keep coordination main clean; never copy uncommitted files or delete another agent's worktree/branch. Create/push `chore(plan-051): start implementation`, open a draft PR, and fill the body before substantive work. Target main. When a prerequisite merges, fetch, explicitly merge `origin/main`, resolve, rerun affected tests, push, and update the PR. Never rebase a published branch.

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

Published SHAs are permanent handoff markers: no amend, rebase, force-push, silent rewrite, or stash handoff. Push each coherent tested slice and update its PR row/evidence immediately. Never knowingly commit broken behavior. Do not duplicate prerequisite contracts, copy unpublished sibling files, or cherry-pick arbitrary work. Keep exact fault points, seeds, decisions, and `Next exact steps` in the PR because interruption may happen after any call. Before stopping, run `git status --short`; a valid handoff is clean. Do not merge without authorization; owner review requires every row/evidence/current-state field complete and all STOP conditions closed.

## Completion gate

- No user state depends on hidden List markup or DOM queries.
- DraftV2 is durable, versioned, local-only, reloadable, and deterministically convertible to current history rows.
- Every listed capability has List/Focus parity before List deletion.
- Legacy migration is lossless/idempotent or fails recoverably without clearing data.
- Crash, retry, two-tab, stale draft, draft removal, save, program replacement, and service-worker upgrade tests pass.
- Focus, session summary, history, Progress facts, accessibility, reduced motion, EN/PT, themes, and catalog regressions pass.
- The new script and cache inventory are in lockstep.
- Branch is pushed/clean, PR body is current, and implementation stops at owner review.
