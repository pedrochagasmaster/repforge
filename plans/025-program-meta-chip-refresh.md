# Plan 025: Program summary chips refresh immediately after meta edits

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f9da669..HEAD -- app.js test/simulation.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (but land before plan 028, which touches the same function)
- **Category**: bug
- **Planned at**: commit `f9da669` (PR #19 branch `cursor/program-abstraction-df5f`), 2026-07-02

## Why this matters

PR #19 added a program summary card on the Program tab: editable name + start
date, and read-only chips (week number, status label, adherence, progression
health, volume compliance). The card's primary interaction is broken: **setting
the start date does not make the "Week N" chip appear**. Verified at runtime
with Playwright — after filling `#programStarted` with a date 15 days back, the
header still reads `Program name … Getting started … 0 / 3 days this week`
with no Week chip; it only appears after navigating to another tab and back.
The root cause is that `persistProgramMeta()` only saves state, nothing
re-renders the header afterwards, and `renderProgramHeader()` has an early
return while focus is inside the card (correct for protecting the inputs,
but it also suppresses chip updates). For the feature this PR exists to ship,
the feedback loop must be immediate.

## Current state

Relevant file: `app.js` (single-file vanilla JS app, no build step, dense
"statement-per-line" style — match it).

`app.js:201-204` — persist helper (saves only, no rendering):

```javascript
function persistProgramMeta(partial={}){if(!state.programMeta)state.programMeta=defaultProgramMeta(state.log);
  if(partial.name!==undefined)state.programMeta.name=String(partial.name??"").trim();
  if(partial.started!==undefined){const v=partial.started;state.programMeta.started=v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null}
  state.programMeta.updated=new Date().toISOString();save()}
```

`app.js:677-698` — header renderer. Note the focus guard on the second line
and that the chip markup is built inline inside the same `innerHTML` write
that rebuilds the two inputs:

```javascript
function renderProgramHeader(){
  const el=$("#programMeta");if(!el)return;
  if(document.activeElement?.closest("#programMeta"))return;
  const meta=state.programMeta||defaultProgramMeta(state.log);
  const ad=programAdherence(),week=programWeek(),status=programStatusLabel();
  const health=programProgressionHealth(),vol=programVolumeCompliance();
  const weekChip=week?`<span class="pmeta__chip">Week ${week}</span>`:"";
  const healthChip=health?`<span class="pmeta__chip">${health.hot}/${health.total} ready to add</span>`:"";
  const volChip=vol?`<span class="pmeta__chip">${Math.round(vol.ratio*100)}% volume (7d)</span>`:"";
  el.innerHTML=
    `<div class="pmeta__row">`+
      `<label class="pmeta__name">Program name<input id="programName" type="text" value="${esc(meta.name)}" placeholder="Untitled program" aria-label="Program name"></label>`+
      `<div class="pmeta__chips">${weekChip}<span class="pmeta__chip pmeta__chip--status">${esc(status)}</span></div>`+
    `</div>`+
    `<div class="pmeta__row">`+
      `<label class="pmeta__started">Started<input id="programStarted" type="date" value="${esc(meta.started||"")}" aria-label="Program start date"></label>`+
      `<div class="pmeta__chips"><span class="pmeta__chip">${ad.logged} / ${ad.total} days this week</span>${healthChip}${volChip}</div>`+
    `</div>`;
  const nameInp=$("#programName"),startInp=$("#programStarted");
  nameInp.oninput=()=>persistProgramMeta({name:nameInp.value});
  startInp.onchange=()=>persistProgramMeta({started:startInp.value||null});
}
```

The container `#programMeta` lives in `index.html` inside the
`<section id="program">` view (you do not need to change `index.html`).

Conventions that apply:

- HTML built with template strings; user-controlled values pass through
  `esc()` (`app.js:18`). Chip values here are numeric/app-generated, but keep
  `esc()` where it is already used.
- Handlers are assigned with `.onclick=`/`.oninput=` after `innerHTML` writes
  (see `renderProgramHeader` itself, or `bindEditor` at `app.js:744`).
- Domain vocabulary (from `CONTEXT.md`): these chips are **Program progress**
  ("derived signals … computed from the log, not entered manually") and
  **Program status** ("plain-language summary … not a gamified score"). Keep
  names like `renderProgramChips` in that vocabulary.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Static server (terminal 1, repo root) | `python3 -m http.server 8000` | serves on :8000 |
| Simulation (terminal 2) | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |
| Test deps (once, if missing) | `cd test && npm install && npx playwright install chromium` | exit 0 |

At commit `f9da669` the simulation reports `PASSED: 111`. Your changes add
checks, so expect a higher PASSED count and always `FAILED: 0`.

## Scope

**In scope** (the only files you should modify):
- `app.js` — `renderProgramHeader` and the two input handlers it wires.
- `test/simulation.mjs` — extend the existing "Phase: program metadata" block.

**Out of scope** (do NOT touch, even though they look related):
- `index.html`, `styles.css` — the chip containers are created from JS; no
  markup or style change is needed.
- `persistProgramMeta` and the signal functions (`programAdherence`,
  `programWeek`, `programStatusLabel`, `programProgressionHealth`,
  `programVolumeCompliance`) — plan 027 restructures those; changing them
  here creates a conflict.
- `sw.js` — service-worker caching is unrelated.

## Git workflow

- Branch off the PR #19 branch: `git checkout cursor/program-abstraction-df5f && git checkout -b <your-branch>`.
- Commit style from `git log`: single-line imperative summaries
  (e.g. "Add program metadata abstraction with summary dashboard").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Split chip rendering out of `renderProgramHeader`

In `app.js`, extract the chip computation + markup into a new function
`renderProgramChips()` placed directly above `renderProgramHeader`. Give the
two chip containers stable ids so they can be re-rendered without touching
the inputs. Target shape:

```javascript
function renderProgramChips(){
  const top=$("#pmetaChipsTop"),bottom=$("#pmetaChipsBottom");if(!top||!bottom)return;
  const ad=programAdherence(),week=programWeek(),status=programStatusLabel();
  const health=programProgressionHealth(),vol=programVolumeCompliance();
  const weekChip=week?`<span class="pmeta__chip">Week ${week}</span>`:"";
  const healthChip=health?`<span class="pmeta__chip">${health.hot}/${health.total} ready to add</span>`:"";
  const volChip=vol?`<span class="pmeta__chip">${Math.round(vol.ratio*100)}% volume (7d)</span>`:"";
  top.innerHTML=`${weekChip}<span class="pmeta__chip pmeta__chip--status">${esc(status)}</span>`;
  bottom.innerHTML=`<span class="pmeta__chip">${ad.logged} / ${ad.total} days this week</span>${healthChip}${volChip}`;
}
```

In `renderProgramHeader`, replace the inline chip variables and the two
`<div class="pmeta__chips">…</div>` interiors with
`<div id="pmetaChipsTop" class="pmeta__chips"></div>` and
`<div id="pmetaChipsBottom" class="pmeta__chips"></div>`, then call
`renderProgramChips()` right after the `el.innerHTML=` assignment (before
wiring the input handlers). Keep the focus guard exactly where it is — it
still protects the inputs.

**Verify**: `node --check app.js` → exit 0.

### Step 2: Refresh chips from the input handlers

Change the two handlers at the bottom of `renderProgramHeader` so every meta
edit refreshes the chips even while focus stays inside the card:

```javascript
nameInp.oninput=()=>persistProgramMeta({name:nameInp.value});
startInp.onchange=()=>{persistProgramMeta({started:startInp.value||null});renderProgramChips()};
```

(The name does not feed any chip, so `oninput` on it does not need a refresh;
adding one is acceptable but not required.)

**Verify**: `node --check app.js` → exit 0. Then manually (or skip to Step 3's
automated check): serve the app, open the Program tab, set the start date to
~2 weeks ago → the "Week 3" chip appears immediately, without changing tabs.

### Step 3: Add a regression check to the simulation

In `test/simulation.mjs`, inside the existing `Phase: program metadata` block
(it starts at the `console.log("\nPhase: program metadata")` line, after the
"Program name persists on edit" assert and **before** the block that deletes
`programMeta` from storage), add:

```javascript
  const startedIso = (() => {
    const d = new Date(Date.now() - 15 * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  await page.fill("#programStarted", startedIso);
  await page.waitForTimeout(150);
  const metaAfterDate = await page.locator("#programMeta").textContent();
  assert(
    /Week 3/.test(metaAfterDate),
    "Week chip appears immediately after setting start date",
    `Meta card after date edit: ${metaAfterDate?.slice(0, 140)}`,
    "Program tab → set start date 15 days back → Week chip without leaving the tab"
  );
  state = await getState(page);
  assert(
    state.programMeta.started === startedIso,
    "Start date persists on edit",
    `started=${state.programMeta?.started}`,
    "Program tab → edit start date"
  );
```

Note: `page.fill` keeps focus inside `#programMeta`, which is exactly the
condition that reproduced the bug — do not blur or navigate before asserting.
The later migration sub-test deletes `programMeta` entirely, so the started
date you set here does not leak into later phases.

**Verify**: with the static server running, `cd test && node simulation.mjs`
→ `FAILED: 0`, PASSED ≥ 113, and the two new check names appear with `✓`.

## Test plan

- New simulation checks (Step 3): Week chip appears immediately after a
  start-date edit with focus still in the card; `programMeta.started`
  persists. These are the regression tests for the verified bug.
- Existing checks that must keep passing: "Program tab shows adherence chip",
  "Program name persists on edit", "Legacy backup migrates programMeta on
  load", the export/import v2 checks, and everything else — the full run must
  end `FAILED: 0`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` exits 0 with `FAILED: 0` and PASSED ≥ 113
- [ ] `grep -c "renderProgramChips" app.js` returns ≥ 3 (definition + two call sites)
- [ ] No files outside `app.js` and `test/simulation.mjs` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `renderProgramHeader` or `persistProgramMeta` in `app.js` does not match the
  "Current state" excerpts (the PR branch has moved).
- The simulation fails on a check that existed before your change, twice in a
  row after a re-run (the suite drives a real browser; a single flaky timeout
  may be retried once).
- Fixing the refresh appears to require modifying `render()`, `renderProgram()`,
  or the signal functions — that is plan 027's territory.

## Maintenance notes

- Plan 027 (single-pass signal computation) and plan 028 (program identity
  surfacing) both touch `renderProgramHeader`/`renderProgramChips`; land this
  plan first and rebase those on it.
- Reviewer should scrutinize: the focus guard must still prevent input
  clobbering (type in the name field while chips refresh — the cursor must not
  jump), and no chip content bypasses `esc()` if any non-numeric value is added
  later.
- Deferred: live-refreshing chips when the log changes while the Program tab
  is open in another render path — the existing full `render()` on tab
  switches already covers real usage.
