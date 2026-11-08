# Plan 083: the landing's additive change

Status: **approved in substance by owner decision D-14 (2026-11-08)**: the landing changes additively now,
small: a proof chapter, one band, two FAQ entries, with the headline, structure and actions kept, and no
coach comparison in the copy (D-1). One item needs the owner's word before PR 1 (§3.5, the telemetry
range). Copy is reviewed in each PR (#315). Docs only.
Source: `docs/coach-layer-strategy-2026-11-08.md` §4 and §10 (D-14); the brand guide's "First-run modes".
Step 7 of the note's §11; any point after Plan 078 PR 1, so the proof can show the words stage.
Written against `main` 0fbae7b; check for drift before executing.

Out of scope: the headline, the hero's lede, the page's structure and actions, the feature tabs, the shared
and invalid modes' behaviour, a redesign (held for alpha evidence).

## 1. Problem, and two facts that shape the change

The landing shows the next-target promise and never the mechanism that makes it fit the lifter. Two facts
bound what "additive" can mean:

1. **The proof's exercise cannot take a test set.** The demo is Barbell bench press
   (`LANDING_CASES`, `app.js:23037–38`, id `19f5c6f170d8808bb424e98de4472a7e`), and
   `RepForgeEffortCalibration.eligibility` returns `eligible:false` for it: a horizontal push on a free
   barbell (`effort-calibration.js:10–12, 33–45`). A test-set chapter needs a different lift.
2. **The proof has exactly four chapters by contract.** `test/landing-variants.mjs` pins `steps.length === 4`
   (`:723–760`), the player's `count === 4` with hard-coded starts `[0,6,10,14]` and loop 18 (`:825–945`),
   and telemetry's `landing_action.chapter` is `integerIn(1, 4)` (`telemetry.js:160`), pinned by
   `test/telemetry-unit.mjs:95–105` and `test/fixtures/telemetry.mjs:94` (chapter 5 is an invalid event).

Also recorded, because the plan touches the documents: the brand guide (`docs/brand-guide.md:87–99`) and the
`first-run-proof` frame scenario still describe an older page ("seven steps … lens and rail", "three engine
outcomes and the strength-trend chart", "five questions"); the outcomes band was retired on 2026-10-30 and
the trend lives in feature tab 0 with authored figures (`app.js:23515, 23592–94`).

## 2. Owner decisions (2026-11-08)

| # | Decision |
| --- | --- |
| D-14 | Additive now, small: a proof chapter, one band, two FAQ entries; headline, structure and actions kept. |
| D-1 | No coach comparison in copy; the page shows the mechanism, never the profession. |

## 3. The change. Proposed.

### 3.1 The proof's exercise: Smith machine bench press

Replace the demo's lift with **Smith machine bench press** (`1a05c6f170d88058a3a0c07e098a9605`, illustration
`pr_sm`, EN "Smith machine bench press", PT "Supino reto no Smith"). It is eligible, it is a press (so the
press safety line appears in the chapter, which is honest), it keeps external loading on a 2.5 kg grid so
`landingEvaluate` (`app.js:23048–73`) and the oracle in `test/landing-variants.mjs:140–181` change only
their id, and the sentence "a bench press session" survives as "a Smith machine bench press session"
(`landing.anim.sub`, `i18n-en.json:2362`, PT `i18n-pt.json:2362`). The alternative is Leg extension
(`1a25c6f170d880c59f17ce7802758fc3`, `le_mc`, no safety line, less familiar); the owner may prefer it in
PR 1. `LANDING_PASTE_SHOT.exercise` (`:23043`) and `LANDING_FEATURES.ex.bench` (`:23507`) are the paste
review's and the Progress scene's own lifts and do not change.

### 3.2 The fifth chapter, "Test your guess"

The test set replaces an exercise's **last** working set (Plan 077 OD-7), so the chapter sits between the
rest and the adaptation: chapters become *Know the weight · Log in one tap · Rest at a glance · Test your
guess · See it adapt*. The scene, built from Focus's own markup as the others are (`landingDemoHtml`,
`app.js:23160–251`): the rest tip "Make your last set a test set?" (`maxSetTipHtml`, `:7752`), the guess
sheet with its prefilled guess (`openMaxSetSheet`, `#maxSetSheet`, `index.html:1141–56`), the cue "To
failure at {load}" with the fail rule and the press line (`:9396–401, 9504`), the ledger tag, then the result
pair "Guessed {g} → Did {d}" with its status line (`maxSetResultHtml`, `:7818–33`).

