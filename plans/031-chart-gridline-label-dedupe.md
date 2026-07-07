# Plan 031: Stop the progression chart printing the same Y-axis label on every gridline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c46c1b..HEAD -- app.js test/simulation.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `5c46c1b`, 2026-07-07

## Why this matters

When a lift's top load is flat (very common: every "hold" phase), the Dig
deeper progression chart draws four gridlines that all read the same number —
runtime-verified with two sessions at 20 kg: the Y axis reads `20, 20, 20, 20`
top to bottom. The gridline values differ (the range is padded ±25%), but
`Math.round` collapses them to the same integer whenever the padded range is
narrower than ~3 display units. It looks broken and makes the axis useless
exactly when the user is deciding whether they're stalled.

## Current state

Relevant file: `app.js` — canvas chart in `draw(rows)`.

`app.js:1191-1196` — range calculation and the gridline/label loop:

```javascript
  const vals=rows.map(r=>r.top),max=Math.max(...vals),min=Math.min(...vals),span=max-min||1,pad=span*0.25;
  const lo=Math.max(0,min-pad),hi=max+pad,rng=hi-lo||1;
  const X=i=>padL+(rows.length===1?iw/2:i*iw/(rows.length-1)),Y=v=>padT+ih-((v-lo)/rng)*ih;
  // gridlines + y labels
  ctx.strokeStyle=C.rule;ctx.lineWidth=1;ctx.fillStyle=C.dim;ctx.textAlign="right";
  for(let i=0;i<=3;i++){const gy=padT+ih*i/3,val=hi-(rng*i/3);ctx.beginPath();ctx.moveTo(padL,gy);ctx.lineTo(w-padR,gy);ctx.stroke();ctx.fillText(fmt(Math.round(toDisplay(val))),padL-8,gy)}
```

Supporting facts:

- `toDisplay` converts kg to the display unit (kg or lb) — keep it.
- `fmt` (`app.js:19`) prints integers without decimals and trims trailing
  zeros from decimals (`20.5` → `"20.5"`, `20.50` → `"20.5"`).
- Flat data example: two sessions at top load 20 → `span=0` → `span||1` → 1,
  `pad=0.25`, `lo=19.75`, `hi=20.25`; the four label values are 20.25,
  20.083…, 19.916…, 19.75 — all rounding to 20.
- Left padding `padL=42` (`app.js:1188`) fits ~5 mono characters at 11px; a
  one-decimal label like `20.3` fits, `20.25` may not — use **one** decimal.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Static server (terminal 1, repo root) | `python3 -m http.server 8000` | serves on :8000 |
| Simulation (terminal 2) | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |

At commit `5c46c1b` the simulation reports `PASSED: 267, FAILED: 0`.

## Scope

**In scope** (the only files you should modify):
- `app.js` — the gridline label expression inside `draw` only.
- `test/simulation.mjs` — one regression check (canvas text is not queryable;
  test the formatting decision via an exposed pure helper, see Step 2).

**Out of scope** (do NOT touch, even though they look related):
- The range padding math (`lo`/`hi`/`rng`) — changing it moves the plotted
  line; this plan only changes label formatting.
- The last-value callout (`app.js:1210-1211`) and x-axis date labels — correct
  already.
- `redrawChart`, chart sizing, or `devicePixelRatio` handling.

## Git workflow

- Branch: `cursor/plan-031-chart-labels-<suffix>`.
- Commit style: single-line imperative summary.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Precision-aware label formatting

Inside `draw`, before the gridline loop, compute whether integer rounding
would collapse adjacent labels, and pick decimals accordingly:

```javascript
  const stepVal=rng/3,decimals=toDisplay(stepVal)<1?1:0,yLabel=v=>{const d=toDisplay(v);return decimals?d.toFixed(1):fmt(Math.round(d))};
```

Then in the loop replace `fmt(Math.round(toDisplay(val)))` with `yLabel(val)`.

Rationale: adjacent gridlines differ by `rng/3` in kg; if that difference is
under 1 display unit, integers must collide, so show one decimal. One decimal
is always sufficient to distinguish labels when `rng/3 >= 0.1` display units;
for pathologically small ranges (identical loads → `rng` comes from the
`span||1` fallback = 1 kg → step ≈ 0.33) one decimal yields distinct labels
(e.g. `20.3`, `19.9`, ... for kg; lb conversion only widens the step).

**Verify**: `node --check app.js` → exit 0. Serve the app, seed two sessions
at the same load for one exercise (log 20×10 twice on different dates), open
Stats → Dig deeper → select the exercise: the four Y labels are now distinct
(e.g. `20.3 / 20.1 / 19.9 / 19.8`), not `20 / 20 / 20 / 20`.

### Step 2: Expose the decision and add a simulation check

Canvas text can't be asserted from the DOM. Expose the formatter decision as
a pure test hook next to the other `window.__repforge*` hooks (see
`app.js:407` `window.__repforgeWeeklySnapshot=weeklySnapshot;` for the
convention). Extract the decimals decision into a small pure function so it
can be tested without drawing:

```javascript
function chartLabelDecimals(rngKg){return toDisplay(rngKg/3)<1?1:0}
window.__repforgeChartLabelDecimals=chartLabelDecimals;
```

…and use `chartLabelDecimals(rng)` inside `draw`.

In `test/simulation.mjs`, add checks (near the existing chart/orientation
checks — search for `redrawChart` or `chart`):

- `page.evaluate(() => window.__repforgeChartLabelDecimals(1))` → `1`
  (flat-data fallback range must get decimals).
- `page.evaluate(() => window.__repforgeChartLabelDecimals(30))` → `0`
  (wide ranges keep integer labels).

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`, PASSED ≥ 269.

## Test plan

- New simulation checks (Step 2): decimals decision for narrow and wide
  ranges.
- Manual visual check (Step 1 verify) — the executor must actually look at
  the chart with flat data, since the regression is visual.
- Existing checks that must keep passing: the whole suite, `FAILED: 0`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` exits 0 with `FAILED: 0` and PASSED ≥ 269
- [ ] `grep -c "chartLabelDecimals" app.js` returns ≥ 3 (definition, use in `draw`, window hook)
- [ ] `grep -n "fmt(Math.round(toDisplay(val)))" app.js` returns no matches
- [ ] No files outside `app.js` and `test/simulation.mjs` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `draw` excerpt doesn't match the live code (drifted).
- Fixing labels appears to require changing `lo`/`hi`/`rng` — that changes
  the plot, report instead.
- One decimal still produces duplicate adjacent labels in your manual check —
  the range math has an edge this plan didn't anticipate; report the seeded
  data that triggers it.

## Maintenance notes

- If a future change adds more gridlines (`i<=3` → more), the decimals
  threshold (`rng/3`) must use the new divisor.
- Unit toggle interacts here: `toDisplay` is inside the decision on purpose —
  a 1 kg range is a 2.2 lb range and may not need decimals in lb mode.
