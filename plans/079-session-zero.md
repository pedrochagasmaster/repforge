# Plan 079: session zero and the declared priors

Status: **approved in substance by owner decisions D-2 and D-5 (2026-11-08)**: session zero replaces the
"pick a load" prompt for programs without loads, skippable and skipped by default when loads are known; a
published, versioned table of declared priors for opening loads and new-lift ratios. The shape marked
*proposed* below is the default for the PRs; the priors' values are a first draft for review by the
CREF-registered professional (D-1) before the alpha. Docs only.
Source: `docs/coach-layer-strategy-2026-11-08.md` §3.1, §3.3 and §10. Step 3 of its §11; follows Plan 078.
Written against `main` 0fbae7b; check for drift before executing.

Out of scope: the estimator and the standing words (Plan 080, which reserves the reason code `prior` for
this plan), the profile (Plan 081), onboarding B's question set, Pro.

## 1. Problem

No program source starts with a load. Generated programs carry rep targets, RIR and rest but no load
(`program-compiler.js:506–515`); the workout context sets `suggestedLoad:null` for every canonical slot
(`app.js:2698–2705`); the editor's "Suggest loads" marks sets `ready` and produces no load
(`program-editor.js:462–479`); free-form import drops loads to `notImported`; only an authored `loadKg` in
the editor or a shared program travels as a planned load (`app.js:6475–6487`, `shared-setup.js:49`). A lift
with no history therefore reaches Focus as `status:"new"`, the cue says "Pick a load for {min}–{max} reps"
(`focus.cue.pick_load`, `app.js:9408–9415`) and the shelf's Load field is empty. A beginner is asked the one
question they cannot answer, on every exercise of their first week.

The engine already does the second half of the job: a set logged in this session becomes the next set's
anchor (`currentSessionAnchor`, `progression-engine.js:429–456`), so set 1 at any load seeds set 2 correctly.
What is missing is a sensible first load and a protocol for finding it that a beginner can follow in words.

## 2. Owner decisions (2026-11-08)

| # | Decision |
| --- | --- |
| D-2 | Session zero replaces the "pick a load" prompt for new programs without loads. Skippable; skipped by default when loads are known. |
| D-5 | Declared population priors for opening loads in session zero and for a first suggestion on a new or substituted lift, published as a versioned table in the mechanics doc, replaced by the lifter's own data as soon as it exists. |

## 3. Shape. Proposed.

### 3.1 Session zero is the first session of each training day, with a ramp per lift

Rather than a separate assessment day (a new session kind, a Today state, a day the lifter did not plan),
session zero is **the first time each lift with no load is trained**: a short ramp inside the normal session
that finds the working load and then hands over to the programmed sets. On day one every lift ramps; on day
two, day two's lifts. For a program with loads, nothing ramps.

The ramp, on a lift whose cue would be `pick_load` today:

1. **The cue reads "Find your weight".** It names the opening load (§3.3) and offers two actions: *Start at
   {load}* and *I know my weight*, which opens the load wheel as today (the skip).
2. **The lifter does the prescribed minimum reps at the opening load** and answers in words, with the stage-A
   chips: Easy, Hard or Max. In the reps-left stage the chips are the same numbers as any set.
3. **Easy** (≈ 3 left): the set is marked a warm-up (`markWarmup`, `workout-draft.js:1490`), a ramp set is
   inserted before the working sets at the next load (§3.2), and the cue repeats. At most **three** ramp sets.
4. **Hard or Max**: the set stands as working set 1. The engine's live anchor takes it from here, exactly as
   it does today for any first set: Max (0 left) lowers set 2, Hard holds it.
5. The lift's opening load, basis and the number of ramp sets are recorded on its first working row
   (§3.4), so Plan 081 can later say how far the opening guess was from what the lifter demonstrated.

The next ramp load is a pure function: the engine's own capacity arithmetic solved for the prescription's
target RIR at the minimum reps, rounded **down** to the lift's load grid (`loadGridKg`, `app.js:6423`) and at
least one step up: `next = load × (1 + (reps + 3)/30) / (1 + (reps + targetRir)/30)`. With reps 8, target
RIR 2 and 40 kg, next is 42.5 kg on a 2.5 grid. No new engine entry point; the formula is
`FORMULA_VERSION`'s.

Lifts that cannot ramp, and so keep today's behaviour: bodyweight-convention lifts (multiplier 0: there is no
load to find; the first set is logged and the engine anchors on it), assistance lifts, and lifts whose
prescription is `configuration_required`. Per-side lifts ramp on the per-side load.

### 3.2 Draft: one new command. Worker redeploy.

`insertSet {exerciseInstanceId, beforeSetId, role:"warmup", origin:"ramp", programmed, edited}` adds a set
to `setOrder` before the given set and renumbers ordinals. Today the reducer has no add-set command
(`workout-draft.js:1290–1660`); set counts come from `programmedSets`. The command is refused once the lift
has a completed working set, so a ramp cannot be started mid-exercise, and refused when three ramp sets
exist. `toHistoryRows` writes ramp sets as ordinary warm-up rows (`warmup:true`), so the engine
(`app.js:6393`) and volume ignore them as they ignore any warm-up. The draft validator accepts the command;
`workout-draft.js` and the transfer contract change, so PR 2 redeploys the Worker before merge (Plan 077
§6.1).

