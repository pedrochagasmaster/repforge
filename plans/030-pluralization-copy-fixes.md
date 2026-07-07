# Plan 030: Pluralize count copy on the finish toast, This Week card, delta counts, and volume rows

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
- **Category**: bug (copy)
- **Planned at**: commit `5c46c1b`, 2026-07-07

## Why this matters

Several coaching surfaces print grammatically wrong counts: the finish toast
says "Workout forged — **1 sets** logged." after a one-set session
(runtime-verified), the This Week card says "**1 hard sets**", and the
Completed hard sets rows can read "**1 sets**". The delta summary also says
"1 new" with no noun, which the UI/UX evaluation report flagged as cryptic.
These strings appear at the emotional peak of the product loop (finishing a
workout, reviewing the week), so sloppy grammar directly undercuts the
"coaching system" feel. One tiny helper fixes all of them consistently.

## Current state

All in `app.js` (single-file vanilla JS app, no build step, dense
statement-per-line style — match it).

`app.js:891-895` — finish toast in `saveWorkout` ("1 sets logged"):

```javascript
  const delta=sessionDeltaCounts(rows),deltaTxt=formatDeltaCounts(delta,{sep:", "});
  let msg=`Workout forged — ${rows.length} sets logged.`;
  if(prLifts.length)msg+=` PR: ${prLifts.join(", ")}.`;
  if(deltaTxt)msg+=` ${deltaTxt}.`;
  toast(msg);render()}finally{saving=false}}
```

`app.js:923-929` — This Week card ("1 hard sets"; note the lifts line already
pluralizes and is the pattern to follow):

```javascript
function renderThisWeek(){const el=$("#thisWeek");if(!el)return;const w=weeklySnapshot();
  el.innerHTML=`<div class="thisweek__title">This week</div><div class="thisweek__rows">`+
    `<div>${w.completedDays} / ${w.plannedDays} days logged</div>`+
    `<div>${w.totalHardSets} hard sets</div>`+
    `<div>${w.improvedLifts} lift${w.improvedLifts===1?"":"s"} improved</div>`+
    `<div>${w.readyToAdd} ready to add</div></div>`+
    `<div class="thisweek__status">Status: <b>${esc(w.status)}</b></div>`}
```

`app.js:628-631` — delta counts used by the finish toast, History session
cards, and the recent-deltas table ("1 new" has no noun):

```javascript
function formatDeltaCounts(c,{sep=" · "}={}){const parts=[];
  if(c.improved)parts.push(`${c.improved} improved`);if(c.flat)parts.push(`${c.flat} flat`);
  if(c.regressed)parts.push(`${c.regressed} regressed`);if(c.new)parts.push(`${c.new} new`);
  return parts.join(sep)}
```

`app.js:1179-1181` — Completed hard sets rows ("1 sets" possible; `x.eff` can
also be fractional like `1.5`, which should stay plural):

```javascript
  el.innerHTML=arr.length?arr.map(x=>`<div class="vrow"><span class="vrow__name">${esc(x.name)}</span>`+
    `<span class="vrow__bar"><span class="vrow__fill${x.eff>=10?" is-high":""}" style="width:${Math.max(4,Math.round(x.eff/max*100))}%"></span></span>`+
    `<span class="vrow__num"><b>${fmt(x.eff)}</b> sets</span></div>`).join(""):`<div class="table"><div class="empty">No hard sets in the last ${volWindow} days yet.</div></div>`;
```

Existing correct-pluralization exemplar in the same file (`app.js:492`):

```javascript
  if(imp||flat)parts.push(`${imp} lift${imp===1?"":"s"} improved${flat?` and ${flat} held flat`:""} so far.`);
```

Helper conventions: tiny arrow-function utilities live near the top of
`app.js` (e.g. `fmt` at line 19, `kfmt` at line 20). Add the new helper there.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Static server (terminal 1, repo root) | `python3 -m http.server 8000` | serves on :8000 |
| Simulation (terminal 2) | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |
| Test deps (once, if missing) | `cd test && npm install && npx playwright install chromium` | exit 0 |

At commit `5c46c1b` the simulation reports `PASSED: 267, FAILED: 0`. Your
changes add checks, so expect a higher PASSED count and always `FAILED: 0`.

## Scope

