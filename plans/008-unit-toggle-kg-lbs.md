# Plan 008: kg / lbs display unit toggle

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js index.html`
> On any change, compare "Current state" excerpts against live code; mismatch =
> STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches every load display + the increment math)
- **Depends on**: none (Plan 009 reuses this unit plumbing)
- **Category**: direction (feature)
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: Power user ("Kg only … the US gym where half the plates are in
  pounds"), spreadsheet. Report §5 "Next 2 months" — "lbs/kg unit toggle".

## Why this matters

Loads are kg-only. Half the target market (US) does mental math every set. The
safe design keeps **kg as the canonical stored unit** (so all history, e1RM,
tonnage, and backups stay stable) and adds a **display/entry unit** that
converts at the edges. This is a display concern, but it touches many render
sites and the stepper/jump math, so it's MED risk — do it carefully with the
gate green at every step.

## Current state

- Loads are stored raw as kg in every log row (`saveWorkout`, `app.js:217`) and
  displayed with `fmt()` (`app.js:6`) at many sites: recommendation target
  (`app.js:172`), previous-session line (`app.js:152`), set-row default
  (`app.js:155`), Stats tiles/trend/tables (`app.js:239-262`), History
  (`app.js:335`), chart axis labels (`draw`, `app.js:304,319,322-323`).
- The increment is kg via `minJump`: stepper (`app.js:186`) and `round()`
  (`app.js:119`), `jump()` (`app.js:120`). Settings `minJump`/`jumpPct`
  (`DEFAULTS`, `app.js:17`).
- The kg column header is literal text: `<span>kg</span>` (`app.js:175`) and the
  Program "Minimum jump (kg)" label (`index.html:103`).
- There is no unit concept anywhere: `grep -n "lbs\|unit\|kg" app.js` shows `kg`
  only as display strings/labels.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:
- `app.js` — a `state.settings.unit` (`"kg"`|`"lb"`), conversion helpers
  (`toDisplay`/`fromDisplay`, factor `2.2046226218`), a `unitLabel`, and routing
  all **load** displays + the load input default + the stepper through them.
  Stored values stay kg.
- `index.html` — a unit `<select>`/segmented control in Settings; the Log kg
  column header becomes dynamic.
- `test/simulation.mjs` — a check that switching to lb converts a known display
  value while stored kg is unchanged.

**Out of scope** (do NOT touch):
- Stored units — the log, e1RM, tonnage, volume, and JSON backup stay kg.
- Reps and RIR (unitless).
- Per-exercise units or plate calculators (backlog).
- `minJump` semantics beyond display — keep `minJump` as a **kg** increment;
  only its label and the stepped display convert. (Changing the stored increment
  unit is a larger, riskier change; keep it out.)

## Git workflow

- Branch: `advisor/008-unit-toggle`
- Commit per step, keeping the gate green each time. Do NOT push/PR unless asked.

## Steps

### Step 1: Unit setting + helpers

In `DEFAULTS` (`app.js:17`) add `unit:"kg"`. In `normalizeSettings` (`app.js:19`)
add `unit:s?.unit==="lb"?"lb":"kg"`.

Add helpers near `fmt` (`app.js:6`):

```js
const LB=2.2046226218;
const isLb=()=>state.settings.unit==="lb";
const toDisplay=kg=>isLb()?(+kg||0)*LB:(+kg||0);           // kg → shown number
const fromDisplay=v=>isLb()?(+v||0)/LB:(+v||0);            // shown number → kg
const unitLabel=()=>isLb()?"lb":"kg";
const fmtLoad=kg=>fmt(toDisplay(kg));                       // display a stored kg load
```

**Verify**: `node --check app.js` → 0.

### Step 2: Route load displays through `fmtLoad`

Replace `fmt(<load>)` with `fmtLoad(<load>)` **only for load values** (not reps,
RIR, or e1RM which stays kg unless you also convert it — see Step 5). Sites:

- Recommendation target (`app.js:172`): `Target <b>${fmtLoad(r.load)} ${unitLabel()}</b>`.
- Previous-session line (`app.js:152`): `${fmtLoad(x.load)}×${x.reps}`.
- Set-row default value (`app.js:155`): wrap the `r.load`/`old.load` branch in
  `fmtLoad(...)` (the draft branch stores display values already — see Step 4).
- Stats tiles Volume/Best e1RM, trend, recent/tops tables, History top/vol,
  chart axis + callout + x-labels. For **aggregate stats** convert the displayed
  numbers with `toDisplay` (tonnage and e1RM are in kg·reps and kg respectively;
  see Step 5 decision).

**Verify** after each site: `node --check app.js` → 0; the number changes when
unit=lb and matches `kg × 2.2046`.

### Step 3: Dynamic column header + labels

- Log set-row header (`app.js:175`): `<span>${unitLabel()}</span>`.
- Program label (`index.html:103`): keep "(kg)" — `minJump` stays kg per scope.
  Add a small note "increment is always in kg".

### Step 4: Input entry + stepper in display units

The set-row `<input data-k="…_load">` currently shows/collects kg. With a unit
toggle it must show display units and convert back on save.

- Default value: use `fmtLoad(...)` (Step 2).
- Draft: `saveDraft` (`app.js:181`) stores raw input strings — these are now
  **display** values. That's fine as long as save converts them.
- `saveWorkout` (`app.js:215`): convert the load input back to kg before storing:

  ```js
  const load=posNum(fromDisplay($(`[data-k="${ex.id}_${n}_load"]`).value)),
  ```

- Stepper (`bindWorkout`, `app.js:185-187`): it increments the input by
  `minJump` (kg). In lb display, step by the lb-equivalent so the shown number
  moves by a sensible amount. Simplest correct approach: keep stepping in kg
  under the hood — read display, convert to kg, add `minJump` kg, convert back:

  ```js
  const incKg=+state.settings.minJump||2.5,curKg=fromDisplay(+inp.value||0),
    nextKg=Math.max(0,Math.round((curKg+incKg*(+b.dataset.dir))/incKg)*incKg);
  inp.value=fmt(toDisplay(nextKg));
  ```

- Copy-last (`app.js:188-190`): it fills from stored kg via `fmt(s[f])`; change
  the load field to `fmt(toDisplay(s.load))` while reps/rir stay `fmt(s[f])`.

- History session editor (`sessionEditor`, `app.js:350`) load inputs and
  `saveSessionEdit` (`app.js:365`) must convert the same way (display in, kg
  stored). Route the load input `value` through `fmtLoad` and the save through
  `fromDisplay`.

**Verify**: `node --check app.js` → 0. Toggle to lb: entering `225` lb and
saving stores ~`102.06` kg; stepper moves by 2.5 kg (~5.5 lb) shown; copy-last
shows lb; History edit round-trips without drift.

### Step 5: Decide e1RM / tonnage display unit (document it)

e1RM and tonnage are derived in kg. Simplest consistent behavior: display e1RM
in the chosen unit (`toDisplay`) and label it; keep **tonnage** in the chosen
unit too. Do NOT change stored/derived kg — only the displayed number and label.
Update: Stats "Best e1RM" tile (`app.js:240`) and trend (`app.js:250-254`),
`tops`/`recent` tables load columns, and chart labels. Add `unitLabel()` to each.

**Verify**: unit label is consistent everywhere a load/e1RM/tonnage shows.

### Step 6: Settings control + wiring

In `index.html` Progression card (near the dials), add:

```html
<label class="field">Units<select id="unit"><option value="kg">kg</option><option value="lb">lb</option></select></label>
```

In `renderSettings` (`app.js:458`): `$("#unit").value=state.settings.unit;`.
In `commitSettings` (`app.js:462`) include `unit:$("#unit").value==="lb"?"lb":"kg"`.
In `init()` bindings (`app.js:483`) add `#unit` to the auto-save list.

