# Plan 019: Warmup vs working-set flag

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
- **Effort**: M
- **Risk**: MED (touches the save schema and every volume/recommendation calc)
- **Depends on**: none. Interacts with Plan 018 (PR ledger): whichever lands
  second must exclude warmups from PR detection.
- **Category**: direction (feature) / correctness
- **Planned at**: commit `ff67850`, 2026-07-01
- **Source**: Report §5 "Next 6 months" — "**Warmup vs working set flag** |
  Volume audit accuracy"; `plans/README.md` backlog ("Small, but touches the
  save schema and every volume calc; scope carefully"). Power-user persona.

## Why this matters

Today every set with `load > 0` counts as a working set. A lifter who logs
warmup ramps (bar × 10, 60 kg × 5 …) poisons three things at once: the
recommendation engine treats warmup loads/reps as performance data (median
load drops, "Back off" fires wrongly), the hard-set volume audit counts
warmups done at high RIR ≤ ceiling as junk hard sets, and Stats
tonnage/e1RM/top-load mix warmups into trends. The fix is one boolean per
logged row plus systematic exclusion at each consumer — small surface, but it
must be exhaustive or the flag silently lies.

## Current state

- `app.js` (~693 lines) is the whole app; sets are flat rows in `state.log`:
  `{session,date,day,name,exerciseId,set,load,reps,rir,notes,created,primary,secondary[,bodyweight]}`
  written in `saveWorkout` (`app.js:353`).
- Set rows render in `renderWorkout` (`app.js:239-253`): per set `n`, inputs
  `data-k="${ex.id}_${n}_load|reps|rir"`, a set-number chip
  `<span class="setrow__n">${n}</span>`, and a per-set Save button. Per-set UI
  state lives in the draft (`repforge_draft_v1`) as arrays `__done` and
  `__touched` (`app.js:274-275`), re-hydrated into the `committed` / `touched`
  Sets at the top of `renderWorkout` (`app.js:227-228`).
- Consumers that treat every `load>0` row as a working set — the exclusion
  list this plan must cover:
  - `sessionsFor(ex)` (`app.js:164-170`) — feeds `recommendation()`; filters
    `+x.load>0` only.
  - `last(ex)` (`app.js:159-162`) — "Last:" strip and Copy-last prefills.
  - `summaries()` (`app.js:361-367`) — Stats chart, trend, recent table,
    per-session e1RM/volume.
  - `renderStats` totals (`app.js:372-373`) and `topByLift` top-loads table
    (`app.js:396-399`).
  - `renderCompleted` hard-set audit (`app.js:419-423`).
  - `renderHistory` per-session top/volume summary (`app.js:473-474`).
  - `exportCsv` `is_hard_set` (`app.js:627`).
- `updateSaveMeta` (`app.js:340-343`) counts planned/committed sets — planned
  count comes from the program (`e.sets`), so warmups (extra rows) are out of
  scope for it.
- Conventions: DOM via `$`/`$$`, template-string HTML with `esc()` on user
  data, glossary terms via `GLOSSARY` map + `term()` helper (`app.js:34-46`,
  `app.js:58`).
- Product guardrail (from `plans/README.md`): protect the Log tab's speed
  above all else — the flag must not add a required input or extra tap to the
  default flow.

## Design decision (already made — do not re-litigate)

- A warmup set is an **extra toggle on an existing set row**, not a separate
  row type: tapping the set-number chip (`.setrow__n`) toggles warmup, which
  restyles the row and swaps the number for "W". Zero new inputs; the default
  path is untouched.
- Storage: `warmup: true` on the log row (absent = working set, so all
  existing data is valid unchanged — no migration).
- Warmups are **kept** in History ("every set" table, marked) and CSV (new
  `is_warmup` column) but **excluded** from recommendations, Last-strip,
  Stats summaries/tops/totals, hard-set audit, and session top/volume lines.

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
- `app.js` — warmup toggle state, save schema, exclusions at each consumer.
- `styles.css` — `.setrow.is-warmup` styling.
- `index.html` — only if a glossary term button is added to the sets header.
- `test/simulation.mjs` — warmup exclusion checks.
- `plans/README.md` — status row update.

