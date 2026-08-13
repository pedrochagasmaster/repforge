# Implementation brief — RepForge pre-launch UI/UX fixes

Hand this file to an implementation agent as its task. It is written to be read cold, with no
prior conversation context.

---

## Validation status

Validated on `main` at `ee59cdf`. The browser baselines are **408/0** for the long-horizon
simulation and **83/0** for Focus mode. Audit numbers are not reused for unrelated work:

- Implement audit findings **F1, F2 and F4–F11**, plus contrast work item **C1**: eleven work items.
- **Defer F3.** The noisy pound formatting is real, but snapping historical values to 5 lb would
  display loads the user did not record. Unit-specific actionable increments need a separate
  product decision.
- F12 (early workout finish), F14 (landscape), F15 (tour accuracy), F17–F30 and every P3 item except
  C1 remain out of this pass.
- F13 and F16 are rejected by current source plus targeted runtime probes; do not implement them.
- Preserve ADR 0003's capacity arithmetic. F1 rounds the four raw recommendation paths; it does
  not replace the median.

## Your task

Implement the eleven validated work items below. The full evidence and post-publication
verification matrix are in `docs/ui-ux-audit-2026-08-13.md`; read that matrix first. Anything
outside the explicit dispatch list is out of scope.

## The repo, in one paragraph

Static site, no build step, no bundler, no package manager at the root. `index.html`, `styles.css`,
`app.js` (dense but readable), `sw.js`, `i18n.js` + `i18n-en.json` / `i18n-pt.json`,
`schedule.js`, `notify.js`. All training data lives in `localStorage` under `repforge_v1`, mirrored
to IndexedDB (`repforge` / `kv`), with an in-progress draft under `repforge_draft_v1`. The only
tooling is a Playwright suite with its own `test/package.json`; there is no root package.

Read `AGENTS.md` and `CONTEXT.md` before touching anything. `CONTEXT.md` is the domain glossary and
it is binding — use its terms in code and copy (**program**, **exercise template**, **session**,
**log row**, **capacity**, **block review**), and avoid the words it lists as forbidden.

### Running it

```bash
python3 -m http.server 8000        # from repo root
# open http://localhost:8000/
```

The service worker caches core assets, so a plain reload can serve stale files. Hard-reload or
clear site data while developing.

### Tests you must keep green

```bash
npm --prefix test ci
npm --prefix test exec -- playwright install chromium --with-deps
# separate terminal, from the repository root:
python3 -m http.server 8000
node --check app.js
node --check i18n.js
node --check sw.js
REPFORGE_URL=http://localhost:8000/ npm --prefix test run simulate
REPFORGE_URL=http://localhost:8000/ npm --prefix test run test:focus
```

Both browser suites run in CI on every PR (`.github/workflows/simulation.yml`). New focused checks
will increase the pass counts; the invariant is zero failures, not the original exact totals.
**F1 changes recommendation output and may move existing expectations.** If it does, verify the new
number independently, update the exact expectation, and document why. Do not loosen assertions.

---

## Hard constraints

- **No new dependencies.** No npm packages at the root, no CDN links, no build step. Vanilla JS,
  matching the existing style (terse, no semicolon-free experiments, no framework).
- **Every workstream that adds user-facing copy updates `i18n-en.json`, `i18n-pt.json`, and both
  dictionaries in generated `i18n.js`.** There is no generator script in this repo, so keep all
  three in sync by hand. Do not add hardcoded English in `app.js`. The integrator resolves expected
  overlaps and verifies exact dictionary parity.
- **Only the integrating branch bumps `CACHE` in `sw.js` once.** Parallel workstreams must not each
  edit it. The shell is network-first, but the final cache rollover keeps the offline set coherent.
- **Do not touch the storage schema.** No migrations, no new keys in `repforge_v1`. Existing
  backups must still import cleanly.
- **Match the surrounding code's density and comment style.** This codebase comments *why*, rarely
  *what*. Follow that.

