# One-off sessions — product and technical design

> **Status:** Proposed; owner-approved product direction on August 25, 2026
> **Scope:** Temporary planned-session adaptation and off-program session
> generation, execution, history, and entitlement semantics.
> **Entry point:** The existing **Choose another day** button below **Start
> workout** on Today.
> **Strategic context:**
> [`docs/product-grilling-decision-register.md`](../../product-grilling-decision-register.md),
> [`docs/backlog.md`](../../backlog.md), and
> [`ADR 0010`](../../adr/0010-product-business-thesis-and-validation-sequencing.md).

## 1. Summary

Taurifer needs an intentional escape hatch for days when the athlete cannot or
does not want to execute the next programmed session: travel, an unusually busy
week, different equipment, a crowded gym, or training with a friend.

The feature is not a second program and not a random-workout generator. It is a
temporary exception layer with two different authorities:

1. **Adapt a planned session:** preserve the purpose of a program day while
   changing its time or equipment constraints. The result is still the planned
   session.
2. **Create a one-off session:** build useful training for today without
   completing, skipping, reordering, or editing any program day.

The central invariant is:

> A one-off session records real training but never silently rewrites the
> program or advances its prescribed progression.

The feature reuses the existing **Choose another day** entry instead of adding a
competing call to action to Today. Program execution remains primary.

## 2. Problem

The current day picker lets the athlete start a different day from the active
program. That handles ordinary day reordering but not these legitimate cases:

- the available equipment cannot execute any programmed day faithfully;
- the athlete has only one session available during a disrupted week and wants
  to preserve the most important program exposures;
- the athlete wants a familiar standalone Push, Pull, Legs, Upper, Lower, Full
  body, or Arms and shoulders session;
- the athlete wants to select one or more muscle groups;
- the athlete wants to assemble a session manually, including when training
  with a friend.

Today the user must either distort the program, start a misleading program day,
or edit durable program structure for a temporary situation. All three make the
record less trustworthy.

## 3. Goals

1. Give temporary constraints an explicit, low-friction path from Today.
2. Keep **Start workout** as the one visually dominant action.
3. Let an athlete select focus, total available time, and exact available
   equipment before generating a session.
4. Support program-aware disrupted-week sessions without mutating the active
   program or its ordered day queue.
5. Support deterministic Taurifer-authored classic sessions and manual session
   construction.
6. Use the existing workout logger, focus mode, substitutions, rest timer,
   session summary, history, and general statistics wherever their semantics
   remain correct.
7. Preserve an honest distinction among athlete history, program completion,
   and progression evidence.
8. Make every recommendation and warning traceable to the active program,
   selected constraints, or logged history.

## 4. Non-goals

- Replacing or structurally editing the active program.
- Automatically compressing missed program days into a new program schedule.
- Giving partial completion credit to several program days.
- Treating a one-off as evidence that the user needs a permanent schedule
  change.
- A calendar or weekday scheduling system.
- A social account, shared live workout, or two-user optimization system.
- Inferring a training partner's goals, experience, recovery, or program.
- Inventing pain, readiness, recovery, or form assessments.
- Automatically increasing a programmed load because of an off-program set.
- Copying named external programs or branded community routines. Classic
  sessions use original, versioned Taurifer one-session blueprints.
- Resolving the broader pending program-family equipment-variant policy in
  Q268. This feature may use explicit session-only substitutions without
  creating a new program variant.

## 5. Locked product decisions

### 5.1 Entry and hierarchy

- **Start workout** remains the primary Today CTA.
- The feature is reached through the existing **Choose another day** button
  immediately below it.
- The current program-day picker remains available in that sheet.
- One-off creation appears after the program days, visually separated as a
  temporary alternative.
- After a session has already been completed today, the existing **Log another
  session** action opens the same selection hub.
- No one-off CTA is added to the primary Today card, bottom navigation, or app
  header.

### 5.2 Program authority

