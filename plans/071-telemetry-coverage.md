# Plan 071: telemetry coverage for every meaningful journey, onboarding first

- **Status:** IMPLEMENTED in PR #359. The owner approved designing and
  implementing this on 2026-10-11, then answered §7 the same day. The
  approved additions ship in follow-up PRs (§7 decisions 2 and 6; §10).
- **Contract:** the closed event schema in `telemetry.js`, ADR 0010
  ("Data and telemetry"), ADR 0013 (install transfer), ADR 0014 (free-form
  import) and the privacy rules in `AGENTS.md`. Nothing here widens them.
  This plan extends Plan 044's Phase A catalogue with the owner's 2026-10-11
  approval. It is the product decision that the backlog's deferred "General
  lifecycle/friction observability" row asked for. Reason catalogues stay
  excluded. It keeps Plan 045 §4's explicit removals (§5.5).
- **Base:** `32ecc21c` (main on 11 October 2026, after #350 and #351).
- **Coordination:** Plan 072 (the rest of onboarding B) reuses the step-id
  scheme in §4. #353 (Generate in a Worker) reuses the generation timing seam
  in §5.3.
- **Out of scope:** new product features. An event whose feature does not
  exist is retired, not faked (§6).

## 1. What is true today

- 30 events are declared. 23 have a producer. Of the 23, 22 are in
  `app.js`/`history-ui.js` and `late_install_transfer` is emitted by
  `telemetry.js` itself. `tools/check-production-syntax.mjs` holds the other
  seven in a `RESERVED` map: `recommendation_overridden`, `substitution_used`,
  `equipment_context_selected`, `one_off_started`, `one_off_completed`,
  `session_abandoned` and `program_transition_selected`.
- `alpha-scorecard.md` points at `test/telemetry-call-sites.mjs` for those
  reasons. That file does not exist. The list lives in the syntax guard.
- Onboarding sends `program_path_selected`, `generator_started` (at route
  choice, not at generation), `generator_completed`, `template_selected`
  (retired Browse) and `program_activated`, plus the import funnel. Nothing
  says which step a lifter reached, how long it took, where they went back or
  stopped, or whether they used B's editor (#351).
- The landing page, the install prompt and the installed state send nothing.
  `app_boot` cannot tell a Home Screen launch from a browser tab.
- Generation is synchronous today (`compileGeneratorCandidate`,
  `app.js:15564`). Its three failures (`rules_changed`, `rebuild_failed`,
  `generation_conflict`) are silent in telemetry. So are activation failures
  (`activateEntryPreview`, `app.js:17674-17680`).
- After activation, the workout start, the in-workout substitution
  (`substituteExercise`), the discard caused by a program edit, the block
  transition choice, edits to the active program, backup and settings send
  nothing.

## 2. Journey map

Each row is a journey stage, the question it answers, and the events that
cover it. **New** means added by this plan; everything else exists.

| # | Stage | Events |
|---|---|---|
| 1 | First visit and landing | `app_boot` (+ `display_mode`, new), `landing_viewed` (new), `landing_action` (new) |
| 2 | Install / PWA | `install_prompt_outcome` (new), `app_installed` (new), `app_boot.display_mode`, `late_install_transfer` |
| 3 | Onboarding start | `onboarding_started` (new), `onboarding_resume_offered` (new) |
| 4 | Route choice | `onboarding_step_completed{step:entry}` (new), `program_path_selected` |
| 5 | Generate, step by step | `onboarding_step_viewed` / `_completed` / `_back` (new) over desired_result → background → schedule → environment → abilities → priorities → result |
| 6 | Custom | same funnel events over the custom steps |
| 7 | Build | same funnel events over build_setup → editor |
| 8 | Import | same funnel events over import_source → preview, plus the import funnel (`program_import_*`) |
| 9 | Setup link received | `landing_viewed{landing:shared}`, `landing_action{action:shared_start}`, funnel events over shared_review → preview |
| 10 | Building moment | `generator_started`, `generation_settled` (new), `generator_completed` |
| 11 | Review and edit (B) | `program_review_action` (new), `program_activated.review_changes` (new) |
| 12 | Leaving / resuming setup | `onboarding_exit` (new), `onboarding_resume_offered`, step events after resume |
| 13 | Activation | `program_activated`, `program_activation_failed` (new) |
| 14 | First workout and first set | `first_set_logged`, `set_saved` |
| 15 | Session completion | `session_completed`, `session_summary_viewed`, `workout_discarded` (new) |
| 16 | In-workout choices | `exercise_skipped`, `substitution_used` (now produced), `recommendation_explained` |
| 17 | Return sessions | `app_boot{first_run:false}`, `set_saved`, `session_completed` |
| 18 | Block lifecycle | `block_review_viewed`, `block_transition_chosen` (new) |
| 19 | History, Progress | nav autocapture, `history_session_outcome` |
| 20 | Settings | `settings_open` autocapture, `settings_changed` (new) |
| 21 | Program edits after activation | `active_program_edited` (new) |
| 22 | Sharing, backup, transfer | `share_setup_outcome`, `late_install_transfer`. Backup stays untracked (Plan 045; owner question 6) |

## 3. Adoption questions

The alpha must be able to answer each question from schema events alone.
"Unit" is the counting unit. Every rate follows the maturity and denominator
rules in `alpha-scorecard.md`.

| Question | Unit | Answered by |
|---|---|---|
| Activation rate, overall and by route | installation | `onboarding_started` → `program_activated`, by `program_activated.route` |
| Onboarding drop-off by step | installation | last `onboarding_step_viewed{route,step}` with no `program_activated` in 7 days |
| Where lifters go back | event | `onboarding_step_back` by `{route,step}` |
| Time spent per step | event | `onboarding_step_completed.time_on_step` by `{route,step}` |
| Does generation fail or stall? | event | `generation_settled` by `outcome`, `duration` |
| Editor reliance | installation | `program_activated.review_changes` on recommend/custom; `program_review_action` by `kind` and `action` |
| Do lifters abandon in the editor? | installation | `onboarding_step_viewed{step:result}` + `program_review_action` with no activation |
| Does activation fail? | event | `program_activation_failed` by `reason` |
| Time to first set | installation | `program_activated` → `first_set_logged` time-to-convert; `onboarding_started` → `first_set_logged` for the whole journey |
| Install adoption | installation | `install_prompt_outcome`, `app_installed`, share of `app_boot` with `display_mode=standalone` |
| Week-1 and week-4 retention by route | installation | anchor `program_activated` (route); a `session_completed` on a later UTC date in elapsed days 1–7, and in days 22–28 |
| Do started workouts finish? | installation + SDK session | `set_saved` → `session_completed` / `workout_discarded` |
| Block continuation | installation | `block_review_viewed` → `block_transition_chosen` by `action` |
| Is setup resumed after leaving? | installation | `onboarding_exit{action:keep_draft}` → `onboarding_resume_offered` → step events |

## 4. Step-id and route-id scheme (shared with Plan 072)

- **Route ids** are `ProgramEntry.ROUTES`: `recommend`, `custom`, `build`,
  `import`, `shared`. The hub has no route; its events send `route: "none"`.
- **Step ids** are the values of `ProgramEntry.ROUTE_STEPS`, plus `entry` (the
  hub) and `activation_conflict`. The telemetry `step` enum is the union of
  these. Funnels never use a screen index. They order steps by the route's
  step list at analysis time.
- An id names what the step asks, not where it sits. Reordering, restyling or
  rewording keeps the id. A materially different question gets a new
  snake_case id.
- A retired step keeps its enum value so historical data still parses.
- A new step joins `ROUTE_STEPS` and the telemetry enum in the same change.
  `test/telemetry-unit.mjs` fails if any `ROUTE_STEPS` id is missing from the
  enum.
- Step events are observed in `renderOnboarding` (`app.js:16963`), where the
  visible `{route, stepId}` is already computed. They are not observed in
  `entrySetState`, because three paths change the step without it:
  `collapseSingleCustomShape`, `recoverEntryDurableConflict` and
  `commitSharedSetup`. Observing the render covers them, and covers any 072
  screen that renders through the entry shell.

## 5. Event table

All new properties are closed enums, booleans or buckets. "Trigger" names
the code boundary, not a control.

### 5.1 Landing and install (new)

| Event | Properties | Duplicates | Trigger |
|---|---|---|---|
| `landing_viewed` | `landing`: generic, shared, shared_invalid; `visit`: first, returning | repeatable | `openFirstRun` after the landing kind and visit are set |
| `landing_action` | `action`: create, import, continue_browser, shared_start, install, privacy, proof_chapter; optional `chapter`: integer 1–4, only with proof_chapter | repeatable | each landing CTA handler in `init()`; proof_chapter from a tap on one of the proof's four chapters (the landing controller's player), never from the phone playing on by itself |
| `install_prompt_outcome` | `surface`: landing, banner, header, settings; `mode`: native, ios, manual; `outcome`: prompted, accepted, dismissed, instructions_shown | repeatable | `triggerInstall(source)`: the native prompt and its `userChoice`, the iOS sheet, the manual banner |
| `app_installed` | none | milestone | the `appinstalled` listener |
| `app_boot` (changed) | adds optional `display_mode`: standalone, browser | once_per_boot | `boot()`, from `isStandalone()` |