**Out of scope** (do NOT touch, even though they look related):
- Program schema (`Exercise` class) — warmups are per-logged-set, not planned.
- Session editor (`sessionEditor`, `app.js:488-511`) — editing the warmup flag
  retroactively is deferred (see Maintenance notes); the editor must simply
  not lose the flag (it mutates rows in place, so it won't).
- `updateSaveMeta` planned-set counts.
- Auto-detecting warmups from load patterns — explicit toggle only.

## Git workflow

- Branch: `advisor/019-warmup-flag` (or the operator's requested branch).
- Commit per step; message style matches `git log` (short imperative).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: A shared working-set predicate

At the top of `app.js` near `liftKey` (`app.js:71`), add:

```js
const isWork=r=>!r.warmup;
```

Every exclusion below uses this predicate — grep-ability is the point.

**Verify**: `node --check app.js` → exit 0.

### Step 2: Toggle UI + draft persistence

- Add a module-level `const warmups=new Set();` beside `committed`/`touched`
  (`app.js:140-141`).
- In `renderWorkout` hydration (`app.js:227-228`), add
  `warmups.clear();(draft.__warm||[]).forEach(k=>warmups.add(k));`
- In `saveDraft` (`app.js:274-275`), persist `d.__warm=[...warmups];`
- In the set-row template (`app.js:246`), make the number chip a button and
  mark the row:

  ```js
  const isW=warmups.has(key);
  const cls=`${committed.has(key)?"is-done":(touched.has(key)?"":"is-suggested")}${isW?" is-warmup":""}`;
  // number chip becomes:
  `<button type="button" class="setrow__n" data-warm="${esc(key)}" aria-pressed="${isW?"true":"false"}" title="Tap to mark as warmup">${isW?"W":n}</button>`
  ```

- In `bindWorkout`, bind the toggle (pattern-match the `.saveset` binding at
  `app.js:283`):

  ```js
  $$("#workout [data-warm]").forEach(b=>b.onclick=()=>{const key=b.dataset.warm;
    warmups.has(key)?warmups.delete(key):warmups.add(key);saveDraft();renderWorkout()});
  ```

- In `styles.css`, style `.setrow.is-warmup` muted (e.g. reduced opacity on
  the row, steel-colored `W` chip) using existing custom properties; keep
  `.setrow__n` visually identical to today when not a warmup (it was a
  `span`; as a `button` it needs `background:none;border:0;font:inherit;
  color:inherit;padding:0` plus the existing alignment).
- `saveWorkout` clears per-set state after save (`app.js:357`) — add
  `warmups.clear();` beside `committed.clear();touched.clear();`.

**Verify**: hard-reload; tap a set number → it becomes "W" and the row mutes;
reload the page → the draft restores the W; tap again → back to the number.

### Step 3: Persist the flag on save

In `saveWorkout`'s row construction (`app.js:349-355`), after `const key=...`:

```js
const row={session,date,day,name:ex.name,exerciseId:ex.id,set:n,load,reps,rir,notes,created,primary:ex.primary,secondary:ex.secondary};
if(warmups.has(key))row.warmup=true;
```

Also count a warmup toggle as intent: in the same loop the row is skipped
unless committed/touched (`app.js:352`) — extend to
`if(!(committed.has(key)||touched.has(key)||warmups.has(key)))continue;`

**Verify**: log a session with set 1 marked W → in DevTools,
`JSON.parse(localStorage.repforge_v1).log` shows `warmup:true` on exactly
that row and no `warmup` key on others.

### Step 4: Exclude warmups at every consumer

Apply `isWork` at each site from "Current state" — all seven, no fewer:

1. `sessionsFor` (`app.js:165`): `if(!match(x)||!(+x.load>0)||!isWork(x))continue;`
2. `last` (`app.js:160`): `const hits=state.log.filter(x=>match(x)&&isWork(x));`
   (keeps Copy-last filling working weights, not the bar).
3. `summaries` (`app.js:362`): first line of the loop —
   `if(!isWork(x))continue;`
4. `renderStats` totals (`app.js:372-373`): filter both `totalVol` and `bestE`
   sources with `.filter(isWork)`.
5. `topByLift` (`app.js:397`): `for(const x of state.log){if(!isWork(x))continue;...`
6. `renderCompleted` (`app.js:420`): add `||!isWork(x)` to the skip condition.
7. `renderHistory` session summary (`app.js:473-474`): compute `top` and `vol`
   from `sets.filter(isWork)`; in the "every set" table rows (`app.js:484`),
   render the Set cell as `x.warmup ? "W" + x.set : x.set` so warmups stay
   visible but marked.

In `exportCsv` (`app.js:620-630`): add `["is_warmup",r=>r.warmup?1:0]` after
`is_hard_set`, and extend the `is_hard_set` lambda with `&&!r.warmup`.

If Plan 018 (PR ledger) has already landed: exclude warmups in its save-time
PR detection and in the rows fed to `prsFor` (both derive from summaries/log —
sites 3 and 5 may already cover it; confirm by reading 018's diff).

**Verify**: `node --check app.js` → exit 0. Manually: log a session with a
20 kg warmup + 100 kg working sets → Log tab recommendation next visit uses
100 kg history (not 20); Stats top loads show 100; hard-set audit doesn't
count the warmup; History table shows the warmup row marked `W1`.

### Step 5: Simulation checks

In `test/simulation.mjs`, add a phase (helpers: `nav`, `getExerciseMeta`,
`fillExerciseSets`, `saveWorkout`, `getState` — lines 37-125). Sketch:

```js
console.log("\nPhase: warmup flag");
await nav(page, "log");
const wMeta = await getExerciseMeta(page, "Day 1");
const wEx = wMeta[0];
await fillExerciseSets(page, wEx.id, wEx.sets, 100, 6, 2);
// mark set 1 as warmup and change its load to 20
await page.click(`[data-warm="${wEx.id}_1"]`);
await page.fill(`[data-k="${wEx.id}_1_load"]`, "20");
await saveWorkout(page);
const wState = await getState(page);
const wRows = wState.log.filter(r => r.exerciseId === wEx.id && r.date === new Date().toISOString().slice(0,10));
assert(wRows.some(r => r.warmup === true && +r.load === 20),
  "Warmup flag persists on the saved row",
  JSON.stringify(wRows), "Mark set 1 W → save");
// exclusion: session summary top load must be 100, not affected by the 20
await nav(page, "history");
const sessText = await page.textContent("#sessions");
assert(!/\b20×/.test(sessText.split("·")[2] || sessText),
  "History session top ignores the warmup set",
  sessText.slice(0, 120), "History → newest session summary");
```

Also assert the CSV header gains `is_warmup` in the existing Phase 9 header
check (line ~678) — extend that assertion rather than duplicating the export.

Adjust selectors/loads if earlier phases left conflicting data; the intent of
each check is stated so you can adapt mechanics.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`, new checks pass.

## Test plan

- `node --check app.js` after each step.
- Simulation (Step 5): flag persists; History summary excludes warmups; CSV
  header check extended.
- Manual sweep of the full exclusion list in Step 4's verify, plus: draft
  round-trip of the W state across reload; unit toggle with a warmup marked
  (draft-load conversion at `app.js:61-69` only rewrites `_load` keys — the
  `__warm` array must survive; it will, since only `_load`-suffixed keys are
  touched, but confirm).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`, including new warmup checks
- [ ] `grep -c "isWork" app.js` ≥ 8 (definition + 7 consumer sites)
- [ ] `grep -n "is_warmup" app.js` shows the CSV column
- [ ] Rows without the flag have no `warmup` key (no migration writes)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row for 019 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any consumer site in Step 4 doesn't match its "Current state" line number ±5
  after the drift check passed — re-locate by symbol name, and if a site has
  been restructured beyond recognition, stop.
- You find an eighth `load>0`-style consumer not on the list — stop and report
  it rather than guessing whether warmups belong in it.
- The set-number chip → button change breaks the grid layout in a way CSS
  resets don't fix — report with a screenshot rather than restructuring the row.

## Maintenance notes

- The session editor intentionally cannot toggle `warmup` retroactively —
  deferred to keep this plan's surface small. If added later, it belongs in
  `sessionEditor`/`saveSessionEdit`.
- Any future consumer of `state.log` that aggregates performance MUST filter
  with `isWork` — reviewers should grep for it in new code.
- Plan 018 interaction: PR detection must never fire on a warmup row.
