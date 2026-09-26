# Direction D: implementation spec

- **Status:** Draft for owner review, 2026-09-25. Execution waits for Plan 058
  to merge.
- **Decision record:** [ADR 0016](../adr/0016-direction-d-design-reference.md)
- **Execution plan:** [Plan 063](../../plans/063-direction-d-redesign.md)
- **Strings:** [appendix](direction-d-strings.md), every key with PT and EN
- **Design sources:** `docs/design/main-screen-directions/DIRECTION-D-SPEC.md`,
  its 2026-09-25 amendments, and the review page in the same folder
- **Workfront PR:** #272 (`redesign/direction-d`), which carries this spec,
  the plan, the review page, the session-outcome fix and the backlog order
- **Scheduling:** backlog row "Direction D redesign"

## 0. How to read this

The D spec says what each screen looks like. This document says how the app
becomes that: which decisions override the D spec, what every catalog screen
becomes, which state and behavior contracts hold, how copy and the design
system map, and what proves each step.

When sources disagree, the first one wins:

1. Owner decisions recorded here (§1) and in ADR 0016.
2. Plan 058's frozen semantic roles (`docs/design/ui-system-semantic-contract.md`
   on `main` once 058 merges).
3. The D spec's 2026-09-25 amendments.
4. The D spec.
5. The review page. It is a drawing, not an implementation: its renderers are
   string templates over a fixture, and none of its code ships.

Nothing here changes the progression engine, persistence schemas, the draft
state model or the setup-link contracts. Code locations in §13 were read at
`main` `29fc1c36` and must be refreshed after Plan 058 merges (Plan 063 P0).

