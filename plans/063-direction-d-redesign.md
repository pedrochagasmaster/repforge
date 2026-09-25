# Plan 063: Direction D redesign

Implementation and review use the [evidence protocol](../docs/agents/implementation-evidence.md).
The screen contracts, owner decisions, surface inventory and verification
rules live in the [implementation spec](../docs/design/direction-d-implementation-spec.md);
this plan defines scope, sequence, proof and owner gates.

- **Plan number:** 063
- **Phase:** between Plan 058 (system convergence) and Plan 059 (public-launch validation)
- **Status:** Proposed; waits for Plan 058 to merge
- **Owner approval state:** Direction selected ([ADR 0016](../docs/adr/0016-direction-d-design-reference.md)); every "needs drawing" screen and every packet's changed frames need owner review
- **Depends on:** Plan 058 merged; PR #260 (D spec) and PR #264 (review page) merged as documentation; PR #265 (session outcomes) rebased
- **Blocks:** Plan 059 and the alpha (backlog row "Direction D redesign")
- **Supersedes for these surfaces:** G-23, G-29, G-44, G-60, G-65 (ADR 0016)
- **Affected surfaces:** Today, Focus and rest, Why this weight, session summary, Progress and the exercise chart, History, Program; shared components reach the rest of the catalog
- **Complexity:** High
- **Risk:** Medium to high. The workout shelf sits on DraftV2 and the most-used flow in the app.

## Problem

Plans 049–058 fixed what the audits found and converged the design system,
but the main screens still show the template instead of the prescription,
explain recommendations as a list of rows, spread set entry across a card,
and celebrate a saved session. The owner compared seven directions on the
review page and selected D: read everything as a ledger, act on every set
from one bottom shelf.

## Direction

Build D on Plan 058's roles, screen by screen, keeping every state,
persistence and recovery contract the earlier plans established. The spec's
§1 lists the owner decisions this plan executes; §3 assigns every catalog
screen a treatment (17 redesign, 17 needs drawing, 107 rules only,
2 retired).

## Preserved

DraftV2 and its commit path, the rest timer's state machine and
notifications, the engine and its explanations, `compareExerciseSession` as
the one outcome source, the guide registry and its anchors, History's search
index and edit contract (G-68), Program's editor and its action layer (G-80),
Plan 056's Progress contents and lifecycle surfaces, units and effort mode,
the Focus swipe, and the complete catalog.

## Non-goals

- No engine, schema, persistence, setup-link or telemetry change.
- No change to onboarding, Settings, Library or install layouts beyond the
  shared rules.
- No new capability. Anything D shows exists in the app today.
- No code from the review page. It is a drawing.

## Execution slices

Each slice is one PR against `main`, in order. A slice starts only when the
previous one has merged.

