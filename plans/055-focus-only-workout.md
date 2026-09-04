# Plan 055: Focus-only workout

- **Plan number:** 055
- **Phase:** 4 — Focus-only workout
- **Status:** Planned; implementation has not started
- **Owner approval state:** Focus-only direction is final; capability parity is an implementation gate
- **Depends on:** Plan 049 semantic roles; Plan 050 responsive/overflow harness; Plan 051 DraftV2 and DOM-independence. The contextual-guide cleanup slice integrates after Plan 054's guide registry
- **Blocks:** Workout-owned portions of Plan 057/058 and final Plan 059 acceptance
- **Governing G decisions:** G-08, G-15, G-22, G-41–G-44, G-49, G-62, G-69, G-77
- **Governing UI findings:** UI-18, UI-23, and Today preview behavior associated with UI-25
- **Affected surfaces:** Today session actions, active workout shell, Focus card, session map/sheet, exercise actions, rest timer, draft resume/save/summary, obsolete List/tour artifacts
- **Complexity:** Very high
- **Risk:** Very high — sole workout workflow and deletion of the previous mode

## Problem statement

Focus has Taurifer's strongest one-exercise/one-decision hierarchy, but it remains an optional mode propped up by hidden List markup. Important utilities are scattered across List, header overflow, per-exercise rows, and sheets. Focus also wastes vertical space and its previous-session/timer geometry can shift or compress titles. Today has no clean read-only session inspection boundary.

After Plan 051 makes DraftV2 authoritative, this phase turns Focus into the only logger, relocates every approved capability by scope, creates a read-only Today preview, and deletes List only after executable parity is complete.

## Approved direction

- Focus only; List ultimately ceases to exist.
- Keep a session map, arbitrary exercise navigation/reordering, and ordered sets within each exercise.
- Put date, bodyweight, session notes, overview, and early finish in a Session sheet.
- Put substitution, warm-ups, setup notes, skip/restore, and repeat-last under exercise actions.
- Hide the global dock during an active workout. **Leave workout** preserves the draft and returns safely to the app.
- **Preview session** is read-only and does not start a workout. **Start workout** creates/enters Focus.
- Preserve correction/uncommit, recommendation context, `Why this weight?`, safety boundaries, save, and summary.
- Reduce wasted space and fix previous-session minimum, timer geometry, and title shift.

## Preserved strengths

Preserve the Today → workout → save → centered summary loop, Focus's one-exercise/one-decision hierarchy, `Why this weight?`, deterministic next targets, adjacent validation, pain/discomfort handling, licensed/empty media behavior, token-swap themes, local-only draft behavior, and the screen catalog. List capabilities are preserved by relocation before List itself is removed.

## Non-goals

- No progression-math or recommendation-policy change.
- No unordered sets, free one-off session, supersets/circuits, general session template editing, or new voice feature.
- No global dock redesign, management-surface redesign, or system-wide token migration.
- No deletion of List before Plan 051 and the parity gate.
- No restoration of the global tour; Plan 054 supplies the contextual-guide registry.

## Current-state audit

- `index.html` contains one workout surface with List markup, Focus header/card/navigation, rest UI, overflow controls, notes/why/substitution sheets, and save actions.
- `app.js` switches modes, renders Focus from the selected List exercise, scrapes List inputs for draft/save, and keeps state in DOM plus Maps/Sets. Plan 051 replaces that ownership.
- Focus already supports previous-session context, `Why this weight?`, input/edit/commit/uncommit, swipe/arrow exercise navigation, rest control, substitutions, notes, and save; some controls remain discoverable only through List/header overflow.
- The global app dock is hidden in Focus via body state, but exit semantics and draft preservation need one explicit action.
- Today's start action can create the workout state. The new Preview action must be observational and storage-silent.
- `styles.css` contains separate List (`.ex`, set row/table, floating rest) and Focus (`.focus-*`, `.deck`, `.ledger`, `.wo-rest`) systems, plus fixed/min-height/absolute-position rules causing whitespace and timer/title pressure.
- `test/focus-mode.mjs` currently reports 116 passing cases on baseline main. `test/simulation.mjs` and the tour tests intentionally toggle both modes and sometimes query hidden inputs.
- Catalog states include `workout/list`, `workout/focus`, rest timer, exercise note, and why; the global `install/tour` depicts List/Focus switching.