### 5.2 Onboarding funnel (new)

| Event | Properties | Duplicates | Trigger |
|---|---|---|---|
| `onboarding_started` | `origin`: first_run, settings, block; `resumed`: boolean | repeatable | `startOnboarding(origin)`, once the draft is read |
| `onboarding_resume_offered` | `status`: resumable, rules_changed, activation_conflict, corrupt | repeatable | `startOnboarding` when it sets the matching `entryUiNotice` |
| `onboarding_step_viewed` | `route`, `step` | repeatable | `renderOnboarding` when `{route, step}` differs from the last observed pair |
| `onboarding_step_completed` | `route`, `step`, `time_on_step` | repeatable | the same observer, when the step moves forward in the route's step list or leaves the hub for a route |
| `onboarding_step_back` | `route`, `step` | repeatable | the same observer, when the step moves backward or returns to the hub |
| `onboarding_exit` | `action`: keep_draft, discard_draft, start_over; `route`; `step` | repeatable | `keepEntryDraftAndCancel`, `discardEntryDraftAndCancel`, `entryStartOver` |

`time_on_step` buckets: `under_10s`, `10_30s`, `30_60s`, `1_3m`, `3_10m`,
`over_10m`. It is measured in memory from the step's view to its
completion. A reload restarts the clock at the resumed view. The funnel
observer sends no answer values; §7 explains why.

