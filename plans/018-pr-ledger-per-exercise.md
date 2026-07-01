# Plan 018: PR ledger per exercise + PR callout on save

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ff67850..HEAD -- app.js index.html styles.css test/simulation.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (007's rich summaries already landed)
- **Category**: direction (feature)
- **Planned at**: commit `ff67850`, 2026-07-01
- **Source**: Report §5 "Next 6 months" — "**PR ledger** per exercise |
  Motivation without social". `plans/README.md` backlog deferred it until
  Plan 007's computed columns existed; 007 is DONE, so this is unblocked.

## Why this matters

The spreadsheet maximalist and minimalist personas both asked for personal
records with dates — the one motivational surface that fits the guardrails
(no streaks, badges, or social). The data is already computed:
`summaries()` produces per-session `top`, `e1rm`, and `volume` per lift, and
`renderStats` already reduces a best-load map for the "Top loads by exercise"
table. This plan surfaces PRs in two places: a small ledger for the selected
exercise in the Stats deep-dive, and a one-line PR callout in the save toast
so the user learns about a PR the moment they earn it.

## Current state

- `app.js` (~693 lines) is the whole app; no build step, no framework.
- `summaries()` (`app.js:361-367`) returns one row per (session, lift):
  `{session,date,day,name,top,topReps,reps,rir,sets,volume,e1rm}` — `top` is
  the heaviest set's load, `e1rm` the best Epley estimate, `volume` the
  session tonnage for that lift.
- `renderStats` (`app.js:369-402`) filters summaries to the selected exercise
  and renders a trend line into `#trend`:

  ```js
  // app.js:385-393
  const sel=$("#statExercise").value,rows=sums.filter(x=>x.name===sel);
  draw(rows);
  if(rows.length){const first=rows[0].top,latest=rows.at(-1).top,delta=latest-first,be=Math.max(...rows.map(r=>r.e1rm));
    const dir=delta>0?"up":delta<0?"down":"";const arrow=delta>0?"▲":delta<0?"▼":"·";
    $("#trend").innerHTML=`<span>Top load <b>${fmtLoad(first)}→${fmtLoad(latest)} ${unitLabel()}</b></span>`+
    ...
  ```

- The Stats markup hosts the chart card inside a `<details id="statsDeep">`
  (`index.html:70-86`); `#trend` is at `index.html:74`, directly above the
  `#chart` canvas.
- `saveWorkout` (`app.js:345-359`) builds `rows`, pushes them into
  `state.log`, and toasts:

  ```js
  // app.js:356-359
  if(!rows.length){toast("Enter weight on at least one set before saving.");return}
  state.log.push(...rows);save();clearDraft();committed.clear();touched.clear();$("#notes").value="";
  const btn=$(".btn--save");btn.classList.remove("is-stamped");void btn.offsetWidth;btn.classList.add("is-stamped");
  toast(`Workout forged — ${rows.length} sets logged.`);render()}finally{saving=false}}
  ```

- Lift identity: `liftKey(x)=x.exerciseId||x.name` (`app.js:71`);
  `exerciseLabel(row)` (`app.js:72`) resolves display names. `matchLift(ex)`
  (`app.js:158`) matches log rows to an exercise. Use these — never raw names.
- Unit display: loads are stored in kg; render with `fmtLoad(kg)` and
  `unitLabel()` (`app.js:56-57`). `e1rm(load,reps)` helper at `app.js:25`.
- Conventions: DOM via `$`/`$$` helpers, HTML built as template strings with
  `esc()` on all interpolated user data, styles in `styles.css` with BEM-ish
  block__element classes (see `.trend`, `.metric` for exemplars).
- Product guardrails (from `plans/README.md`): no gamification (streaks,
  badges, XP). A factual "PR" line with a date is in-bounds; anything
  celebratory-persistent (confetti, badge cabinets) is not.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` (repo root, keep running) | serving on :8000 |
| Simulation deps (once) | `cd test && npm install && npx playwright install chromium` | exit 0 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` (85+ passed) |

There is no linter, type-checker, or bundler in this repo — do not look for one.

## Scope

**In scope** (the only files you should modify):
- `app.js` — PR computation, ledger rendering, save-time PR detection.
- `index.html` — one `<div id="prLedger">` container.
- `styles.css` — minimal styles for the ledger rows.
- `test/simulation.mjs` — checks for ledger contents and PR toast.
- `plans/README.md` — status row update.

**Out of scope** (do NOT touch, even though they look related):
- The "Top loads by exercise" table (`app.js:396-400`) — it stays as the
  all-lifts overview; the ledger is per-selected-exercise.
- Any persistent PR store — PRs are derived from `state.log` on render, never
  written to state (no schema change).
- Streaks, badges, XP, share images (guardrail).

## Git workflow

- Branch: `advisor/018-pr-ledger` (or the operator's requested branch).
- Commit per step; message style matches `git log` (short imperative).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: PR computation helper

In `app.js`, near `summaries()` (`app.js:361`), add a pure helper that
derives PRs for one lift from its summaries rows (oldest→newest order is
already guaranteed by the `.sort` in `summaries`):

```js
// PRs for one lift from its summary rows: best top load, best e1RM, best
// session volume — each with the date it was FIRST achieved.
function prsFor(rows){if(!rows.length)return null;
  const best=(key)=>rows.reduce((m,r)=>r[key]>m[key]?r:m,rows[0]);
  const load=best("top"),e=best("e1rm"),vol=best("volume");
  return{load:{val:load.top,date:load.date},e1rm:{val:e.e1rm,date:e.date},volume:{val:vol.volume,date:vol.date}}}
```

(`reduce` with `>` keeps the *first* occurrence on ties — that is the date the
PR was set, which is what a ledger should show.)

**Verify**: `node --check app.js` → exit 0.

### Step 2: Render the ledger in the Stats deep-dive

In `index.html`, add below `#trend` (`index.html:74`):

```html
<div id="prLedger" class="prledger"></div>
```

In `renderStats` (`app.js:388-393`), after the `#trend` block, render the
ledger from the same `rows`:

```js
const pr=prsFor(rows);
$("#prLedger").innerHTML=pr?`<div class="prledger__row"><span>Top load PR</span><b>${fmtLoad(pr.load.val)} ${unitLabel()}</b><small>${esc(shortDate(pr.load.date))}</small></div>`+
  `<div class="prledger__row"><span>e1RM PR</span><b>${fmt(Math.round(toDisplay(pr.e1rm.val)))} ${unitLabel()}</b><small>${esc(shortDate(pr.e1rm.date))}</small></div>`+
  `<div class="prledger__row"><span>Session volume PR</span><b>${kfmt(toDisplay(pr.volume.val))} ${unitLabel()}</b><small>${esc(shortDate(pr.volume.date))}</small></div>`:"";
```

In `styles.css`, add a `.prledger` block styled like `.trend` (same font
scale, muted labels, monospace values — copy `.trend` / `.trend span` rules
as the pattern; three compact rows or inline chips, executor's choice, but no
new colors outside the existing custom properties).

**Verify**: hard-reload `http://localhost:8000/` (service worker caches the
shell), log a session, open Stats → "Dig deeper" → the ledger shows three PR
rows with dates for the selected exercise; switching `#statExercise` updates it.

### Step 3: PR callout in the save toast

In `saveWorkout`, before `state.log.push(...rows)` (`app.js:357`), compute
which lifts just set a top-load PR, then fold it into the existing toast:

```js
const prLifts=[];
for(const ex of exercises()){if(skipped.has(ex.id))continue;
  const mine=rows.filter(r=>r.exerciseId===ex.id);if(!mine.length)continue;
  const newTop=Math.max(...mine.map(r=>+r.load));
  const prevTop=Math.max(0,...state.log.filter(matchLift(ex)).map(r=>+r.load));
  if(newTop>prevTop&&prevTop>0)prLifts.push(`${ex.name} ${fmtLoad(newTop)} ${unitLabel()}`)}
```

Then replace the toast line (`app.js:359`):

```js
toast(prLifts.length?`Workout forged — ${rows.length} sets logged. PR: ${prLifts.join(", ")}!`:`Workout forged — ${rows.length} sets logged.`);
```

Note `prevTop>0` guards the first-ever session for a lift — logging a lift for
the first time is not a PR.

**Verify**: `node --check app.js` → exit 0. Manually: log a session, then log
the same lift heavier → toast includes `PR: <name> <load> kg!`; logging the
same or lower load toasts the plain message.

### Step 4: Simulation checks

In `test/simulation.mjs`, add checks after an existing save-flow phase. The
harness helpers you need already exist: `nav`, `selectDay`,
`getExerciseMeta`, `fillExerciseSets`, `saveWorkout` (lines 77-125), and the
toast is readable via `page.textContent("#toast")` right after save (toast
hides after 2.4 s — read it within that window; `saveWorkout` only waits
250 ms, so read immediately after it returns).

```js
console.log("\nPhase: PR ledger");
await nav(page, "log");
const prMeta = await getExerciseMeta(page, "Day 1");
await fillExerciseSets(page, prMeta[0].id, prMeta[0].sets, 200, 6, 2);
await saveWorkout(page);
const prToast = await page.textContent("#toast");
assert(/PR:/.test(prToast),
  "Save toast announces a top-load PR",
  `Toast: ${prToast}`,
  "Log a heavier top set than any prior session → Save");
await nav(page, "stats");
await page.evaluate(() => { document.querySelector("#statsDeep").open = true; });
await page.waitForTimeout(100);
const ledger = await page.textContent("#prLedger");
assert(/Top load PR/.test(ledger) && /e1RM PR/.test(ledger),
  "PR ledger renders top-load and e1RM PRs",
  `Ledger: ${ledger}`,
  "Stats → Dig deeper → PR ledger under the trend");
```

Pick a load (200) higher than anything the earlier phases logged for that
exercise; if earlier phases changed, adjust the load so it is a genuine PR.
Note `renderStats` runs on nav; opening `#statsDeep` only affects visibility,
not rendering — the `#prLedger` HTML is present either way.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`, new checks pass.

## Test plan

- `node --check app.js` after each step.
- Simulation (Step 4): PR toast fires on a genuine PR; ledger renders both PR
  rows for the selected lift.
- Manual: tie a PR (same top load) → no PR toast; first-ever session for a new
  exercise → no PR toast; switch units to lb → ledger values convert.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`, including the 2 new PR checks
- [ ] `grep -c "prsFor\|prLedger" app.js index.html` ≥ 3
- [ ] `grep -n "localStorage.setItem" app.js` shows no new persistence key
      (PRs are derived, not stored)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row for 018 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `summaries()` or `saveWorkout` no longer match the "Current state" excerpts.
- You find yourself persisting PR data into `state` — that is a schema change
  this plan explicitly avoids.
- The toast window proves too short for the simulation to read reliably twice
  in a row — report rather than lengthening the toast timeout for tests.

## Maintenance notes

- If Plan 019 (warmup flag) lands after this, warmup sets must be excluded
  from PR detection and `prsFor` inputs — 019's step list includes that hook;
  a reviewer should check whichever lands second wires the exclusion.
- Rep-PRs (most reps at a given load) were considered and deferred: they need
  per-set granularity `summaries()` doesn't expose; revisit only if users ask.
- The save-time detection is O(log × exercises) on save — fine at this scale;
  if the log grows into tens of thousands of rows, memoize per-lift maxima.