- Starting or completing a pure one-off never edits `state.program`,
  `state.programMeta`, the active program id, source blueprint identity, day
  order, block start, or block length.
- A pure one-off does not mark a program day complete or skipped.
- After completion, Today still presents the same next programmed day it would
  have presented if the one-off had not occurred.
- Adapting a planned session is different: it keeps the selected program day's
  identity and may count as that planned session if the result still preserves
  its primary purpose.
- Taurifer never silently converts a substantially changed session into a
  planned completion. It routes the athlete to a one-off and says why.

### 5.3 History and progression

- Every performed set is part of the athlete-owned training history.
- One-offs appear in History and may contribute to general PR, workload, and
  muscle-volume views.
- Pure one-offs do not count toward program adherence, program-day completion,
  block volume compliance, program-specific performance trends, or automatic
  progression.
- The next planned workout may show that the exercise was recently performed,
  but the initial release does not advance its programmed load from the
  one-off result.
- Adapted planned sessions use normal program completion and progression
  semantics.

### 5.4 Free and Pro

- Manual one-offs, classic session blueprints, muscle-focus sessions, time and
  equipment filtering, editing, execution, and history are Free.
- Temporary user-directed adaptation of a planned session is Free.
- Program-aware disrupted-week generation, prioritization across the active
  program, sacrifice explanations, and recent/upcoming conflict analysis are
  Pro.
- There is no fake door. Before a real entitlement lifecycle and working Pro
  capability exist, the Pro path is either available to the alpha cohort or
  omitted entirely; the shipped app must not advertise an unusable future
  action.

## 6. Terminology

| Term | Meaning |
|---|---|
| **Planned session** | An unchanged day from the active program. |
| **Adapted planned session** | A temporary time/equipment version that preserves the chosen program day's purpose and counts as that day. |
| **One-off session** | A temporary session whose completion does not complete, skip, reorder, or edit the program. |
| **Program mix** | A Pro one-off that prioritizes exercises or purposes from the active program for a disrupted week. |
| **Classic session** | A deterministic Taurifer one-session blueprint such as Push or Full body. It is not a saved program family. |
| **Muscle-focus session** | A generated one-off centered on user-selected muscle groups. |
| **Manual session** | A one-off whose actual exercise prescription is authored by the user. |
| **Session plan** | The immutable snapshot executed by the workout UI after the athlete accepts the preview. |

The durable History label is **One-off**. The entry action is **One-off
session**. Avoid “Quick workout,” because duration is not necessarily short,
and “Freestyle,” because the generated result remains structured.

## 7. Information architecture

### 7.1 Today states and entry behavior

| Today state | Entry behavior |
|---|---|
| Program active; no workout today | **Choose another day** opens the selection hub. |
| Program active; only one program day | Keep the entry available because one-off and adaptation routes still exist. |
| Program active; today's session completed | **Log another session** opens the selection hub with one-off choices; program-day rows remain available if existing repeat behavior permits them. |
| In-progress draft | Opening either entry offers **Continue current session**, **Discard and choose another**, or **Cancel**. Never create two simultaneous drafts. |
| No active program | This specification does not add an entry to first-run. Manual or classic quick-start without a program is a separate decision. |
| Program transition/review gate active | Keep the transition gate authoritative; do not use one-offs to bypass it. |

The current code hides `#chooseAnotherDay` when `days().length <= 1`. The
implementation must instead base visibility on whether the selection hub has a
valid alternative route, not only on the number of program days.

### 7.2 Selection hub

The current day-picker sheet becomes a selection hub while preserving its
existing program-day list and fast confirmation behavior.

Structure:

1. Sheet header: **Choose today's session**. The Today button may retain
   **Choose another day**.
2. Section: **From your program**
   - Existing program-day rows, including the currently recommended day.
   - Selecting and confirming a row behaves exactly as it does today.
3. Section: **For today only**
   - **Adapt today's session**
     - “Keep its purpose; change time or equipment.”
   - **One-off session**
     - “Choose a focus, time, and available equipment.”
4. Cancel action.