---

## The fixes

Each item gives you: the symptom, where it lives, what to do, and how you'll know it's done. Verify
every acceptance criterion in a real browser before moving on.

---

### F1. History-derived hold-family recommendations can return unloadable weights — **P0**

**Symptom.** An even-set prior session whose middle loads average off the configured increment grid
can yield `Hold 53.75 kg`, `Drop to 51.25 kg`, `68.25`, `92.25` or `113.75`. The audit fixture
reproduced this on 6 of 6 lifts. Mixed-load sessions do not all trigger it.

**Cause.** `recommendation()` (`app.js:934–970`) uses `l.med` — the *median* of the previous
session's loads. The `add`, `add2` and below-range `reduce` paths pass it through `round()`
(`app.js:880`, snaps to `minJump`, default 2.5 kg). Four paths — stalled, recover, push reps and the
default hold — return it raw.

**Do.**
- Round the load on all four stalled/recover/push-reps/default raw return paths, the same way the
  load-change paths do.
- Keep `l.med` as the capacity engine's typical-load reference. ADR 0003 and plan 039 deliberately
  normalize capacity at that load; replacing it with top load or set 1 is out of scope.
- Confirm `baseSuggestion()` passes the corrected `rec.load` through unchanged. Do not round the
  independent current-session `setSuggestion()` hold: it may truthfully echo a manually entered
  off-grid load and belongs to the deferred input/increment policy.

**Done when.** With `minJump = 2.5`, every history-derived `recommendation().load` from the stalled,
recover, push-reps and default paths lies on the internal kilogram grid. Exercise all four branches
with mixed previous-set loads and assert the kg card, untouched first-set Focus cue and
exercise-page headline. In lb mode preserve lossless conversion; do not invent F3's display grid.

---

### F2. Two definitions of "this week" — **P0**

**Symptom.** Same state, same moment: Today says `2 of 3 sessions completed`, Progress says
`2 of 3 sessions`, Program says `3 / 3` and `3 / 3 days this week`. Ground truth is 2.

**Cause.** `weeklySnapshot()` (`app.js:542`) uses `weekRange(today)` — Monday-to-Sunday.
`programAdherence()` (`app.js:538`) uses `daysAgo(6)` — a rolling 7 days. Both render under labels
that read identically.

**Do.** Make `programAdherence()` filter inclusively from `weekRange(today()).start` through `.end`,
matching `weeklySnapshot()`. Preserve the current adherence rule: it counts each planned training
day at most once, even where the existing UI calls the result sessions.

**Done when.** Today, Progress → This week, Program → sessions stat, and the Program `days this
week` chip all report the same number for the same log. Seed the previous Sunday, dates inside the
current Monday–Sunday range and the following Monday; future-dated rows must not leak in.

---

### F3. Pound formatting and actionable increments — **DEFERRED**

**Symptom.** In lb mode: `115.74 lb`, `Drop to 112.99 lb`, PR table `194.01` / `199.52`, delta
`+5.51`, metrics row `231klb` and `307lb`.

**Cause.** Two separate problems.
- `fmtPlain` (`app.js:32`) does `.toFixed(2)`, and `fmtLoad` = `fmt(toDisplay(kg))` converts without
  rounding to a loadable increment.
- `kfmt` (`app.js:38–40`) returns `"231k"` and callers concatenate the unit with no separator.

**Do not implement this in the current pass.** A stored historical value and an editable
recommendation are different contracts. Rounding both to 5 lb would make history untruthful, while
rounding only the cue would make it disagree with the prefilled input unless the entry pipeline also
changes. The `minJump` setting is explicitly kilogram-based even in lb mode. Record a follow-up
decision covering those three surfaces together.

The accessible separator in abbreviated metric values may be fixed only if it can be done without
introducing the broader rounding policy.

---

### F4. Onboarding discards the equipment answer — **P0**

