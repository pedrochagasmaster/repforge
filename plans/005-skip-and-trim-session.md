# Plan 005: Skip exercise + fatigue-watch "Trim session"

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js index.html styles.css`
> On any change, compare "Current state" excerpts against live code; mismatch
> = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (precursor to backlog "essentials mode")
- **Category**: direction (feature)
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: Parent ("no skip exercise … no short workout mode"), power user
  ("I do a backoff set not in the template … scroll graveyard"), coach. Report
  §5 "Next 2 weeks" + §2.2 "Adaptation without guilt".

## Why this matters

The Log tab renders the entire programmed day and only saves sets with load > 0
(`saveWorkout`, `app.js:216`). Skipping is possible in the data layer but not
the experience layer — users scroll past exercises they aren't doing, "which
feels like failure before I tap Save." Fatigue watch already detects overreach
(`renderFatigue`, `app.js:203`) but hands back the full menu. This plan adds a
per-exercise **Skip** (hide from the active log, purely client-side, no schema
change) and wires the fatigue banner to a **Trim** action that hides everything
except lifts flagged "ready to add".

## Current state

- `renderWorkout` (`app.js:148-179`) renders every exercise from `exercises()`
  (`app.js:102`). Collapse state already exists as an in-memory `Set`:
  `const collapsed=new Set();` (`app.js:89`), toggled via the caret
  (`app.js:191-192`). This is the exact pattern to mirror for "skipped".
- `saveWorkout` (`app.js:212-221`) iterates `exercises()` and skips sets with
  `load<=0` (`app.js:216`). Hiding an exercise's inputs means they stay empty,
  so save already ignores them — **no save-logic change needed** as long as
  hidden inputs are not required.
- Fatigue banner (`renderFatigue`, `app.js:203-206`) sets `#fatigue` innerHTML
  when `flagged>=2` on a 3+ exercise day. It has no action button today.
- The heat gauge click-to-jump handler (`updateGauge`, `app.js:195-201`) shows
  the pattern for "reveal/scroll to matching exercises" — reuse its approach.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:
- `app.js` — a `skipped` in-memory `Set` (mirrors `collapsed`), a Skip control
  per exercise, a "Trim to essentials" button in the fatigue banner, and an
  "N hidden — show all" affordance to unhide.
- `index.html` — no structural change required (fatigue banner content is set
  from JS).
- `styles.css` — `.is-skipped` (visually removed / minimized) and a
  `.fatigue__trim` button style.
- `test/simulation.mjs` — a check that skipping hides an exercise and that its
  empty sets don't get saved.

**Out of scope** (do NOT touch):
- The save schema and `saveWorkout` set-collection logic (hidden = empty = not
  saved; do not add a "skipped" flag to `repforge_v1`).
- Substitution (backlog — different feature).
- Readiness check-in / time-boxed "essentials builder" (backlog; this plan only
  proves the hide mechanic that essentials mode will reuse).
- Persisting skip state across reloads — skips are per-session, in-memory only,
  like `collapsed`.

## Git workflow

- Branch: `advisor/005-skip-and-trim`
- Commit per step. Do NOT push/PR unless asked.

## Steps

### Step 1: `skipped` set + per-exercise Skip control

Next to `collapsed` (`app.js:89`), add `const skipped=new Set();`.

In `renderWorkout`, when building each `<article>` (`app.js:165`), add
`is-skipped` to the class list when `skipped.has(ex.id)`:

```js
return `<article class="exercise is-${r.status}${collapsed.has(ex.id)?" is-collapsed":""}${skipped.has(ex.id)?" is-skipped":""}" data-ex="${esc(ex.id)}">`+
```

Add a Skip button beside the caret in `.ex__topend` (`app.js:168-169`):

```js
`<button type="button" class="ex__skip" data-skip="${esc(ex.id)}" aria-label="Skip ${esc(ex.name)} today">Skip</button>`
```

In `bindWorkout` (`app.js:183`), wire it:

```js
$$("#workout .ex__skip").forEach(b=>b.onclick=()=>{const id=b.dataset.skip;
  skipped.has(id)?skipped.delete(id):skipped.add(id);renderWorkout()});
```

**Verify**: `node --check app.js` → 0. Tapping Skip visually removes the card;
tapping again restores it.

### Step 2: Don't let a skipped exercise's stale draft get saved

`saveWorkout` reads inputs by `data-k` from the DOM (`app.js:215`). If
`.is-skipped` fully hides inputs (CSS `display:none`), `$(…).value` still
returns any draft value. To guarantee skipped exercises never persist, filter
them in the save loop (`app.js:214`):

