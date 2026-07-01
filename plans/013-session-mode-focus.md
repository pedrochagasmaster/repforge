# Plan 013: Session mode — one exercise at a time with visible progress

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js index.html styles.css`
> On any change, compare "Current state" excerpts against live code; mismatch =
> STOP.

## Status

- **Priority**: P2 (highest-leverage per report §2, but larger than the quick wins)
- **Effort**: L
- **Risk**: MED
- **Depends on**: 006 (stable ids) recommended; composes with 001 (rest timer)
- **Category**: direction (feature)
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: Power user ("Session mode: one exercise at a time … Save becomes
  'finish workout'"), parent, minimalist. Report §2.1 — "the single
  highest-leverage change."

## Why this matters

The Log tab renders the whole day as one long scroll form with a single Save at
the bottom (`renderWorkout` + `saveWorkout`). Under fatigue this is "scroll and
comply" and users lose track of what's done. Session mode shows **one exercise
at a time** with a progress indicator and a per-exercise "Done → next", turning
Save into "Finish workout." It must be **additive and opt-in** so the existing
full-day form (which the simulation and current users rely on) stays intact.

## Current state

- `renderWorkout` (`app.js:148-179`) renders all `exercises()` into `#workout`;
  inputs autosave to a draft (`saveDraft`, `app.js:181`).
- `saveWorkout` (`app.js:212-221`) collects every exercise's sets on submit.
- In-memory view state already exists as `Set`s: `collapsed` (`app.js:89`); this
  plan adds analogous ephemeral state (`focusIndex`, `mode`).
- `updateSaveMeta` (`app.js:208-210`) already computes `filled/planned` — the
  seed of a progress indicator.
- Draft persistence means switching between full/focus views loses nothing.
- No focus/stepper "one exercise" concept exists:
  `grep -n "focus\|sessionMode\|one exercise" app.js` → none.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:
- `app.js` — a `logMode` (`"full"`|`"focus"`) in-memory flag (default `"full"`),
  a `focusIndex`, a mode toggle, focus rendering that shows one exercise +
  prev/next + a progress dots/bar, and a "Finish workout" affordance in focus
  mode that calls the existing `saveWorkout`.
- `index.html` — a small mode toggle on the Log header (e.g. beside the day tabs
  or in the section head).
- `styles.css` — focus-mode layout, progress indicator, big tap targets.
- `test/simulation.mjs` — a check that focus mode shows one exercise and Next
  advances, and that Finish saves the same rows the full form would.

**Out of scope** (do NOT touch):
- Removing or breaking the full-day form — it stays the default and the
  simulation's primary path.
- The save schema — `saveWorkout` is reused unchanged (both modes read the same
  `[data-k]` inputs from the DOM; ensure focus mode keeps ALL exercises'
  inputs in the DOM, just visually shows one — see Step 2).
- Rest timer (Plan 001) — compose if present, don't require.
- Persisting mode across reloads (ephemeral, like `collapsed`).

## Git workflow

- Branch: `advisor/013-session-mode`
- Commit per step, gate green each time. Do NOT push/PR unless asked.

## Steps

### Step 1: Mode state + toggle

Near `collapsed` (`app.js:89`) add: `let logMode="full",focusIndex=0;`

In `index.html` section head (`index.html:35-41`), add a toggle:

```html
<div class="modeswitch" role="group" aria-label="Log layout">
  <button type="button" id="modeFull" class="active">List</button>
  <button type="button" id="modeFocus">Focus</button>
</div>
```

In `init()` wire:

```js
$("#modeFull").onclick=()=>setLogMode("full");
$("#modeFocus").onclick=()=>setLogMode("focus");
function setLogMode(m){logMode=m;focusIndex=0;$("#modeFull").classList.toggle("active",m==="full");$("#modeFocus").classList.toggle("active",m==="focus");renderWorkout()}
```

(`setLogMode` can be a top-level function; place it near `renderWorkout`.)

### Step 2: Keep all inputs in the DOM; show one in focus mode

Critical constraint: `saveWorkout` reads inputs by `data-k` from the DOM. So
focus mode must still render **every** exercise's inputs; it only visually
reveals the current one. Easiest robust approach: render the full `#workout`
list exactly as today, then in focus mode add a class to `#workout`
(`is-focus`) and toggle a `is-current` class on the exercise at `focusIndex`;
CSS hides all non-current exercises in focus mode.

In `renderWorkout` (`app.js:150`), wrap the container class:

```js
const wk=$("#workout");wk.classList.toggle("is-focus",logMode==="focus");
```

When building each `<article>` (`app.js:165`), add current marker in focus mode:

```js
`${logMode==="focus"&&i===focusIndex?" is-current":""}`
```