**Symptom.** Onboarding step 5 says *"Pick everything you can use. We'll only program what you
have."* Select **Bodyweight** only and you get `Barbell back squat`, `Barbell bench press`,
`Cable pullover`, `Dumbbell curl`.

**Cause.** `catalogForSlot()` falls back to the entire catalogue when filtering empties a slot.
`applyPriorityMuscles()` separately calls `chooseExercise()` with an empty equipment list. Removing
those bypasses can expose a day type with zero valid primary slots; the current data model then
silently drops that training day.

**Do.**
- Remove Bodyweight from `ONB_EQ_UI`; the catalogue has zero bodyweight entries. Retain legacy
  mapping/translation support so existing imported onboarding metadata is not broken.
- Remove `catalogForSlot()`'s fallback to the unfiltered catalogue.
- Pass selected equipment through primary-slot selection, `applyPriorityMuscles()` and filler
  selection. If no matching priority template exists, skip that addition. Never retry with an empty
  filter or violate equipment merely to hit `SESSION_BOUNDS`.
- Before leaving the equipment step, detect whether any resolved day type has zero valid primary
  templates. Keep Continue disabled and render a localized explanation: “Choose equipment that
  supports every training day.” / “Escolha equipamentos compatíveis com todos os dias de treino.”
  Short non-empty days are acceptable; silently dropping a selected training day is not.

**Done when.** Every generated exercise—including priority additions and fillers—matches selected
equipment. Every selectable equipment/split case either produces all resolved non-empty training
days or is blocked with that explanation. Bodyweight is absent from new onboarding.

---

### F5. Repeated day types generate visually identical days — **P0**

**Symptom.** 3-day full body → Day 1, Day 2 and Day 3 contain the same six exercises, verbatim. The
step-8 review shows identical cards. 4-day upper/lower → Day 1 = Day 3, Day 2 = Day 4. 6-day PPL →
3 unique days out of 6. These are representative audited scenarios, not an exhaustive count of all
multi-select answer combinations.

**Cause.** `resolveSplit()` (`app.js:333–341`) emits N copies of a day type; `exerciseSlotsForDay()`
returns the same slot list each time; `usedIds` is scoped per day, so nothing varies between
repeats.

**Do.** Rotate each equipment-filtered pool by the occurrence index of that day type while retaining
the per-day duplicate guard. Return `null`, rather than an already-used template, when a within-day
pool is exhausted. Do not collapse duplicate review cards.

**Done when.** Repeated days differ in at least one ordered `libraryId`/visible selection while
alternatives remain, and a template never duplicates within one day. Reuse after alternatives are
exhausted is allowed. Two generations from identical answers have identical ordered visible/library
fields; generated row ids are intentionally unique and excluded from the comparison.

---

### F6. Disabled buttons look enabled — **P0**

**Symptom.** Onboarding step 1: "Continue" renders as a solid black CTA with an orange arrow,
identical to an active button, and does nothing when tapped. No feedback at all. It is the first
interaction in the product and it reads as "the app is broken".

**Cause.** `styles.css` has no `.btn:disabled` rule. (`.iconbtn:disabled` exists at
`styles.css:1029` — follow that pattern.)

**Do.** Add an unmistakable `.btn:disabled` treatment consistent with the existing
`.iconbtn:disabled` pattern: dim the whole CTA and use the default cursor. Do not turn the button
back into an enabled validation flow in this work item.

**Done when.** On onboarding step 1, Continue cannot advance without a selection and its computed
appearance differs clearly from the enabled state. Existing custom disabled treatments for Focus
navigation and icon buttons remain intact.

---

### F7. Loads accepted with no upper bound, and wrong validation messages — **P0**

**Symptom.** Typing `1e5` in the load field commits a set at **100,000 kg**; `99999999` also
commits. Both permanently distort every chart, e1RM, PR and volume number derived from that lift,
and the only way to find the bad row is History → Every set. Separately, the toast reads *"Enter a
weight before saving the set."* for `abc`, `-50`, `0` and `12.5.5` — cases where the user plainly
did enter something, so they don't know what to change.