## Capability parity table

Before deleting List, convert this table into an executable checklist with a production-backed test and destination for every row.

| Capability | Current carrier | Focus-only owner | Required proof before List deletion |
|---|---|---|---|
| Session map / whole-session inspection | List and Focus navigation | Session sheet/map | All exercises, completion/skipped state, and set counts readable without starting another route |
| Arbitrary exercise navigation | List scroll and Focus arrows/swipe | Session map, arrows/swipe, direct selection | First/middle/last and skipped exercise reachable; focus/announcement correct |
| Exercise reordering | Program order only/current limited behavior | Active-session map reorder | Draft order changes only for this session; set order/content/identity preserved |
| Ordered sets | List rows and Focus ledger | Focus ledger | Set N+1 cannot be committed through an accidental reorder; correction retains ordinal |
| Repeat last-session values | Existing exercise utility | Exercise actions | Copies eligible fields, does not auto-complete, handles no history honestly |
| Substitution / restore original | List/exercise controls and sheet | Exercise actions | Explicit current-ID replacement, provenance retained, no fuzzy identity |
| Warm-up / restore working set | Set controls | Exercise actions plus per-set state | Role changes analysis/save semantics and remains reversible |
| Programmed setup notes | Exercise header/detail | Exercise actions/read-only note | Full text accessible without editing it as session notes |
| User exercise notes | Exercise note sheet | Exercise actions | Save/reload and focus restoration |
| Skip / restore exercise | Existing row/action | Exercise actions and map | Edits remain intact; map/status/save reflect skip |
| Bodyweight | Workout/session controls | Session sheet | Unit/validation/reload/save semantics unchanged |
| Session notes | Workout overflow/sheet | Session sheet | Free text survives reload and summary/history |
| Date | Workout overflow/current field | Session sheet | Platform-native control; locale display; draft/history date correct |
| Early finish | Save/confirmation path | Session sheet | Preview of omissions, explicit confirm, deterministic save |
| Set correction/uncommit | Focus/List completion control | Focus ledger | Values retained, status announced, save uses corrected state |
| Day/session context | Workout title/List | Immersive header + Session sheet | Day, date, block/week and progress context remain discoverable |
| Previous-session values | Focus card/rows | Compact previous-session band | Minimum readable size; no clipping at PT+200 |
| Recommendation and `Why this weight?` | Focus/card/sheet | Focus target block and Why sheet | Exact engine facts/copy preserved; no invented certainty |
| Rest timer | Floating List bar and Focus chip/sheet | Focus header chip + timer sheet | Start/pause/resume/stop/overtime, background/visibility behavior, no title shift |
| Load/reps/RIR or effort editing | List/Focus inputs | Focus active set | Units, keyboard/input modes, validation, one-handed reach, reload |
| Save → summary | Shared footer/path | Session sheet/primary finish action | One atomic history commit, draft clear, summary/history/Progress update |
| Leave and resume | Browser navigation/implicit draft | Explicit Leave workout | Draft preserved, Today safe, resume exact exercise/set |
| Voice input when capability-detected | Header overflow, often hidden | Optional active-set action if still supported | Preserve current functional behavior or prove dead/unapproved and STOP for owner before removal |

Mode switching itself is intentionally removed. It is not a capability to preserve.

## Architecture

### One renderer over DraftV2

Consume Plan 051's `activeWorkoutDraft` and commands directly. Remove mode branching from all save/read/state paths before removing markup. The sole renderer has three layers:

1. immersive workout shell: header/context, exercise navigation, active exercise, ordered sets, rest status, finish/leave entry;
2. Session sheet: whole-session map/overview, reorder, date, bodyweight, session notes, early finish;
3. Exercise actions sheet/menu: substitution, warm-up management, programmed/setup notes, skip/restore, repeat-last.

Every action dispatches a DraftV2 command. Sheets receive a draft revision; destructive/finish confirmations reject stale revisions. No action locates a sibling input to derive state.

### Today preview boundary

Build a pure planned-session view model from the selected program/day and current progression facts. `Preview session` opens a read-only sheet/page with day/session context, ordered exercises, programmed sets/reps/RIR/setup notes and available next-target context. It may navigate to exercise/library detail but cannot edit, complete, substitute, reorder, start rest, create DraftV2, update timestamps, or emit workout-start telemetry.

`Start workout` is the only entry that calls DraftV2 `create()` (or resumes a matching draft) and enters the immersive shell. If a different active draft exists, use the existing explicit resume/discard/replace decision and atomic draft protocol.

### Exercise order

Reordering is session-scoped DraftV2 state, not a Program mutation. Provide accessible move earlier/later actions and optional pointer drag only as enhancement. The map and workout renderer consume the same order. Sets within an exercise never reorder. Save/history retains exercise order/provenance without changing future program order.

### Safe leave and finish

`Leave workout` flushes pending field state through Plan 051, waits for verified persistence, returns to Today (or prior valid app view), and leaves the draft resumable. It never saves a session. If persistence fails, remain in workout with Retry/export-safe feedback.

Normal finish validates required completed state. Early finish names skipped/incomplete work and asks explicit confirmation from a stable revision. Successful save uses `toHistoryRows()` and existing atomic durable/draft clearing path, then opens the centered summary.

### List deletion order

Delete only after all parity rows are green on the DraftV2 renderer:

1. remove mode preference/toggle/route/event paths;
2. remove List markup and hidden off-screen carriers;
3. remove List-only styles, translations, catalog scenario/state, helper APIs, and tests;
4. replace any behavior test that used List with visible Focus/Session/Exercise-actions proof;
5. update historical spec status references without erasing history;
6. verify no code/test selector for List or hidden `data-k` value ownership remains.

## Domain/state model

No second workout store is introduced. Add only DraftV2 session-order and optional UI projection state if Plan 051 did not already include it. Open sheet, focus target, swipe offset, and timer animation are volatile UI state; date/bodyweight/notes/order/selection/actions remain draft state. “Preview” is a separate read-only model and can never be serialized as an active draft.

## Migrations

- Remove/ignore the old List/Focus preference while preserving parser tolerance for older UI/state records.
- Plan 051 V1→V2 draft migration must already be deployed and proven.
- Existing active drafts resume into Focus at their exact selected exercise/set; no mode prompt.
- Tour state migrates under Plan 054's guide registry; remove List/mode-tour steps and preserve completion/dismissal appropriately.
- Remove List translations only after checking they are not reused by Focus/accessibility labels.
- Update service-worker shell/revisions and catalog manifest atomically with removed markup/scripts/styles.

## UX state specification

### Today

- No program and completed-day states retain existing contracts.
- Ready state shows distinct **Preview session** and primary **Start workout**.
- Preview is read-only with close/back and Start workout; closing leaves storage unchanged.
- Matching draft changes Start to Resume; nonmatching draft invokes explicit conflict handling.

### Active workout

- First exercise/set; partially completed; exercise complete; skipped/restored; substituted/restored; reordered; no previous history; previous history; programmed note; user note; rest running/paused/overtime/stopped.
- Session sheet default/map, editing metadata, validation, reorder controls, early-finish warning.
- Exercise actions normal/skipped/substituted, warm-up selection, repeat-last unavailable/available.
- Set pending, valid, invalid, completing, completed, uncommitted/correction.
- Leave persistence pending/success/failure; resume after reload/crash.
- Save validation, confirmation, in progress, failure, success summary.

