# Plan 001: Rest timer per exercise (optional auto-start on set fill)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> STOP condition occurs, stop and report — do not improvise. When done, update
> this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js index.html styles.css`
> If `app.js`, `index.html`, or `styles.css` changed since this plan was
> written, compare the "Current state" excerpts against the live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction (feature)
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: Power user ("No rest timer. I cannot say this loudly enough"),
  parent, minimalist. Report §5 "Next 2 weeks" — the single highest-leverage,
  zero-architectural-risk gap vs Strong/Hevy.

## Why this matters

RepForge wins or loses "on the sixty seconds between sets" (report §1 thesis),
yet there is no timer anywhere in the app. Users track rest on a separate app,
which is exactly the moment they open Hevy and don't come back. The logging
loop already commits set values to a draft on every input (`saveDraft`,
`app.js:181`), so a timer is purely additive UI + a `setInterval` — no data
model change, no storage change.

## Current state

- `app.js:148` `renderWorkout()` builds each exercise `<article class="exercise …">`.
  Set rows are built at `app.js:158-163` — each `.setrow` has a kg input
  (`data-k="${ex.id}_${n}_load"`), reps, and RIR.
- `app.js:183` `bindWorkout()` wires input/step/copy/collapse handlers. Inputs
  call `saveDraft()` on `oninput` (`app.js:184`).
- Header has a `#heatGauge` element (`index.html:25-28`) in `.topbar__end`; the
  topbar is a good home for a compact global timer readout.
- There is **no** rest-related code, no `setInterval`, no Settings field for
  rest. Confirm: `grep -n "timer\|setInterval\|rest" app.js` → no matches
  (only unrelated `clearTimeout` in `toast`, `app.js:15`).
- Settings live in `state.settings` (`DEFAULTS`, `app.js:17`;
  `normalizeSettings`, `app.js:19`) and render/persist via `renderSettings`
  (`app.js:458`) and `commitSettings` (`app.js:461`). Settings inputs are in
  `index.html:100-108`.

## Commands you will need

Run from the repo root unless noted.

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Serve app | `python3 -m http.server 8000` (leave running) | serving on :8000 |
| Test deps | `cd test && npm install` | exit 0 |
| Browser | `cd test && npx playwright install chromium` | exit 0 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |

There is no linter/type-checker/bundler in this repo. Do not add one.

## Scope

**In scope** (only these files):
- `app.js` — timer state, `startRest()`/`stopRest()`, interval tick, settings
  field `restSec`, and a "Rest" affordance on each exercise + optional auto-start.
- `index.html` — a `#restBar` timer element in the topbar and a `restSec`
  Settings input.
- `styles.css` — styles for `#restBar` and the per-exercise rest button.
- `test/simulation.mjs` — one new check for the timer.

**Out of scope** (do NOT touch):
- The save/draft schema — the timer stores nothing in `repforge_v1` beyond the
  new `restSec` setting.
- Background/OS notifications and audio — a visible in-app countdown only.
  (`Notification`/`Audio` are a separate plan; do not add them here.)
- Session mode (Plan 013).

## Git workflow

- Branch: `advisor/001-rest-timer`
- One commit per step, present-tense messages (see `git log` for tone, e.g.
  "Add progression + UX + hypertrophy upgrades").
- Do NOT push or open a PR unless the operator asks.

## Steps

### Step 1: Add the `restSec` setting

In `app.js:17`, extend `DEFAULTS` with `restSec:120`. In `normalizeSettings`
(`app.js:19`) add `restSec:normSetting(s?.restSec,DEFAULTS.restSec,0)`.

In `index.html`, add inside the Progression card (after `#hardRir`,
`index.html:105`):

```html
<label class="field">Rest timer (seconds, 0 = off)<input id="restSec" type="number" step="5" min="0" inputmode="numeric"></label>
```

In `renderSettings` (`app.js:458`) add `$("#restSec").value=state.settings.restSec;`.
In `commitSettings` (`app.js:461`) add `restSec` to the object using the same
`num("#restSec",120,0)` pattern already used for `rirHigh`.

**Verify**: `node --check app.js` → exit 0. Load `http://localhost:8000/`,
open Settings, confirm the field shows `120` and persists after reload.

### Step 2: Timer state + control functions

Near the other module-level `let` declarations (`app.js:88`), add:
`let restEnd=0,restTick=null;`

Add functions (place them after `updateSaveMeta`, ~`app.js:210`):

```js
function fmtClock(s){const m=Math.floor(s/60);return `${m}:${String(s%60).padStart(2,"0")}`}
function stopRest(){if(restTick){clearInterval(restTick);restTick=null}restEnd=0;const b=$("#restBar");if(b){b.classList.add("hidden");b.classList.remove("is-done")}}
function tickRest(){const b=$("#restBar");if(!b)return;const left=Math.round((restEnd-Date.now())/1000);
  if(left<=0){b.querySelector(".restbar__time").textContent="0:00";b.classList.add("is-done");clearInterval(restTick);restTick=null;return}
  b.querySelector(".restbar__time").textContent=fmtClock(left)}
function startRest(sec){const s=sec||+state.settings.restSec||0;if(s<=0)return;
  restEnd=Date.now()+s*1000;const b=$("#restBar");if(!b)return;b.classList.remove("hidden","is-done");
  b.querySelector(".restbar__time").textContent=fmtClock(s);clearInterval(restTick);restTick=setInterval(tickRest,250)}
```