**Do.**
- Add one parser that trims the raw string and accepts only `^\d+(?:[.,]\d+)?$`. Return distinct
  empty / invalid / valid-kg results. Values `<= 0` or above **1000 kg after exactly one display-unit
  conversion** are invalid; 1000 kg is inclusive. This rejects exponent notation.
- Use the existing empty message only for an empty committed/touched field. Add
  `toast.invalid_weight`: “That isn't a valid weight.” / “Essa carga não é válida.”
- Use the parser in per-set commit, final session save and History session edit. During final save,
  ignore untouched blank rows as today; if a touched, committed or warm-up row has invalid load,
  abort the entire save rather than partially persisting it.
- Voice may continue to fill the same draft inputs and rely on this parser. Draft storage may retain
  raw text. Backup import remains unchanged for compatibility. Reps/RIR policy is out of scope.

**Done when.** Test empty, malformed, non-positive, scientific, comma-decimal, exact-limit and
over-limit values in kg and lb through all three interactive persistence paths. Each rejection uses
the correct localized message and leaves the log unchanged.

---

### F8. Mesocycle counter runs past its own end — **P1**

**Symptom.** `Week 7 of 6`, `Week 9 of 6` — in the Today program chip, the workout header banner
("Block ending — Week 7 of 6."), and the Program tab beside a fully-filled 6-segment progress bar.

**Cause.** `mesocycleWeek()` never separates elapsed week from display week. `blockSnapshot()`
independently recalculates the same unbounded value, so changing only one helper leaves other
surfaces wrong.

**Do.** Centralize lifecycle output. `elapsedWeek = programWeek()` may be null, so define:

- `current = elapsedWeek == null ? null : Math.min(elapsedWeek,total)`
- `overrunWeeks = elapsedWeek == null ? 0 : Math.max(0,elapsedWeek-total)`
- `isFinalWeek = elapsedWeek != null && elapsedWeek >= total`
- `isComplete = programMeta.mesocycleStatus === "completed"`

Consume the clamped value from `mesocycleWeek()` and `blockSnapshot()`. Use `isFinalWeek` to offer
review while active and `isComplete` only for completed-state copy. Passing the target date does not
mutate status to completed; use truthful localized copy such as “Week 6 of 6 · ready for review.”

**Done when.** Test no start date (`current === null`, never Week 0), active week 8 of 6
(`current === 6`, `overrunWeeks === 2`, `isComplete === false`) and stored completed status. No
Today, workout, Program or review surface displays `N of M` where `N > M`.

---

### F9. Volume bars contradict the numbers beside them — **P1**

**Symptom.** `Front delts — 4 / 4 — On target` draws a **67 %** bar. `Lats — 5 / 5 — On target`
draws 83 %. `Chest — 6 / 6` draws 100 %. `Adductors — 0 / 4 — Below` draws a visible 4 % orange nub
for zero sets. A lifter who hit every target sees three different bar lengths.

**Cause.** `renderOverviewVolume()` (`app.js:2103`) sets width to `completed7 / max` where `max` is
the largest value across *all* muscles, while the number and status word next to it are per-muscle
`completed / planned`. Two scales in one row.

**Do.** Compute width as
`planned > 0 ? Math.min(100, Math.round(completed7 / planned * 100)) : 0`. Remove both the
`Math.max(4, …)` JavaScript floor and `.vrow__fill`'s CSS `min-width`, so zero is visually empty.
Retain the existing High/On target/Below status semantics; rows with no planned target use zero
width rather than dividing by zero.

**Done when.** Assert `4/4` and `5/5` at 100%, `0/4` at 0%, over-target capped at 100%, and
unplanned rows at 0% with no visible fill nub.

---

### F10. Overview volume hides the muscles that matter — **P1**

