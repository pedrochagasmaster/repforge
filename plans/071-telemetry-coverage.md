# Plan 071: telemetry coverage for every meaningful journey, onboarding first

- **Status:** IN PROGRESS. The owner approved designing and implementing this
  on 2026-10-11.
- **Contract:** the closed event schema in `telemetry.js`, ADR 0010
  ("Data and telemetry"), ADR 0013 (install transfer), ADR 0014 (free-form
  import) and the privacy rules in `AGENTS.md`. Nothing here widens them.
  This plan extends Plan 044's Phase A catalogue with the owner's 2026-10-11
  approval. It keeps Plan 045 §4's explicit removals (§5.5).
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
| `landing_action` | `action`: create, import, continue_browser, shared_start, install, privacy | repeatable | each landing CTA handler in `init()` |
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
| `session_abandoned` | No abandon action exists. Leaving pauses; finishing early completes. The one real discard is `workout_discarded`. |
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
  bucketed `time_on_step`, and nothing about the answer.
  `generator_completed` keeps its existing goal and frequency.
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

### Owner questions (nothing below ships)

1. **Basics for measurement.** Is any Basics answer needed to read
   retention, for example an age band? Recommendation: no. Nothing is
   shipped.
2. **Closed-enum answers on step completion.** Should `step_completed` carry
   the enum answer for desired_result, background (experience band),
   schedule (days, minutes) and environment kind? This would show who drops
   at each step, but it widens the payload. Not shipped.
3. **Substitution reason.** `substitution_used.reason` needs a reason
   question in the workout. That is a product change. Not shipped.
4. **Explicit abandon.** An explicit "abandon this session" action, with its
   stage and reason, is a product change. Until it exists, abandonment is
   read as unresolved, not reported.
5. **Backup events.** Plan 045 removed `backup_exported`: backup health is
   tested locally and operationally. Export and restore outcomes would show
   whether lifters protect their data, and whether restore fails in the
   field. Reversing Plan 045 is the owner's call. Not shipped.
6. **Days since last session on `app_boot`.** A recency bucket would make
   return-session views cheaper. Retention is derivable without it. Not
   shipped.

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