**Verify**: `node --check app.js` → exit 0.

### Step 3: `#restBar` markup + wiring

In `index.html` topbar (`index.html:24-30`, inside `.topbar__end`), add before
`#installBtn`:

```html
<button id="restBar" type="button" class="restbar hidden" aria-live="polite" aria-label="Rest timer — tap to stop">
  <span class="restbar__dot" aria-hidden="true"></span><span class="restbar__time">0:00</span>
</button>
```

In `init()` (`app.js:473`), wire tap-to-stop: `$("#restBar").onclick=stopRest;`

### Step 4: Per-exercise "Rest" button + optional auto-start

In `renderWorkout` (`app.js:165-175`), add a rest control in the exercise
header. Append to the `.ex__topend` block (`app.js:168-169`), after the caret
button:

```js
`<button type="button" class="ex__rest" data-rest="1" aria-label="Start rest timer">⏱</button>`
```

In `bindWorkout` (`app.js:183`), wire it:

```js
$$("#workout .ex__rest").forEach(b=>b.onclick=()=>startRest());
```

Optional auto-start on the last set's fields: in `bindWorkout`, when an input
whose `data-k` ends with `_rir` receives input and the setting is on, start the
timer. Extend the existing input handler (`app.js:184`) so it reads:

```js
$$("#workout input").forEach(i=>{i.oninput=()=>{saveDraft();updateSaveMeta();
  if(+state.settings.restSec>0&&i.dataset.k&&i.dataset.k.endsWith("_rir")&&+i.value>=0&&i.value!=="")startRest()};
  i.onfocus=()=>i.select()});
```

(Rationale: RIR is the last field a lifter fills for a set, so it's the natural
"set complete" signal without adding a new button per row.)

**Verify**: `node --check app.js` → exit 0. In the browser: Log tab → tap ⏱ on
an exercise → `#restBar` counts down from `2:00`; tap it → it hides. Fill a
set's kg/reps/RIR → timer auto-starts. Set Rest to `0` in Settings → ⏱ and
auto-start do nothing.

### Step 5: Styles

In `styles.css`, add styles for `.restbar` (compact pill in the topbar,
monospace time, `.is-done` turns ember/`--ember`) and `.ex__rest` (small icon
button matching `.ex__caret`). Match existing tokens — search styles.css for
`.ex__caret` and `.gauge` and mirror their sizing/colors. Keep it small enough
not to crowd the topbar on a 360px-wide screen.

**Verify**: at 360px width the topbar (brand + gauge + restbar + install) does
not overflow or wrap awkwardly.

### Step 6: Simulation check

In `test/simulation.mjs`, inside `main()` near the other Phase 12 checks
(~line 900), add a check that the timer starts. Pattern after existing checks
(use `page.click`, `page.waitForTimeout`, `assert`):

```js
// Rest timer starts and is visible
await nav(page, "log");
await selectDay(page, "Day 1");
await page.click("#workout .ex__rest");
await page.waitForTimeout(120);
assert(
  !(await page.locator("#restBar").getAttribute("class")).includes("hidden"),
  "Rest timer shows on demand",
  "restBar still hidden after tapping ⏱",
  "Log → tap ⏱ on an exercise → rest timer appears"
);
await page.click("#restBar"); // stop it so it doesn't affect later checks
```

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js` after each JS edit.
- Manual: countdown runs, tap-to-stop, auto-start on RIR fill, `0` disables.
- One new simulation check (Step 6). Existing 61 checks must stay green.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] `restSec` persists in `repforge_v1.settings` and survives reload
- [ ] `#restBar` counts down and can be dismissed by tapping it
- [ ] `restSec: 0` disables both the ⏱ button and auto-start
- [ ] `cd test && node simulation.mjs` → `FAILED: 0` (62 checks)
- [ ] Topbar does not overflow at 360px width
- [ ] No files outside the in-scope list changed (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- Current-state excerpts don't match live code (drift since `1d68b68`).
- Implementing the timer requires storing per-set timestamps in `repforge_v1`
  (it must not — timer state is in-memory only, plus the one `restSec` setting).
- Auto-start proves flaky in the simulation because RIR prefill fires `oninput`
  on load — if so, gate auto-start behind an explicit `change` from the user or
  a per-row "done" tap, and note the change; do not weaken the existing 61 checks.

## Maintenance notes

- Background notifications / sound are deliberately deferred (guardrails: don't
  bloat). If added later, gate behind a separate opt-in setting.
- The topbar is getting busy (brand, gauge, restbar, install). If a fourth item
  lands, reconsider layout before squeezing further.