```js
for(const ex of exercises()){if(skipped.has(ex.id))continue;for(let n=1;n<=ex.sets;n++){
```

**Verify**: fill a set, then Skip that exercise, then Save → that exercise's
sets are NOT in `repforge_v1.log`.

### Step 3: Fatigue banner → "Trim to essentials"

In `renderFatigue` (`app.js:203-206`), when the banner shows, append a trim
button:

```js
el.innerHTML=`<b>Fatigue watch</b> — ${flagged} lifts are backing off or stalled today. `+
  `<button type="button" class="fatigue__trim">Trim to essentials</button>`;
$("#fatigue .fatigue__trim").onclick=()=>{skipped.clear();
  for(const e of exs){const s=recommendation(e).status;if(!(s==="add"||s==="add2"))skipped.add(e.id)}
  renderWorkout();toast("Trimmed to your priority lifts. Skip individually to adjust.")};
```

(Essentials = lifts flagged ready-to-add; everything else is skipped. The user
can un-skip any of them.)

**Verify**: on a day with ≥2 reduce/stall lifts, the banner shows a Trim button;
tapping it hides all non-"add" lifts.

### Step 4: "N hidden — show all" affordance

At the top of `#workout` in `renderWorkout`, when `skipped.size>0`, prepend a
small bar. Build it into the joined HTML (before the `.map` output, `app.js:150`):

```js
const hiddenCount=exercises().filter(e=>skipped.has(e.id)).length;
const banner=hiddenCount?`<div class="skipbar">${hiddenCount} hidden today <button type="button" class="skipbar__show">Show all</button></div>`:"";
$("#workout").innerHTML=banner+exercises().map(ex=>{ /* …existing… */ }).join("");
```

Wire in `bindWorkout`:

```js
const sb=$("#workout .skipbar__show");if(sb)sb.onclick=()=>{skipped.clear();renderWorkout()};
```

**Verify**: `node --check app.js` → 0. After skipping/trim, a "N hidden — show
all" bar appears and restores everything.

### Step 5: Styles

In `styles.css`:
- `.exercise.is-skipped` — collapse to a thin, muted strip (name + "Skipped ·
  undo" only) OR `display:none` with the count bar as the only trace. Prefer the
  muted-strip approach so undo is one tap on the card itself; if using
  `display:none`, the Step 4 count bar is the required undo path.
- `.ex__skip`, `.fatigue__trim`, `.skipbar` — match existing token colors
  (search styles.css for `.ex__caret`, `.fatigue`).

## Test plan

- `node --check app.js` after each edit.
- Manual: skip/unskip; skipped sets not saved; trim hides non-essentials; show-all restores.
- Simulation: add a skip check; existing 61 stay green.

### Simulation check (Step's test)

In `test/simulation.mjs` (~Phase 12):

```js
await nav(page, "log");
await selectDay(page, "Day 1");
const meta = await getExerciseMeta(page, "Day 1");
const skipId = meta[0].id;
await page.fill(`[data-k="${skipId}_1_load"]`, "50");
await page.click(`.ex__skip[data-skip="${skipId}"]`);
await page.waitForTimeout(80);
await saveWorkout(page);
const st = await getState(page);
assert(
  !st.log.some(r => r.exerciseId === skipId),
  "Skipped exercise is not saved",
  "A skipped exercise's set was persisted",
  "Log → fill a set → Skip it → Save → that exercise has no rows"
);
```

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] Skip hides an exercise from the active log; tapping again / "Show all" restores it
- [ ] A skipped exercise's sets are never saved, even with a stale draft value
- [ ] Fatigue banner shows "Trim to essentials"; tapping hides all non-"add" lifts
- [ ] Skip state is in-memory only (nothing new in `repforge_v1`)
- [ ] `cd test && node simulation.mjs` → `FAILED: 0` (62 checks)
- [ ] No files outside scope changed; `plans/README.md` status updated

## STOP conditions

- Drift: `renderWorkout`/`saveWorkout`/`renderFatigue` don't match excerpts.
- If hiding an exercise via `display:none` causes the existing simulation checks
  that index cards by position (`cardInfo(page, idx)`, `test/simulation.mjs:121`;
  used e.g. at the fatigue/stall checks ~line 934) to read the wrong card, STOP:
  keep skipped cards in the DOM as a muted strip (not `display:none`) so index
  order is preserved, and re-run.

## Maintenance notes

- This plan intentionally keeps skips ephemeral. "Essentials mode" (backlog)
  will add a readiness/time input that drives the same `skipped` set — build it
  on top of this, don't fork the mechanic.
- If substitutions land (backlog), a skipped exercise should be substitutable
  rather than only hideable.