## 1. Owner decisions

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Reference | D is the reference for the main screens (ADR 0016). |
| 2 | Order | Plan 058 → Plan 063 (D) → Plan 059 → alpha. Nothing ships before 059 signs off on D. |
| 3 | Numbers | 058's role scale wins over D's numbers. Known cases: body and controls 16 px (D said 15), the cue's second line on the 18 px `subtitle` role (D said 17), the Today load figure on the 22 px `metric` role (D said 20; it fits at 360 with a 66 px kg column), the rest clock on 058's protected `clamp(32px,10vw,42px)` (D said 56), and the CTA and shelf radius set by 058's Today/Focus migration (D said 14). |
| 4 | Outcomes | The "Session outcome" rule in `CONTEXT.md`, already committed on the workfront branch (slice P2). |
| 5 | Progress navigation | One tab row of five, superseding G-29. |
| 6 | Session summary | D's ledger summary, superseding G-60: no check circle, outcome words in ink, green only for records. |
| 7 | History | D's week list, superseding G-23, with the calendar as a sheet and a session as a page. |
| 8 | History frequency | Option E: two small counts above the list, sessions per week against the planned line and sessions by weekday (§4.8). |
| 9 | Today preview | No Preview action, superseding G-44. A tap on a Today row opens the exercise page, as it does now. |
| 10 | Readiness route | Dropped, superseding G-65, on Today and Program. The verdict mark on each row carries it. |
| 11 | Utility ownership | G-42 stands. ⋯ holds note, substitute, skip and warm-up actions. D's table-view button opens the Session sheet: session map, reorder, date, bodyweight, session notes, early finish. |
| 12 | Effort mode | When the lifter logs effort instead of RIR, the shelf's RIR field shows the effort word, and its pads step through Easy, Hard and Max. |
| 13 | Swipe | The Focus swipe between exercises stays as an additional gesture. |
| 14 | Rest overrun | After zero the rest line reads "Descanso concluído · +0:15" and keeps counting. |
| 15 | Copy fixes | "Why this weight" names the logged anchor reps and their RIR; EN pause reads "Pause" (both in the session-outcome commit on #272). |

## 2. Preconditions

Plan 063 starts only when all of these hold:

- Plan 058 has merged, so its role scale, control roles and elevation roles
  are frozen on `main`, and `main` has been merged into `redesign/direction-d`
  with an explicit merge commit.
- P0 has refreshed §7 and §13 against the merged 058 and recorded any Sol
  consultations.
- Before a screen marked "needs drawing" in §3 is built, the owner has
  approved its drawing on the review page (P1).

## 3. Surface inventory

Every catalog screen (143 at `29fc1c36`, from `docs/ui-screens/manifest.json`)
gets exactly one treatment:

- **Redesign:** D draws it; build to the D spec plus this document.
- **Needs drawing:** D implies a change but has not drawn it. Draw it on the
  review page, get owner approval, then build (P1).
- **Rules only:** layout stays as 058 leaves it; only D's shared components
  and rules reach it (shared ledger row, verdict mark, tab row, orange budget).
- **Retired:** removed from the app and the catalog.

| Flow | Redesign | Needs drawing | Rules only | Retired |
| --- | --- | --- | --- | --- |
| onboarding-* (8 flows, 45 screens) | | | all 45 | |
| today (6) | ready, day-picker | done, draft-resume | no-program | preview |
| workout (15) | focus, rest-timer, why-this-weight, correction, exercise-actions | session, early-finish, exercise-note, warmup-actions, reorder, skipped-actions, substituted-actions | stale-draft, persist-retry, invalid-draft | |
| session (4) | summary, summary-maintained, summary-declined, summary-mixed | | | |
| progress (28) | overview, overview-action, exercise-chart | overview-baseline, strength, strength-current-block, strength-all-history, strength-comparison, strength-sparse | volume, volume-block, volume-drill-in, prs, prs-drill-in, review, review-active, review-complete, review-insufficient, schedule-diagnosis, sibling-lower-frequency, sibling-shorter-session, guided-repair, volume-reduction-preview, recovery-ineligible, recovery-questions, recovery-preview, recovery-active, recovery-reassessment | |
| history (6) | list, session | edit-dirty, edit-invalid | delete-confirm, conflict | |
| library (3) | | | all 3 | |
| program (15) | overview | | no-program, progression-editor, exercise-picker, custom-exercise, custom-exercise-saving, custom-exercise-deleting, custom-exercise-archiving, custom-exercise-recovery, share-setup, share-one-blocker, share-repair-return, share-ready, text-export | readiness |
| settings (6) | | | all 6 | |
| install (15) | | | all 15 | |
| **Total 143** | **17** | **17** | **107** | **2** |

The Progress "rules only" screens still change: the tab row becomes D's single
row (§4.6), and outcome words follow the new rule. Their content layout is
Plan 056's and stays.

New catalog states (all Redesign): `workout/rest-running` and
`workout/rest-done` (inline rest, replacing `rest-timer`'s sheet),
`workout/why-in-session`, `workout/why-rep-goal`, `workout/why-anchor`,
`workout/why-manual`, `today/mixed-strategies`, `session/summary-first`.
The mixed-strategy fixture follows the D spec §6: one lift per strategy, a
movement without an illustration, a custom exercise and a set logged without
RIR.

## 4. Screen contracts

Each item lists what the D spec leaves open or what the decisions change.
Everything else is the D spec section named.

### 4.1 Today (D §5.1)

- The prescription table reads `recommendation(ex)` for every exercise of the
  selected day. Today already calls it for each exercise (the ready count at
  `renderToday`), so there is no new engine work. Memoize per render.
- Rows are buttons that open the exercise page (`openExerciseView`), as
  `data-exopen` rows do today. The whole row is the target (at least 48 px).
- Target column formats by strategy: range `3 × 7`, rep goal `total 36`,
  anchor and back-off `1 + 2`, effort target `3 × 10`, manual `3 × 12–15` in
  soft ink with no mark.
- The tally line is text, not a control (decision 10).
- `Escolher outro dia` opens the existing day picker (`openDayPickSheet`),
  restyled as a D sheet. The header wraps the long date to two lines at 360 PT
  rather than truncating.
- No Preview button (decision 9). The start button reads `today.start`, or
  `today.continue` when a draft has progress, as now.
- Done state (needs drawing): after today's session, Today shows the session's
  outcome groups in summary form and the week line; the start button becomes
  `today.done_review`.
- Draft resume (needs drawing): the existing recovery notice sits above the
  table in D's style. The start button reads `today.continue`.

### 4.2 Focus and the shelf (D §5.2, §4)

- **Header:** back (leave with the draft kept, G-43), the day and exercise
  position, the timer (shows remaining time while running and opens the rest
  presets sheet), the table view (opens the Session sheet, G-42), and ⋯ (the
  exercise actions sheet).
- **Swipe:** the existing deck swipe between exercises stays (decision 13),
  owned by `motion-layer.js`. The "Próximo" row and the segment bar are the
  visible routes.
- **Ledger:** one row per set, from the existing ledger projection
  (`focusLedgerHtml`/`focusRowVals`): done, open or queued, with the previous
  session's matching set as the second line. The index column accepts labels,
  so warm-up sets show their label and are skipped by the set counter.
- **The shelf** replaces the in-card input well (`focusWellHtml`/`cursetHtml`)
  as a presentation over the same DraftV2 commands. No schema change:
  - Field buttons for load, reps and RIR hold the values of the active set.
    Selection and "is editing" are transient UI state, never persisted.
  - Default selection is reps; load comes from `setSuggestion`. Values the
    lifter has not confirmed show in soft ink, exactly as today's
    suggested-but-untouched inputs (DraftV2 `touched`).
  - A second tap on the selected field turns it into the real input
    (`inputmode="decimal"`, 058's 16 px control type) with the existing
    `data-k` key, so the existing input handlers and validation apply.
  - Pads step by the lifter's settings: load by the load step in the current
    unit (kg or lb), reps by 1, RIR by 1. In effort mode the RIR field shows
    the effort word and the pads step through Easy, Hard and Max (decision
    12).
  - The CTA commits through the same path as today's save button. It reads
    "Registrar série N", or "Salvar série N" while correcting.
  - Correcting: a tap on a done ledger row enters the existing edit mode
    (`focusEdit`) and loads that set into the shelf.
  - When an exercise is complete, the shelf shows the existing completion
    actions (`focus.next_ex` or `log.finish`) in place of the fields.
- **Rest inline** (D §5.4), reading the existing timer state (`startRest`,
  `restPaused`, `armRestTick`, notifications via `notify.js`/`schedule.js`):
  - The cue slot shows the clock on 058's rest-clock role with "de 2:00", an
    orange drain bar, and the next set's cue at 18 px with a "Por quê?" link
    to the in-session Why.
  - The pad row becomes −30 s, Pausar/Retomar, +30 s, Pular. A tap on any
    field brings the pads back.
  - Logging stays enabled throughout, as it is today.
  - At zero the clock collapses to "Descanso concluído · +0:15", counting up
    (decision 14), and the cue returns to the 24 px role.
  - The live region announces the start and the end only, never every second.
- **Recovery banners** (stale draft, persist retry, invalid draft) keep their
  Plan 051 contracts and sit above the ledger. The shelf never covers them.

### 4.3 Why this weight (D §5.3)

- Built from `explainRecommendation`/`explainStrategy`, the same engine facts
  as today. Sentences first, each with a bold lead; the worked calculation
  behind "Ver o cálculo"; the evidence footer; "Entendi".
- The first sentence carries the RIR it used. The anchor strategy names the
  logged top set (the session-outcome commit).
- In-session variant, opened from the rest cue: `why.session` leads, using
  `log.insession.*`. It says the observed capacity ("mostrou 8") before the
  prediction for the next set ("cerca de 7,5"), never the reverse.
- Manual strategy: one sentence, no calculation.

### 4.4 Session summary (D §5.5, §5.6)

- Eyebrow `summary.eyebrow`, the day name, date and week; the three totals.
- One group per lift: the name and its session outcome (the `CONTEXT.md` rule
  via `compareExerciseSession`), the performed sets in mono, a record line in
  the positive color when there is one, and the next target from
  `recommendation()` as the strongest line.
- The first session with a set of lifts shows `summary.baseline` and no
  outcome words.
- Hard sets by muscle stay as ranked weighted counts without bars (G-63).
- The week line (G-64), then "Ver a sessão" and "Concluir".

### 4.5 Exercise chart (D §5.8)

- The primary series is the shipped Strength metric, top load, drawn as the
  step itself, with a small tick where the load went up. Best e1RM is the
  labeled second metric.
- Scope toggle: current block and all history (G-34 default: current block).
- The whole plot is one target that snaps to the nearest session. Every table
  row (at least 48 px) selects the same point and is the accessible
  alternative. Readout: date, metric value, source set.
- No explanation of past load changes; the app does not store one.

### 4.6 Progress overview (D §5.7)

- One tab row of five (decision 5). It scrolls horizontally with a paper fade
  when it overflows at 360 PT. Every tab is at least 44 × 44. The existing
  tab contents (Força, Volume, PRs, Revisão) keep Plan 056's layouts.
- The two totals and the week line.
- Attention rows from the existing action queue (G-30): mark, name, the
  shipped verdict label and reason, evidence kind and count in soft text
  (G-27), the figure and a chevron. The whole row opens the exercise.
- Strength rows: name, the latest session outcome, a top-load sparkline and
  `a→b kg`. The row opens the exercise chart.
- The baseline state (`overview-baseline`, needs drawing) keeps G-31's neutral
  baseline copy.

### 4.7 History list and session (D §5.9, §5.10)

- The list groups sessions by block week ("Semana 4 · 1 de 3"), newest first,
  with month headings when a week crosses a month, and earlier blocks under
  their block name. Search stays (the existing index).
- A session row: weekday and day, the day name with its muscles, then sets,
  load and records on the right. It opens the session page.
- The calendar button opens the existing month calendar as a sheet. A tap on
  a trained day there opens that session.
- The session page: back, title, date and week, the totals, and one group per
  lift with its outcome, the previous exposure line and the numbered sets.
  Editing keeps G-68 (explicit Edit, Save and Cancel; Delete isolated with a
  confirmation). The edit states are "needs drawing" in D's ledger style.

### 4.8 History frequency counts (decision 8)

Two small counts sit above the list, under the heading "Frequência no bloco":

- **Por semana:** one bar per week of the current block, the height being the
  sessions saved that week, against a dashed line at the planned sessions per
  week (the program's training days). Weeks not yet reached draw no bar. The
  current week's label is emphasized.
- **Por dia da semana:** one bar per weekday, the count of sessions on that
  weekday in the block so far, with the value above each bar.

Rules:

- One session counts once. No intensity by sets or volume, no streak, and
  nothing marks a missed day.
- Ink only; no orange (the chart is not live and not a change).
- The pair is one image for assistive technology, labeled with the block
  total ("10 de 18 sessões no bloco, semana 4 de 6"). The list below remains
  the way into sessions.
- Source: the saved log, the block bounds (`programMeta.started`, the block
  length) and the planned days per week. When no program is active, the
  counts are hidden.
- The review page's `history-freq-e` screen is the drawing.

### 4.9 Program (D §5.11)

- Header with "Editar" (opens the existing editor; the editor keeps G-80's
  persistent action layer). The title, lede, week rule and status line.
- Every day open, never truncated. Columns: exercise with its strategy name
  underneath, sets × range, and "Próxima" (the next load from
  `recommendation()`) in soft mono with the verdict mark. Manual rows show the
  authored load with no mark. One legend line under the first column head.
- No readiness line (decision 10).

## 5. Behavior and state contracts

These hold through every packet and are tested by the existing suites named.

- **DraftV2 is untouched.** The shelf, inline rest, correction and swipe are
  presentations over the existing commands. Writes, reload recovery,
  cross-tab locking and the journal behave exactly as today
  (`workout-draft-parity`, `focus-only-parity`, `persistence`,
  `workout-finish-boundary`, `adversarial-draft-transactions`, `workout-draft` suites).
- **One commit path.** Logging a set from the shelf and from the old well run
  the same code; a packet that duplicates the commit path stops.
- **The engine is read-only.** Targets, cues and Why come from
  `recommendation()`, `setSuggestion()` and `explainRecommendation()`. No
  target is computed in the presentation layer (`recommendation-parity`).
- **One outcome source.** The summary, History and Progress read the same
  `compareExerciseSession`/`strengthEvidenceRecords` result for the same lift
  and session (`summary-evidence`, `progress-evidence`, `management-summary`).
- **The rest timer** keeps its state machine, notifications and overrun. The
  inline block and the presets sheet read the same state.
- **Units and effort mode** flow through the existing formatters and
  settings. A lb lifter sees lb everywhere the shelf, cue and Why show a load.
- **Guides** keep their anchors (G-49, G-62, G-69). When D moves a control,
  its guide anchor moves with it. The first-set cue anchors to the shelf CTA.
- **Telemetry** stays on the allowlist (G-83) and follows its controls:
  - `first_set_logged` and `session_completed` fire from the one commit and
    save path, unchanged.
  - `session_summary_viewed` fires when the D summary opens.
  - `history_session_outcome` fires from the History session page's read,
    Edit, Save, Cancel and Delete, as today.
  - `set_saved`, `recommendation_explained` (surface `focus`) and
    `exercise_skipped` are approved but have no producer yet (backlog "Alpha
    measurement producers"). Whichever lands second attaches them to D's
    controls: the shelf CTA, Why opening, and Skip in the exercise actions.
  - `program_readiness_navigated` loses its only producer when decision 10
    removes the readiness line. Plan 063 marks it retired in the allowlist
    after the owner confirms (Plan 063 owner gate 3).
  - No new event and no new property.

## 6. Copy and strings

- The [strings appendix](direction-d-strings.md) is the complete list: 144
  strings, each with its app key, PT, EN, the surface that renders it and the
  review-page key it came from. 25 reuse shipped keys word for word; 119 are
  new, under the owning namespace (`today.*`, `ledger.*`, `focus.*`,
  `rest.inline.*`, `why.*`, `summary.*`, `stats.*`, `exercise.chart.*`,
  `history.*`, `program.overview.*`). Use the appendix's key names; do not
  invent parallel ones.
- Every dynamic `t()` family is enumerated as literal keys, because
  `test/i18n.mjs` fails on unenumerated template keys.
- No em dashes in app prose, no "Regrediu", and no "Hold" as a timer label.
- PT is validated first at 360. Exercise names and muscle lists wrap and are
  never ellipsized.
- Each packet adds only the strings its screens use; `test/i18n.mjs` and
  `build-i18n --check` pass per packet.

## 7. Design system mapping

D's roles map onto Plan 058's. The final token names are confirmed in P0
against the merged contract.

| D element | 058 role |
| --- | --- |
| Page title (30) | `title` |
| Cue line (24) | `section-title` |
| Cue second line, rest next cue | `subtitle` (18) |
| Body, rows, controls | `body`/`control` (16) |
| Secondary lines, previous-set line | `body-small` (14) |
| Column heads (uppercase) | `label` (11) |
| Today load, summary totals, shelf values | `metric` (22) in Mono |
| Rest clock | the protected rest-clock variant |
| CTA, shelf fields and pads, secondary buttons | the control radius 058 sets for primary and adjustment controls |
| Sheets | `modal` radius and elevation |
| Dock | `persistent-action` (nav variant), unchanged |
| Shelf | `persistent-action` |
| Reading screens | `flat`; groups are hairline bands, never cards |

The orange budget from D §3 becomes a rule in `DESIGN.md` and a check (§10):
orange marks only an up or down verdict glyph, the current exercise segment, a
running timer's drain bar, the CTA arrow and the active dock icon. Records use
the positive color; declines are ink.

New content jobs for 058's contract review (P0): the shelf, the inline rest
block, the prescription row, the ledger's open row, and the frequency counts.

## 8. Motion

All motion goes through `motion-layer.js`, which owns the reduced-motion
decision. Keep the existing sheet gestures and the Focus deck. New motion is
limited to the shelf switching between pads and rest controls (a crossfade of
at most 160 ms), the drain bar (a transform, not a width animation), and the
Why calculation disclosure (the existing disclosure height helper). Nothing
animates to celebrate.

## 9. Accessibility

- Every control at least 44 × 44 at 360 in PT and EN, including tabs, the
  calendar button, the Why links and ledger rows.
- Shelf field buttons expose `aria-pressed`. The input on second tap takes
  focus and keeps its accessible name ("Reps, série 2").
- Focus order in Focus: header, cue, Why, ledger, then the shelf. The shelf
  never traps focus.
- Charts and the frequency counts are labeled images with a text or table
  alternative.
- Contrast is checked by 058's rendered-role checker (P5 of 058) on every new
  state, in both themes, including 200 % text.

## 10. Verification

Each packet runs the suites `tools/run-tests.mjs affected` selects, regenerates
the catalog for its flows, and records the changed-frame inventory.

The review page's acceptance checks move to the real app as a catalog gate
(P3a), run over every D-owned catalog state in PT and EN:

1. **Targets:** every `button, a, input, [role=button]` at least 44 × 44 at
   360 (extends `accessibility.mjs --touch-targets-320`).
2. **Overflow:** no element wider than its box at 360 PT except the tab row;
   no `text-overflow: ellipsis` on D surfaces (extends the G-59 overflow gate).
3. **Orange budget:** every element painted with the accent is on §7's list.
4. **Parity:** every outcome word equals `compareExerciseSession`; every shown
   target equals `recommendation()`.
5. **Strings:** no banned words; every rendered string is a catalog key.

The owner reviews each packet's changed frames. Before Plan 059, the owner
repeats the five-second read on Today, Focus and Why at 390: "the app tells me
the exact load and reps, and why".

## 11. Catalog fixture for D states

D-owned catalog states render one lifter, the same one the review page draws,
so the owner can compare a capture with its drawing.

- Add `directionDState()` to `tools/ui-screens/fixtures.mjs`. Its source of
  truth is the review page's `data.js` (program, sessions, prior block) and
  `data-d.js` (the mixed day). Convert, don't retype: a small generator reads
  those files and writes the fixture, so the drawing and the app cannot drift.
- Dates shift by −21 days so the review page's "today" (Monday 21 Sep 2026,
  week 4) lands on the pinned capture clock `CAPTURE_NOW` (Monday 31 Aug
  2026). The block therefore starts on 10 Aug, and every weekday is preserved.
- Program exercises carry the library ids and names from `exercises.js`, the
  range prescription (sets, min, max, RIR 0–2) for the main days, and the exact
  `progression` envelopes of `data-d.js` for the mixed day (anchor and back-off,
  rep goal, fixed effort, manual). The custom exercise is a real custom
  definition in state. The manual slot's authored load is a program field.
- Log rows use the existing row shape: session id, date, day, name,
  exerciseId, set, load, reps, rir (blank for the one missing-effort set),
  work, created, primary, secondary, performedLibraryId.
- The fixture's unit test runs `evaluateProgression` on it and asserts the
  same targets the review page shows (squat 102,5 × 7, and so on). If they
  differ, the conversion is wrong.
- States that are not D-owned keep `catalogState()`, so rules-only frames do
  not change because of the fixture.

## 12. Out of scope

- Engine, persistence, draft schema and setup-link changes.
- Onboarding, Settings, Library and install layouts (rules only).
- New features. D is a redesign of existing capabilities.
- The E, F and G candidates. They remain on the review page as record.

## 13. Code map (refresh in P0)

Read at `main` `29fc1c36`. Plan 058's surface migrations will move these;
P0 records the post-058 locations before any packet starts.

| Surface | Current owner |
| --- | --- |
| Today | `renderToday` (`app.js` ~5988), `todayExListHtml`, `openDayPickSheet` |
| Focus | `renderWorkout` (~6658), `focusCardHtml`, `focusDeckHtml`, `focusCue` (~6441), `focusLedgerHtml`, `focusRowVals`, `cursetHtml` (~6527), `focusWellHtml` (~6562), `setSuggestion`, `focusEdit` |
| Rest | `startRest` (~5338), `paintRest` (~5266), `openRestSheet` (~5403), `renderRestPresets` |
| Why | `openWhySheet` (~15410), `explainRecommendation` (~5169), `explainStrategy` |
| Summary | `renderSessionSummary` (~7230) |
| Progress | `renderStats` (~7442), `setStatsSeg`, `renderStrengthDash` (~7320), `renderAttention` (~8625) |
| Exercise page and chart | `renderExerciseView` (~8970), `progress-model.js` |
| History | `history-ui.js` (index, search, selection, calendar, edit) |
| Program | `renderProgram` (~9585) |
| Outcomes | `buildSessionDelta`, `compareExerciseSession`, `strengthEvidenceRecords` |
| Catalog scenarios | `tools/ui-screens/screens-app.mjs` |