Every number is produced at render time (brand guide `:95–102`): the guess is
`RepForgeEffortCalibration.prefillGuess(reps, rir)` on the authored set before it (10 reps at 2 left gives
11), the result and the status line come from `RepForgeEffortCalibration.result(guess, did)` and the
estimator's `minChecks`, and the authored `did` is the one new logged value in `LANDING_CASES`. With the
case's third set at 12 reps to failure, its capacity equals the authored 10 at 2 left exactly
(60 × (1 + 12/30) both ways), and the history anchor reads set index 0 only, so chapter five's "See it
adapt" numbers are **unchanged** and the oracle keeps passing.

Timing: `LANDING_DEMO` (`:23145–46`) grows to `loop: 24`, `chapters: [0, 6, 10, 14, 20]`, one more still,
and the sheet, wrap, reset and pull beats move after the new chapter. The chapter row's CSS becomes five
columns (`styles.css:5992`) and keeps the flex column at the narrow breakpoint (`:6017`); captions stay whole
and equal-height at 390, 375 and 320 (`landing-variants.mjs:1040–49, 1099–115`). Reduced motion gets the new
still. `LANDING_DEMO_KEYS` (`:23153–57`) lists the `maxset.*` keys the scene shows, so
`test/landing-demo-copy.mjs` keeps proving Focus still says each of them.

### 3.3 One band: "Two numbers per set"

A new `section.firstrun-band` after the proof and before the three ways (`index.html:788`), surface
palette, `data-landing-section="check"`. Title (proposed EN): "It checks your judgement, not just your
numbers." Three short rows, each rendered from `RepForgeEffortCalibration.result` over authored pairs: "You
guessed 11 and did 14: 3 more than you expected." / "You guessed 10 and did 9: 1 fewer." / "Exactly what you
guessed." Then one paragraph that states the limits as facts, every figure from the modules' constants
(`LIMITS.perWorkout`, `perExerciseDays`, `perWeek`, `ESTIMATOR.minChecks`, `CALIBRATION_STEPS`): "At most one
test set a workout, one per lift every {days} days, {perWeek} a week. Nothing changes until a lift has
{minChecks}. Then the weight moves at most {up} step up or {down} down." And one sentence that names the
exclusion: "Never on a barbell squat, bench press or deadlift." No coach word, no percentage, no gauge.

### 3.4 Two FAQ entries

Appended **after** the existing five (`index.html:889–933`), so the RIR question stays third and the frame
capture's `details:nth-of-type(3)` (`screens-onboarding.mjs:930–934`) still opens it:

- **"What is a test set?"** The mechanism in three sentences from the mechanics doc's "Test sets" section
  (`:156–176`), with the figures as `{curly}` fills.