## Accessibility

Use a single `h1`/landmark structure in the immersive shell. Announce exercise position, selected exercise, set completion/uncommit, skip/restore, substitution, reorder, rest state, save/leave outcomes without excessive chatter. Session/exercise sheets trap/restore focus correctly. Swipe is never the only navigation; reorder has buttons/keyboard. Touch targets are at least 44×44 CSS px and primary set completion is reachable one-handed without covering inputs. Inputs have exercise/set-specific names and adjacent validation. At 200% text, no forced two-dimensional scroll. Reduced motion removes deck/gesture transitions while preserving state.

## Localization

All new actions, confirmations, unavailable reasons, and announcements have complete EN/PT-BR strings. Do not assemble sentences from exercise/day/status fragments. Exercise/program names remain data. Date roles follow G-38. Generated i18n stays current.

## Responsive behavior

- 320px: active set fields and completion action reflow without overlap; session/exercise sheets keep final controls above safe area; no horizontal document scroll.
- 390×844: one-exercise hierarchy uses vertical space efficiently; previous-session band has a defined minimum and does not dominate.
- 430px/desktop: preserve compact focus rather than expanding to an empty card; desktop maintains bounded line length.
- 200% and PT+200: titles wrap without timer/nav shift; set fields stack if needed; all actions/notes remain available.

## Light/dark

Consume semantic tokens only. Preserve paper-backed licensed art and intentional empty media. Focus hierarchy, completion, warning, and disabled states work in light/dark without color-only meaning.

## Offline/PWA

Preview, active workout, timer, draft persistence, leave/resume, save, and summary work offline. Test installed/browser display modes, safe areas, background/visibility timer behavior, and a service-worker update mid-draft. No network becomes a save dependency.

## Failure and recovery

- Preview crash/close: no draft exists.
- Leave persist failure: stay in workout with recoverable state.
- Reload/crash: exact DraftV2 exercise order, selected exercise, values, roles, notes, substitutions, skips, and completions restore.
- Two tabs/stale draft/removal follow Plan 051; conflict UI cannot overwrite the winner.
- Timer background/throttle uses wall-clock deadline; timer state never determines whether a set saved.
- Save crash/duplicate action creates exactly one session and a deterministic draft outcome.
- Obsolete preference/tour keys are ignored, not treated as corrupt durable state.

## Privacy

Workout, bodyweight, and notes remain local. Preview/guide/leave actions must not add content telemetry. Voice input, if preserved, retains existing capability/privacy boundary and cannot be newly networked without owner approval.

## Telemetry

Only previously approved coarse task events may distinguish preview opened, workout started, safe leave, saved, and contextual-guide completion. Never send load/reps/RIR/bodyweight, exercise identity, notes, substitutions, draft content, or timer values. Owner interpretation only.

## Testing and executable evidence

- Convert the capability table to named test cases and record its green status in the PR before List deletion.
- Storage-diff test proves Preview creates/changes no draft, log, durable revision, timer, or start event.
- Visible-control journeys for every capability, including reload and arbitrary order/navigation.
- Pure DraftV2 tests prove session reorder leaves set order/identity and future Program unchanged.
- Safe leave, persist failure, resume, stale-tab, draft removal, save crash/duplicate, summary/history/Progress integration.
- Geometry for title/timer/previous-session/set controls at 320/390/430, EN/PT, 200%, PT+200, light/dark, safe areas.
- Semantic tree, keyboard, focus restoration, live announcements, touch targets, reduced motion, one-handed owner phone review.
- Source/test grep proves List route/markup/style/i18n/catalog/test-only mode dependencies are gone, excluding historical docs.
- Run focused DraftV2/focus/session/accessibility tests, complete browser regression, generative suite, catalog capture/check/compare.

## Screen catalog changes