**In scope** (the only files you should modify):
- `app.js` — the four excerpts above plus one new helper.
- `test/simulation.mjs` — add regression checks.

**Out of scope** (do NOT touch, even though they look related):
- `buildPlainSummary` (`app.js:486-497`) — already pluralizes correctly.
- `renderVolume` (Program tab planned-volume rows) — uses the same `sets`
  label but planned set counts are ≥ 2 in practice; leave unless a check
  fails.
- `index.html`, `styles.css`, `sw.js` — no markup or style change is needed.
- CSV export column headers — machine-facing, not user copy.

## Git workflow

- Branch: `cursor/plan-030-pluralization-<suffix>` (repo convention:
  `cursor/<descriptive-name>`).
- Commit style from `git log`: single-line imperative summaries
  (e.g. "Fix pluralization on finish toast and weekly card").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a `plural` helper

Near the other tiny helpers (directly after `kfmt` at `app.js:20`), add:

```javascript
const plural=(n,word)=>`${word}${+n===1?"":"s"}`;
```

**Verify**: `node --check app.js` → exit 0.

### Step 2: Fix the four call sites

1. `saveWorkout` toast (`app.js:892`):
   `` let msg=`Workout forged — ${rows.length} ${plural(rows.length,"set")} logged.`; ``
2. `renderThisWeek` (`app.js:926`):
   `` `<div>${w.totalHardSets} hard ${plural(w.totalHardSets,"set")}</div>` ``
   Optionally simplify the lifts line on 927 to use `plural` too — consistent,
   not required.
3. `formatDeltaCounts` (`app.js:630`): change the `new` part to
   `` if(c.new)parts.push(`${c.new} new ${plural(c.new,"lift")}`); ``
   Leave improved/flat/regressed as bare adjectives — they read correctly
   without a noun ("2 improved"), and History cards are width-constrained.
4. `renderCompleted` (`app.js:1181`): change `</b> sets` to
   `` </b> ${plural(x.eff,"set")} `` — note `plural` treats only exactly `1`
   as singular, so fractional values like `1.5` stay plural.

**Verify**: `node --check app.js` → exit 0. Then serve the app, log a single
set, press Finish workout → toast reads "… 1 set logged." and (if the lift is
new) "1 new lift".

### Step 3: Add regression checks to the simulation

In `test/simulation.mjs`, find the existing single-set UI save flow (search
for `"Workout forged"` or the toast assertion after the first UI save) and
extend/add asserts:

- After a save of exactly one set, `#toast` text matches `/1 set logged\./`
  and does NOT match `/1 sets/`.
- After seeding one hard set and rendering Stats, `#thisWeek` text matches
  `/1 hard set(?!s)/`.
- A History `.session__delta` line for a session containing one brand-new
  lift matches `/1 new lift/`.

Model the assertions on the surrounding `assert(cond, name, detail, repro)`
calls.

**Verify**: with the static server running, `cd test && node simulation.mjs`
→ `FAILED: 0`, PASSED ≥ 270, new check names appear with `✓`.

## Test plan

- New simulation checks (Step 3): singular toast, singular hard-set line,
  "new lift" noun. These are regression tests for each fixed string.
- Existing checks that must keep passing: any assertion matching toast text
  or delta summaries — search `test/simulation.mjs` for `sets logged`,
  `improved`, `new` and update expected strings **only** where they assert
  the old ungrammatical copy.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` exits 0 with `FAILED: 0` and PASSED ≥ 270
- [ ] `grep -c "plural(" app.js` returns ≥ 4 (definition + at least 3 call sites)
- [ ] `grep -n 'sets logged' app.js` returns no matches (the template now uses `plural`)
- [ ] No files outside `app.js` and `test/simulation.mjs` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match the live code (drifted).
- More than 3 existing simulation checks assert the old copy — that means the
  suite is tightly coupled to these strings and the change needs a reviewer's
  eye on test intent, not silent rewrites.
- You find yourself editing `formatDelta` (singular, `app.js` near
  `compareExerciseSession`) — that formats load/e1RM deltas, not counts; it is
  out of scope.

## Maintenance notes

- Any future count-bearing copy should use `plural` — reviewers should flag
  new `${n} things` template literals.
- Deferred: pluralizing "days logged" ("1 / 4 days logged" is arguably fine
  as a ratio); Program-tab planned volume rows (see Out of scope).