- **"Will it make me train to failure all the time?"** No. The ceilings (§3.3's figures), the exclusion,
  "you choose each time", and the Settings switch (`settings.max_set_lede`), the switch named through
  `landingRich` like the other interface terms.

`landing.faq.rir.q` stays; under Plan 078 the glossary entry it shows defines RIR as reps left.

### 3.5 Telemetry: the one owner call before PR 1

A tap on the fifth chapter cannot be reported under `chapter: integerIn(1, 4)`. Two options:

- **Widen to 1–5.** A schema change to a Plan 071 closed property; it needs the owner's explicit approval.
  Touch points: `telemetry.js:160`; `test/telemetry-unit.mjs:95–105` (accepted and sent lists);
  `test/fixtures/telemetry.mjs:94` (chapter 5 moves from invalid to valid); `test/telemetry-runtime.mjs:396`;
  `plans/071-telemetry-coverage.md:131, 310`; `docs/measurement/posthog-dashboard-recipes.md:120–121`.
- **Report nothing for chapter five.** The click handler (`app.js:24023–25`) skips the capture for index 4.
  The funnel loses one chapter's taps and the schema is untouched.

The plan recommends widening, because the chapter is the page's new argument and its taps are the first
signal of whether calibration is what people respond to (the note's §6). It is the owner's call.

### 3.6 Documents corrected in the same change

The brand guide's "First-run modes" paragraph is rewritten to the page as it is (five chapters, the check
band, the feature tabs with their authored trend, seven questions), and the `first-run-proof` frame scenario
with it. The strategy note's §4 is updated to point here.

## 4. Changes by owner module

| Owner | Change |
| --- | --- |
| `index.html` | The fifth `li[data-landing-chapter]` and button; the check band; two `details.firstrun-qa` |
| `app.js` | `LANDING_CASES` (lift, `did`), `LANDING_DEMO` timing, the chapter-five scene in `landingDemoHtml` and `paintLandingDemo`, `LANDING_DEMO_KEYS`, the band's fills in `renderLandingWays`, the FAQ fills, the stills; the chapter capture per §3.5 |
| `styles.css` | Five chapter columns; the check band |
| `i18n-en.json`, `i18n-pt.json` | `landing.anim.sub` lift name; `landing.anim.ch5.*`; `landing.check.*`; `landing.faq.test.*`, `landing.faq.failure.*`; regenerate `i18n.js` |
| `telemetry.js` and its tests, Plan 071, the dashboard recipes | Only under §3.5's first option |
| `docs/brand-guide.md` | "First-run modes" corrected |
| `docs/ui-screens/manifest.json`, `README.md` | §6 |
| `sw.js` | Revisions from live `main` at merge |

No draft, row, contract or engine change. No Worker redeploy.

## 5. Tests (each red before its change)

- `test/landing-variants.mjs`: the oracle's lift and `move:"up"` on the new id (`:146–181, 571–581`); the
  copy pins (no digit in the chapter-five and check-band templates; the new keys present, the retired ones
  absent); PART 2's `steps.length` 5, `faqCount` 7, sections include `check`; the player's starts, loop and
  count; chapter five lands in its window; the last chapter still shows the engine's numbers; captions
  whole and equal-height at the three widths; reduced motion in PT; Tab reaches the new FAQ items.
- `test/landing-demo-copy.mjs`: the `maxset.*` keys in `LANDING_DEMO_KEYS` exist in both catalogs and Focus
  still says them.
- `test/landing-features.mjs`, `test/landing-proof-capture.mjs`, `test/entry-landing.mjs`,
  `test/landing-offline.mjs`: unchanged behaviour, re-run.
- `test/telemetry-unit.mjs`, `test/telemetry-runtime.mjs`, `test/fixtures/telemetry.mjs`: per §3.5.
- `test/i18n.mjs`; the production syntax check.

## 6. Catalog states

- `first-run-proof`: scenario text corrected; recaptured at the existing `PROOF_HOLD`.
- New `first-run-proof-test`: held inside chapter five, the result pair visible.
- New `first-run-check`: the band centred (`FOCUS_SELECTOR`, `screens-onboarding.mjs:889–895`).
- `first-run-faq-open`: unchanged question (third), recaptured for the two extra closed items below it.
- All landing frames recaptured for the chapter row's fifth column; from CI, committed with the PR.

## 7. PR split

| PR | Content |
| --- | --- |
| 1 | The lift swap and the fifth chapter, with the telemetry decision applied; frames |
| 2 | The check band and the two FAQ entries; the brand guide correction; frames |