Program-day selection continues to use one confirmation button. The two
temporary-action rows navigate immediately because each opens a reviewable
flow and does not start a workout by itself.

### 7.3 One-off flow

The flow uses progressive disclosure and one primary action per step.

#### Step 1 — What do you want to train?

Available paths:

1. **Get the most from a disrupted week** — Program mix; Pro.
2. **Classic session** — Opens the blueprint choices below.
3. **Choose muscle groups** — One primary focus and up to two secondary muscle
   groups.
4. **Build it myself** — Opens an empty temporary session.

Classic session choices:

- Full body
- Upper body
- Lower body
- Push
- Pull
- Legs
- Arms and shoulders

Training with a friend uses Classic, Choose muscle groups, or Build it myself.
It is explanatory copy, not a separate generator mode. A true buddy mode needs
input from both athletes and remains out of scope.

#### Step 2 — How much time do you have?

Choices:

- 20 minutes
- 30 minutes
- 45 minutes
- 60 minutes
- 75 minutes
- 90+ minutes

The value means total approximate gym time, including working sets, expected
warm-ups, configured or selected rest, exercise transitions, and a small
buffer. More time is a ceiling, not a quota. Taurifer may produce a shorter
session when additional work would not serve the selected purpose.

Preferred rest uses the existing saved preference by default. If the one-off
flow later exposes a temporary rest choice, it must not silently alter the
durable timer preference.

#### Step 3 — What equipment is actually available?

Start with a shortcut and require that its exact inventory remain visible and
editable before generation:

- Same as my program
- Full gym
- Hotel/basic gym
- Dumbbells only
- Barbell and rack
- Machines and cables
- Bodyweight
- Customize

Shortcuts expand into the canonical exercise-library equipment vocabulary:
`barbell`, `dumbbell`, `cable`, `machine`, `smith`, and `bodyweight`. The
implementation owns an explicit mapping from plural `programMeta.equipment`
values to those catalogue codes; it must not compare the two vocabularies
implicitly.

**Hotel/basic gym** is only a starting checklist. It must never assert that a
particular hotel has a cable station, bench, or sufficiently heavy dumbbells.

An optional **Minimize equipment changes** control prioritizes fewer stations
and remains useful when a full gym is crowded. It does not relax the selected
equipment constraint.

#### Step 4 — Review

The review is a generated draft, not a workout and not a program mutation. It
shows:

- session name and origin;
- selected focus;
- exercises in order;
- working sets and target ranges;
- estimated total duration as a range, not a false exact value;
- required equipment;
- program exercises retained and session-only substitutions, where relevant;
- logged-history facts used by the recommendation;
- material conflicts with very recent training or the next planned session;
- what Taurifer omitted to respect the time budget;
- the explicit program-effect statement.

Pure one-off statement:

> This session will be saved to History. Your program will still resume with
> {next program day}.

Adapted planned-session statement:

> This temporarily adapts {program day}. Completing it counts as that planned
> session; your program itself will not be edited.

Primary action: **Start session**.

Secondary actions:

- Edit exercises
- Change time
- Change equipment
- Back

There is no random **Regenerate** action. Editing an input produces the
deterministic result for the revised inputs.

## 8. Mode behavior

### 8.1 Start another program day

This remains the existing behavior:

- preserve the selected program day and its prescription;
- use its normal progression recommendations;
- count completion normally;
- preserve current draft-discard protections;
- show the existing “ready” toast after confirmation.

This path does not enter the one-off builder.

### 8.2 Adapt today's planned session

Inputs are total time, exact equipment, and optionally **Minimize equipment
changes**. Taurifer retains the current program day's ordering and purpose as
far as the constraints allow.

Reduction order:

1. Preserve safety constraints and available equipment.
2. Preserve primary-purpose exercises or compatible session-only
   substitutions.
3. Preserve the program's declared progression-bearing work.
4. Reduce optional isolation or lowest-priority work.
5. Reduce working sets only after lower-priority exercise removal.
6. Never shorten rest below the selected/saved requirement merely to make the
   estimate fit.

