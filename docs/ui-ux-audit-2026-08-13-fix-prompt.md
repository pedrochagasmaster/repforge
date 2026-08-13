# Implementation brief — RepForge pre-launch UI/UX fixes

Hand this file to an implementation agent as its task. It is written to be read cold, with no
prior conversation context.

---

## Your task

Fix the twelve defects listed below in the RepForge repo. They come from a hands-on pre-launch
audit; the full findings are in `docs/ui-ux-audit-2026-08-13.md` (read it first — it has
reproductions and screenshots' worth of detail this brief compresses).

The app ships tomorrow. Items 1–7 are launch blockers. Items 8–12 are cheap and high-value; do
them if 1–7 land cleanly. Anything not on this list is **out of scope** — do not refactor, do not
restyle, do not "improve while you're in there".

## The repo, in one paragraph

Static site, no build step, no bundler, no package manager at the root. `index.html`, `styles.css`,
`app.js` (~3,250 lines, dense but readable), `sw.js`, `i18n.js` + `i18n-en.json` / `i18n-pt.json`,
`schedule.js`, `notify.js`. All training data lives in `localStorage` under `repforge_v1`, mirrored
to IndexedDB (`repforge` / `kv`), with an in-progress draft under `repforge_draft_v1`. The only
tooling is a Playwright suite under `test/`.

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
cd test && npm ci && npx playwright install chromium
node --check ../app.js
REPFORGE_URL=http://localhost:8000/ npm run simulate     # long-horizon training simulation
REPFORGE_URL=http://localhost:8000/ npm run test:focus   # Focus-mode state machine
```

Both run in CI on every PR (`.github/workflows/simulation.yml`). **Fix 1 changes recommendation
output and will very likely move simulation assertions.** When that happens: verify by hand that the
new number is the correct one, update the expectation, and say so explicitly in your PR body. Do not
loosen an assertion to make it pass.

---

## Hard constraints

- **No new dependencies.** No npm packages at the root, no CDN links, no build step. Vanilla JS,
  matching the existing style (terse, no semicolon-free experiments, no framework).
- **Every user-facing string goes in both `i18n-en.json` and `i18n-pt.json`.** No hardcoded English
  in `app.js`. Follow the existing key naming (`rec.*`, `toast.*`, `stats.*`, `settings.*`). If you
  cannot write good Brazilian Portuguese for a string, say so in the PR rather than guessing badly.
- **Bump `CACHE` in `sw.js`** (currently `repforge-v53` → `repforge-v54`) in your final commit, or
  returning users get stale assets.
- **Do not touch the storage schema.** No migrations, no new keys in `repforge_v1`. Existing
  backups must still import cleanly.
- **Match the surrounding code's density and comment style.** This codebase comments *why*, rarely
  *what*. Follow that.

---

## The fixes

Each item gives you: the symptom, where it lives, what to do, and how you'll know it's done. Verify
every acceptance criterion in a real browser before moving on.

---

### 1. `hold` recommendations return unloadable weights — **P0**

**Symptom.** With any history where sets used different loads, every "hold" recommendation is a
half-increment nobody can load: `Hold 53.75 kg`, `Drop to 51.25 kg`, `68.25`, `92.25`, `113.75`.
Reproduced on 6 of 6 lifts. It's the app's core output and it's unusable.

**Cause.** `recommendation()` (`app.js:934–970`) uses `l.med` — the *median* of the previous
session's loads (`sessionsForLog()` sets `med: median(o.loads)`). The `add`, `add2` and `reduce`
branches pass it through `round()` (`app.js:880`, snaps to `minJump`, default 2.5 kg). The three
`hold` branches — `app.js:955` (stalled), `956` (recover), `958` (push reps) and the fallthrough at
`959` — return it raw.

**Do.**
- Round the load on every `hold` branch, the same way the others do.
- Then reconsider the median itself. "Hold" should mean *the weight you actually used*, not the
  arithmetic middle of the weights you used. Prefer the previous session's **top working-set load**
  (or set 1's load) as the hold reference, and note in the commit which you chose and why. If you
  keep the median, it must still be rounded.
- Check the same raw-`load` leak in `baseSuggestion()` / `setSuggestion()` (`app.js:1051–1090`) —
  the tempered path already calls `round()`, the untempered path returns `rec.load` straight
  through, which is fine *once* `rec.load` is always rounded. Confirm that holds true for every
  branch.

**Done when.** With `minJump = 2.5`, no recommendation, Focus cue, or exercise-page headline can
ever display a load that isn't a multiple of `minJump`. Test with a seeded log whose sets descend
(e.g. 55/52.5) — the classic trigger.

---

### 2. Two definitions of "this week" — **P0**

**Symptom.** Same state, same moment: Today says `2 of 3 sessions completed`, Progress says
`2 of 3 sessions`, Program says `3 / 3` and `3 / 3 days this week`. Ground truth is 2.

**Cause.** `weeklySnapshot()` (`app.js:542`) uses `weekRange(today)` — Monday-to-Sunday.
`programAdherence()` (`app.js:538`) uses `daysAgo(6)` — a rolling 7 days. Both render under labels
that read identically.

**Do.** Make `programAdherence()` use `weekRange()` so all three surfaces agree. If you believe the
rolling window is deliberate somewhere, keep it *and* relabel that surface "last 7 days" — but only
one of the two behaviours may keep the word "week".

**Done when.** Today, Progress → This week, Program → sessions stat, and the Program `days this
week` chip all report the same number for the same log. Verify with a log that has sessions both
inside and outside the current Mon–Sun window.

---

### 3. Pounds are unusable — **P0**

**Symptom.** In lb mode: `115.74 lb`, `Drop to 112.99 lb`, PR table `194.01` / `199.52`, delta
`+5.51`, metrics row `231klb` and `307lb`.

**Cause.** Two separate problems.
- `fmtPlain` (`app.js:32`) does `.toFixed(2)`, and `fmtLoad` = `fmt(toDisplay(kg))` converts without
  rounding to a loadable increment.
- `kfmt` (`app.js:38–40`) returns `"231k"` and callers concatenate the unit with no separator.

**Do.**
- Introduce one function that owns "kilograms → the string a lifter reads", and route every load
  display through it. It should round to a loadable increment per unit — 2.5 kg / 5 lb — and never
  emit trailing decimal noise. Put it next to the existing `fmtLoad` and delete duplicated logic.
- Keep stored data in kg and full precision. **Only display rounds.**
- Fix the unit spacing in the metrics row and anywhere else `kfmt` output is concatenated with a
  unit label.

**Done when.** Switching Settings → Units to lb produces round, loadable numbers everywhere: the
Focus cue, the last-session ledger, the exercise page, PR tables, PR timeline, metrics. Switching
back to kg is lossless — no accumulated rounding in stored values.

---

### 4. Onboarding discards the equipment answer — **P0**

**Symptom.** Onboarding step 5 says *"Pick everything you can use. We'll only program what you
have."* Select **Bodyweight** only and you get `Barbell back squat`, `Barbell bench press`,
`Cable pullover`, `Dumbbell curl`.

**Cause.** `catalogForSlot()` (`app.js:342`, fallback at `346`): when the equipment filter empties a
slot's pool, it silently falls back to the entire catalogue.

**Do.** Pick one and implement it fully:
- **(a)** Drop slots that can't be filled with the selected equipment, and backfill the day from
  `FILLER_SLOTS` patterns that *can* be filled — so the day still hits its `SESSION_BOUNDS` length.
- **(b)** Keep the fallback but surface it: the step-8 review screen names the exercises that
  required equipment the lifter didn't select, so the promise on step 5 isn't silently broken.

(a) is the better product. (b) is acceptable if (a) turns out to leave days unfillably short —
which it may, since the catalogue has no true bodyweight entries. **Check the catalogue first**
(`EXERCISE_CATALOG`, `app.js:288–332`): if bodyweight is offered in the UI but has almost no
entries, that's the real bug, and the honest fix may be adding a handful of bodyweight movements or
removing the option.

**Done when.** No equipment selection produces an exercise the lifter can't perform, or — if the
catalogue genuinely can't cover it — the review screen says so plainly before they save.

---

### 5. Repeated day types generate byte-identical days — **P0**

**Symptom.** 3-day full body → Day 1, Day 2 and Day 3 contain the same six exercises, verbatim. The
step-8 review shows identical cards. 4-day upper/lower → Day 1 = Day 3, Day 2 = Day 4. 6-day PPL →
3 unique days out of 6. Verified across all 45 reachable answer combinations.

**Cause.** `resolveSplit()` (`app.js:333–341`) emits N copies of a day type; `exerciseSlotsForDay()`
returns the same slot list each time; `usedIds` is scoped per day, so nothing varies between
repeats.

**Do (minimum).** Make the repetition legible instead of looking broken: on the review screen,
collapse repeats of a day type into one card labelled with its multiplicity, and label training days
by type rather than bare ordinals so Day 1 and Day 3 aren't indistinguishable in the Log tab's day
tabs and the Program tab's day list.

**Do (better, if time allows).** Vary exercise selection across repeats of a day type — carry
`usedIds` across same-type days and rotate through the pool — so Day 1 and Day 3 genuinely differ.

**Done when.** A new user completing onboarding never sees two cards with identical contents, and
can tell their training days apart on Log and Program.

---

### 6. Disabled buttons look enabled — **P0**

**Symptom.** Onboarding step 1: "Continue" renders as a solid black CTA with an orange arrow,
identical to an active button, and does nothing when tapped. No feedback at all. It is the first
interaction in the product and it reads as "the app is broken".

**Cause.** `styles.css` has no `.btn:disabled` rule. (`.iconbtn:disabled` exists at
`styles.css:1029` — follow that pattern.)

**Do.** Add a disabled treatment for `.btn` that is unmistakable at a glance. Then consider whether
disabling is even right here: keeping the button enabled and revealing the requirement on tap
("Pick a goal to continue") is friendlier on a first-run screen. Either is acceptable; silence is
not.

**Done when.** No control anywhere in the app is visually indistinguishable between its enabled and
disabled states. Sweep for other `disabled` usages while you're in there.

---

### 7. Loads accepted with no upper bound, and wrong validation messages — **P0**

**Symptom.** Typing `1e5` in the load field commits a set at **100,000 kg**; `99999999` also
commits. Both permanently distort every chart, e1RM, PR and volume number derived from that lift,
and the only way to find the bad row is History → Every set. Separately, the toast reads *"Enter a
weight before saving the set."* for `abc`, `-50`, `0` and `12.5.5` — cases where the user plainly
did enter something, so they don't know what to change.

**Do.**
- Clamp load to a plausible range (upper bound around 1000 kg / 2200 lb) and reject scientific
  notation in `parseDec`'s consumers for this field.
- Split the message into two: "enter a weight" when the field is empty, "that isn't a valid weight"
  (or similar) when it's non-empty but unparseable or out of range. Both keys in both locales.
- Check reps and RIR for the same class of hole while you're there.

**Done when.** No input a thumb can produce results in a stored set that corrupts the charts, and
every rejection tells the user which of the two problems they have.

---

### 8. Block counter runs past its own end — **P1**

**Symptom.** `Week 7 of 6`, `Week 9 of 6` — in the Today program chip, the workout header banner
("Block ending — Week 7 of 6."), and the Program tab beside a fully-filled 6-segment progress bar.

**Cause.** `mesocycleWeek()` (`app.js:568`) never clamps `current` to `total`.

**Do.** Clamp the displayed week, and make the overrun state say something true and useful —
"Week 6 of 6 · block complete" or "2 weeks past · review your block" — rather than an impossible
fraction. The banner is dismissible, so the state persists; the copy has to hold up.

**Done when.** No surface can display `Week N of M` where `N > M`.

---

### 9. Volume bars contradict the numbers beside them — **P1**

**Symptom.** `Front delts — 4 / 4 — On target` draws a **67 %** bar. `Lats — 5 / 5 — On target`
draws 83 %. `Chest — 6 / 6` draws 100 %. `Adductors — 0 / 4 — Below` draws a visible 4 % orange nub
for zero sets. A lifter who hit every target sees three different bar lengths.

**Cause.** `renderOverviewVolume()` (`app.js:2103`) sets width to `completed7 / max` where `max` is
the largest value across *all* muscles, while the number and status word next to it are per-muscle
`completed / planned`. Two scales in one row.

**Do.** Set the fill to `completed / planned` (capped at 100 %) so the bar, the fraction and the
status word all describe the same thing. Drop the `Math.max(4, …)` floor so zero renders as zero.

**Done when.** Every row where the fraction reads `n / n` shows a full bar, and `0 / n` shows an
empty one.

---

### 10. Overview volume hides the muscles that matter — **P1**

**Symptom.** The same function does `rows.slice(0, 8)` on an alphabetically sorted list. On a real
log that shows Adductors → Mid/upper back and **hides Quads at 0/6 "Low"**, plus Rear delts, Side
delts, Spinal erectors and Triceps. The one row the lifter needs is cut because it starts with Q.

**Do.** Sort by deficit (largest shortfall first) rather than alphabetically, and label the
truncation so the list doesn't silently lie ("+5 more" / link to the Volume segment). New string,
both locales.

**Done when.** Any muscle below target appears in the visible eight, or the user can see that more
rows exist.

---

### 11. Dialogs are not modal — **P1**

**Symptom.** `#endBlockConfirm`, `#importChoice` and `#blockReview` all carry `aria-modal="true"`
but have no scrim, never move focus into themselves, don't close on Escape, and don't close on
tap-outside. The page behind stays fully visible and **fully tappable** — you can hit "+ Add
exercise" behind the "End this training block?" dialog.

**Do.** Extract the pattern the exercise-note sheet already implements correctly (`#exNoteSheet` +
`#exNoteScrim`: scrim, focus moved into the dialog, tap-out to close) into a small shared helper,
and apply it to all three. Restore focus to the trigger on close. Keep Escape working.

**Done when.** For each of the three: background is dimmed and inert, focus lands inside on open,
Escape and tap-outside both close, and focus returns to the element that opened it.

---

### 12. Secondary text fails WCAG AA nearly everywhere — **P1**

**Symptom.** `--ink-faint` (`#98948C`) on the app background is **2.7:1** — every section label,
table header, eyebrow, calendar day-of-week row and settings group label fails AA (needs 4.5:1). The
text accent `#E04E14` on background is **3.57:1** — every text link, "Edit", "Done", "See volume ›",
"Cancel", every back link. On card white it's 3.99:1. The disabled Focus prev-chevron is **1.31:1**,
which is invisible rather than merely dim.

**Do.** Darken the two variables until body-size text clears 4.5:1 on both the app background
(`#F4F2EF`) and card white. Roughly `#6E6A62` for `--ink-faint` and around `#B33C0F` for the text
accent get there, but **measure, don't trust those values** — compute the ratios yourself against
both backgrounds. If the brand accent must stay `#E04E14` for large text and fills, introduce a
separate darker token for accent *text* rather than changing the fill colour.

Also give the disabled `.focusnav` chevron enough contrast to read as a present-but-unavailable
control (3:1 for non-text UI).

**Done when.** A contrast sweep over Today, Progress, History, Program, Settings and an active
workout reports no body-text failures. Re-check both locales — Portuguese strings are longer and
land in different places.

---

## Explicitly out of scope

Do **not** attempt these; they need a design pass, not a patch, and they'll blow the timeline:

- The 320 px layout failure (reps/RIR inputs collapsing to 4–6 px, last-session ledger clipped away).
- Landscape (844×390 slices the card mid-word).
- History performance at multi-year scale (32,559 DOM nodes, 45,650 px page).
- The Focus card's ~450 px of reserved dead space.
- Any redesign of the Focus deck, the Program editor, or the Block review.

Findings 15–30 and the P3 list in the audit are also out of scope for this pass. Leave them.

---

## Verifying your work

There is a reusable Playwright harness pattern in `test/focus-mode.mjs` — `persist()` writes state
to **both** localStorage and IndexedDB (the app restores from IndexedDB first, so writing only
localStorage silently does nothing). Copy that helper rather than reinventing it.

For each fix, verify in a real browser at 390×844, and check the affected screens in **both**
languages and **both** units. Several of these bugs only appear in one combination.

Before you open the PR:

```bash
node --check app.js
cd test && REPFORGE_URL=http://localhost:8000/ npm run simulate
cd test && REPFORGE_URL=http://localhost:8000/ npm run test:focus
```

Confirm zero console errors on every tab — the app currently has none, and that's a property worth
keeping.

---

## Delivering

Work on a branch off `main`. One commit per numbered fix, message naming the finding it closes.
Bump `sw.js` `CACHE` in the last commit.

Open a **draft PR**. In the body:
- list which of the twelve you completed and which you did not, with reasons
- for fix 1 and fix 3, state exactly what rounding rule you chose and why
- for fix 4 and fix 5, state which option (a/b, minimum/better) you implemented
- **name every test expectation you changed and justify each one** — a moved assertion is a claim
  that the old expected value was wrong, and it needs to read like one
- flag anything you found that the audit missed

If a fix turns out to be larger than this brief implies, or you find that fixing it properly
requires touching something on the out-of-scope list, **stop and say so in the PR** rather than
half-doing it or quietly expanding scope. Shipping six correct fixes and a clear note about the
seventh beats shipping seven uncertain ones the night before launch.
