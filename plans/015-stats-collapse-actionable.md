# Plan 015: Collapse Stats to an actionable default with "Dig deeper"

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js index.html styles.css`
> On any change, compare "Current state" excerpts against live code; mismatch =
> STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: Minimalist ("Stats is becoming a second app … I scrolled past four
  screens"), spreadsheet ("Stats mixes incompatible metrics"). Report §2.6 —
  "Collapse Stats to actionable defaults."

## Why this matters

Stats stacks an attention board, a metrics grid, a chart, completed-hard-set
volume, recent performance, and top-loads — "four screens of analysis to answer
a question I didn't ask on a Tuesday." The report's guidance: the **attention
board is the stats page**; charts and tables live behind one "Dig deeper"
affordance. This protects the minimalist soul without deleting depth. Pure
markup reorg + a disclosure; the rendering functions stay.

## Current state

- Stats markup order (`index.html:56-74`): `#attention` → `#metrics` →
  chart card (`#statExercise`, `#trend`, `#chart`) → "Completed hard sets"
  (`#volWindow`, `#completedVolume`) → "Recent performance" (`#recent`) → "Top
  loads by exercise" (`#tops`).
- `renderStats` (`app.js:231-264`) populates all of them every render and calls
  `renderAttention` (`app.js:267`) and `renderCompleted` (`app.js:281`).
- The attention board (`renderAttention`, `app.js:267-278`) already groups lifts
  into add / reduce / fresh with tap-to-chart — it's the actionable summary.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:
- `index.html` — reorder Stats so the attention board (+ a compact metrics row)
  is the default view; wrap chart, completed-hard-sets, recent, and top-loads in
  a single `<details class="advanced">` "Dig deeper" disclosure.
- `styles.css` — minor spacing for the collapsed layout (reuse `.advanced`).
- `app.js` — only if a render call needs to be triggered when the disclosure
  opens (e.g. the chart must `draw()` after becoming visible — see Step 2).
- `test/simulation.mjs` — ensure Stats checks that read `#chart`/`#recent`/
  `#tops`/`#completedVolume` open the disclosure first.

**Out of scope** (do NOT touch):
- The rendering functions' logic (`renderAttention`, `renderCompleted`, `draw`,
  tables) — reorg only.
- New chart types / metric labeling fixes (separate Stats plan; the report also
  wants e1RM/volume overlays and clearer metric grouping — keep that out here).

## Git workflow

- Branch: `advisor/015-stats-collapse`
- Commit per step. Do NOT push/PR unless asked.

## Steps

### Step 1: Reorder + wrap depth in a disclosure

Restructure the Stats section (`index.html:56-74`) so the default is the
actionable summary and everything else is behind "Dig deeper":

```html
<section id="stats" class="view" aria-label="Stats">
  <div class="sectionhead"><p class="eyebrow">The numbers</p><h2>Stats</h2></div>
  <div id="attention" class="attention"></div>
  <div id="metrics" class="metrics"></div>
  <details class="advanced" id="statsDeep">
    <summary>Dig deeper — charts &amp; tables</summary>
    <div class="card chartcard">
      <label class="field">Exercise<select id="statExercise"></select></label>
      <div id="trend" class="trend"></div>
      <canvas id="chart" height="240" aria-label="Top load over time"></canvas>
    </div>
    <h3 class="subhead">Completed hard sets</h3>
    <p class="lede">Logged sets per muscle within your RIR ceiling — the volume you actually did, not the plan.</p>
    <div id="volWindow" class="seg seg--window" role="tablist" aria-label="Volume window">
      <button type="button" data-win="7" class="active">7 days</button>
      <button type="button" data-win="28">28 days</button>
    </div>
    <div id="completedVolume" class="volume"></div>
    <h3 class="subhead">Recent performance</h3><div id="recent" class="table"></div>
    <h3 class="subhead">Top loads by exercise</h3><div id="tops" class="table"></div>
  </details>
</section>
```

Keep every `id` identical — `renderStats` targets them by id and must keep working.

### Step 2: Draw the chart when the disclosure opens

The canvas sizes from `clientWidth` at draw time (`draw`, `app.js:293`). Inside a
closed `<details>` its `clientWidth` is 0, so a chart drawn while collapsed is
blank. Redraw when "Dig deeper" opens. In `init()`:

```js
$("#statsDeep").addEventListener("toggle",()=>{if($("#statsDeep").open)renderStats()});
```

(If Plan 010 landed, call `redrawChart()` instead of the full `renderStats`.)

**Verify**: `node --check app.js` → 0. Stats default shows only attention +
metrics; expanding "Dig deeper" reveals the chart correctly sized (not blank),
plus the tables.

### Step 3: Keep the attention→chart tap working

`renderAttention` tap handler (`app.js:277-278`) selects a lift in
`#statExercise` and scrolls to `#chart`. If the chart is inside a closed
disclosure, that scroll lands on a hidden element. Update the handler to open
the disclosure first. Since it's out-of-scope to change logic gratuitously, make
the minimal change: in the click handler (`app.js:277`), before scrolling, add
`$("#statsDeep").open=true;` then `renderStats()` (already called) then scroll.

**Verify**: tapping a lift chip in the attention board opens "Dig deeper",
selects that lift, and scrolls to its chart.

### Step 4: Simulation compatibility

Several existing checks read `#completedVolume`, `#attention`, `#recent`,
`#tops`, `#chart` (e.g. "Completed hard sets render per muscle",
`test/simulation.mjs:965-970`). With those now inside a closed `<details>`,
Playwright can still read DOM/counts, but any visibility-dependent read or the
chart-size read (Plan 010) needs the disclosure open. Add, before Stats depth
assertions:

```js
await page.evaluate(() => document.querySelector("#statsDeep")?.setAttribute("open",""));
```

Grep for the Stats checks and insert the open step where needed:
`grep -n "completedVolume\|#recent\|#tops\|#chart\|attention" test/simulation.mjs`.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js`.
- Manual: default Stats fits ~one thumb-scroll (attention + metrics); "Dig
  deeper" reveals chart (correctly sized) + tables; attention chip opens it and
  scrolls to the chart.
- Simulation: open-disclosure step added where depth is asserted; all checks pass.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] Stats default view shows attention board + metrics only; depth is behind
      one "Dig deeper" disclosure
- [ ] Expanding the disclosure renders the chart at the correct size (not blank)
- [ ] Attention-board chips open the disclosure and scroll to the chart
- [ ] All element ids unchanged; render functions' logic untouched
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] No files outside scope changed; `plans/README.md` status updated

## STOP conditions

- Drift: Stats markup / `renderStats` / `renderAttention` don't match excerpts.
- If the chart renders blank even after the `toggle` redraw, the redraw is firing
  before layout settles — defer with a `requestAnimationFrame`/short timeout; do
  not move the chart back out of the disclosure.

## Maintenance notes

- Metric-grouping clarity (separating strength vs volume vs tonnage) and extra
  chart series (e1RM/volume trend) are a separate, larger Stats plan — keep them
  out of this reorg.
- New Stats widgets ship inside "Dig deeper" by default, per the guardrail
  "protect the Log tab's soul / Stats depth is for Sunday review."