### 5.3 Generation and activation

| Event | Properties | Duplicates | Trigger |
|---|---|---|---|
| `generation_settled` (new) | `route`: recommend, custom; `outcome`: success, rules_changed, rebuild_failed, generation_conflict; `duration`: under_1s, 1_3s, 3_10s, over_10s | repeatable | `beginGeneration()` stamps the request; `settleGeneration(token, outcome)` reports it. Today both run inside `compileGeneratorCandidate`. #353's Worker calls `begin` when it posts the request and `settle` when the reply or the error arrives, so the event is the same either way. A superseded request settles nothing. |
| `program_activation_failed` (new) | `route`; `reason`: definition_invalid, setup_conflict, durable_conflict | repeatable | `activateEntryPreview` failure branches (`app.js:17636-17680`) |
| `program_activated` (changed) | adds optional `review_changes`: 0, 1_2, 3_5, 6_10, 11_plus | once_per_setup_flow | existing producer. Recommend/custom only: `RepForgeProgramReview.changes(baseline, definition).count` at commit |
| `generator_started` | unchanged | once_per_setup_flow | Still fires at route choice. The scorecard documents that it measures entering Generate, not generation; `generation_settled` measures generation |

### 5.4 B's review editor (new)

| Event | Properties | Duplicates | Trigger |
|---|---|---|---|
| `program_review_action` | `action`: edit, undo, restore, rename_program, refused, save_failed; `kind`: optional, one of `EDIT_KINDS` (sets, rep_range, rir, rest, swap, alternates, move, remove, reorder, add, day_name) | repeatable | `program-review.js` `apply`, `undo`, `restore`, through a new optional `adapter.observe(report)`. The module keeps no telemetry dependency. |