- **New states:** Today preview; Session sheet overview/metadata/early finish; exercise actions normal/substituted/skipped/warm-up; Leave workout; draft-resume/conflict/persist failure; reorder state.
- **Removed states:** `workout/list`; mode-switching states; List-specific global-tour state/copy after Plan 054 registry integration.
- **Changed states:** `workout/focus`, rest timer, exercise note, Why, Today ready/day-picker/done as applicable, session summary entry transition.
- **Matrix expansion:** Focus, both sheets, preview, leave/error, timer, and correction get EN/PT, light/dark, 320/390/430, 200%, PT+200, reduced-motion and browser/installed evidence. Record exact state/frame delta.

## Owner gates

Real-phone owner review is required for one-handed logging, exercise navigation/reorder, sheets, timer, safe leave, and summary transition. This is usability acceptance of the approved Focus direction, not a choice to retain List. Plan 059 repeats physical VoiceOver/TalkBack launch sign-off.

## STOP conditions

- Stop before List deletion if any parity row is unowned, untested, or still queries hidden markup.
- Stop if Preview writes draft/session/start state.
- Stop if reordering changes Program order or set order.
- Stop if Leave can lose an unpersisted edit or early finish can act on a stale revision.
- Stop before removing a live capability such as capability-detected voice input without evidence and owner direction.
- Stop if work changes progression math, safety language, or adds one-off sessions.

## Rollback

Before List deletion, the single DraftV2 renderer can fall back to the prior projection while keeping V2 readable. After deletion ships, rollback must not restore DOM ownership; use a forward fix or temporarily render a V2-backed compatibility view. Keep obsolete preference parsers harmless for one release. Each List deletion commit removes matched code/style/test/catalog artifacts and can be reverted as a unit only onto a Plan 051-compatible base.

## Atomic commit sequence

| # | Exact commit message | Contract delivered | Likely files | Prerequisite | Focused proof | Broader regression | Catalog impact | PR-body update | Rollback boundary |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `test(workout): make Focus capability parity executable` | Named table cases over visible controls and DraftV2; baseline gaps explicit | focus/session/simulation/accessibility tests | Plan 051 | Parity report with no hidden-input helpers | Draft/race suites | None | Paste table status and blockers | Tests only |
| 2 | `feat(today): add read-only session preview` | Storage-silent planned-session map and distinct Start boundary | `app.js`, `index.html`, styles/i18n/tests, cache | Plan 050/051 | Storage/event diff and preview→start journey | Today/program/focus suites | Preview states added | Record zero-write evidence | Revert preview; Start remains |
| 3 | `feat(workout): organize session and exercise actions` | Session sheet and exercise-action ownership with all listed behaviors | workout renderers/markup/styles/i18n/tests | Commit 1 | Capability rows for metadata/substitution/warm-up/notes/skip/repeat/finish | Focus/draft/session/accessibility | Sheet/action states added | Update parity destinations | Revert sheets while retaining V2 actions |
| 4 | `feat(workout): add session map reorder and safe leave` | Direct navigation, session-only reorder, persistent Leave/Resume | workout app/domain adapter, markup/styles/i18n/tests | Commits 1/3 | Reorder invariants, leave fault, resume exact location | Draft/race/focus suites | Map/reorder/leave states | Record failure and phone evidence | Revert interaction layer, retain draft order parser |
| 5 | `fix(workout): tighten Focus and timer geometry` | Removed wasted space, minimum previous-session band, stable title/timer, neutral controls only if Plan 057/058 role already available | `styles.css`, focused markup/tests, cache | Commits 2–4 and Phase 049 roles | Variant bounding boxes/one-handed reach | Accessibility/overflow | Focus/timer frames changed | Record every required variant | Revert layout/cache/images together |
| 6 | `refactor(workout): make Focus the sole workout route` | No mode branching/toggle/preference; active sessions always Focus | `app.js`, `index.html`, prefs/i18n/tests, cache | All parity rows green; Commits 1–5 | Complete capability journey and mode-route absence | Full workout/session/history/Progress regression | List/mode states removed | Mark deletion gate passed | Revert only to V2-backed dual projection |
| 7 | `refactor(workout): remove obsolete List artifacts` | Dead markup/styles/translations/tests/catalog/tour references removed, required tests replaced | `index.html`, `app.js`, `styles.css`, i18n, tests, manifest/scenarios/docs | Commit 6; Plan 054 guide registry merged | Source-selector audit and replacement tests | Full browser/generative/catalog | `workout/list` and obsolete tour removed | List removed files and replacements | Revert as one artifact-consistent slice |
| 8 | `test(workout): prove Focus-only release evidence` | Full catalog, SW upgrade, reduced motion, accessibility and real-phone evidence | tests/catalog PNGs/docs/SW inventory | Commits 2–7 | Critical-flow matrix | Full regression + audit checks | Exact delta recorded | Fill owner/device/completion evidence | Evidence reverts with owning slices |