The adapted session can count as planned only when all declared primary
purposes remain represented. When the selected time/equipment makes that
impossible, the review states the conflict and offers:

- change constraints;
- start the proposed result as a one-off; or
- return to the unchanged planned day.

This is a temporary execution snapshot. It does not edit the program's stored
exercises, sets, ranges, equipment metadata, or future sessions.

### 8.3 Program mix for a disrupted week

This is a one-off, not a replacement microcycle. It draws from the active
program while accepting that limited time cannot preserve everything.

Candidate priority order:

1. Exact active-program exercises compatible with available equipment.
2. Exercises serving the program's primary purposes and declared priorities.
3. Program exercises not represented in the athlete's most recent logged
   training.
4. Familiar movements with comparable history.
5. Explicit, compatible session-only substitutions when an important purpose
   has no exact equipment-compatible exercise.
6. Lower-priority assistance only if the time model has room.

The algorithm must:

- consider the complete active-program snapshot rather than only the current
  day;
- use recent history as a factual overlap signal, not as a readiness diagnosis;
- prefer a coherent small session over token sets for every muscle;
- preserve primary work and remove secondary work when the budget is tight;
- never claim to have “made up the week” or replaced every missed session;
- state which program purposes were preserved and which were not;
- leave the active day queue unchanged after completion.

Good explanation:

> Preserves your primary knee-dominant, press, and pull exposures within about
> 45–50 minutes. Hamstring isolation and secondary arm work were omitted.

Disallowed explanation:

> Fully replaces all four missed workouts.

### 8.4 Classic session

Classic choices are original, versioned Taurifer one-session blueprints. Each
blueprint declares ordered slot purposes, optional slots, time-removal priority,
and compatible equipment patterns. It does not declare a bespoke progression
engine.

Initial slot intents:

| Blueprint | Required intent | Optional intent as time permits |
|---|---|---|
| Full body | Knee- or hip-dominant lower, press, pull | Second lower pattern, delts, arms |
| Upper body | Press, pull | Second press/pull angle, delts, arms |
| Lower body | Knee dominant, hip dominant | Hamstrings, glutes, calves |
| Push | Chest press, shoulder/delt work | Triceps, second press angle |
| Pull | Lat pull, upper-back row | Rear delts, biceps |
| Legs | Quads, hamstrings/glutes | Calves, second compatible lower pattern |
| Arms and shoulders | Biceps, triceps, delts | Additional compatible angle |

The generator prefers familiar catalogue movements from the active program or
history, then selects deterministic catalogue fallbacks. Novel exercises are
allowed only when needed by focus/equipment and are labeled as new.

### 8.5 Muscle-focus session

- Require one primary muscle group.
- Permit up to two secondary muscle groups.
- Treat primary/secondary as allocation intent, not known volume tolerance.
- Select exercises using catalogue muscle and equipment metadata.
- Avoid duplicating the same movement identity within the session.
- When time cannot support every selected focus meaningfully, ask the athlete
  to remove a secondary focus rather than generating token work.

### 8.6 Manual session

- Open an empty temporary session, not a new program day.
- Reuse the exercise library and custom-exercise support.
- Time and equipment may prefilter the library but do not prevent a deliberate
  manual override; show the mismatch before start.
- The user authors exercise order, working sets, and target ranges.
- The normal workout logger handles substitutions, skips, notes, warm-ups, and
  set recording after start.

## 9. Common generation rules

### 9.1 Determinism and versioning

The same normalized inputs, active-program fingerprint, relevant history
snapshot, catalogue version, blueprint version, and generation-engine version
must produce the same ordered session plan.

Do not use unseeded randomness or expose random rerolls. Store enough source
metadata on the accepted session plan to explain why an older one-off differs
from a newly generated result.

### 9.2 Equipment fidelity

- Every automatically selected exercise must match at least one selected
  equipment code.
