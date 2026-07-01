# Plan 009: Bodyweight per session

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js index.html`
> On any change, compare "Current state" excerpts against live code; mismatch =
> STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 008 (unit toggle) if you want bodyweight in the display unit;
  otherwise none (store kg).
- **Category**: direction (feature)
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: Spreadsheet maximalist ("No bodyweight field … a one-column
  addition that signals you understand long-term tracking"). Report §5
  "Next 6 months".

## Why this matters

Bodyweight is half the progressive-overload picture for relative strength and
cut/bulk phases, and it's a single optional field. It's a low-risk win that
flows straight into the CSV/JSON export the spreadsheet persona already uses.

## Current state

- A session is a set of log rows sharing a `session` id, written in
  `saveWorkout` (`app.js:212-221`). Rows carry `session,date,day,name,
  exerciseId,set,load,reps,rir,notes,created,primary,secondary` (`app.js:217`).
- The Log form has a Date picker (`index.html:39`) and a Session notes textarea
  (`index.html:46-48`); `saveWorkout` reads `$("#notes").value` (`app.js:213`).
- There is no per-session metadata store separate from set rows and no
  bodyweight anywhere: `grep -n "bodyweight\|bw\b" app.js index.html` → none.
- CSV export (`app.js:468`) and JSON export (`app.js:469`) serialize log rows /
  full state respectively.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:
- `index.html` — a bodyweight input on the Log form beside notes.
- `app.js` — read/store `bodyweight` on each saved row of a session (simplest,
  keeps the flat-log model), prefill from the last session's bodyweight, and
  include it in CSV export.
- `test/simulation.mjs` — a check that bodyweight persists and prefills.

**Out of scope** (do NOT touch):
- A separate sessions table / schema refactor (the flat log is the model;
  store `bodyweight` on rows like `notes` already is).
- Relative-strength charts / bodyweight trend (backlog).
- Unit handling beyond reusing Plan 008's helpers if present (if 008 has not
  landed, store and show bodyweight in kg).

## Git workflow

- Branch: `advisor/009-bodyweight`
- Commit per step. Do NOT push/PR unless asked.

## Steps

### Step 1: Bodyweight input on the Log form

In `index.html`, add near the notes field (after `index.html:48`):

```html
<label class="field">Bodyweight (optional)<input id="bodyweight" type="number" step="any" min="0" inputmode="decimal" placeholder="kg"></label>
```

If Plan 008 landed, set the placeholder via JS to `unitLabel()` and convert on
save/prefill with `fromDisplay`/`toDisplay`.

### Step 2: Store on save + prefill from last session

In `saveWorkout` (`app.js:213`), read bodyweight once per save:

```js
const bw=posNum($("#bodyweight").value);
```

Add `bodyweight:bw` to each pushed row object (`app.js:217`). (Denormalized onto
rows keeps the flat log; every row in a session shares the value.)

Prefill: after the log renders, set the input to the most recent session's
bodyweight. Add a helper and call it in `renderWorkout` (end, near `app.js:178`)
or `init`:

```js
function lastBodyweight(){const rows=state.log.filter(r=>+r.bodyweight>0);
  if(!rows.length)return "";const latest=rows.sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0];
  return fmt(latest.bodyweight)}
```

Set `$("#bodyweight").value=lastBodyweight();` where the date is set
(`init`, `app.js:477`) and after a successful save the field can retain the
value (do not clear it in `saveWorkout` — it clears `#notes` at `app.js:219`;
leave bodyweight so consecutive days keep it).

**Verify**: `node --check app.js` → 0. Log a session with bodyweight `80`;
reload → the field prefills `80`; the saved rows carry `bodyweight:80`.

### Step 3: Add bodyweight to CSV export

If Plan 007 landed, add a column `["bodyweight",r=>r.bodyweight??""]` to its
`cols` array. If 007 has NOT landed, append `"bodyweight"` to the header array
in `exportCsv` (`app.js:468`).

**Verify**: exported CSV includes a `bodyweight` column.

### Step 4: Simulation check

In `test/simulation.mjs`:

```js
await nav(page, "log");
await selectDay(page, "Day 1");
await page.fill("#bodyweight", "80");
const meta = await getExerciseMeta(page, "Day 1");
await fillExerciseSets(page, meta[0].id, meta[0].sets, 100, 6, 1);
await saveWorkout(page);
const st = await getState(page);
assert(
  st.log.some(r => +r.bodyweight === 80),
  "Bodyweight persists on saved rows",
  "No saved row carries bodyweight 80",
  "Log → set bodyweight → Save → rows carry bodyweight"
);
await nav(page, "log");
await selectDay(page, "Day 1");
assert(
  (await page.inputValue("#bodyweight")) === "80",
  "Bodyweight prefills from last session",
  `bodyweight input = ${await page.inputValue("#bodyweight")}`,
  "Log → reopen → bodyweight prefilled"
);
```

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js`.
- Manual: enter/save/reload prefill; empty bodyweight is fine (stored 0/omitted).
- Simulation: persist + prefill checks; existing 61 stay green.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] Bodyweight input on Log; optional (empty saves fine)
- [ ] Saved session rows carry `bodyweight`; it prefills from the last session
- [ ] CSV export includes a `bodyweight` column
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] No files outside scope changed; `plans/README.md` status updated

## STOP conditions

- Drift: `saveWorkout` doesn't match the excerpt.
- If denormalizing bodyweight onto every row is judged unacceptable and a
  separate session-metadata store is required, STOP and escalate — that's a
  schema change beyond this plan's scope.

## Maintenance notes

- Bodyweight trend chart and relative-strength metrics are backlog and build on
  this field.
- Denormalization matches how `notes`/`day`/`date` already repeat per row; keep
  it consistent.
