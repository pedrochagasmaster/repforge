# Plan 021: Beginner literacy — plain program variant + effort-based RIR

> **Executor instructions**: This plan has two deliverables that can ship
> independently (Step 1–2 content-only, Step 3–4 settings toggle). Follow
> steps in order. Run verification gates before proceeding. On STOP, report.
> Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat ff67850..HEAD -- app.js index.html styles.css test/simulation.mjs`
> Mismatch with "Current state" excerpts → STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (plan 002 glossary DONE — extend, don't duplicate)
- **Category**: direction
- **Planned at**: commit `ff67850`, 2026-07-01
- **Source**: Beginner persona §129-135; report §5 "Next 6 months"

## Why this matters

Glossary-on-tap and plain recommendation translations (plan 002) closed part of
the literacy gap, but the **default program** still opens with "Hack squat or
pendulum squat" and numeric RIR inputs. Beginners fake RIR for weeks. A **plain
program variant** (human names + setup notes) and optional **Easy / Hard / Max**
logging mode meet the beginner thesis: "confidence is the feature" without a
20-screen tutorial or AI coach.

## Current state

Default program uses expert machine names (`app.js:78-82`).

Glossary + plain rec copy exist:

```34:40:app.js
const GLOSSARY={
  RIR:"Reps in reserve — how many reps you could have done before failing..."
```

```204:208:app.js
const PLAIN={add2:"Translation: it was easy and you hit the top reps — add weight.",
  add:"Translation: you hit the top of every set — add a little weight next time.",
```

Exercise model already has `notes` for gym-floor hints (`Exercise.notes`, shown
on Log as `.setup` when non-empty — `app.js:265`).

Settings has no `rirMode` — only numeric RIR on set rows.

Program JSON import replaces whole program (`saveProgram`) — a second bundled
program can live as a constant array like `program` / `programBeginner`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:

- `app.js` — `programBeginner` constant; `switchToBeginnerProgram()`; settings
  `rirMode: "numeric" | "effort"` with mapping Easy→3, Hard→1, Max→0 RIR internally;
  Log UI shows segmented control when effort mode on
- `index.html` — Settings: "Beginner program" one-shot button with confirm; RIR mode toggle
- `styles.css` — effort chip row (`.effort`, three buttons)
- `test/simulation.mjs` — effort mode saves numeric RIR; beginner program loads

**Out of scope**:

- Multi-screen onboarding carousel (persona rejected long onboarding)
- Exercise photos / GIFs (rejected)
- AI explanations
- Changing recommendation engine formulas (only input mapping)

## Git workflow

- Branch: `cursor/beginner-literacy-fb30`
- Do NOT push unless instructed

## Steps

### Step 1: Plain program variant content

Add `programBeginner` — same 3-day structure, 18 exercises, but:

- Names like "Leg press (quad focus)", "Chest press machine", "Lat pulldown"
- Fill `notes` with one-line gym-floor hints: "Look for a seat with chest pad
  and handles at armpit height."

Do **not** remove the expert default — this is an opt-in switch.

Add Settings button **"Use beginner-friendly program"** with confirm:
"Replace your current program template? Your logged history stays."

On confirm: `prog = new Program(programBeginner); persistProgram(); render(); toast(...)`

**Verify**: Switch programs → Day 1 shows plain names; history unchanged.

### Step 2: Surface setup notes on Log

Already renders when `ex.notes` set (`app.js:265`). Ensure beginner program
notes are visible without expanding cards — they should show under recommendation.

**Verify**: Log Day 1 exercise shows setup hint line.

### Step 3: Effort-based RIR mode (Settings)

Add to `DEFAULTS` / `normalizeSettings`:

```javascript
rirMode: s?.rirMode === "effort" ? "effort" : "numeric"
```

Settings UI (Progression card, not Advanced):

```
RIR logging: ( ) Numbers  ( ) Easy / Hard / Max
```

When `effort`:

- Replace RIR number input with three buttons per set row (store in draft as
  `_rir` suffixed values or map on save)
- On save: Easy→3, Hard→1, Max→0 (document mapping in GLOSSARY update)
- Recommendations still use numeric RIR from saved log

When switching modes mid-draft, clear draft or convert — **clear draft** is safer.

**Verify**: Effort mode → save workout → History shows numeric RIR 1/3/0;
recommendations still run.

### Step 4: Extend glossary

Add GLOSSARY entries: `Easy effort`, `Hard effort`, `Max effort` — two sentences each.

**Verify**: Tap terms if exposed; no duplicate popover bugs.

### Step 5: Simulation

1. Toggle effort mode, log one set as Hard, save, assert stored `rir === 1`
2. Trigger beginner program switch on empty log fixture, assert first exercise
   name contains "Leg press" not "Hack squat"

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`

## Test plan

- Beginner program switch preserves log
- Effort → numeric RIR mapping on save
- Numeric mode unchanged (regression)
- Export/import preserves `settings.rirMode`
- Glossary and PLAIN copy still render in numeric mode

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] Beginner program is opt-in, not forced on first run
- [ ] No sixth tab; no onboarding wizard
- [ ] `plans/README.md` row 021 updated

## STOP conditions

Stop if:

- Effort UI cannot fit set row on 320px width — use dropdown instead and report
- Stakeholder wants default program replaced globally — needs product decision

## Maintenance notes

- Substitution alternates (plan 017) should use plain names in beginner variant
- Coach templates (backlog) can ship JSON of `programBeginner`