For every row: mark 🟡; implement only that slice; run focused verification; inspect the complete diff; eliminate unrelated edits; commit; push immediately; update the PR; continue only from a truthful remote checkpoint.

## Implementation-agent operating protocol

### Branch/worktree contract

- **Branch:** `ui-overhaul/055-focus-only`
- **Worktree:** `../repforge-ui-055-focus-only`
- **Base:** current `origin/main`
- **Dependency gate:** Plan 051 merged and parity baseline green; Plan 054 guide registry before obsolete-tour deletion
- **Primary files:** workout/Today portions of `app.js`/`index.html`/`styles.css`, i18n, focus/draft/session tests, workout catalog scenarios
- **Shared hotspots:** `app.js`, `styles.css`, `index.html`, i18n/generated, SW, manifest, session summary and Progress integration tests
- **Conflicting phases:** Plan 054 on tour/shell/i18n; Plan 057 timer/Today/summary; Plan 058 tokens. This plan owns workout workflow; consumers must not redesign it concurrently
- **Safe parallelism:** Core work may run beside Plan 054 and Plan 056 in file-partitioned commits; serialize shell/i18n/SW/manifest and merge main before proof
- **Integration order:** 049/050/051 → 055; guide-deletion slice after 054; then relevant 057/058/059

Fetch current main; inspect branches/worktrees/PRs; resume existing work. Use one dedicated worktree; keep coordination checkout clean; never copy uncommitted files or delete another agent's work. Push `chore(plan-055): start implementation`, open a draft PR, and populate it before substantive work. Target main. When prerequisites merge, fetch and explicitly merge `origin/main`, resolve deliberately, rerun affected proof, push, update PR. Do not rebase published history.

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

Published SHAs are stable: no amend, rebase, force-push, silent rewrite, or stash-based handoff. Push each coherent tested slice and immediately update status/evidence/next steps. Never commit a knowingly broken checkpoint; return to the prior pushed state. Do not bypass prerequisites through duplicate state/guide contracts or unpublished copies. Keep the live parity table, device results, and exact next action in the PR. Run `git status --short` before stopping; valid handoff is clean. Unless explicitly authorized, do not merge; stop at owner review with all rows, evidence, review threads, owner/device gates, and STOP conditions closed.

## Completion gate

- Focus is the only workout logger and no state/save path depends on hidden List DOM.
- Every parity-table capability is present at its approved Session/Exercise/Focus scope with executable visible-control proof.
- Preview session is read-only/storage-silent; Start creates/resumes DraftV2.
- Navigation/reorder preserve identity and ordered sets; safe Leave preserves draft; correction, early finish, save, summary, and reload are atomic/recoverable.
- List routes/markup/styles/translations/tests/catalog/tour references are removed only after replacement proof.
- Focus spacing, previous-session band, timer/title, 320/390/430, EN/PT, 200%, PT+200, light/dark, reduced-motion, safe-area, overflow, semantic and one-handed gates pass.
- Real-phone owner review and full regression/catalog/SW evidence are recorded.
- Branch/PR are pushed, current, clean, and stopped at owner review.
