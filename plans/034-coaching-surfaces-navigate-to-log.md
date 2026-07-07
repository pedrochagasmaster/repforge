# Plan 034: Make coaching surfaces navigate to the work surface — attention chips jump to the lift on Log, week eyebrow opens Stats → Review

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c46c1b..HEAD -- app.js index.html test/simulation.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches nav plumbing and an existing simulation-covered click behavior)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `5c46c1b`, 2026-07-07

## Why this matters

The UI/UX evaluation report's core conclusion — confirmed by code review — is
that the remaining product gap is connecting insights back to action. Two
dead ends today:

1. **Attention board chips**: a chip for an unlogged ("Untested") lift fires
   `toast("Log this lift to chart it.")` — a dead end telling the user to do
   something the app could just take them to. Chips for logged lifts jump to
   the *chart*, not to the place where the user acts (the Log tab).
2. **The Log week eyebrow** (`UNTITLED PROGRAM · WEEK 1 OF 6`) is inert text;
   the natural tap target for "how is this block going?" — the Stats Review
   segment — is three taps away.

This plan makes attention chips for actionable groups (Ready to add,
Untested, Not trained recently) navigate to the lift on the Log tab (correct
day tab selected, exercise card scrolled into view), keeps the chart jump for
the analysis-flavored groups, and makes the week eyebrow a button that opens
Stats → Review.

## Current state

All in `app.js` unless noted.

`app.js:1148-1156` — attention board rendering and the current click handler
(chart jump or toast dead end):

```javascript
function renderAttention(){const el=$("#attention");if(!el)return;
  const groups=attentionGroups();
  const html=groups.map(({cls,lead,items})=>`<div class="attn__grp attn--${cls}"><span class="attn__lead">${esc(lead)}</span>`+
    `<p class="attn__why">${esc(items[0]?.why||"")}</p>`+
    items.map(({ex})=>`<button type="button" class="attn__chip" data-attn="${esc(ex.name)}">${esc(ex.name)}</button>`).join("")+`</div>`).join("");
  el.innerHTML=html||`<div class="attn__grp"><span class="attn__lead">Every lift is holding — chase reps.</span></div>`;
  $$("#attention [data-attn]").forEach(b=>b.onclick=()=>{const ex=prog.exercises.find(e=>e.name===b.dataset.attn),k=ex?.id||b.dataset.attn;
    const has=[...$("#statExercise").options].some(o=>o.value===k);
    if(has){$("#statsDeep").open=true;$("#statExercise").value=k;renderStats();redrawChart();$("#chart").scrollIntoView({behavior:"smooth",block:"center"})}else toast("Log this lift to chart it.")});}
```

`app.js:1141-1146` — the group definitions (keys you will branch on):

```javascript
function attentionGroups(){const fatigueCluster=prog.exercises.filter(ex=>{const r=recommendation(ex);return r.status==="reduce"||r.stalled}).length>=2;
  const defs=[{key:"add",cls:"add",lead:"Ready to add"},{key:"reduce",cls:"reduce",lead:"Back off / stalled"},{key:"new",cls:"new",lead:"Untested"},
    {key:"stale",cls:"stale",lead:"Not trained recently"},{key:"vol",cls:"vol",lead:"Volume low"},{key:"fatigue",cls:"fatigue",lead:"Possible fatigue"}];
```

`app.js:1597-1599` — nav switching (the pattern for programmatic tab
changes; each nav button toggles `.active` on itself and its view then calls
`render()`):

```javascript
  $$("nav button").forEach(b=>b.onclick=()=>{$$("nav button").forEach(x=>{const on=x===b;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===b.dataset.view));window.scrollTo({top:0});render()});
```

There is no existing `goToView(name)` helper — the simulation navigates by
clicking `nav button[data-view="…"]`. The heat gauge already implements a
"scroll an exercise card into view" pattern (`app.js:848`):

```javascript
  g.onclick=hot?()=>{const first=$("#workout .exercise.is-add, #workout .exercise.is-add2");if(first){collapsed.delete(first.dataset.ex);first.classList.remove("is-collapsed");first.scrollIntoView({behavior:"smooth",block:"center"})}}:null;}
```

Day switching: module-level `let day` (near `app.js:330`); `renderTabs`
(`app.js:696-698`) reads it; exercise cards carry `data-ex="<id>"`
(`app.js:746`); each exercise template has a `.day` property.

