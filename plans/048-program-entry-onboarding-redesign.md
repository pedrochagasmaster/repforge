# Plan 048: program entry and onboarding redesign

## Status

- **State:** READY FOR IMPLEMENTATION after Plan 047 can compile every claimed
  route/frequency
- **Priority:** P0 — fourth item in the canonical alpha queue
- **Effort:** XL
- **Risk:** HIGH — first-run activation, active-program replacement, import,
  and shared setup converge here
- **Depends on:**
  [Plan 045](./045-posthog-measurement-foundation.md),
  [Plan 046](./046-multi-strategy-progression-engine.md),
  [Plan 047](./047-taurifer-program-families-compiler.md),
  [ADR 0007](../docs/adr/0007-shared-setup-links.md), and the
  entry/onboarding decisions in the
  [decision register](../docs/product-grilling-decision-register.md)
- **Blocks:** rolling organic alpha recruitment and every generator/Browse Pro
  extension
- **Phase gate satisfied:** normal participant entry and deterministic program
  activation in Plan 044 Phase A/B

## Outcome

Taurifer presents five clearly different program-entry jobs without making the
user understand internal programming jargon:

1. **Recommend a program** — Taurifer chooses the suitable family, schedule,
   exercises, and supported progression setup from the user's real constraints.
2. **Generate a custom program** — the user makes bounded program-specific
   choices such as a compatible split and exercise preferences; Taurifer still
   authors the prescription.
3. **Browse Taurifer programs** — the user chooses a complete, named,
   versioned Taurifer program after a lightweight compatibility check.
4. **Build a program** — the user manually authors days, exercises, order,
   sets, targets, and one of Taurifer's supported progression methods.
5. **Import a program** — the user brings an existing prescription through the
   current review/mapping flow.

All paths converge on the same editable preview, activation transaction,
program model, and progression engine. Generation never overwrites the active
program until the user explicitly activates the preview.

The rolling alpha uses this exact normal flow. There is no participant-only
onboarding, assigned program, founder program audit, paywall, or future-feature
control.

## The key distinction

The current product risks calling two different jobs “build” or “custom.” Use
the authorship test everywhere:

| The user does… | Route |
|---|---|
| States goals, schedule, equipment, and preferences while Taurifer writes the executable prescription | Recommend or Generate custom |
| Chooses one complete Taurifer-authored program | Browse |
| Manually chooses the days, exercises, order, sets, targets, and supported progression methods | Build |
| Brings an existing external prescription | Import |

Choosing a split does **not** make a program manual. Custom is still generation.
Build is manual programming because the athlete writes the executable plan.

## Current-state audit

Re-check these findings against `HEAD`:

- First run currently offers “Create a program / Build your training from
  scratch,” but that action opens the automatic generator. This conflates
  Custom generation with manual Build.
- The wizard stores one mutable `onbAnswers` object and an integer `onbStep` in
  `app.js`; it is not a route-aware or reload-safe state machine.
- Current questions are goal, self-rated beginner/intermediate/advanced,
  2–6 days, split, equipment, unlimited muscle priorities, vague short/normal/
  long session length, and review.
- Current goal labels are “Build muscle,” “Build muscle and Strength,” and
  “Build consistency.” Consistency is incorrectly treated as a goal rather
  than recent training state.
- The flow does not ask structured-program experience, recent six-week
  consistency, exact minutes, preferred rest, exercise avoidance reasons, or
  safe pain/discomfort context.
- It has no Browse catalogue, true empty-day Build, reusable context, draft
  resume/restart, deterministic result versions, or route-switch preservation.
- `finalizeProgramSetup` already uses the repository's program transition and
  draft-conflict protections. Those semantics must be reused, not bypassed.
- Shared setup links have special first-run behavior and released payload
  compatibility that must survive the redesign.

## Locked UX/product decisions

1. The top level has one primary “Create a program” action. Inside it,
   Recommend is the default and Generate custom is the deliberate alternative.
   Browse and “Bring or build my own” are lower, distinct paths.
2. The “at most two choices” rule applies to compatible **split choices** in
   Custom. It does not require presenting only two top-level entry jobs.