- An empty candidate pool is an explicit constraint failure, never permission
  to ignore the equipment selection.
- Substitutions must carry their performed library identity and actual muscle
  metadata, following the existing workout substitution semantics.
- **Minimize equipment changes** is a ranking term after compatibility, not a
  hard excuse to omit a primary purpose without explanation.

### 9.3 Time model

Estimate:

```text
total = working-set execution
      + expected warm-up work
      + selected/rest-preference intervals
      + exercise transitions
      + conservative buffer
```

Use history-derived rest behavior only to improve an estimate and state the
basis when material. Never silently change the timer preference or prescribe
density from inferred behavior.

The preview shows a bounded estimate such as **42–49 min**. If the minimum
coherent plan exceeds the budget, block generation with a useful choice rather
than display an impossible plan.

### 9.4 Recent-training and next-session conflicts

Warnings and ranking may use:

- exercises and muscles actually logged in the recent window;
- the active program's currently recommended/up-next day;
- the user's explicit answer about when they expect to train next, if that
  question is introduced.

They may not claim soreness, recovery, or readiness without user input. Prefer
factual copy such as **You trained quads yesterday** or **Upper A is currently
up next**.

The athlete may override a conflict warning. The choice is recorded as an
ordinary one-off decision, not noncompliance.

## 10. Program, history, and progression semantics

The implementation must separate three ledgers that the current flat log can
otherwise conflate:

| Consequence | Planned | Adapted planned | Pure one-off |
|---|---:|---:|---:|
| Appears in History | Yes | Yes | Yes |
| General PRs and athlete-wide statistics | Yes | Yes | Yes |
| General muscle/workload history | Yes | Yes | Yes |
| Counts as a completed program day | Yes | Yes | No |
| Counts toward block adherence | Yes | Yes | No |
| Counts toward block volume compliance | Yes | Yes | No |
| Advances automatic program progression | Yes | Yes | No, initial release |
| Alters program day queue | Existing behavior | Existing behavior | No |
| May inform factual overlap warnings | Yes | Yes | Yes |
| May become contextual evidence for future Pro interpretation | Yes | Yes | Yes, labeled as one-off |

One-off rows must not inflate `buildBlockReview().completedSessions`,
`weeklySnapshot().completedDays`, adherence, or program-specific progression.
General History and Stats remain faithful to actual training.

Do not implement the distinction by hiding performed identity. That would
break history, PRs, notes, and exercise-detail continuity. Instead, keep the
movement identity and add explicit eligibility semantics.

## 11. Storage and domain model

### 11.1 Session context

The accepted session plan carries a context snapshot. Illustrative shape:

```js
{
  schemaVersion: 1,
  sessionKind: "planned" | "planned_adapted" | "one_off",
  oneOffIntent: null | "program_mix" | "classic" | "muscle_focus" | "manual",
  name: "Push",
  sourceProgramId: "..." | null,
  sourceProgramFingerprint: "..." | null,
  sourceDays: ["Day 1", "Day 3"],
  focus: { classic: "push", primaryMuscles: [], secondaryMuscles: [] },
  constraints: {
    minutes: 45,
    equipment: ["dumbbell", "cable"],
    minimizeEquipmentChanges: true
  },
  generation: {
    engineVersion: 1,
    blueprintId: "classic-push" | null,
    blueprintVersion: 1 | null,
    catalogVersion: "..."
  },
  programCompletionEligible: false,
  progressionEligible: false,
  exercises: []
}
```

This is a semantic shape, not authorization to persist fields that the
implementation cannot validate. Exact schemas must use normalizers and reject
invalid enum values, malformed source references, duplicate exercise-instance
ids, and unsupported equipment codes.

### 11.2 Exercise instances

Each temporary exercise needs its own session-plan instance id plus stable
movement identity:

- `id`: unique within the temporary plan;
- `libraryId` or custom definition reference;
- optional `sourceExerciseId` and `sourceDay` for program-derived work;
- actual name, primary/secondary muscles, sets, range, order, and declared
  progression strategy snapshot;