(You'll need the index — switch the `.map(ex=>…)` to `.map((ex,i)=>…)`.)

### Step 3: Focus controls + progress

After the workout renders in focus mode, inject a control bar (prev / "1 of 6"
progress / next or Finish). Append to `#workout` or a sibling `#focusBar`
element. In `bindWorkout` (`app.js:183`), when `logMode==="focus"`:

```js
if(logMode==="focus"){const exs=exercises();const at=Math.min(focusIndex,exs.length-1);
  const bar=document.createElement("div");bar.className="focusbar";
  bar.innerHTML=`<button type="button" class="btn btn--steel" data-fprev ${at===0?"disabled":""}>Prev</button>`+
    `<span class="focusbar__prog">${at+1} of ${exs.length}</span>`+
    (at>=exs.length-1?`<button type="button" class="btn btn--forge" data-ffinish>Finish workout</button>`:`<button type="button" class="btn btn--forge" data-fnext>Next</button>`);
  $("#workout").append(bar);
  const p=$("[data-fprev]");if(p)p.onclick=()=>{focusIndex=Math.max(0,focusIndex-1);renderWorkout()};
  const n=$("[data-fnext]");if(n)n.onclick=()=>{focusIndex=Math.min(exs.length-1,focusIndex+1);renderWorkout();window.scrollTo({top:0})};
  const f=$("[data-ffinish]");if(f)f.onclick=()=>$("#logForm").requestSubmit();
}
```

("Finish workout" submits the same form → `saveWorkout` runs unchanged over all
in-DOM inputs.)

### Step 4: Styles

In `styles.css`:
- `#workout.is-focus .exercise:not(.is-current){display:none}` — reveal only the
  current exercise. (Because inputs remain in the DOM, hidden ones still save.)
- `.modeswitch`, `.focusbar` (sticky bottom bar, big buttons), `.focusbar__prog`
  — match existing tokens.
- Ensure the collapse caret / skip (if Plan 005 landed) still make sense in focus
  mode (a single card is already "expanded").

**Verify**: `node --check app.js` → 0. Toggle Focus → one exercise shows with a
"1 of 6" bar; Next advances; on the last, "Finish workout" saves and the Stats/
History populate exactly as the list mode would.

### Step 5: Simulation check

In `test/simulation.mjs`, add a focus-mode check that mirrors a list-mode save:

```js
await nav(page, "log");
await selectDay(page, "Day 1");
await page.click("#modeFocus");
await page.waitForTimeout(80);
const visible = await page.locator("#workout .exercise:not(.is-current)").evaluateAll(els => els.every(e => getComputedStyle(e).display === "none"));
assert(visible, "Focus mode shows one exercise at a time", "Non-current exercises visible in focus mode", "Log → Focus → only current card shown");
// fill current, Next, fill, Finish → rows saved
const meta = await getExerciseMeta(page, "Day 1");
await fillExerciseSets(page, meta[0].id, meta[0].sets, 90, 6, 1);
await page.click("[data-fnext]");
await page.waitForTimeout(80);
// advance to last and finish
// (loop Next until Finish appears, then click it)
for (let i = 0; i < meta.length + 1; i++) {
  if (await page.locator("[data-ffinish]").count()) { await page.click("[data-ffinish]"); break; }
  if (await page.locator("[data-fnext]").count()) { await page.click("[data-fnext]"); await page.waitForTimeout(60); }
}
await page.waitForTimeout(120);
assert((await getState(page)).log.some(r => r.exerciseId === meta[0].id && +r.load === 90),
  "Finish workout saves focus-mode sets", "No saved row from focus mode", "Log → Focus → fill → Finish → rows saved");
await page.click("#modeFull"); // restore default for later checks
```

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js` after each step.
- Manual: toggle both modes; draft carries between them; Finish saves; progress
  indicator accurate; big tap targets on mobile width.
- Simulation: focus one-at-a-time + finish-saves checks; existing 61 stay green
  (list mode is default, so they're unaffected).

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] `logMode` defaults to `"full"`; the existing list layout is unchanged there
- [ ] Focus mode reveals exactly one exercise with a "N of M" progress indicator
      and Prev/Next/Finish
- [ ] Hidden focus-mode inputs remain in the DOM and are saved by "Finish workout"
- [ ] Mode is ephemeral (not persisted), like `collapsed`
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] No files outside scope changed; `plans/README.md` status updated

## STOP conditions

- Drift: `renderWorkout`/`saveWorkout` don't match excerpts.
- If hiding non-current cards with `display:none` breaks the simulation's
  index-based `cardInfo(page, idx)` reads while in **list** mode, something is
  toggling `is-focus` by default — STOP: focus must never be the default.
- If "Finish workout" only saves the current exercise (because a refactor pulled
  other inputs out of the DOM), STOP and restore the all-inputs-in-DOM invariant
  — that invariant is the whole reason `saveWorkout` stays untouched.

## Maintenance notes

- Composes with Plan 001 (auto-start rest on set fill), Plan 005 (skip), and
  Plan 016 (per-set commit) — a skipped exercise should be stepped over in focus
  navigation, and "Save set" + "Next" is the natural focus-mode loop (reuse
  016's `committed`/`touched` state; don't fork it).
- "Essentials mode" (backlog) can default focus mode to only the essential lifts.