3. Recommend is roughly five short sections and asks only what can materially
   change the first program.
4. Desired result has exactly three plain choices: prioritize muscle growth,
   balance muscle and strength, prioritize strength.
5. Consistency is not a desired result. Ask recent behavior over roughly six
   weeks separately.
6. Experience means time following structured resistance programs, not a
   self-awarded level or strength standard.
7. Ask weekly frequency, approximate minutes (30/45/60/75/90+), preferred rest
   interval, and equipment/environment. Do not ask volume tolerance.
8. Recommend and Custom allow at most two primary muscle priorities. Custom
   may also expose de-emphasize/ignore intent.
9. Custom may ask a compatible split and optional must-have/avoid exercises.
   It never asks the user to program sets per muscle, RIR, rep ranges,
   progression math, or deloads.
10. Avoidance is one optional screen with a reason per selected exercise:
    dislike, pain/discomfort, unavailable equipment, or other. Pain receives
    conservative Free safety copy and is not treated as preference telemetry.
11. Same answers plus the same blueprint/compiler/catalogue/rule versions
    produce the same result. There is no random reroll.
12. Recommend returns one primary choice and at most one genuinely close
    alternative. Browse owns the full catalogue.
13. Result explanation cites desired result, current state, schedule, and main
    constraint. Do not show an opaque compatibility score.
14. A generated result is an editable draft. Program replacement/archive occurs
    only through explicit activation.
15. Saved context can prefill later creation but changing circumstances must be
    reviewed. Each draft snapshots its answers and rule versions.
16. Once activated, the program belongs to the user and may be renamed/edited.
17. Research participants use the same flow and random telemetry identifier as
    everyone else.
18. Every feature-looking control works. No Pro teaser, disabled family, fake
    door, or payment exists in this flow.

## Scope

### In scope

- top-level entry information architecture and copy;
- pure route-aware onboarding state machine;
- reusable programming context and resumable setup draft;
- Recommend, Custom, Browse, Build, Import, and shared-setup handoff;
- deterministic result choice and editable preview;
- explicit activation through current transaction/conflict semantics;
- current-onboarding migration/prefill behavior;
- PT-BR/English copy, accessibility, responsive layout, and screenshots;
- allowlisted Plan 045 events;
- unit, browser, property, and model-based long-journey tests.

### Out of scope

- changing Plan 047 family prescriptions/compiler rules;
- arbitrary progression formulas;
- program lifecycle after activation beyond the existing transition contract;
- multi-gym contexts, one-off sessions, or creator publishing;
- Pro advanced generation, history interpretation, adaptation, paywall, or
  payment;
- server accounts/cloud sync;
- research-only questions or manual program review.

## Information architecture

### Entry hub

Use one clear first-run/Program action:

**Create a program**

- **Recommend one for me** — “Answer a few questions. Taurifer chooses the
  structure.” Default and visually primary.
- **Generate a custom program** — “Choose more of the structure and exercise
  preferences.”

Below, with lower emphasis:

- **Browse Taurifer programs** — “Choose a complete program by purpose and
  schedule.”
- **Bring or build my own** — opens two choices:
  - **Build a program** — “Start with empty training days and write it yourself.”
  - **Import a program** — “Review a Taurifer program file or setup.”

Final copy is written natively in PT-BR and English, then checked for equal
meaning. Do not translate “Build” as though it were automatic generation.

### Existing users

The same hub opens from Program. If a program is active:

- creation/import happens in a draft;
- a persistent summary states that the current program remains active;
- activation explicitly explains that the current program will be archived
  without changing its workout history;
- cancel/back leaves the active program untouched.

### Shared setup

If a valid setup fragment is present, preserve the current precedence:

- decode and validate without placing the fragment in telemetry;
- open the existing shared-program review;
- identify source as `shared`;
- do not force generator questions;
- never activate/replace until explicit confirmation;
- retain all released payload decoders under ADR 0007.

## Pure state-machine architecture

### 1. Add a Node-testable module

Add `program-entry.js` as a dependency-free UMD module. It owns:

- route and step definitions;
- transitions, back behavior, and route switching;
- step validation and optionality;
- legacy-answer migration hints;
- context/draft normalization and bounds;
- “which inputs are compatible across routes?” mapping;
- result-choice state;
- activation readiness.

It must not read DOM, storage, current app state, compiler globals, i18n, or
PostHog. `app.js` adapts UI events and injected compiler/catalogue services to
the state machine.

### 2. Use explicit state, not a step integer

Minimum state:

```json
{
  "schemaVersion": 1,
  "draftId": "random UUID",
  "route": "recommend | custom | browse | build | import | shared",
  "step": "stable semantic step id",
  "answers": {},
  "legacyHints": {},
  "result": null,
  "versions": {},
  "activeProgramRevisionAtStart": 0,
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

Use semantic steps such as `desired_result` and `schedule`, not `step_3`.
Back/forward transitions must be valid from the state graph and generated
tests, not scattered click-handler increments.

### 3. Persist one bounded setup draft

Use a dedicated key such as `repforge_program_setup_draft_v1`; do not reuse
the active-workout draft or mutate the live program.

Persist:

- normalized answers;
- exact route/step;
- active-program ID/revision at start;
- compiler, family, blueprint, catalogue, allocation, time-model, and context
  schema versions;
- compiled preview snapshot and deterministic fingerprint after generation;
- result selection and user changes made inside preview;
- timestamps.

Apply strict shape/size/depth bounds and prototype-pollution defenses. If a
draft is corrupt, offer a safe restart without touching the active program.

On app boot, offer **Resume setup** or **Start over**. Starting over deletes
only the setup draft. It does not delete the active program, reusable context,
history, or import file.

If compiler/blueprint versions changed after a saved draft:

- keep the old compiled preview snapshot readable;
- explain that program rules have changed;
- require explicit “Rebuild with current rules” before a current-version
  activation, or allow activation of the internally complete pinned old draft
  if its strategy/catalogue versions remain executable;
- never silently regenerate a different program.

### 4. Store reusable context separately

Add a versioned `programmingContext` to the durable local state/full backup.
It is user-owned context, not telemetry and not shared-program data.

Minimum shape:

```json
{
  "schemaVersion": 1,
  "desiredResult": "muscle_growth | balanced | strength",
  "structuredExperience": "first | under_6m | 6_to_24m | over_24m",
  "recentConsistency": "most | about_half | few | none",
  "availability": {
    "daysPerWeek": 3,
    "sessionMinutes": 60,
    "preferredRestSeconds": 120
  },
  "environment": {},
  "primaryMuscles": [],
  "deEmphasizedMuscles": [],
  "ignoredMuscles": [],
  "priorityMovements": [],
  "exerciseConstraints": [],
  "reviewedAt": "ISO"
}
```

Exact enum labels/copy must be reviewed in the UI, but the semantics stay
closed. A generated program stores a local immutable context snapshot and
source versions for explanation. Full backup includes it; program/shared setup
exports omit personal context and include only the compiled prescription plus
safe provenance.

Future setup prefills values but visually marks circumstances most likely to
change—goal, days, minutes, equipment, consistency, pain/avoidance—and requires
review before compilation.

## Recommend flow

Keep it to approximately five short sections. One section may contain several
closely related controls; do not create a screen for every radio group.

### Section 1 — what the user wants

Ask one required question:

- prioritize muscle growth;
- balance muscle and strength;
- prioritize strength.

Do not show “Build consistency.” The user may care about consistency, but it
describes recent state and product friction, not the program's training goal.

### Section 2 — training background now

Ask:

1. **Time following structured resistance programs**, using broad factual
   ranges: first structured program, under 6 months, 6–24 months, over 2 years.
2. **Recent consistency over roughly six weeks**, using behavior-based choices:
   completed most planned training, about half, only a few sessions, or none/
   returning after a break.

Do not ask “beginner/intermediate/advanced,” strength standards, or a confidence
rating. Experienced returners keep suitable complexity and receive only the
reviewed short re-entry treatment.

### Section 3 — fit the real week

Ask:

- training days per week: 2, 3, 4, 5, or 6;
- maximum typical session: 30, 45, 60, 75, or 90+ minutes;
- preferred interval between demanding sets: concise choices such as 60, 90,
  120, 180+ seconds, plus “let Taurifer choose” if the user has no preference.

Explain that time is a ceiling. Do not ask the user to estimate set volume or
volume tolerance.

### Section 4 — where they train

Start with a shortcut:

- full commercial gym;
- small/basic gym;
- limited home equipment;
- full home gym;
- another setup.

Then show a compact correction screen for material capabilities only. Do not
present a long inventory by default. Limited home may select the Home family;
full home gym remains eligible for ordinary families.

This is a program-generation environment, not the later multi-gym-context
system.

### Section 5 — priorities and constraints

Required/default state may be “No special priority.” Allow:

- zero, one, or two primary muscle groups;
- optional primary movement patterns the user cares about for strength;
- optional exercise avoidance through one search/selection screen.

For each avoided exercise, require one reason only when it is selected:
dislike, pain/discomfort, unavailable equipment, or other. `other` is a closed
reason here; do not collect free text unless a separate local note field is
explicitly designed. Pain/discomfort shows conservative Free advice and a
compatible avoidance/substitution route; it does not diagnose injury.

### Recommend result

Run Plan 047 deterministically. Show:

- one primary recommendation;
- at most one genuinely close alternative, only when a materially different
  valid structure also fits;
- a short explanation tied to desired result, experience/recent state,
  schedule, and the main constraint;
- no score, percentile, “AI,” or unexplained confidence number.

Choosing a result opens the common editable preview.

## Generate custom flow

Custom reuses the same factual context and compiler. It differs because the
user chooses more of the program-specific shape before Taurifer writes it.

After frequency is known, add:

1. **Split preference:** show at most two compatible choices. Select Taurifer's
   default. Hide known-wrong/incompatible choices instead of letting the user
   fail and explaining afterward.
2. **Muscle allocation:** up to two primary muscles plus optional de-emphasized
   or ignored groups, within the same time/volume budget.
3. **Movement priorities:** optional bounded strength-pattern preferences.
4. **Exercise preferences:** optional must-have and the same combined avoid/
   reason screen.

Do not ask:

- number of sets per muscle or exercise;
- RIR/RPE targets;
- rep ranges;
- progression strategy;
- deload timing;
- arbitrary program formulas.

Those are Taurifer's authored prescription in Custom. A user who wants to
choose them belongs in Build.

Custom produces one deterministic draft. “Change” actions alter a named input
and recompile predictably; there is no random “reroll.”

## Browse flow

Browse starts from a named, complete Taurifer program rather than a blank set
of preferences.

### Lightweight compatibility context

Reuse reviewed context if available. Ask only missing material facts needed to
avoid a clearly unsuitable card:

- weekly days/frequency;
- session-minute ceiling;
- environment/equipment;
- structured-program experience where a program has a genuine maturity bound.

Do not require the full Recommend goal flow; the catalogue's purposes are the
choice.

### Catalogue behavior

- show only `browse: true`, complete, executable, tested blueprint versions;
- rank suitable cards but preserve browsing agency;
- card facts: purpose, frequency, time range, maturity fit, equipment
  assumptions, weekly structure, and progression approach in plain language;
- explain a resolvable mismatch (for example, equipment correction) without a
  mysterious score;
- do not show disabled/future families;
- selecting a card emits the approved `template_selected` event and opens the
  common preview;
- the user owns the activated instance and may rename/edit it.

## Build flow — manual programming

Ask only:

1. program name;
2. number of training days.

Create the explicit empty day containers introduced in Plan 047 and open the
normal Program editor. Do not insert placeholder exercises.

The editor lets the user manually add and order exercises, choose sets and
targets, and select one of Plan 046's supported progression methods/basic
parameters. It cannot accept arbitrary formulas or unsupported methods.

The program is not activation-ready until validation passes. Empty/incomplete
days can remain a saved draft, but the UI states what is missing. Existing
active program remains untouched until explicit activation.

## Import flow

Reuse the current bounded file/text/setup decode, exercise mapping, and review
behavior. The route should:

- explain supported Taurifer program formats;
- validate before mutation;
- preserve imported authorship/provenance without treating it as engine input;
- map supported progression semantics and show manual/unsupported states from
  Plan 046 honestly;
- use the common preview/activation transaction;
- leave the source file and active program untouched on cancel/failure.

CSV or third-party-app import is not added by this plan.

## Common editable preview

Every non-empty route reaches a common review surface before activation.

Show:

- program name and source;
- weekly day structure;
- exercises and order;
- working-set/target summary;
- estimated duration per day;
- primary/de-emphasized/ignored priorities;
- progression approach in plain language;
- equipment assumptions;
- compromises or unresolved incompatibilities;
- whether the current program will remain active until activation.

Allow targeted edits through the normal editor. Edits update the program
instance and provenance, not the frozen blueprint or reusable context unless
the user explicitly chooses “Use this for future programs.”

Activation button copy must describe the consequence:

- first run: “Use this program”;
- existing program: “Archive current program and use this one.”

Before commit, compare `activeProgramRevisionAtStart` with live state. If it
changed, show the existing conflict/review path. Never apply a stale draft over
a newer active program.

## Legacy onboarding migration

Existing active programs continue unchanged. Old answers are hints, not
authority for future generation.

| Old field/value | New treatment |
|---|---|
| goal `hypertrophy` | Prefill desired result `muscle_growth`, visibly reviewable. |
| goal `strength_hypertrophy` / old `strength` alias | Prefill `balanced`, visibly reviewable. |
| goal `beginner_consistency` | Do not infer a desired result. Mark it unanswered; consistency belongs in recent state. |
| self-rated `beginner/intermediate/advanced` | Do not silently convert to structured-program time. Show as a legacy hint and require the factual question. |
| `daysPerWeek` | Prefill if still 2–6, require schedule review. |
| vague `sessionLength` | Do not silently treat as minutes. Show a hint and require 30/45/60/75/90+. |
| `equipment` | Map only exact known semantics and require correction/review. |
| `splitType` | Carry only into Custom and only if still compatible. |
| more than two priorities | Preserve as a legacy hint and ask the user to select at most two; do not truncate silently. |

Do not rewrite historical `programMeta` to claim it was created under the new
context/compiler. New provenance begins with new drafts.

## Telemetry contract

Use only Plan 045's facade and catalogue:

- `program_path_selected` with route;
- `generator_started` with allowed Free mode;
- `generator_completed` with closed goal/frequency/family categories;
- `template_selected` with versioned family category;
- `program_activated` with route/version category.

Emit at semantic commits. Do not send:

- answer values beyond approved closed coarse properties;
- exercise/movement/equipment IDs or names;
- priorities, avoidance choices/reasons, pain state, program contents, draft
  fingerprints, active-program IDs, or free text;
- step-by-step input events through custom capture.

Controlled autocapture annotations remain limited to safe static navigation
approved in Plan 045. Onboarding controls containing user choices remain
unmarked unless a specific safe action is reviewed.

## Accessibility and interaction requirements

- one clear heading and question group per section;
- visible overall progress based on semantic sections, not a misleading count
  that changes when optional steps appear;
- Back preserves answers; Cancel explicitly preserves or discards the setup
  draft according to the user's choice;
- optional questions say “Optional” and can be skipped without an error;
- errors are adjacent, summarized, and focused/announced appropriately;
- radio/checkbox/search/list controls expose correct names, state, and group
  semantics;
- focus moves to the new section heading after navigation and returns to the
  opener after closing;
- browser Back is either deliberately integrated with state or intercepted
  consistently so it never exits and loses a draft by surprise;
- 320 px width, large text, reduced motion, light/dark mode, keyboard, VoiceOver,
  and TalkBack are release gates;
- copy uses plain training language; internal terms such as Foundation,
  blueprint, compiler, allocation rule, and primitive are never required from
  the user.

## Implementation sequence

### Slice 1 — pure state machine and persistence

1. Add `program-entry.js`, route/step graph, schemas, and pure tests.
2. Add reusable context and bounded setup-draft storage/normalization.
3. Add resume/start-over and version-staleness behavior.
4. Add generated model tests before rendering new screens.

### Slice 2 — entry hub and shared context questions

1. Replace conflated first-run copy/hub.
2. Build desired-result, background, schedule/rest, environment/equipment, and
   priority/avoidance sections.
3. Add PT-BR/English native copy, progress, Back/Cancel, and migration hints.
4. Keep the old generator behind a temporary compatibility flag only until the
   new compiler path passes; do not expose two competing production flows.

### Slice 3 — Recommend and common preview

1. Connect state machine to Plan 047 family selection/compiler.
2. Show one recommendation plus at most one valid alternative.
3. Add explanation and editable preview.
4. Activate through the existing transition journal/conflict protocol.

### Slice 4 — Custom

1. Add max-two compatible split choices after frequency.
2. Add bounded allocation/movement/exercise preferences.
3. Add targeted change/recompile actions and deterministic fingerprint checks.
4. Prove it never exposes prescription math or random reroll.

### Slice 5 — Browse

1. Add lightweight compatibility context.
2. Render only executable Plan 047 catalogue entries and full card facts.
3. Add rank/mismatch explanation, selection, preview, and activation.

### Slice 6 — Build, Import, and shared convergence

1. Build name/days → empty day editor using Plan 047 explicit structure.
2. Add activation-readiness validation and supported strategy editor handoff.
3. Route Import and shared setup through the common preview/transaction without
   breaking released payload handling.

### Slice 7 — remove legacy path and harden

1. Remove obsolete `onbStep`, `onbAnswers`, old goal/experience/session-length
   UI, and embedded legacy generator once migration tests pass.
2. Expand full model-based lifecycle journeys.
3. Refresh service-worker revisions, i18n, accessibility evidence, and full
   light/dark screenshot catalogue.
4. Run the exact production build through first-run and existing-program manual
   device checks.

Each slice may be reviewed separately, but no public route may point to a
partially implemented or placeholder next slice.

## File-change map

| File | Required change |
|---|---|
| `program-entry.js` | New pure route/step/context/draft state machine. |
| `app.js` | UI adapter, storage integration, compiler calls, preview, activation, legacy removal. |
| `index.html` | Entry hub, onboarding sections, result/catalogue/preview/Build surfaces. |
| `styles.css` | Responsive accessible layouts/states. |
| `i18n/en.json`, `i18n/pt-BR.json` | Entire entry/onboarding/catalogue/preview/migration copy. |
| `i18n.js` | Regenerate. |
| `service-worker.js` | Cache new module and bump revisions. |
| `telemetry.js` call sites | Approved semantic events only; no schema widening without review. |
| `test/program-entry.mjs` | Pure state graph, schemas, migration, resume, switching, validation. |
| `test/generative/` | Route-aware commands/model/invariants and long lifecycle journeys. |
| browser tests | Every route, reload/back/conflict, accessibility, telemetry, responsive screenshots. |

## Test requirements

### Pure state-machine tests

- every valid route reaches preview/editor without impossible steps;
- every Back transition is defined;
- optional skips are legal and required omissions block only the relevant next
  step;
- switching Recommend ↔ Custom preserves compatible answers;
- switching to Browse preserves compatibility context but not irrelevant
  generator preferences;
- Build/Import do not inherit generator prescriptions;
- resume/start-over, corrupt/oversized draft, clock/version changes, and stale
  active revision;
- legacy migration table exactly as specified;
- no input mutation and deterministic state transitions.

### Recommend/Custom compiler tests

- same answers/versions produce the same candidate/draft fingerprint;
- 2–6 days remain covered where Plan 047 promises;
- result uses no volume-tolerance input;
- experienced inconsistent user keeps appropriate complexity with temporary
  re-entry behavior;
- max two primary muscles and max two compatible split choices;
- known-incompatible split never appears;
- must-have/avoid conflict gets a clear compromise/alternative;
- no reroll produces an uncaused output change;
- one primary recommendation and at most one alternative;
- explanation facts match compiler diagnostics, not a second UI algorithm.

### Draft/activation safety tests

- opening/cancelling every route leaves active program byte-equivalent;
- preview edits affect only draft;
- first-run activation and existing-program archive activation;
- active program changes in another tab while draft is open;
- partial local/IndexedDB write, reload, compensation, and recovery;
- old/current program IDs and logs remain correctly associated;
- starting over deletes only setup draft;
- saved old-version preview is not silently regenerated;
- imported/shared invalid payload cannot mutate state.

### Build/Import/Browse tests

- Build creates real empty day containers and no placeholder exercises;
- manual editor supports only Plan 046 strategies and basic parameters;
- incomplete Build saves as draft and cannot activate falsely;
- Browse exposes only current complete tested catalogue entries;
- card fact/mismatch copy comes from declared Plan 047 metadata;
- Import/released shared formats preserve current decode/review behavior;
- personal context never enters shared/exported program payload.

### Telemetry/privacy tests

- exact allowed events fire once at semantic actions;
- route changes/back/reload do not inflate completion/activation events;
- onboarding answers, exercise constraints, pain, equipment details, draft
  fingerprints, program IDs/content, and free text never appear in requests;
- opt-out/blocked SDK does not change any flow result;
- URL setup fragments remain absent.

### Generated/model-based journeys

The fast-check model must generate long sequences including:

- choose/switch route;
- fill, skip, edit, back, reload, resume, restart;
- compile/recompile/change targeted preference;
- preview edit, cancel, activate, conflict;
- run workouts and progress under every supported strategy;
- archive/transition and start another setup with prefilled context;
- import/share during an active draft;
- offline/online and old/new version migrations.

Persist seeds and promote minimized failures into permanent regressions.

### Accessibility/visual/manual matrix

- PT-BR and English;
- 320 px, representative phone/tablet/desktop widths, large text;
- light/dark and reduced motion;
- keyboard only;
- iOS Safari/VoiceOver and Android Chrome/TalkBack on the exact release build;
- first run, returning user with active program, valid shared link, invalid
  shared link, resume draft, and stale-draft conflict;
- complete light/dark screenshot catalogue for every new state.

## Acceptance checklist

- [ ] Entry hub and copy distinguish Recommend, Custom, Browse, Build, and
      Import by authorship.
- [ ] Recommend uses three desired results and separate factual experience/
      recent-consistency questions.
- [ ] Minutes and preferred rest feed time fit; no volume-tolerance question
      exists.
- [ ] Custom exposes no more than two compatible split choices and never asks
      users to program Taurifer's math.
- [ ] Muscle priority is max two; avoidance reasons preserve the pain safety
      distinction.
- [ ] Browse contains only complete tested Taurifer programs and useful card
      facts.
- [ ] Build creates empty day containers and opens real manual programming.
- [ ] Import/shared setup retain compatibility and non-destructive review.
- [ ] Same answers/versions produce the same program; no reroll.
- [ ] Setup resumes/restarts safely and saved context is reviewable/reusable.
- [ ] Every result is an editable draft and activation is explicit/conflict-
      safe.
- [ ] Active/history state is unchanged until activation commits.
- [ ] Research participants use the normal flow.
- [ ] Only approved text-free telemetry leaves the app.
- [ ] PT-BR/English, accessibility, responsive, physical-device, screenshot,
      property, model, and lifecycle gates pass.

## STOP conditions

- STOP if automatic generation is called Build or manual Build opens the
  generator.
- STOP if “Build consistency” remains a training goal.
- STOP if experience is reduced to beginner/intermediate/advanced or a strength
  score.
- STOP if onboarding asks volume tolerance, set volume, RIR, rep ranges,
  progression method, deload timing, or arbitrary formulas in Recommend/Custom.
- STOP if Custom shows a known-incompatible split or more than two split
  choices.
- STOP if generated output changes without an input/version change.
- STOP if a draft replaces/archives an active program before explicit
  activation.
- STOP if a stale draft can overwrite a newer active-program revision.
- STOP if Build fakes empty days with placeholder exercises.
- STOP if Browse shows unfinished/future/disabled families.
- STOP if setup sharing leaks personal programming context.
- STOP if research participants receive a different onboarding or assigned/
  individually audited programs.
- STOP if a Pro/future-feature control or paywall appears in this flow.
- STOP if onboarding data, pain, program contents, exercise IDs, or free text
  enters PostHog.