**Symptom.** The same function does `rows.slice(0, 8)` on an alphabetically sorted list. On a real
log that shows Adductors → Mid/upper back and **hides Quads at 0/6 "Low"**, plus Rear delts, Side
delts, Spinal erectors and Triceps. The one row the lifter needs is cut because it starts with Q.

**Do.** Sort a copy by descending `Math.max(planned-completed7,0)`, then ascending completion ratio
(`planned > 0 ? completed7/planned : Infinity`), then localized muscle name. Render the first eight.
When rows remain, add a localized `+{n} more` button that opens the complete Volume segment.

**Done when.** The largest deficits appear first with deterministic ties, the hidden count equals
`rows.length-8` in English and Portuguese, and activating it reveals the complete Volume view.

---

### F11. Dialogs are not modal — **P1**

**Symptom.** `#endBlockConfirm`, `#importChoice` and `#blockReview` all carry `aria-modal="true"`
but never move focus into themselves, do not trap focus, do not close on Escape, and do not restore
focus. The two compact dialogs also have no scrim and leave the page behind tappable. The
full-screen block review already covers the viewport, so it does not need a second visible scrim.

**Do.** Extract the exercise-note sheet's focus/Tab/Escape/focus-return behavior into a shared
controller in `app.js`. Opening records the visible opener, makes background siblings inert, focuses
the first enabled control and installs one Escape/forward-Tab/reverse-Tab handler. Closing removes
inert state and restores the recorded opener. Add one shared scrim for compact dialogs and enable
backdrop-close there only. The full-screen review needs no second visible scrim.

The end-block flow is chained: confirmation closes before block review opens. Transfer the original
Program-page End block opener into block review instead of recording/restoring the now-hidden
`#endBlockGo` button.

**Done when.** For each of the three: background is inert, focus lands inside, Tab stays inside,
Escape closes, and focus returns to the opener. The two compact dialogs are dimmed and close on
backdrop tap; the full-screen review closes through its own Close/Decide later controls. Retain the
exercise-note-sheet behavior while sharing the primitive.

---

### C1. Secondary and accent text fail WCAG AA — **P1**

**Symptom.** `--ink-faint` (`#98948C`) on the app background is **2.7:1** — every section label,
table header, eyebrow, calendar day-of-week row and settings group label fails AA (needs 4.5:1). The
text accent `#E04E14` on background is **3.57:1** — every text link, "Edit", "Done", "See volume ›",
"Cancel", every back link. On card white it's 3.99:1. The disabled Focus prev-chevron is **1.31:1**,
which is difficult to perceive. Disabled controls are exempt from WCAG contrast requirements; its
change below is a usability target, not an AA claim.

**Do.** Keep `--accent:#E04E14` for fills, borders, focus rings and the dark-CTA arrow. Set
`--ink-faint:#6E6A62`. Introduce `--accent-text:#B8410E` and migrate accent foreground text on light
surfaces to it without changing fills/icons that already rely on brand orange. Those candidates
measure 4.82/5.38 and 4.95/5.53 against `#F4F2EF`/white respectively; verify the implemented
selectors. Set `.focusnav:disabled` to a token that reaches the product's 3:1 usability target.

**Done when.** A contrast sweep over Today, Progress, History, Program, Settings and an active
workout reports no audited body-text failures on cream or white. Both locales pass, brand-orange
fills/focus indicators remain unchanged, and disabled Focus navigation reaches 3:1.

---

## Explicitly out of scope

Do **not** attempt these; they need a design or product-decision pass:

- F3 pound display/actionable increment policy.
- F12 early workout finish.
- F14 landscape.
- F15 tour accuracy.
- F17–F30 and every P3 item except C1.
- History performance at multi-year scale and the Focus card's large flex-ledger gap.
- Any redesign of the Focus deck, the Program editor, or the Block review.

F13 and F16 are rejected, not backlog work.

## Parallel workstreams

These are logical workstreams for isolated implementation agents, not conflict-free file seams:

1. Recommendation/week lifecycle: F1, F2 and F8.
2. Onboarding generator: F4 and F5.
3. Load validation: F7.
4. Presentation: F6, F9, F10 and C1.
5. Dialog behavior: F11.

All five may touch `app.js` and browser tests; Presentation and Dialog behavior may share
`styles.css`; four streams may touch i18n artifacts. Each workstream updates every representation
needed by its own behavior, owns focused tests and produces one logical commit. The integrator
cherry-picks in the order above, resolves those expected overlaps, and verifies the merged intent.
No workstream edits `sw.js`; the integrator performs one cache rollover (`repforge-v53` →
`repforge-v54`) after integration.

---

## Verifying your work

There is a reusable Playwright harness pattern in `test/focus-mode.mjs` — `persist()` writes state
to **both** localStorage and IndexedDB (the app restores from IndexedDB first, so writing only
localStorage silently does nothing). Copy that helper rather than reinventing it.

Required focused regression coverage:

- **F1:** all four raw recommendation branches with mixed previous-set loads; internal kg-grid
  alignment plus kg output in the card, untouched Focus first-set cue and exercise page.
- **F2:** previous Sunday, current Monday–Sunday and following Monday; identical counts on Today,
  Progress and both Program surfaces.
- **F4/F5:** every selectable non-empty equipment subset and reachable split/day pair; no Bodyweight
  UI, equipment-valid `libraryId`s including priority additions, no within-day duplicate, differing
  repeated days while alternatives remain, and stable visible output across two generations.
- **F6:** disabled onboarding Continue cannot advance and has computed styling distinct from enabled.
- **F7:** empty, malformed, non-positive, scientific, comma-decimal, exact-limit and over-limit
  inputs in kg/lb; correct toast and unchanged log in per-set, final-save and History-edit paths.
- **F8:** week 8 of 6 across every week-bearing surface, including review; clamped fraction and
  truthful active/completed copy.
- **F9/F10:** `4/4` and `5/5` widths at 100%, `0/4` and unplanned rows at 0%, deficits first,
  deterministic ties, localized hidden-row count and navigation to complete Volume.
- **F11:** all three dialogs get initial focus, forward/reverse Tab loop, Escape, opener restoration,
  inert background and compact-dialog backdrop close; retain exercise-note-sheet coverage.
- **C1:** compute contrast for every changed token against cream and white, assert mapped text
  selectors use the passing token, retain brand-orange fill/focus rules, and check disabled Focus
  navigation against the 3:1 product target.

For each work item, verify in a real browser at 390×844 and check affected screens in both languages
and both units where the behavior varies. Focused tests belong in the existing Playwright files;
do not create a second test framework.

With the static server running in a separate terminal:

```bash
node --check app.js
node --check i18n.js
node --check sw.js
REPFORGE_URL=http://localhost:8000/ npm --prefix test run simulate
REPFORGE_URL=http://localhost:8000/ npm --prefix test run test:focus
```

Confirm zero console errors on every tab — the app currently has none, and that's a property worth
keeping.

After integration, verify i18n parity:

```bash
node <<'NODE'
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { STRINGS } = require("./i18n.js");
for (const lang of ["en", "pt"]) {
  assert.deepStrictEqual(
    STRINGS[lang],
    JSON.parse(fs.readFileSync(`i18n-${lang}.json`, "utf8"))
  );
}
console.log("i18n parity OK");
NODE
```

---

## Delivering

Commit each workstream as one logical change and report the commit hash to the integrator. The
integrator resolves overlaps, verifies generated `i18n.js`, performs the single `sw.js` cache bump,
runs both complete suites, and owns the draft PR. In a fresh browser context, the integrator also
loads online, waits for `navigator.serviceWorker.ready`, reloads, switches offline, reloads again,
and confirms the shell boots without console errors.

Name every changed test expectation and justify it. A moved assertion is a claim that the old
expected value was wrong; do not loosen checks merely to make them pass. If a validated fix requires
an out-of-scope product decision, stop that workstream and report the exact boundary.