| Slice | Goal | Owns | Proof | Catalog | STOP if |
| --- | --- | --- | --- | --- | --- |
| **063-P0** Refresh | Re-read the code after 058 merges; confirm §7's role mapping against 058's contract; take the five new content jobs (shelf, inline rest, prescription row, ledger open row, frequency counts) through 058's contract review; update the spec's §12 code map | spec and plan docs only | Doc review by owner | none | 058 moved a D surface's contract in a way the spec does not cover |
| **063-P1** Draw the rest | Draw the 17 "needs drawing" screens on the review page in D, with the same acceptance checks; owner approves each | review page, D spec | `checks/acceptance.mjs` passes; owner approval recorded per screen | none (review page only) | A drawing needs a capability or decision the spec does not have |
| **063-P2** Outcomes | Rebase and merge PR #265 (session-outcome rule, anchor Why reps, EN pause) | `app.js` outcome and Why code, i18n, tests | full `simulation.mjs`, `summary-evidence`, `progress-evidence`, `progression-strategies-ui`, affected lane | session summary frames | An outcome test changes meaning rather than fixture |
| **063-P3** Shared parts and gates | D's shared components on 058 roles: ledger row, verdict mark, tab row, sheet header, shelf shell (not yet wired); the real-app gates for targets, overflow, orange budget and strings over D-owned states | `styles.css`, shared renderers, new gate tool, test wiring | new gate runs green on current screens with D states marked pending; 058's `ui-system` suite, `accessibility` | none intended | A shared part changes a screen before its slice |
| **063-P4** Today | Prescription table, tally, row → exercise page, day picker sheet, done and draft-resume states; retire the Preview action and `today/preview`; add the `today/mixed-strategies` fixture | Today renderer, index markup, i18n, catalog scenarios | `today-*` (`today-preview.mjs` rewritten for row → exercise page), `recommendation-parity`, `focus-only-parity`, i18n, gate | today flow | Removing Preview breaks a guide or route still in use |
| **063-P5** Focus and shelf | Header routes (Session sheet per G-42, ⋯ exercise actions), cue, ledger, the shelf over DraftV2 (fields, pads, input on second tap, units, effort mode, CTA, correction, completion actions), recovery banners, swipe kept; the workout sheets drawn in P1 | Focus renderers, shelf, workout sheets, i18n | `workout-draft*`, `adversarial-draft-transactions`, `focus-*`, `workout-finish-boundary`, `persistence*`, `recommendation-parity`, gate | workout flow | The shelf needs a second commit path or a DraftV2 change |
| **063-P6** Inline rest | Rest block in the cue slot, drain bar, rest pads, overrun "+0:15", presets sheet from the header timer; replace `workout/rest-timer` with `rest-running` and `rest-done` | rest renderers, shelf states, i18n, catalog | `schedule.mjs`, `focus-mode`, `focus-*`, `motion-integration`, gate | workout flow | Rest state is read from anywhere but the existing timer |
| **063-P7** Why this weight | Sentences first, calculation disclosure, evidence footer, in-session variant, strategy variants; new catalog states for rep goal, anchor, manual and in-session | Why sheet, explanation formatting, i18n, catalog | `progression-strategies-ui`, `recommendation-parity`, i18n, gate | workout flow | A sentence needs a fact the engine does not return |
| **063-P8** Summary | Ledger summary (G-60 superseded), outcome and next-target groups, first-session baseline, muscles, week line, actions; add `session/summary-first` | summary renderer, i18n, catalog | `session-summary`, `summary-evidence`, `management-summary`, gate | session flow | The summary disagrees with History or Progress for any lift |
| **063-P9** Progress | One tab row (G-29 superseded), overview, attention rows, strength rows and tab states, exercise chart (step series, e1RM toggle, snapping plot, table) | Progress renderers, chart, i18n, catalog | `progress-*`, `progress-evidence`, `progress-lifecycle`, `progress-navigation`, gate | progress flow | A lifecycle surface from Plan 056 changes behavior |
| **063-P10** History | Week list, frequency counts (option E), calendar sheet, session page, edit states in D style (G-23 superseded, G-68 kept) | `history-ui.js`, History markup, i18n, catalog | `history*`, `history-persistence-race`, `history-delete-replay`, gate | history flow | Editing or search loses a Plan 057 guarantee |
| **063-P11** Program | Day ledgers with Próxima, strategy names, legend, status line; retire the readiness line and `program/readiness` (G-65 superseded) | Program renderer, i18n, catalog | `program-actions`, `program-editor-*`, `share-repair`, gate | program flow | The editor or Share repair changes behavior |
| **063-P12** Close | Rules-only sweep of the remaining surfaces; `DESIGN.md` rewritten to D on 058's roles; the full catalog regenerated; the gate over every D-owned state; the owner's five-second read on Today, Focus and Why | `DESIGN.md`, `styles.css`, catalog, gate | full `run-tests.mjs all`, full catalog capture and compare, `check-ui-screens` | all flows | Any D-owned state fails the gate or lacks owner review |

## Owner gates

- P1: each "needs drawing" screen approved on the review page before it is
  built.
- Every slice from P4: the changed-frame inventory reviewed in PT and EN,
  light and dark.
- P12: the five-second read and a board of every D surface before Plan 059
  starts.

## Testing and evidence

Per slice: the suites `tools/run-tests.mjs affected` selects, the slice's
named suites, `test/i18n.mjs` and `build-i18n --check`, the catalog capture
for its flows with the changed-frame inventory, and the P3 gate. The spec's
§10 lists what the gate checks. Every slice's PR body records the commands
and results.

## Screen catalog changes

- Retired: `today/preview` (P4), `program/readiness` (P11), the sheet form
  of `workout/rest-timer` (P6).
- Added: `today/mixed-strategies` (P4), `workout/rest-running` and
  `workout/rest-done` (P6), `workout/why-in-session`, `workout/why-rep-goal`,
  `workout/why-anchor`, `workout/why-manual` (P7), `session/summary-first`
  (P8).
- Every other D-owned state regenerates in its slice.

## Rollback

Each slice reverts on its own. P3's shared parts stay unused until a screen
slice adopts them. P5 keeps the old input well behind the same commit path
until the shelf passes every workout suite, then removes it in the same PR.

## STOP conditions

Stop and ask the owner if a slice would change a state, persistence or
recovery contract; if a screen needs a capability that does not exist; if a
058 role cannot express a D element and the contract review has not approved
a new one; or if any outcome word or target differs between screens.