**Verify**: switching units re-renders all tabs with converted displays;
reloading preserves the unit.

### Step 7: Simulation check

In `test/simulation.mjs`:

```js
// log a known kg set, switch to lb, confirm display converts, stored stays kg
await nav(page, "settings");
await page.selectOption("#unit", "lb");
await page.waitForTimeout(120);
await nav(page, "stats");
// stored kg unchanged
const st = await getState(page);
assert(st.log.every(r => r.load < 1000), "Stored loads remain kg after unit switch",
  "A stored load looks converted to lb", "Settings → unit=lb → repforge_v1 loads still kg");
// reset for later checks
await nav(page, "settings");
await page.selectOption("#unit", "kg");
```

Prefer a stronger check if the test already logs a known load: assert the Log
set-row default shows `kg×2.2046` when unit=lb. Keep it robust to the collapsed
Advanced disclosure (open it if the `#unit` control lives inside — put `#unit`
in the always-open card body to avoid that).

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js` after each step.
- Manual round-trip: enter lb, save, switch to kg, confirm the kg value is the
  correct conversion (no drift), History edit preserves value.
- Simulation: stored-stays-kg check; existing 61 stay green (they log/read kg
  with unit=kg default, so they must be unaffected).

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] `unit` persists in settings and defaults to `kg`
- [ ] With unit=lb, all load/e1RM/tonnage displays and the column header show lb
- [ ] Entering a lb value stores the correct kg (round-trips without drift)
- [ ] Stepper moves by a consistent kg increment regardless of display unit
- [ ] `repforge_v1.log` loads are unchanged (still kg) after switching units
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] No files outside scope changed; `plans/README.md` status updated

## STOP conditions

- Drift: excerpts don't match live code.
- If routing displays through `fmtLoad` breaks the simulation's numeric
  assertions (e.g. "kg stepper increments by minimum jump" expects `102.5`,
  `test/simulation.mjs:891`) even with unit=kg (default), a helper is converting
  when it shouldn't — the default path must be a no-op. STOP and fix so unit=kg
  is byte-identical to today before adding lb.
- If you find yourself changing stored kg values or `minJump` semantics, STOP —
  that's out of scope.

## Maintenance notes

- Canonical unit is kg forever; only display/entry converts. New load displays
  must use `fmtLoad`/`unitLabel`, never bare `fmt` on a load.
- Per-exercise units and a plate calculator are backlog; don't fold them in.