- whether it is an exact program exercise or a session-only substitution.

Do not insert temporary exercises into `state.program` and later attempt to
undo the mutation. The active workout renderer should consume a session-plan
source abstraction so program and temporary sessions share execution UI
without sharing durable ownership.

### 11.3 Draft

- There remains exactly one `repforge_draft_v1` workout draft.
- On **Start session**, snapshot the accepted session context and exercise plan
  into that draft.
- Reloading the PWA restores the exact accepted one-off plan; it must not
  regenerate against changed history or a changed catalogue.
- Existing draft transaction, cross-tab ownership, pending-write, discard, and
  recovery guarantees remain in force.
- A program replacement or destructive edit must treat an in-progress one-off
  draft as real workout work and use the existing coordinated discard path.

### 11.4 Log rows

The flat log remains backward compatible. New rows should repeat the minimal
session-level fields needed by existing import/export and recovery behavior:

- `sessionKind`;
- `oneOffIntent` when applicable;
- `programCompletionEligible`;
- `progressionEligible`;
- `sourceProgramId` when applicable;
- `sourceExerciseId` and `sourceDay` when applicable;
- accepted constraint/generation references only when needed for explanation.

Existing `performedLibraryId` / `performedMovementId` remains the movement
identity used by general history.

Older rows without the new fields preserve today's behavior: treat them as
planned/progression-eligible unless another existing legacy rule says
otherwise. Do not retroactively guess which historical sessions were one-offs.

### 11.5 Progression seam

Current movement matching intentionally joins history by performed identity.
Do not weaken `matchLift()` to exclude one-offs globally. Introduce an explicit
progression-history selector, for example:

```text
historyForMovement(exercise, scope)
  scope = all_training | program_progression | active_block
```

- General stats and PRs use `all_training`.
- load/rep recommendations use `program_progression`.
- block trends and review use `active_block` plus completion eligibility.

This prevents one-off data from either disappearing everywhere or silently
steering the programmed prescription.

## 12. Execution and completion UX

After **Start session**, one-offs use the normal full/focus workout UI. The
header and context affordance identify **One-off · {session name}** rather than
pretending the workout is a program day.

The active session supports:

- the existing set-entry and recommendation UI where recommendations are
  eligible;
- exercise notes;
- warm-up marking;
- skips;
- mid-session substitutions;
- rest timer;
- leaving and resuming the draft;
- explicit finish/save.

For a new or progression-ineligible one-off exercise, Taurifer may show prior
performance as context but must not label an automatic load as the next
programmed progression. Manual targets or a clearly labeled session-only
suggestion are acceptable.

The completion summary:

- labels the session **One-off** or **Adapted {day}**;
- shows actual sets, movements, duration, PRs, and muscle work;
- omits the normal “program day completed” implication for pure one-offs;
- ends with **Your program resumes with {day}** for pure one-offs;
- returns to Today without changing the active program day.

An incomplete or abandoned one-off saves completed work only when the user
finishes the session through the existing save path. Omitted one-off exercises
are never rescheduled.

## 13. Error and edge behavior

| Case | Required behavior |
|---|---|
| 20-minute Full body cannot fit coherently | Explain the limit; recommend a narrower primary-focus plan or ask for more time. Do not create token sets across many movements. |
| No selected equipment can serve the chosen focus | Keep the user on constraints and name the unsupported focus. Never ignore the filter. |
| Program mix has no exact compatible program exercises | Offer explicit session-only substitutions or another one-off type; leave the program untouched. |
| Custom program exercise has no muscle/equipment metadata | Permit manual inclusion; do not automatically rank or substitute it. |
| Same muscles were logged recently | Show a factual warning and a compatible alternative; permit override. |
| Existing workout draft | Continue, discard through the coordinated path, or cancel. Never overwrite it. |
| Program changes in another tab while building | Revalidate the source fingerprint at start. Regenerate/review the mix or convert it to an independent snapshot; never claim the stale mix represents the new program. |
| Program changes after the one-off has started | Preserve and finish the accepted draft snapshot. The new program must not rewrite an active workout. |
| App reloads mid-session | Restore the exact plan and eligibility flags from the draft. |
| One-off is the second session today | Save as a distinct session; Today recap and History must expose both without double-counting a planned day. |
| Session saved around midnight | Preserve the date explicitly accepted by the workout flow; do not infer eligibility from date alone. |
| Imported old log | Missing eligibility fields retain legacy behavior. |