A unit test fails if `EDIT_KINDS` and the `kind` enum drift.

### 5.5 Workout, block and management

| Event | Properties | Duplicates | Trigger |
|---|---|---|---|
| `substitution_used` (changed, now produced) | `reason` becomes optional and is never sent; adds `source`: alternate (one of the slot's alternates), library | repeatable | applied `substituteExercise` command in `captureDraftCommandTelemetry`. `restoreOriginalExercise` sends nothing. |
| `workout_discarded` (new) | `stage`: before_set, working; `cause`: program_edit | once_per_session | the installed editor's `apply_discard_workout` path, after the discard commits |
| `block_transition_chosen` (new) | `action`: repeat, schedule_repair, reduce_volume, recovery_week, guided_edit, new_program | repeatable | the commit points: the literal repeat in `commitNextBlock`, the sibling-proposal confirm (by staged action), and for `new_program` the successor's activation in `finalizeProgramSetup` when the entry was opened from the block |
| `active_program_edited` (new) | `outcome`: saved, discarded_workout | repeatable | `applyInstalledEditorAndContinue` after `committed && settled` |
| `settings_changed` (new) | `setting`: language, unit, rir_mode, rest_timer, voice, notifications, progression, theme | repeatable | `commitSettings` success (one event per setting whose value changed), `setTheme` |

The telemetry toggle stays without an event: opting out must not report
itself.

Two removals in Plan 045 §4 still hold. There is no workout-start event:
"First meaningful gym-floor evidence is `first_set_logged`; do not invent a
replacement". There is no backup event: "Backup health is tested locally and
operationally". Session reliability is read from `set_saved` to a terminal
event within one SDK session, as it is today.

## 6. Retired declarations

Never emitted, so retiring them changes no recorded data. A future feature
re-declares its event together with its producer.

| Event | Why retired |
|---|---|
| `recommendation_overridden` | No override action exists. Typing a different load is `set_saved.vs_suggestion = raised/lowered`. |
| `session_abandoned` | No abandon action existed. Leaving pauses; finishing early completes. Re-declared with its producer when the owner approved an explicit abandon (§10). |
| `one_off_started`, `one_off_completed` | One-off sessions do not exist (draft PR #257 is domain-only). |
| `equipment_context_selected` | No reachable UI; equipment contexts are deferred (backlog §5). |
| `program_transition_selected` | Its vocabulary (resume, repair, rebase, switch) does not match the product's actions. Replaced by `block_transition_chosen`. |

The `RESERVED` map in `tools/check-production-syntax.mjs` becomes empty and
stays as the guard. `tools/build-posthog-measurement.mjs` stops requiring
`session_abandoned` and `one_off_completed`, and its saved-set outcome
query counts completed, discarded and unresolved sessions.

**Schema version stays 1.** Every change is additive (new events, new
optional properties) or removes an event that was never emitted. No
existing property changes meaning. `substitution_used.reason` becoming
optional loosens an event with no history. Existing schema-1 dashboards
keep reading the same data.

## 7. Privacy review

- **Sent:** event names, closed enums, booleans and buckets. The envelope
  is unchanged (schema version, app version, release channel, installation
  id, SDK session/window ids).
- **Never sent:** program, day or exercise names; exercise ids; answers
  typed by the lifter; loads, reps, RIR, bodyweight or exact durations;
  free text; URLs or setup fragments; counts that are not bucketed. No new
  identifier is introduced. Consent gating is unchanged: `capture()`
  returns early when telemetry is off.
- **Onboarding answers:** the funnel events carry `{route, step}` and a
  bucketed `time_on_step`. Since the owner's decision 2, a completed step also
  carries the closed engine answers it asked, from the table under the
  decisions below. No free-form answer is ever sent: names, exercises,
  muscles or notes. `generator_completed` keeps its existing goal and
  frequency.
- **B's Basics (Plan 072) are never sent, not even bucketed or as closed
  enums:** sex, birth date or age, height, weight or bodyweight, and cardio
  experience. Their step events carry `{route, step, time_on_step}` only.
  Lifting experience (`structuredExperience`) is an existing engine input
  and stays out of telemetry unless the owner approves it (Q2).
- **Mechanical guards** (`test/telemetry-leakage.mjs`):
  - No declared property name matches a Basics or body term.
  - Seeding Basics-shaped answers with sentinel values into the setup state
    and walking the funnel leaves every captured payload free of the
    sentinels.
  - Every new property joins the hostile-value rejection matrix.
- **Rate:** the adapter caps PostHog at 4 events/s with a burst of 12. Every
  new event follows a human action or a step change. Editor taps are one
  event each and stay below the cap.

### Owner decisions (2026-10-11)

The owner answered the six questions on 2026-10-11, relayed by the parent
session.

1. **Basics stay out.** No Basics answer is sent, in any form. The unit
   guards from §7 stand.
2. **Closed engine answers on step completion: approved.**
   `onboarding_step_completed` carries the closed answers the completed step
   asked, and nothing else. Lifting experience is allowed as its existing
   bucket.

   | Step | Property | Values |
   |---|---|---|
   | `entry` (Generate shortcut only), `desired_result` | `goal` | muscle_growth, balanced, strength |
   | `background` | `experience` | first, under_6m, 6_to_24m, over_24m |
   | `schedule` | `days_per_week` | 2–6 |
   | `schedule` | `session_length` | up_to_40, 60, 90, 120_plus |
   | `environment` | `gym_preset` | the entry environments |
   | `custom_shape` | `split` | the compiler's authored splits |
   | (the step that asks it) | `deload` | on, off |

   - The table lives in `telemetry.js` (`STEP_ANSWERS`). A step that asks a
     closed engine answer joins it. `deload` is declared for the deload step
     Plan 068/072 adds; that step maps its answer when it lands.
   - A value outside its list is dropped and the step still reports.
   - Guards in `test/telemetry-unit.mjs`:
     - each step projects only its own answers;
     - the split and environment lists follow the engine's vocabularies;
     - a walk over every step of every route, with Basics sentinels and free
       text in the answers, emits only allowlisted keys and no sentinel.
3. **Substitution reason: approved, optional.** One tap on optional reason
   chips in the swap sheet. It never blocks or delays the swap, and the
   default is no reason. `reason` is sent only when the lifter chooses one.
   Specified in §10 and shipped in its own PR.
4. **Explicit abandon: approved.** A clear "end without finishing" action in
   the workout, with an optional reason. It emits `session_abandoned`
   (`stage`, `reason`) and reuses the existing discard semantics. Specified in
   §10 and shipped in its own PR.
5. **Backup events stay out.** Plan 045 §4 stands.
6. **Days since last session: approved.** There is no session-start event
   (Plan 045 §4), so the bucket rides on `session_completed` as
   `days_since_last`:
   - Values: first, same_day, 1, 2_3, 4_7, 8_14, 15_30, 31_plus.
   - It counts calendar days from the latest earlier saved session in the
     log. A backdated session compares only with sessions on or before its
     own date.

## 8. Implementation slices

One branch (`feat/071-telemetry-coverage`) and one draft PR, committed in
coherent slices. Each slice is test-first: the runtime proof fails, then the
producer, then the proof passes.

1. **This plan.**
2. **Schema and guards.** The new events and properties, the retirements,
   the step and edit-kind drift tests, the Basics leakage guard and the
   fixtures (`test/fixtures/telemetry.mjs`).
3. **Onboarding funnel and editor.** The step observer, onboarding
   start/resume/exit, generation timing, activation failure,
   `review_changes`, `program_review_action`. Runtime proofs go in
   `test/telemetry-runtime.mjs`: step viewed/completed/back once per
   transition on a real Generate walk, the hub goal shortcut, back to the
   hub, an editor edit/undo/restore, and `review_changes` on activation.
4. **Landing and install.** `landing_viewed`, `landing_action`,
   `install_prompt_outcome`, `app_installed`, `display_mode`.
   Added 2026-10-30 (owner-approved with the playing proof, #572): `landing_action`
   `{action: proof_chapter, chapter: 1–4}` for a tapped proof chapter. The schema
   takes the action value and a closed integer range (`integerIn(1, 4)`) and no free
   text; autoplay emits nothing and opt-out emits nothing (`test/telemetry-unit.mjs`,
   `test/telemetry-runtime.mjs`).
5. **Workout, block and management.** `substitution_used`,
   `workout_discarded`, `block_transition_chosen`, `active_program_edited`,
   `settings_changed`.
6. **Measurement docs.** `alpha-scorecard.md` (onboarding funnel, editor
   reliance, retention by route, retired rows), `posthog-dashboard-recipes.md`,
   and new compiled definitions in `tools/build-posthog-measurement.mjs`:
   onboarding step reach, activation by route, and week-1/week-4 retention
   by route.

Revisions (`?v=` for changed query-versioned scripts and `CACHE`) are bumped
relative to main when the PR opens, and again after the final rebase.

## 9. Verification

- `node tools/run-tests.mjs edit` and the owning suites:
  `test/telemetry-unit.mjs`, `test/telemetry-leakage.mjs`,
  `test/posthog-measurement.mjs`, `tools/check-production-syntax.mjs`.
  Browser suites run under `flock /tmp/taurifer-browser.lock`:
  `test/telemetry-runtime.mjs`.
- A green `ci` check on the final head is the completion evidence.

## 10. Substitution reason and explicit abandon (owner decisions 3 and 4)

Both add UI, follow the existing sheet patterns, and carry EN and PT copy.

### Substitution reason

- The swap sheet (the exercise picker opened from Exercise actions → Swap)
  shows optional reason chips at the head of its scrolling list: Equipment,
  Preference, Pain, Crowded, Other. The copy is under `picker.reason.*`.
- None is selected when the sheet opens. One tap selects a chip; a second tap
  clears it. Picking an exercise swaps immediately, exactly as before. The
  reason never blocks or delays the swap.
- `substitution_used` gains `reason` only when a chip was selected
  (`equipment`, `preference`, `pain`, `crowded`, `other`). With no chip it is
  absent, never defaulted. Restoring the original exercise sends nothing.
- Only the workout swap shows the chips. Every other use of the picker
  (Build, the program editor, imports) is unchanged.

### End without saving

- **Where:** the session sheet's foot, under Finish session early: **End
  without saving** (destructive).
- **The prompt:** tapping it opens a one-step confirmation in the same foot,
  following the early-finish pattern. It shows:
  - the consequence: "Nothing from this session is saved. Logged sets are
    discarded and your program stays as it is."
  - optional reason chips: Out of time, Not recovered, Pain, Equipment,
    Schedule changed, Other. None is selected by default.
  - **End and discard** and **Cancel**.
- **What it does:** exactly the existing unfinished-session discard
  (`clearDraft`, the same removal the "discard unfinished session" sheet
  uses):
  - The DraftV2 record and its checkpoint are removed under the draft
    compare-and-swap.
  - Every set logged in this session is discarded and never reaches History.
  - The program, the block, earlier sessions and settings are untouched.
  - The lifter returns to Today. No new storage is introduced.
  - If the removal fails, the existing draft-recovery surface appears and
    nothing is reported.
- **Finish early vs end without saving:** finish early saves the logged sets
  and completes the session. This action saves nothing.
- **Telemetry:** `session_abandoned` (once per session) is sent after the
  removal succeeds.
  - `stage` is `working` if a working set had been committed, otherwise
    `before_set`.
  - `reason` is sent only when a chip was chosen: `time`, `recovery`, `pain`,
    `equipment`, `schedule`, `other`.
- **Measurement:** saved-set session outcomes now count three terminals:
  completed, abandoned (`session_abandoned`) and discarded by a program edit
  (`workout_discarded`). A session with none of these is unresolved.
- **Catalog:** `workout/abandon` (the prompt with a reason chosen) and
  `workout/swap-reason` (the swap sheet with a reason chosen), with manifest
  and role-inventory entries.