`app.js:701-702` — the week eyebrow (inert `<p>`):

```javascript
  const lc=$("#logContext");if(lc){const nm=state.programMeta?.name,mc=mesocycleWeek();
    lc.textContent=nm||mc.current!=null?`${nm||"Untitled program"}${mc.current!=null?` · Week ${mc.current} of ${mc.total}`:""}`:"Today's session"}
```

`index.html:39` — `<p class="eyebrow" id="logContext">Today's session</p>`.

`app.js:656-660` — `setStatsSeg(seg)` switches Stats segments ("review" is a
valid key; `STATS_SEG` map at `app.js:334`).

Focus mode interaction: `logMode` / `focusIndex` (`app.js:333`) — in Focus
mode only one exercise card is fully visible; jumping to a lift must also set
`focusIndex` to that exercise's position in `focusList()` (`app.js:654`).

**Existing simulation coverage you must respect** (`test/simulation.mjs`):

- Lines ~620-630: clicks the **first** attention chip and asserts
  `#statsDeep` opens. The first group is "add" if present.
- Lines ~2021-2030: clicks the first chip and asserts `#statExercise` gets a
  value and `#statsDeep` opens.

Both currently rely on chart-jump behavior for chips this plan re-routes to
the Log tab. **These checks must be updated as part of this plan** to assert
the new navigation for add/new/stale chips (or to click a reduce/vol/fatigue
chip when asserting the chart jump).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Static server (terminal 1, repo root) | `python3 -m http.server 8000` | serves on :8000 |
| Simulation (terminal 2) | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |

At commit `5c46c1b` the simulation reports `PASSED: 267, FAILED: 0`.

## Scope

**In scope** (the only files you should modify):
- `app.js` — `renderAttention` click handler, a new `goToLogExercise` helper,
  the `#logContext` renderer + binding, `renderWorkout` (only if needed for
  the focus-mode index fix).
- `index.html` — change `#logContext` from `<p>` to `<button>` (keep the
  `eyebrow` class; add `type="button"`).
- `styles.css` — minimal style so the eyebrow button doesn't look like a
  default button (reset background/border, keep `.eyebrow` typography, add a
  subtle affordance such as the `.term` dotted underline on the week part or
  a `›` suffix).
- `test/simulation.mjs` — update the two existing chip checks + add new ones.

**Out of scope** (do NOT touch, even though they look related):
- `attentionSignal` / `attentionGroups` logic — grouping is unchanged.
- The "only first why shown" limitation (`items[0]?.why`) — separate concern,
  keep as is.
- Strength/Volume/PR dashboard row drill-down — backlog, not this plan.
- The heat gauge behavior.

## Git workflow

- Branch: `cursor/plan-034-coaching-nav-<suffix>`.
- Commit style: single-line imperative summary.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a `goToLogExercise(exId)` helper

Place it near `setLogMode` (`app.js:655`). It must:

1. Find the exercise: `const ex=prog.find(exId);if(!ex)return;`
2. Switch the day: `day=ex.day;`
3. If `logMode==="focus"`, set `focusIndex` to the exercise's index in
   `focusList()` after the day switch (clamp to ≥ 0; if the exercise is
   skipped it won't be in `focusList()` — fall back to index 0).
4. Navigate to the Log view by driving the existing nav machinery:
   `$('nav button[data-view="log"]').click();` (this toggles views and calls
   `render()`, which re-renders tabs and workout for the new `day`).
5. After render, scroll the card into view and expand it, mirroring the heat
   gauge pattern:

```javascript
  const art=$(`#workout [data-ex="${exId}"]`);if(art){collapsed.delete(exId);art.classList.remove("is-collapsed");art.scrollIntoView({behavior:"smooth",block:"center"})}
```

Note `nav` click already does `window.scrollTo({top:0})` before `render()`,
so do the `scrollIntoView` after the click, in the same synchronous handler
(render is synchronous).

**Verify**: `node --check app.js` → exit 0.

### Step 2: Route attention chips by group

In `renderAttention`, include the group key on each chip
(`data-attngo="${key}"` or read it from the enclosing group class) and split
the handler:

- Groups `add`, `new`, `stale` → `goToLogExercise(ex.id)` (these are "go do
  something" signals).
- Groups `reduce`, `vol`, `fatigue` → keep the current chart-jump behavior
  (these are "go analyze" signals), including the existing
  `toast("Log this lift to chart it.")` fallback when the lift has no data.

Chips are keyed by `ex.name` today (`data-attn`); switch to `ex.id` for the
navigation path (`prog.find`) — keep `data-attn` name for the chart path or
migrate both to id (`$("#statExercise")` options are keyed by lift key, which
is the exercise id for program lifts — see the existing handler line
`app.js:1154`).

**Verify**: `node --check app.js` → exit 0. Serve, seed a program, open
Stats: tapping an "Untested" chip lands on the Log tab with the right day tab
active and the exercise card centered; tapping a "Back off / stalled" chip
still jumps to the chart.

### Step 3: Make the week eyebrow open Stats → Review

1. `index.html:39` → `<button type="button" class="eyebrow eyebrow--link" id="logContext">Today's session</button>`.
2. `styles.css`: add `.eyebrow--link{background:none;border:0;padding:0;cursor:pointer;text-align:left;font:inherit;color:inherit}` and an affordance (e.g. `.eyebrow--link::after{content:" ›"}`) — inspect `.eyebrow`'s existing style block and keep its typography exactly.
3. In `app.js` `init` (near the other one-time bindings, `app.js:1570-1599`):

```javascript
  const lc=$("#logContext");if(lc)lc.onclick=()=>{$('nav button[data-view="stats"]').click();setStatsSeg("review")};
```

(`setStatsSeg` must run **after** the nav click because the nav handler calls
`render()`, and `renderStats` leaves the current segment alone — but the
click also re-renders segment buttons; calling `setStatsSeg("review")` after
is what makes Review active. Confirm order by testing.)

**Verify**: serve + hard-reload → tapping the eyebrow on Log lands on Stats
with the Review segment active (`#segReview.active`).

### Step 4: Update and extend the simulation

1. Update the two existing chip-click checks (lines ~620-630 and ~2021-2030):
   pick a chip **inside `.attn--reduce`, `.attn--vol`, or `.attn--fatigue`**
   for the chart-jump assertions (the seeded state at that point produces
   reduce chips — the check at line 2010 already proves it). If no
   analysis-group chip exists at the first site, keep the graceful skip
   branch that's already there.
2. Add new checks:
   - Click a `.attn--new` (or `.attn--add`) chip → `#log` view becomes
     active, the active day tab (`#dayTabs button.active`) matches the
     exercise's day, and `#workout [data-ex="<id>"]` exists.
   - Click `#logContext` → `#stats` view active and `#segReview` has class
     `active`.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`, PASSED ≥ 270.

## Test plan

- Updated checks: existing chip → chart assertions now target analysis-group
  chips explicitly.
- New checks: action-group chip → Log navigation (view, day tab, card
  presence); eyebrow → Stats Review.
- Manual: verify Focus mode — tap an attention chip for a lift on another
  day while in Focus mode; the Log must show that lift as the current focus
  card (Step 1.3).
- Existing checks that must keep passing: everything else, `FAILED: 0`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` exits 0 with `FAILED: 0` and PASSED ≥ 270
- [ ] `grep -c "goToLogExercise" app.js` ≥ 2 (definition + attention handler)
- [ ] `grep -n '"Log this lift to chart it."' app.js` still returns exactly 1 match (kept for analysis-group fallback)
- [ ] `index.html` `#logContext` is a `<button>`
- [ ] No files outside `app.js`, `index.html`, `styles.css`, `test/simulation.mjs` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `renderAttention` / nav excerpts don't match live code (drifted).
- Driving navigation via `$('nav button[…]').click()` causes double-render
  glitches you can't resolve by ordering (e.g. scroll fights) — do NOT build
  a parallel navigation system; report.
- More than the two identified simulation checks break — the coupling is
  wider than mapped and needs review of test intent.
- Making `#logContext` a button breaks the sectionhead layout at 390px after
  a reasonable CSS attempt.

## Maintenance notes

- `goToLogExercise` is the seam for all future "insight → action" links
  (Strength/Volume/PR row drill-down in the backlog should reuse it).
- Reviewer should scrutinize: Focus-mode index math (off-by-one when the
  target is skipped/hidden), and that the eyebrow button stays accessible
  (it now needs a meaningful accessible name — the text content serves, but
  confirm it isn't emptied when no program exists).
- Deferred: "reduce" chips could offer both destinations (chart + Log); kept
  single-destination to avoid a chooser UI.