## 14. Accessibility, copy, and visual requirements

- All controls retain at least 44-point touch targets.
- The selection hub and each flow step use a real heading and a single primary
  action.
- Radio-card selection exposes `aria-pressed` or native radio semantics.
- Constraint summaries and program-effect statements are readable text, not
  color-only badges.
- Equipment chips expose selected state and canonical label.
- Focus returns to the triggering row when a nested sheet closes.
- Back navigation preserves already reviewed answers within the open flow.
- Dynamic Type/text zoom may wrap cards without clipping the primary action.
- Reduced-motion behavior follows the existing modal/sheet system.
- English and PT-BR copy ship together in source dictionaries and regenerated
  `i18n.js`; PT-BR is authored, not word-for-word fallback text.
- The UI follows existing warm-paper, graphite, and burnt-copper tokens. No new
  decorative dashboard chrome is introduced.
- When implementation changes these surfaces, regenerate the exhaustive light
  and dark UI screen catalogue. This documentation-only specification does not
  change the catalogue.

## 15. Privacy and telemetry

The full session plan, workout values, notes, exercise names, and free text stay
in the local athlete record. No telemetry event may include them.

If approved schema-defined measurement exists when the feature ships, coarse
events may include:

- `session_choice_opened` with entry surface only;
- `one_off_builder_started` with mode enum;
- `one_off_generated` with mode, time-bucket enum, equipment-count bucket, and
  generated exercise/set count;
- `one_off_started`;
- `one_off_completed` with coarse counts;
- `planned_session_adapted`;
- `one_off_abandoned` only when abandonment can be defined without session
  content.

Do not send program ids, day names, exercise ids/names, muscle selections,
loads, reps, RIR, notes, generated explanations, source fingerprints, or URLs.
Respect the governing PostHog opt-out and leakage-prevention requirements.

## 16. Entitlement behavior

Capability checks occur before entering Program mix, not halfway through an
already answered flow. Classic, muscle-focus, and manual routes remain
available without Pro.

When a valid Pro entitlement lapses:

- previously completed one-offs remain fully visible;
- an already started program-mix draft remains executable and editable;
- accepted/generated session data is never clawed back;
- future Program mix generation stops;
- the user may recreate a similar session manually using Free tools.

Do not disable an in-progress workout because entitlement changed.

## 17. Testing strategy

### 17.1 Pure and property tests

Extract session generation and eligibility classification behind pure inputs.
Property tests must cover:

- determinism for identical inputs and versions;
- every selected exercise satisfies equipment constraints;
- no duplicate temporary instance id or duplicate movement identity;
- generated plans preserve required blueprint purposes or fail explicitly;
- time estimates do not exceed the selected budget range without warning;
- reducing time removes lower-priority work before primary work;
- **Minimize equipment changes** never introduces incompatible equipment;
- source program snapshots are byte-for-byte unchanged by one-off generation,
  start, save, and discard;
- pure one-off rows are excluded from program completion, block adherence,
  block volume compliance, and program progression selectors;
- pure one-off rows remain included in all-training history and general PRs;
- planned/adapted planned rows retain legacy eligibility;
- older rows without eligibility fields retain legacy behavior;
- normalization rejects malformed enums and source references.

### 17.2 Model-based journey tests

Extend the existing model-based/generative long-journey suite with commands for:

- open/close selection hub;
- select another program day;
- begin each one-off type;
- change time and equipment repeatedly;
- generate, edit, back, and start;
- reload with an active one-off draft;
- cross-tab program change while building or executing;
- substitute, skip, finish, and abandon;
- complete planned plus one-off sessions on the same date;
- run block review after arbitrary mixtures of planned and one-off sessions;
- import/export round trips with old and new rows;
- entitlement lapse before generation and during an active draft.

The oracle should separately track athlete history, program-completion history,
and progression-eligible history. A pass that merely avoids an exception is not
sufficient; every journey asserts those three ledgers.

### 17.3 Browser tests

Add focused Playwright coverage for:

- Today hierarchy and button visibility, including one-day programs;
- existing day-picker behavior remaining intact;
- one-off route placement and keyboard/focus behavior;
- draft-conflict confirmation;
- each builder path and constraint validation;
- deterministic review contents for seeded fixtures;
- workout header and completion-summary labels;
- Today and History after a planned plus one-off same-day sequence;
- EN/PT-BR localization and accessibility names;
- 320, 390, 430, and tablet widths in light and dark themes;
- UI screen catalogue capture for every new primary sheet/view.

### 17.4 Regression gates

- Existing day picker tests remain green.
- Existing draft transaction and adversarial race tests remain green.
- Recommendation fixtures produce identical results when no one-off rows are
  present.
- Weekly and block review fixtures produce identical results when no one-off
  rows are present.
- Export/import and shared-setup behavior do not add one-off draft/session data
  to program-only setup links.
- Offline reload resumes an active one-off draft from cached application code.

## 18. Delivery slices

### Slice 1 — domain separation and manual one-offs

- session-plan source abstraction;
- eligibility fields and scoped history selectors;
- selection-hub route;
- manual one-off build, execution, draft recovery, save, History, and summary;
- completion/adherence/progression regression tests.

This slice proves the difficult semantic boundary before adding generation.

### Slice 2 — Free deterministic generation

- time/equipment inputs and exact inventory correction;
- classic blueprints;
- muscle-focus generation;
- **Minimize equipment changes**;
- generated review and targeted edits;
- property and model-based generator tests.

### Slice 3 — planned-session adaptation

- primary-purpose metadata/derivation;
- temporary removal/substitution rules;
- planned-versus-one-off conversion gate;
- normal completion/progression when the planned purpose is preserved.

### Slice 4 — Pro Program mix

- program-wide prioritization;
- recent/up-next conflict analysis;
- preservation/sacrifice explanations;
- real capability entitlement;
- lapse semantics and alpha/commercial telemetry.

Each slice must be independently usable. Do not ship inert Program mix copy
before Slice 4 works.

## 19. Acceptance criteria

The feature is complete when:

1. An athlete can reach one-off creation through **Choose another day** without
   competing with **Start workout**.
2. The existing program-day selection path still starts the chosen day exactly
   as before.
3. A user can create, review, edit, execute, reload, and save a manual or
   generated one-off.
4. Time and equipment are enforced honestly; infeasible requests fail with a
   useful recovery path.
5. Completed one-offs appear in History and general statistics with their real
   performed movement identities.
6. Pure one-offs do not complete a program day, improve adherence, satisfy
   block volume, advance a programmed recommendation, or reorder the program.
7. After a pure one-off, Today explicitly resumes the same next program day.
8. An adapted planned session counts normally only when its primary purpose is
   preserved and the preview says so.
9. Starting or saving any one-off leaves the durable active-program snapshot
   unchanged.
10. Draft, cross-tab, import/export, offline, localization, accessibility, and
    same-day multi-session cases pass focused and model-based tests.
11. Free routes are genuinely usable and no unavailable Pro capability is
    presented as a working action.

## 20. Follow-up boundary

The [`canonical backlog`](../../backlog.md) owns all follow-up sequencing.
Equipment contexts, program-fit interventions, and optional sync are already
tracked there behind their proper gates.

Reusable one-off templates, a two-athlete optimizer, and progression credit for
pure one-offs are not authorized by this specification. They require a new
product decision; they must not appear as incidental implementation scope.