### 3.3 The declared priors. A new pure module, `starting-loads.js`.

`PRIORS_VERSION = "priors@079.1"`. The module owns three things and nothing else:

- **`openingLoad({exercise, equipmentName, convention, bodyweightKg, experience, grid})`** returns
  `{loadKg, basis}` with `basis` one of `prior`, `ratio` (§3.5), `floor`. The prior is a **fraction of
  bodyweight** keyed on the catalog's movement pattern (`movementPattern[]`) × an equipment class derived
  from `resistanceEquipmentGroupIds` (free barbell, Smith or fixed bar, dumbbell per hand, machine or cable,
  bodyweight plus load) × experience (`programMeta.experience`: beginner / intermediate / advanced, from
  onboarding B's `structuredExperience`, `program-entry-adapter.js:149`). The result rounds **down** to the
  grid and never below the equipment's minimum (a 20 kg bar, the lightest stack).
- **The table.** First draft, deliberately low: a too-light start costs one Easy answer and one ramp set; a
  too-heavy start is the dangerous error. Values are the lower quartile of common beginner starting loads
  and are **reviewed by the CREF-registered professional before the alpha**; they are owner-reviewed
  constants, not engine conclusions. Illustrative rows (fraction of bodyweight; per hand for dumbbells):

  | Pattern | Free barbell | Smith / fixed bar | Dumbbell (per hand) | Machine / cable |
  | --- | --- | --- | --- | --- |
  | Squat | 0.35 / 0.55 / 0.75 | 0.30 / 0.50 / 0.70 | 0.10 / 0.15 / 0.20 | 0.80 / 1.20 / 1.60 (leg press) |
  | Hip hinge | 0.45 / 0.70 / 0.95 | 0.40 / 0.60 / 0.80 | 0.12 / 0.18 / 0.25 | 0.30 / 0.45 / 0.60 |
  | Horizontal push | 0.30 / 0.50 / 0.70 | 0.25 / 0.45 / 0.65 | 0.10 / 0.17 / 0.25 | 0.25 / 0.40 / 0.55 |
  | Vertical push | 0.20 / 0.30 / 0.45 | 0.18 / 0.28 / 0.40 | 0.06 / 0.10 / 0.15 | 0.15 / 0.25 / 0.35 |
  | Horizontal pull | 0.30 / 0.45 / 0.60 | — | 0.10 / 0.17 / 0.25 | 0.25 / 0.40 / 0.55 |
  | Vertical pull | — | — | — | 0.35 / 0.50 / 0.70 (pulldown) |
  | Accessory (biceps, triceps, delts, calves, hamstring, quad, …) | 0.10 / 0.15 / 0.20 | 0.10 / 0.15 / 0.20 | 0.04 / 0.06 / 0.08 | 0.10 / 0.15 / 0.25 |

  Machines vary by brand, so their fractions are the least trusted and the ramp does most of the work there.
  The onboarding competency answers (`competencyAnswers`: pull-ups, push-ups, bench for 10, …,
  `program-entry.js:48–50`) are **not** used in v1; they are recorded as a later refinement.
- **The floor.** With no bodyweight (Build and import routes do not ask; `state.profile.weightKg` is
  onboarding B's) the opening load is the equipment minimum, basis `floor`, and the cue asks for bodyweight
  once through the session sheet's existing field (`setBodyweight`, `workout-draft.js:1630`), which also
  unlocks bodyweight-coefficient lifts (`bodyweight_required`, `progression-engine.js:160`).

The table is published in `docs/progressive-overload-mechanics.md` as a new section, "Finding your weight",
with the version, the rounding rule and the sentence that the lifter's own sets replace it from the first
working set. ADR 0003 permits declared training rules; this is one, and it never alters a conclusion drawn
from the record.

### 3.4 The record. One optional row key. Worker redeploy (with §3.2).

The lift's first working row in session zero gains
`startingLoad: {v:1, openingKg, basis:"prior"|"ratio"|"floor"|"typed", ramps, version}`. `typed` records the
skip (*I know my weight*) with the typed load, so the finding "how far your first guesses were from what you
did" (Plan 081) covers both paths. History edits never touch it; it is never backfilled. The contract's
`validateCanonicalLogRow` validates the shape (OD-24 strictness).

### 3.5 A substituted or new lift: the ratio

Today a swap gets no transfer from the lift it replaces (`app.js:6338–6347`): the slot's history is matched
on the performed library id, so the replacement shows the pick-a-load state. With the priors table, the
opening load of a replacement is `anchorLoad(old) × prior(new) / prior(old)` when the old lift has a history
anchor in the same equipment class or across classes, basis `ratio`, rounded down to the new lift's grid;
otherwise the plain prior. It enters as the ramp's opening load, never as a row, and the ramp runs as in
§3.1. The same rule serves a lift added to the program mid-block. Plan 080's standing stays `first` with
reason `prior` until the lift has its own sets.

### 3.6 Skipping, and when nothing ramps

- *I know my weight* opens the wheel at the opening load, so a lifter who knows their weight still gets a
  sensible wheel position. Choosing it records `basis:"typed"`.
- A program with authored loads (`plannedLoad`), a shared program whose author set them, a lift with
  comparable history, and the three exclusions in §3.1 never show the ramp. Nothing in Settings: ADR 0003
  forbids new dials, and the skip is on the cue.
- A ramp interrupted by finishing early or abandoning saves what was logged as warm-up rows, like any set.

## 4. Changes by owner module

| Owner | Change |
| --- | --- |
| `starting-loads.js` (new) | `PRIORS_VERSION`, the table, `openingLoad`, `nextRampLoad`, `ratioLoad`; pure, no DOM |
| `workout-draft.js` | `insertSet` command with `origin:"ramp"`, its validation and the three-ramp and no-completed-set refusals; `startingLoad` carried to the first working row in `toHistoryRows` |
| `install-transfer-contract.js` | The draft command and set `origin`; the `startingLoad` row key |
| `app.js` | The `ramp` cue kind beside `start` (`focusCue`, `:9392–9437`), its two actions, the Easy branch (mark warm-up, insert, re-cue), the substitution opening load, `effortSource` and bodyweight prompts unchanged |
| `index.html`, `sw.js` | The new script and its precache entry; revisions from live `main` at merge |
| `i18n-en.json`, `i18n-pt.json` | `focus.cue.find_weight`, `focus.cue.start_at`, `focus.cue.know_weight`, `focus.evidence.prior` ("A starting point from your bodyweight; your first set replaces it"), `focus.evidence.ratio`, `history.row.ramp`; regenerate `i18n.js` |
| `docs/progressive-overload-mechanics.md` | New section "Finding your weight" with the table and version |
| `CONTEXT.md` | *Session zero* already defined (2026-11-08); add *Ramp set* and *Opening load* |

`progression-engine.js`, `program-compiler.js`, `program-entry.js`, `shared-setup.js`: no change.

## 5. Draft and data safety

- `insertSet` is refused after a completed working set, so a resumed draft cannot grow a ramp the lifter
  did not start. Ramp sets are pending sets like any other for recovery and replica purposes.
- An older app receiving a draft with `origin:"ramp"` sets ignores the unknown key (`validateSet` ignores
  unknown keys); a row with `startingLoad` passes `isSafeLogRow` as an unknown key on apps before PR 2.
  Plan 077 §6.1's same-origin argument applies.
- No migration: nothing is backfilled; the ramp appears only for lifts that would show `pick_load` today.

## 6. Tests (each red before its change)

- New `test/starting-loads.mjs` (Node, pure): every table cell is a finite fraction; rounding down to the
  grid and the equipment floor; `nextRampLoad` worked examples (40 → 42.5 at reps 8, RIR 2; a grid with
  dumbbell 2 kg steps); `ratioLoad` across classes; bodyweight missing gives `floor`.
- `test/workout-draft*.mjs`: `insertSet` ordering and ordinals, the two refusals, `toHistoryRows` writes
  warm-up rows and `startingLoad` on the first working row.
- New `test/session-zero-browser.mjs`: a fresh generated program with bodyweight 80 kg and experience
  beginner shows "Find your weight" with the table's load on a squat, Easy inserts a ramp set at the next
  grid load, Hard hands over and set 2's suggestion comes from the live anchor, Max lowers set 2, *I know
  my weight* opens the wheel and records `typed`, a program with authored loads shows no ramp, a bodyweight
  lift shows no ramp, a substituted lift opens at the ratio load.
- `test/focus-hero.mjs` (`pick_load`, `none_history`, `:224–225`): the no-history assertions move to the
  ramp cue for rampable lifts and stay for the exclusions.
- `test/install-transfer-contract*.mjs`: the new command and row key validate; `services/install-transfer`
  tests as the RUNBOOK requires.
- `test/i18n.mjs`, `test/exercise-library.mjs` (the new script in both inventories), the production syntax
  check.

## 7. Catalog states

- New `workout/focus-ramp`: the cue "Find your weight" with its two actions and the opening load. New
  `workout/focus-ramp-easy`: after an Easy answer, the inserted ramp set and the re-cue. New
  `history/ramp-rows`: a session with two warm-up ramp rows and the working sets.
- The no-history state has no frame today (a known gap); `focus-ramp` closes it.
- Frames from CI, committed with the PR.

## 8. PR split

| PR | Content | Worker redeploy |
| --- | --- | --- |
| 1 | `starting-loads.js`, the table, the mechanics section, the Node test. Nothing visible changes. | no |
| 2 | The draft command, the `startingLoad` row key, the contract, the ramp cue and flow in Focus, the browser test, frames | **yes** |
| 3 | The substitution ratio and the mid-block new-lift opening load; `CONTEXT.md` terms | no |

The table's professional review (D-1) happens between PR 1 and the alpha, and may change values without
changing shape; `PRIORS_VERSION` is bumped when it does.
