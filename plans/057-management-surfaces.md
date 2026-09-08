# Plan 057: Management surfaces

Implementation and review use the [evidence protocol](../docs/agents/implementation-evidence.md)
and this plan's [first proof checkpoint](../docs/agents/ui-overhaul-proof-checkpoints.md).
External Herdr workers additionally follow the [Herdr dispatch procedure](../docs/agents/herdr-ui-overhaul-execution.md)
and the [Herdr worker packets](#herdr-worker-packets) section below. The coordinator fills every packet field and the
live SHAs, thread ID, server origin, and PID before dispatch.

- **Plan number:** 057
- **Phase:** 6 — Management surfaces
- **Status:** Planned; implementation has not started
- **Owner approval state:** Approved direction; final owner phone review remains
- **Depends on:** Plan 049; Plan 050; Plan 054 Privacy/guide registry; Plan 055 workout/session integration; Plan 056 outcome/Review contracts
- **Blocks:** Plan 058 full-system convergence and Plan 059 launch validation
- **Governing G decisions:** G-12–G-14, G-17, G-23–G-24, G-38, G-45–G-46, G-49, G-60, G-62–G-69, G-80
- **Governing UI findings:** UI-13, UI-14, UI-24, UI-25, UI-26, UI-27, UI-28
- **Affected surfaces:** History session/read/edit/delete, Share setup/repair, session summary, Today, Program overview/editor/actions, Settings/help/privacy, rest-timer visual semantics
- **Complexity:** Very high
- **Risk:** High — edits/deletes/sharing can silently alter or expose user intent if boundaries blur

## Problem statement

Several management surfaces contain strong capabilities but weak hierarchy. History opens an edit form under a dominant calendar and truncates exercise names. Share fails closed correctly but lists no blockers or repair routes while spending space on privacy prose. Summary's centered hierarchy is strong, but exception colors and relative muscle bars mislead. Today repeats weekly completion. Program action roles and its persistent dock are inconsistent. Settings is a flat long list, and the timer uses accent mass for both live progress and controls.

This phase reshapes these surfaces around explicit task/commit boundaries while preserving data integrity, identity validation, and the core workout result.

## Approved direction

- History is read-first. Selection replaces the calendar with compact date context and **Back to calendar**. **Edit session** enters a working edit state; **Save** and **Cancel** define commit; Delete is separate and confirmed.
- Preserve full exercise names and locale-aware date roles.
- Share remains fail-closed. List every unresolved exercise with its own **Repair**, use explicit built-in/custom replacement, and return to Share. Never omit, fuzzy-match, or invent facts.
- Share is task-only; Privacy details live on Plan 054's cached page.
- Preserve Summary's centered completion hierarchy. Improved is restrained green, declined reserved warning, maintained neutral; words/icons carry meaning. Muscle output is ranked weighted hard-set totals without bars.
- Today retains block position plus one weekly completion line beside the day strip.
- Program distinguishes expansion, navigation, replacement, and removal; the action dock is a shallow sticky layer. Hide zero readiness; nonzero count routes to ready exercises.
- Settings uses visible groups: training behavior, app experience, data/privacy, help; links to Privacy and replays contextual guides.
- Timer keeps orange live progress, uses neutral controls, and normalizes glyph weight.

## Preserved strengths

Preserve History/session facts, Share's fail-closed exact-identity boundary, Summary's centered hierarchy, Today → workout → save result, Program's explicit activation/editor capability, token-swap themes and paper-backed media, Sans/Mono roles, local-first storage/export, adjacent validation/destructive confirmation, and catalog evidence. Management clarity cannot weaken any of those contracts.

## Non-goals

- No History bulk edit, calendar redesign beyond selected/read transition, cloud history, or new backup format.
- No fuzzy exercise migration, automatic custom definition, creator identity, or Share privacy prose.
- No new outcome/progression/volume math; consume Plan 056 and existing weighted-hard-set rule.
- No new workout timer behavior; Plan 055 owns timer function/geometry, this plan owns semantic visual roles.
- No full design-system migration; Plan 058 converges untouched/public surfaces after these structures settle.
- No unrelated program lifecycle features or post-Wave-3 work.

## Current-state audit

- History calendar and selected-session edit controls coexist in one first viewport. `app.js` groups saved log rows into sessions and directly exposes editable date/load/reps/RIR fields; names use truncation rules. Delete controls visually compete with ordinary fields.
- Saved log rows are durable state under `repforge_v1`; session identity groups rows. Writes already use durable revision/WAL behavior, but UI edit state needs an explicit original fingerprint to detect stale tabs.
- `shared-setup.js` validates exercise identity and payload bounds. Share currently disables copy on unresolved slots and shows a generic message/privacy/cookie explanation. Program replacement/custom definition flows already exist in exercise picker/editor and must be reused with stable exercise identity.
- Summary generation in `app.js` computes PRs, outcomes, volume, and `sessionMuscleWork()`. The centered summary is a protected strength. Current muscle bars are relative, and current status names include flat/regressed variants.
- Today renders block/week and weekly completion in more than one location. Plan 055 adds distinct Preview/Start behavior; this plan edits only progress information placement.
- Program overview/editor render several row/action patterns and readiness chips. `0 ready` appears; Replace/Remove can have similar light-theme weight. The persistent editor dock is historically flat but G-80 now authorizes restrained elevation.
- Settings contains appearance, training, notifications, install, backup/data/privacy/help in a long flat/inset layout. Plan 054 supplies cached Privacy and guide registry; Plan 053 supplies install-transfer settings action.
- Timer behavior exists in Focus header/sheet. Plan 055 fixes its reserved geometry; current ring and primary control both use orange and icon systems mix fill/stroke weight.

## Architecture

### History read/edit state machine

Keep current session grouping as source data and introduce a UI-local `HistorySelection`:

```text
calendar
reading { sessionId, originalFingerprint }
editing { sessionId, originalFingerprint, workingCopy, dirty, validation }
deleting { sessionId, originalFingerprint }
saving | conflict | failure
```

Selecting a day/session enters `reading` and removes/hides the month from the active surface; **Back to calendar** restores its prior month/focus. The read view derives full exercise/set rows and compact long-date heading from immutable session data.

**Edit session** deep-copies only the selected session into a working copy. Inputs never mutate `state.log` on change. **Cancel** discards the copy (confirm only when dirty and leaving would lose edits). **Save** validates the complete copy, re-reads the durable session fingerprint under the state lock, replaces all rows for that session atomically, and returns to read state. A stale fingerprint produces a conflict with reload/cancel; no automatic row merge. Delete uses a separate confirmation and the same stale check.

### Share validation and repair return route

Extend shared-setup validation output with a complete structured blocker list:

```text
{ dayId, exerciseInstanceId, displayName, reasonCode,
  known: { libraryId?, equipment?, primary?, secondary? } }
```

The Share sheet renders every blocker in program order and no Copy/System Share action while any exist. Each Repair action closes/suspends Share, opens the existing explicit exercise replacement/custom-definition flow with a return token `{surface:'share', exerciseInstanceId}`, and returns to freshly revalidated Share after success/cancel.

Built-in repair accepts only a current library ID. Custom repair requires the user to explicitly provide every required missing fact; prefill only trusted existing values. No display-name alias/fuzzy match, silent omission, or manufactured equipment/muscle data. A program edit/stale identity while repair is open invalidates the return target safely and reopens Share with current blockers.

### Session summary view model

Consume Plan 056's canonical `improved|maintained|declined` outcomes. Map old compatible facts once at the adapter boundary; do not add new thresholds. Render the already-ranked `sessionMuscleWork()` output as numeric weighted hard-set totals. Preserve its existing sets/direct/name tie-break order. Continue the existing primary=1/secondary=0.5 convention and label it; zero rows are omitted. Remove relative bars entirely so 1.5 sets cannot look like 100% of a target.

### Today information model

Use one block-position model and one current-week completion value from Plan 056. The block line remains near the block progress role; the weekly line is adjacent to the day strip. Remove any second sentence with the same completed/planned value. Plan 055's Preview/Start/draft states remain untouched.

### Program action roles

Annotate controls with one semantic role:

- expansion: reveals content in place and reports `aria-expanded`;
- navigation: moves to a separate detail/route and uses a consistent chevron/action label;
- replacement: explicit non-destructive substitution with a strong distinguishable action role;
- removal: destructive, separated and warning-labelled/confirmed as appropriate.

Readiness is derived from authoritative progression recommendations. If count is zero, render no readiness row/chip. If positive, render **N exercises ready to add weight** as a navigation action to a filtered/list/first-ready Program state, with a path back and full set of ready exercises.

The editor action dock uses Phase 049's `persistent-action` elevation: shallow shadow/boundary, safe-area padding, and no surrounding card/modal treatment. It remains distinct from content and does not cover the last editor row.

### Settings task groups

Render four top-level groups with short summaries:

- training behavior: units, effort/RIR, progression/training settings;
- app experience: appearance, timer/notification behavior, language/install as applicable;
- data/privacy: backup/import/delete/analytics and a Privacy-page navigation row;
- help: contextual guide replay and support/about facts.

Keep all required controls visible. Detailed privacy text is not duplicated. Guide replay enumerates Plan 054 registry entries (first set, Focus utilities, Progress interpretation, block transition, backup, installation) and resets only selected presentation state. Install action consumes Plan 054/053 policy.

### Timer ownership boundary

Plan 055 owns timer state, size reservation, title stability, and sheet operation. This plan changes only semantic presentation: ring/progress arc uses accent; start/pause/stop/reset controls use neutral primary/secondary roles; icon masks share a defined visual weight. Do not alter countdown accuracy/background behavior.

## Domain/state model

- `HistoryEditWorkingCopy` contains selected session rows plus original durable fingerprint; it is volatile until Save.
- `ShareBlocker` is validation output keyed by stable day/exercise identity and reason; it is not persisted or telemetered.
- Summary/Today/Program view models consume canonical existing/Plan 056 facts.
- Settings grouping and open row are UI state; actual settings remain in their established durable/device boundaries. Appearance stays device-only and never enters backup/setup proposals.

## Migrations

- No saved-log shape migration. History edit rewrites current canonical rows only on explicit Save.
- Old summary outcome labels are presentation-mapped; stored history is not rewritten.
- Existing Program action markup/state remains compatible while roles migrate; no program identity change.
- Old Settings open-section/tour preferences map to new groups/guide registry without replaying dismissed cues unexpectedly.
- Share payload/schema/cookie remain unchanged. Only validation reporting and repair routing change.
- Rebuild i18n and advance current SW/script revisions with cached files; catalog states migrate by stable IDs where possible.

## UX state specification

### History

- Empty/list/calendar; selected read state; Back to calendar; edit clean/dirty/invalid; cancel; stale conflict; save failure/success; delete confirmation/stale/failure; multiple sessions on date.
- Full exercise names wrap in read and edit; values/units/roles remain aligned.

### Share

- Valid ready/copy/system-share; one blocker; many blockers; repair picker; custom definition with missing fields; cancel return; successful repair with remaining/no blockers; stale target; encoded-length failure.
- Sheet contains task name/status/actions only. Privacy/transport text is absent.

### Summary/Today/Program/Settings/timer

- Summary improved/maintained/declined/mixed/no evidence, PRs, ranked muscles.
- Today zero/partial/complete weekly progress and block position without duplicate.
- Program readiness hidden/nonzero; row expanded/navigated; replace/remove; sticky dock at start/end/keyboard.
- Settings four groups, Privacy navigation/back, guide list/replay, install states, data deletion separation.
- Timer idle/running/paused/overtime with orange progress and neutral controls.

## Accessibility

History read has heading/date/list semantics; Edit announces mode and dirty validation; Cancel/Save focus restores predictably. Delete is separated, explicitly named, and confirmed. Full names wrap instead of ellipsizing meaningful identity. Share blocker list is announced with count; each Repair name includes exercise; return focus targets repaired row/status. Summary outcome and totals use text/icons. Today progress exposes distinct block/week labels. Program roles use correct button/link/disclosure semantics and Replace/Remove remain distinguishable in light/dark. Sticky dock does not obscure focus/content. Settings headings form a meaningful hierarchy; guide replay states are clear. Timer values/controls have stable accessible names without second-by-second live-region spam.

## Localization

Complete EN/PT-BR messages for History modes/conflicts/delete, Share reasons/repair, summary outcomes/counts, Today week, Program readiness/actions, Settings groups/guides, timer controls. Use long dates for History/read headings, short dates for lists, native date control in Edit. Exercise names are data and must be shown whole, not “translated” or treated as raw keys. Rebuild generated i18n.

## Responsive behavior

- 320px: selected History replaces calendar; full names and edit fields stack; Share blockers/actions wrap; sticky Program dock and Settings rows clear chrome/safe areas.
- Canonical/430: compact management rows, no nested-card tunnels, bounded line length.
- Desktop: may retain a calendar/sidebar only if selection still clearly enters read-first content and mobile contract remains; editing remains explicit.
- 200%/PT+200: long names/actions/group headings wrap, final actions remain visible, no horizontal document scroll or obscured destructive boundary.

## Light/dark

Use token swap/Phase 049 roles. Improved/declined/maintained retain text/icon meaning. Replace and Remove must meet rendered-role distinction and AA in light and dark. Licensed art remains paper-backed. Sticky dock/elevation/timer controls use semantic tokens, not literal shadows/colors.

## Offline/PWA

History edit/delete, Share encoding/repair, summary, Today, Program, Settings, timer, Privacy navigation, and guide replay work offline. Native system Share may fail/cancel without changing program. Test browser/installed safe-area and scroll-end clearance. Update service-worker/current query revisions for changed cached files.

## Failure and recovery

- History stale/save/delete failure leaves original durable session intact and working copy recoverable until explicit cancel/reload.
- Crash before Save loses only volatile unsaved edits; never partially rewrites session. Crash during atomic Save resolves one complete old/new session via existing state replay.
- Share repair cancel/stale target revalidates current program; Copy remains disabled until zero blockers.
- Share encoder length/error remains fail-closed and never truncates notes.
- Summary derivation failure does not block durable session save; use recoverable summary fallback and keep history.
- Sticky dock/scroll errors must not hide last content/action; catalog/scroll tests fail.
- Timer visual rollback cannot affect timer deadline/state.

## Privacy

Share displays no privacy/transport essay and leaks no invalid program payload. Repair data stays local. Cached Privacy is linked from Settings (landing link owned by Plan 054). History/notes/bodyweight and blocker identities never enter logs/telemetry. Appearance remains device-only; delete/backup controls retain their existing explicit scope.

## Telemetry

Only Phase 049-approved coarse task outcomes: History read/edit/save/cancel/delete confirmation outcome; Share blocked count bucket/repair opened/valid share outcome; Settings guide replay; Program readiness navigation. Do not send names, row values, dates, blocker identity/reason details granular enough to reveal exercise content, notes, bodyweight, payload/URL, or deletion data. Owner interpretation only.

## Testing and executable evidence

- History read/edit state-machine tests: selection replaces calendar; Back restores; no mutation before Save; Cancel exact; Save atomic; stale two-tab conflict; delete separate/confirmed; full names; locale dates.
- Share valid and every-blocker journeys: list equality with validator; per-row stable Repair; built-in/custom/missing facts; cancel/success/stale return; fail-closed actions; no fuzzy/omission/fabrication; length/no-truncation; task-only copy.
- Summary tests for canonical outcomes in words/icons/colors and ranked weighted totals without bars; core centered hierarchy/saved-session facts unchanged.
- Today exact one weekly sentence plus block role; no duplicate accessible text.
- Program role semantics, light/dark Replace/Remove distinction, zero/nonzero readiness and navigation, sticky dock scroll/safe-area/keyboard.
- Settings group/source-state preservation, Privacy link/offline/back, individual guide replay, install integration.
- Timer state behavior unchanged; computed semantic colors/icons/geometry in all states.
- EN/PT, 320/390/430/desktop, 200%, PT+200, light/dark, reduced motion, overflow/scroll end, keyboard/focus/announcements/touch targets.
- Run focused history/shared-setup/session-summary/program/settings/focus/accessibility suites, then full browser/generative/catalog capture/check/compare.

## Screen catalog changes

- **New states:** History read, explicit edit dirty/invalid, delete confirm/conflict; Share one/many blockers and repair return; Summary maintained/declined/mixed; Program readiness destination; Settings guide replay.
- **Removed states:** selected History with dominant calendar/edit-by-default; Share disclosure paragraph; duplicate Today weekly line (not a state); relative summary muscle bars.
- **Changed states:** History list/session, Program overview/editor/picker/share, session summary, Today ready/done/day strip, Settings main/appearance/privacy, rest timer.
- **Matrix expansion:** destructive/share/history/Program dock states get EN/PT, light/dark, compact, 200%, PT+200 and scroll-end evidence; timer gets reduced motion/installed safe area. Record exact state/frame delta.

## Owner gates

Owner real-phone review covers History read/edit/delete, multi-blocker Share repair, summary interpretation, Program dock/readiness, Settings grouping, and timer hierarchy. Plan 059 repeats final VoiceOver/TalkBack and launch sign-off.

## STOP conditions

- Stop if History controls mutate durable state before Save or stale conflict would auto-merge/overwrite.
- Stop if any unresolved Share row is omitted, guessed, fuzzy-matched, or supplied invented equipment/muscle facts.
- Stop if Share regains privacy prose or payload logging/truncation.
- Stop if summary adds new performance thresholds or relative bars.
- Stop if Today/Program/Settings work changes Plan 055/056 state/progression contracts.
- Stop if timer styling alters countdown behavior or global tokens ahead of Plan 058.

## Rollback

History state-machine commits preserve canonical logs and can return to read-only if editing must be disabled; never fall back to edit-on-open after a newer working-copy format writes. Share repair can be disabled while fail-closed validation remains. Summary/Today/Program/Settings/timer presentation slices are independently revertible with matching i18n/catalog/cache artifacts. Preserve newer prefs/parsers. Never rollback by enabling invalid Share or deleting unresolved data.

## Atomic commit sequence

| # | Exact commit message | Contract delivered | Likely files | Prerequisite | Focused proof | Broader regression | Catalog impact | PR-body update | Rollback boundary |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `feat(history): separate session reading from editing` | Calendar replacement, full read view, explicit working copy, Back/Edit/Save/Cancel | History portions of app/index/styles/i18n/tests | Plan 050/056 date/outcome roles | Zero-mutation-before-save, full names, mode/focus tests | History/storage/accessibility | Read/edit states replace old session | Record state/fingerprint proof | Disable edit while retaining read view |
| 2 | `feat(history): isolate stale-safe session deletion` | Separate confirmation, CAS conflict/failure, atomic delete | history/storage adapter, dialogs/i18n/tests | Commit 1 | Two-tab/delete crash matrix | Storage/history suites | Delete/conflict states added | Record fault evidence | Revert delete UI; data untouched |
| 3 | `feat(share): enumerate and repair unresolved exercises` | Complete blocker model, per-row explicit repair, revalidate/return | `shared-setup.js`, app/program picker/editor adapters, styles/i18n/tests | Plan 054 Privacy page available | Blocker equality, built-in/custom/cancel/stale/no-fuzzy tests | Shared/setup/program-entry suites | Share blocker/repair states | Record all reason paths | Disable Repair; remain fail-closed |
| 4 | `refactor(share): keep sharing task-only` | Remove disclosure prose; preserve Copy/System Share and errors | Share markup/app/i18n/tests/SW | Plan 054 cached Privacy | Copy audit and Privacy-link-source tests | Shared/install/privacy suite | Share ready states simplify | Record text relocation | Revert only with Privacy-consistent docs; never lose disclosure globally |
| 5 | `refactor(summary): clarify outcomes and muscle totals` | Centered hierarchy preserved; canonical outcome roles; ranked weighted counts, no bars | summary model/render/styles/i18n/tests | Plan 056 outcome contract; Plan 050 fixture | Fact equality, sorting/weights, role/contrast tests | Session/history/Progress suites | Summary variants changed/added | Record before/after facts | Revert presentation, retain saved session |
| 6 | `refactor(today): show one weekly completion line` | Block position plus one adjacent weekly line, no duplicate | Today renderer/styles/i18n/tests | Plan 055/056 merged | Text/accessibility count and scope test | Today/focus/progress | Today frames changed | Record exact accessible output | Revert presentation only |
| 7 | `refactor(program): normalize actions readiness and sticky dock` | Four action roles, zero-hidden/nonzero navigable readiness, G-80 dock | Program app/index/styles/i18n/tests | Plan 056 Review route | Role/route/contrast/scroll/safe-area tests | Program/editor/progression/accessibility | Program states changed/added | Record role inventory/readiness cases | Revert slice; preserve program data |
| 8 | `refactor(settings): organize tasks privacy and replayable help` | Four visible groups, short summaries, Privacy route, guide replay/install integration | Settings app/index/styles/i18n/tests | Plans 053/054/055/056 guide IDs stable | State-preservation/link/replay/install tests | Backup/install/accessibility | Settings/guide states change | Record guide/group mapping | Revert layout; preserve prefs/guide registry |
| 9 | `refactor(timer): reserve accent for live progress` | Orange ring, neutral controls, normalized glyph weight; function unchanged | timer styles/icons/tests | Plan 055 geometry/function stable | State snapshots/computed roles and timer-equivalence tests | Focus/accessibility | Timer frames changed | Record behavior equivalence | Revert visual assets/styles only |
| 10 | `test(management): prove management catalog and phone gates` | Full destructive/share/scroll/locale/theme/text/a11y/device evidence | tests/manifest/scenarios/PNGs/docs/SW inventory | Commits 1–9 | Required per-surface matrix | Full browser/generative/audit checks | Exact delta recorded | Fill owner/completion/handoff evidence | Evidence reverts with owning slices |

For every row: mark 🟡, implement only that row, run focused proof, inspect the entire diff, remove unrelated edits, commit, push immediately, update the PR immediately, and continue only from a clean remote checkpoint.

## Herdr worker packets

The atomic commit sequence above is the delivery contract. Each management surface is dispatched as its **own**
self-contained packet per the [Herdr dispatch procedure](../docs/agents/herdr-ui-overhaul-execution.md); no worker owns
more than one surface, and the coordinator fills every template field before dispatch.

Rules for every packet in this plan:

- **Read/edit/cancel/save/destruction tests land before the change.** 057-P0 characterizes the History read → edit →
  cancel → save → delete state machine against persisted sessions before any History markup changes; the Share,
  summary, Today, Program, Settings, and timer packets each open with their own characterization assertion.
- **Dates and outcomes are consumed, not recomputed.** Summary and Today packets take Plan 056's canonical
  `improved|maintained|declined` outcomes and week values; no packet adds a threshold or a volume formula.
- **Share identity is exact.** 057-P3's blocker list is byte-equal to `shared-setup.js` `validate()` output, keyed by
  stable day/exercise identity, with no fuzzy or display-name matching, no silent omission, and no invented
  equipment/muscle facts.
- **Anchors are concrete.** Existing: session grouping + editable date/load/reps/RIR in `app.js`, `repforge_v1` log
  rows, `shared-setup.js` `validate()` (`shared-setup.js:622`), exercise picker/editor replacement flow,
  `sessionMuscleWork()` / `buildSessionSummary` / `sessionSummaryHtml` in `app.js`, `weeklySnapshot()`
  (`app.js:3144`) / `renderThisWeek()` (`app.js:6095`), Program readiness chips, timer in the Focus header/sheet;
  tests `test/history.mjs`, `test/shared-setup-flow.mjs`, `test/shared-setup-unit.mjs`, `test/session-summary.mjs`,
  `test/today-done.mjs`, `test/appearance.mjs`, `test/accessibility.mjs`, `test/ui-catalog-contract.mjs`. **NEW**
  (this plan): `HistorySelection` state, structured `ShareBlocker` output, `test/history-edit.mjs`,
  `test/share-repair.mjs`, `test/management-summary.mjs`, `test/program-actions.mjs`, `test/settings-groups.mjs`.
- **Every packet carries a deliberate failing case** and a STOP boundary; the coordinator reproduces the risky
  assertion before the next surface packet.

### Row → packet map

P5 changes presentation, not muscle-volume calculation. `sessionMuscleWork()`
already weights direct/secondary work, removes zero totals, and sorts the rows.
Assert its existing output is preserved while replacing relative bars with
numeric labels. Do not add a parallel muscle-volume helper.

| Packet | Maps rows | Bounded objective · mode | Existing anchors (main unless NEW) | Proof-first: PLANNED assertion + independent oracle + deliberate failure | Commands: baseline now → planned | STOP · reviewer gate |
|---|---|---|---|---|---|---|
| 057-P0 | 1–2 | Characterize History read/edit/cancel/save/delete over persisted sessions; pin "no mutation before Save" · **build (tests only)** | session grouping + edit fields in `app.js`, `repforge_v1` log rows; `test/history.mjs` | NEW `test/history-edit.mjs`: selecting a session and typing in an edit field produces zero change to `state.log` until Save (oracle = pre-edit durable snapshot); Cancel restores exactly. Failure: an input mutates `state.log` on change | baseline: `node test/history.mjs` → planned: `node test/history-edit.mjs` | STOP if the current surface already mutates before Save — record it, do not fix forward here · reviewer: reproduces the zero-mutation assertion |
| 057-P1 | 1 | History read/edit state machine: calendar replaced by compact date context + Back; deep-copied working copy; Save re-reads the durable fingerprint under the state lock and replaces all rows atomically; full exercise names · **build** | `HistorySelection` (NEW), durable revision/WAL write path; `test/history.mjs` | extend `test/history-edit.mjs`: a stale fingerprint on Save produces a conflict with reload/cancel and no auto-merge; full names wrap, never ellipsized to hide identity. Failure: two-tab Save silently merges rows | baseline: `node test/history.mjs` → planned: `node test/history-edit.mjs` | STOP if a stale conflict auto-merges or names are truncated · reviewer: reproduces the two-tab conflict |
| 057-P2 | 2 | Stale-safe session deletion: separate confirmation, same CAS fingerprint check, atomic delete · **build** | history/storage adapter, `test/history.mjs`, `test/persistence-race.mjs` | extend `test/history-edit.mjs`: delete uses its own confirm and the stale check; a crash during delete resolves one complete old/new state via boot replay. Failure: delete competes visually with ordinary fields, or a stale delete removes the wrong session | baseline: `node test/persistence-race.mjs` → planned: `node test/history-edit.mjs` | STOP if delete shares the edit-field affordance or skips the stale check · reviewer: reproduces the delete-crash recovery |
| 057-P3 | 3 | Share: complete structured blocker list keyed by stable identity; per-row explicit Repair with a return token; built-in accepts only a current library ID; custom requires every missing fact explicitly · **build** | `shared-setup.js` `validate()` (`shared-setup.js:622`), exercise picker/editor replacement; `test/shared-setup-flow.mjs`, `test/shared-setup-unit.mjs` | NEW `test/share-repair.mjs`: the rendered blocker list equals `validate()` output one-to-one in program order; each Repair returns to a freshly revalidated Share; no Copy/System Share while any blocker exists. Failure: a blocker omitted; a display-name/fuzzy match; manufactured equipment/muscle data | baseline: `node test/shared-setup-flow.mjs && node test/shared-setup-unit.mjs` → planned: `node test/share-repair.mjs` | STOP if any unresolved row is omitted, guessed, fuzzy-matched, or given invented facts · reviewer: reproduces the list-equality and one custom-repair-missing-fields case |
| 057-P4 | 4 | Keep Share task-only: remove disclosure/transport prose; preserve Copy, System Share, and fail-closed errors; Privacy lives on Plan 054's cached page · **build** | Share markup/app/i18n; Plan 054 Privacy page (merged); `test/shared-setup-flow.mjs` | extend `test/share-repair.mjs`: the Share sheet contains only task name/status/actions; the encoder still fails closed and never truncates notes; the Privacy link source is the landing/Settings page. Failure: Share still renders the cookie/transport essay; a payload logged | baseline: `node test/shared-setup-flow.mjs` → planned: `node test/share-repair.mjs` | STOP if Share regains privacy prose or logs/truncates a payload · reviewer: reproduces the copy audit |
| 057-P5 | 5 | Session summary: preserve the centered completion hierarchy; consume Plan 056 `improved`/`maintained`/`declined`; rank `sessionMuscleWork()` totals descending with numeric weighted hard-set counts and no bars · **build** | `sessionMuscleWork()`, `buildSessionSummary`, `sessionSummaryHtml` in `app.js`; Plan 056 outcome contract; `test/session-summary.mjs` | NEW `test/management-summary.mjs`: saved-session facts and centered layout unchanged; muscle rows are ranked numeric totals (primary 1 / secondary 0.5, labelled), zero rows omitted, no relative bars. Failure: a new performance threshold; a bar that makes 1.5 sets read as 100% | baseline: `node test/session-summary.mjs` → planned: `node test/management-summary.mjs` | STOP if summary adds a threshold or keeps relative bars · reviewer: reproduces the fact-equality and sorting cases |
| 057-P6 | 6 | Today: block position plus exactly one weekly completion line adjacent to the day strip; remove the duplicate sentence · **build** | `weeklySnapshot()` (`app.js:3144`), `renderThisWeek()` (`app.js:6095`); Plan 055/056 merged; `test/today-done.mjs` | extend `test/management-summary.mjs` (or NEW `test/today-week-line.mjs`): exactly one accessible text carries the completed/planned week value; block line stays near the block-progress role. Failure: two accessible strings with the same week value | baseline: `node test/today-done.mjs` → planned: `node test/today-week-line.mjs` | STOP if Today work changes Plan 055/056 state contracts · reviewer: reproduces the single-weekly-line assertion |
| 057-P7 | 7 | Program: annotate each control with one semantic role (expansion/navigation/replacement/removal); hide zero readiness; nonzero renders "N exercises ready to add weight" as navigation; editor dock uses the G-80 `persistent-action` elevation · **build** | Program overview/editor renderers, readiness chips in `app.js`; `test/program-editor-text-fields.mjs`, `test/accessibility.mjs` | NEW `test/program-actions.mjs`: `aria-expanded` on expansion controls; Replace vs Remove meet rendered-role distinction and AA in light and dark; a zero readiness count renders no row/chip; the sticky dock never covers the last editor row. Failure: a `0 ready` chip; Replace/Remove indistinguishable in one theme | baseline: `node test/accessibility.mjs` → planned: `node test/program-actions.mjs` | STOP if readiness shows zero, or role semantics/scroll-safety regress · reviewer: reproduces the role inventory and the dock scroll-end case |
| 057-P8 | 8 | Settings: four visible task groups with short summaries (training behavior / app experience / data-privacy / help); Privacy navigation row; guide replay enumerates the Plan 054 registry; install consumes Plan 053/054 policy · **build** | Settings markup/app; Plan 053 install-transfer action + Plan 054 registry (merged); `test/appearance.mjs`, `test/install-modes.mjs` | NEW `test/settings-groups.mjs`: every required control is still reachable; guide replay resets only the selected presentation state; appearance stays device-only and out of backup/setup. Failure: a control dropped; a dismissed cue replayed unexpectedly | baseline: `node test/appearance.mjs` → planned: `node test/settings-groups.mjs` | STOP if a required control is hidden or a storage boundary changes · reviewer: reproduces the group mapping and one replay |
| 057-P9 | 9 | Timer: orange only for the live progress arc; neutral primary/secondary controls; normalized icon glyph weight; countdown accuracy and background behavior unchanged (Plan 055 owns function/geometry) · **build** | timer in the Focus header/sheet; `test/focus-mode.mjs` | NEW cases in `test/management-summary.mjs` (timer block): state snapshots for idle/running/paused/overtime show computed neutral control roles and unchanged deadline behavior. Failure: countdown behavior changes; a global token is edited ahead of Plan 058 | baseline: `node test/focus-mode.mjs` → planned: same suite, timer-role cases | STOP if timer styling alters countdown/background behavior or touches global tokens · reviewer: reproduces the timer-equivalence assertion |
| 057-P10 | 10 | Management catalog + phone gates: destructive/share/history/Program-dock states across EN/PT, light/dark, compact, 200%, PT+200, scroll-end; owner real-phone review · **build + human evidence** | catalog flows `history`, `program`, `settings`, `session`; `test/ui-catalog-contract.mjs`; physical-phone owner | regenerate `node tools/capture-ui-screens.mjs --flow history --flow program --flow settings`; scroll-end clearance for sticky Program dock and Settings rows. Failure recorded, not hidden: a destructive confirmation pushed off-screen at PT+200 | baseline: `node test/ui-catalog-contract.mjs` → planned: `node tools/capture-ui-screens.mjs --flow history` then `node tools/check-ui-screens.mjs` | STOP if a destructive boundary is obscured at any variant · reviewer + owner: real-phone review of History/Share/summary/Program/Settings/timer signed into the PR (Plan 059 repeats sign-off) |

## Implementation-agent operating protocol

### Branch/worktree contract

- **Branch:** `ui-overhaul/057-management-surfaces`
- **Worktree:** `../repforge-ui-057-management`
- **Base:** current `origin/main`
- **Dependency gate:** Plans 049/050/054/055/056 merged; do not copy their unpublished contracts
- **Primary files:** History/Share/Summary/Today/Program/Settings/timer regions of app/index/styles, `shared-setup.js`, i18n, focused tests/catalog scenarios
- **Shared hotspots:** `app.js`, `index.html`, `styles.css`, i18n/generated, `shared-setup.js`, SW/query revisions, manifest
- **Conflicting phases:** 054 owns Privacy/guide registry; 055 workout/timer function; 056 Progress/outcomes; 058 global tokens. This plan owns the listed management structures
- **Safe parallelism:** History and Share slices may run in parallel only in separate branches/worktrees with one integrator and no shared-file concurrent commits; otherwise sequence as table. Plan 058 waits for principal surfaces
- **Integration order:** 054/055/056 → 057 → 058 → 059

Fetch/inspect main, branches, worktrees, and PRs; resume existing work. Use one plan worktree and keep coordination checkout clean. Never copy uncommitted files or delete another agent's worktree/branch. Push `chore(plan-057): start implementation`, open a draft PR, and populate it before substantive work. Target main. When dependencies merge, fetch and explicitly merge `origin/main`, resolve deliberately, rerun affected checks, push, update PR. Published branches are not rebased.

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

Push every coherent tested slice and update PR status/evidence/next steps immediately. Stable published SHAs are mandatory: no amend, rebase, force-push, silent rewrite, or stash handoff. Never commit a knowingly broken destructive/share boundary; return to the prior push. Do not duplicate prerequisite models or copy unpublished files. Record fault/device/catalog evidence and exact next action so takeover is immediate. Before stopping, run `git status --short`; handoff is clean. Do not merge unless explicitly authorized; stop at owner review after all rows/reviews/gates are complete.

## Completion gate

- History is read-first with calendar replacement, full names, explicit/stale-safe Save/Cancel, and separate confirmed Delete.
- Share is task-only and fail-closed; it lists every blocker, repairs by stable explicit identity, returns/revalidates, and never guesses/omits/invents.
- Summary preserves centered hierarchy, canonical outcome words/icons/colors, and ranked weighted totals without bars.
- Today has block position plus exactly one weekly line.
- Program action roles/readiness/sticky dock are consistent, navigable, distinct, and scroll-safe.
- Settings has four task groups, short summaries, Privacy route, replayable guides, and install integration without changing storage boundaries.
- Timer uses orange only for live progress and neutral consistent controls without behavior change.
- Destructive, locale-date, EN/PT, full-name, compact/desktop, 200%, PT+200, theme, AA, overflow/scroll-end, offline/SW, accessibility, and device gates pass.
- Complete catalog and full regression are current; branch/PR are pushed, clean, and stopped at owner review.
