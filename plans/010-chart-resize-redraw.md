# Plan 010: Redraw the Stats chart on resize / orientation change

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js`
> On any change, compare the `draw`/`renderStats` excerpts against live code;
> mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness (bug)
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: **Audit finding.** No persona named it, but it degrades the Stats
  chart the spreadsheet/power-user personas rely on.

## Why this matters — reproducible rendering bug

The canvas sizes itself from `clientWidth` **only at draw time**, and `draw()`
is called only from `renderStats()`. There is **no `resize`/`orientationchange`
listener**. So if the viewport width changes after the chart is drawn (phone
rotation, desktop resize, browser chrome show/hide), the canvas keeps its old
backing-store width while CSS stretches it — the line blurs and misaligns with
the axis labels until an unrelated re-render happens.

## Current state

- `draw(rows)` (`app.js:292-324`) computes `const w=c.clientWidth||320` and sets
  `c.width=w*ratio` at call time (`app.js:293-294`).
- `draw` is invoked only inside `renderStats` (`app.js:248`).
- `render()` (`app.js:142`) runs on nav clicks (`app.js:487`) and after data
  changes, but **not** on window resize.
- Confirm no resize handling: `grep -n "resize\|orientationchange" app.js` →
  no matches.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope** (only `app.js` + the test):
- `app.js` — add a debounced `resize` listener in `init()` that redraws the
  currently-selected exercise's chart when the Stats view is active.
- `test/simulation.mjs` — a check that resizing then reading the canvas backing
  width reflects the new client width.

**Out of scope**:
- Chart features (e1RM/volume overlays are a separate Stats plan).
- A `ResizeObserver` abstraction — a simple window listener is enough.

## Git workflow

- Branch: `advisor/010-chart-resize`
- Single commit is fine. Do NOT push/PR unless asked.

## Steps

### Step 1: Extract a "redraw current chart" helper

`renderStats` recomputes `rows` for the selected exercise (`app.js:247`). Add a
tiny helper that redraws without recomputing everything else:

```js
function redrawChart(){if(!$("#stats").classList.contains("active"))return;
  const sel=$("#statExercise").value,rows=summaries().filter(x=>x.name===sel);draw(rows)}
```

Place it right after `draw` (`app.js:324`).

### Step 2: Debounced resize listener

In `init()` (`app.js:473`), add:

```js
let rzT;window.addEventListener("resize",()=>{clearTimeout(rzT);rzT=setTimeout(redrawChart,150)});
window.addEventListener("orientationchange",()=>setTimeout(redrawChart,200));
```

**Verify**: `node --check app.js` → 0. In the browser, open Stats for a lift
with data, resize the window narrower → the chart redraws crisply and axis
labels realign (no stretched/blurry line).

### Step 3: Simulation check

In `test/simulation.mjs`, near the Stats checks:

```js
await nav(page, "stats");
await page.waitForTimeout(150);
await page.setViewportSize({ width: 800, height: 900 });
await page.waitForTimeout(300);
const okWide = await page.evaluate(() => {
  const c = document.querySelector("#chart");
  return c.width >= (c.clientWidth || 320) * (devicePixelRatio || 1) - 2;
});
await page.setViewportSize({ width: 380, height: 900 });
await page.waitForTimeout(300);
const okNarrow = await page.evaluate(() => {
  const c = document.querySelector("#chart");
  return c.width <= (c.clientWidth || 320) * (devicePixelRatio || 1) + 2;
});
assert(okWide && okNarrow, "Chart canvas tracks viewport width on resize",
  `wide=${okWide} narrow=${okNarrow}`, "Stats → resize viewport → canvas backing width follows clientWidth");
```

(If the sim sets a fixed viewport at launch, restore it afterward so later
checks are unaffected; `grep -n "setViewportSize\|viewport" test/simulation.mjs`
to match the harness's default.)

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js`.
- Manual: rotate/resize while on Stats → chart stays crisp and aligned.
- Simulation: canvas-tracks-width check; existing 61 stay green.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] Resizing the window while Stats is active redraws the chart at the new width
- [ ] No redraw churn when Stats is not the active view
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] Only `app.js` + test changed; `plans/README.md` status updated

## STOP conditions

- Drift: `draw`/`renderStats` don't match excerpts.
- If the resize listener causes redraw thrash that breaks other timing-sensitive
  checks, increase the debounce or gate on active view; do not remove the guard.

## Maintenance notes

- Any future chart (e1RM/volume overlays) should also be redrawn from
  `redrawChart` so resize handling stays in one place.
