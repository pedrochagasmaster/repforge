# Plan 003: Hide progression dials behind an "Advanced" disclosure

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js index.html styles.css`
> On any change to these files, compare "Current state" excerpts against live
> code; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: Beginner ("Settings is a trap … four dials with zero tooltips"),
  minimalist ("The defaults should be the product; the dials should be
  buried"). Report §5 "Next 2 weeks".

## Why this matters

Four raw progression dials sit at the top of Settings with no grouping and no
"leave these alone" signal. Beginners panic and minimalists call them noise.
The defaults already work (`DEFAULTS`, `app.js:17`); the dials just need to
stop being the first thing every user sees. Pure markup + a tiny style change —
no logic, no data change.

## Current state

- Settings markup (`index.html:100-108`) puts all four dials in an always-open
  card:

  ```html
  <div class="card">
    <p class="cardtitle">Progression</p>
    <label class="field">Load jump %<input id="jumpPct" ...></label>
    <label class="field">Minimum jump (kg)<input id="minJump" ...></label>
    <label class="field">Target RIR ceiling<input id="rirHigh" ...></label>
    <label class="field">Hard-set RIR ceiling<input id="hardRir" ...></label>
    <p class="lede">Sets at or below this RIR count toward completed hard-set volume. Changes save automatically.</p>
    <button id="saveSettings" class="btn btn--forge">Save settings</button>
  </div>
  ```

- The Program tab already uses a `<details class="advanced">` disclosure for raw
  JSON (`index.html:87-92`) — reuse that exact pattern and its `.advanced` style
  so this looks native.
- JS reads/writes these inputs by id in `renderSettings` (`app.js:458`) and
  `commitSettings` (`app.js:461-462`), and binds `onchange` in `init()`
  (`app.js:483`). None of that must change — the inputs keep the same ids, they
  just move inside a `<details>`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:
- `index.html` — wrap the four dials in `<details class="advanced">` with a
  reassuring summary and a one-line "you don't need these" note.
- `styles.css` — only if the existing `.advanced` style needs a minor tweak for
  the Settings context (prefer reusing as-is).

**Out of scope** (do NOT touch):
- `app.js` — no logic change. Input ids (`#jumpPct`, `#minJump`, `#rirHigh`,
  `#hardRir`, `#saveSettings`) MUST stay identical.
- Per-recommendation surfacing of increment rules (a separate, larger idea).
- The glossary (Plan 002).

## Git workflow

- Branch: `advisor/003-hide-advanced-settings`
- Single commit is fine. Do NOT push/PR unless asked.

## Steps

### Step 1: Wrap the dials in a disclosure

Replace the Progression card body (`index.html:100-108`) with a card that keeps
the four inputs but nests them in `<details>`:

```html
<div class="card">
  <p class="cardtitle">Progression</p>
  <p class="lede">The defaults are tuned for most lifters. You don't need to change these for months.</p>
  <details class="advanced">
    <summary>Advanced · progression dials</summary>
    <label class="field">Load jump %<input id="jumpPct" type="number" step="0.5" inputmode="decimal"></label>
    <label class="field">Minimum jump (kg)<input id="minJump" type="number" step="0.25" inputmode="decimal"></label>
    <label class="field">Target RIR ceiling<input id="rirHigh" type="number" step="0.5" inputmode="decimal"></label>
    <label class="field">Hard-set RIR ceiling<input id="hardRir" type="number" step="0.5" inputmode="decimal"></label>
    <p class="lede">Sets at or below the hard-set RIR ceiling count toward completed hard-set volume. Changes save automatically.</p>
    <button id="saveSettings" class="btn btn--forge">Save settings</button>
  </details>
</div>
```

Keep every `id` exactly as-is (JS depends on them).

**Verify**: `node --check app.js` → 0 (no JS changed, but confirm nothing broke).
Browser → Settings: dials are collapsed by default under "Advanced · progression
dials"; expanding reveals them; editing still auto-saves and survives reload.

### Step 2: Confirm the simulation still passes

The existing simulation opens Settings and changes a dial (Phase 12 "Settings
auto-save on change", `test/simulation.mjs` ~line 850). A `<details>` is not
open by default, so if that check `page.fill`s `#jumpPct` directly it may fail
because the element is inside a collapsed disclosure.

Inspect: `grep -n "jumpPct\|Settings auto-save\|details" test/simulation.mjs`.
If the check interacts with a dial, add a one-line open step **in the test**
before it:

```js
await page.evaluate(() => document.querySelector("#settings details.advanced")?.setAttribute("open",""));
```

(Playwright can `fill` hidden inputs, but making intent explicit is safer.)

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- Manual: default-collapsed, expandable, edits persist.
- Existing simulation stays green (adjust only the test's disclosure-open step
  if needed; do not change app logic).

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] The four dials are collapsed by default inside `<details class="advanced">`
- [ ] Input ids unchanged; editing a dial still auto-saves and persists on reload
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] No `app.js` logic changed; `plans/README.md` status updated

## STOP conditions

- Drift: Settings markup no longer matches the excerpt.
- Hiding the dials breaks more than the one auto-save simulation check — if
  multiple checks fail, the dials may be read elsewhere; investigate before
  forcing the test open.

## Maintenance notes

- New power-user knobs should go inside this same `<details>`, not above it.
- If a "Use defaults / reset" button is wanted later, add it to the always-open
  card body, not the disclosure.
