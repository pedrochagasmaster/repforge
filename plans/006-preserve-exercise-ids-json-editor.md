# Plan 006: Preserve exercise IDs through the raw-JSON program editor

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js`
> On any change to `app.js`, compare "Current state" excerpts against live
> code; mismatch = STOP.

## Status

- **Priority**: P1 (foundational — 007 and 013 depend on stable IDs)
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: correctness (bug)
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: **Audit finding.** Grounds the report's power-user, spreadsheet,
  and minimalist complaints that "renaming an exercise breaks history
  continuity" and "Program JSON strips IDs … history follows until it doesn't."

## Why this matters — this is a real data-integrity bug

The visual editor keys history to a stable `exerciseId` and everything is fine.
But the **raw-JSON editor path silently regenerates every exercise ID**, which
severs the ID linkage between the program and all logged history:

1. `renderProgramEditor` writes the textarea **without** ids
   (`app.js:379`):

   ```js
   if(document.activeElement!==$("#programJson"))$("#programJson").value=JSON.stringify(prog.toJSON().map(({id,...x})=>x),null,2);
   ```

2. `saveProgram` rebuilds the program from that id-less JSON
   (`app.js:454`):

   ```js
   function saveProgram(){try{const parsed=JSON.parse($("#programJson").value);if(!Array.isArray(parsed))throw Error();
     prog=new Program(parsed);persistProgram();clearDraft();day=prog.days()[0]||"Day 1";if(migrateLog())save();render();toast("Program saved.")}
   ```

3. `new Program(parsed)` → `new Exercise(e)` assigns a fresh id when none is
   present (`app.js:45`): `this.id=d.id||uid();`.

Result: after **any** raw-JSON save (even a no-op round-trip), every exercise
gets a brand-new id. All existing `state.log` rows still carry the **old**
`exerciseId`, so `matchLift` (`app.js:103`) can no longer match by id and falls
back to name. `migrateLog` (`app.js:92-96`) then backfills ids by name+day —
which papers over it **only while names are unchanged**. Rename an exercise in
the same JSON edit and its history orphans. The report calls this out from
three personas; this is the root cause.

## Current state (exact locations)

- `app.js:45` — `this.id=d.id||uid();` (Exercise assigns new id if absent).
- `app.js:379` — textarea serialization strips `id` via `.map(({id,...x})=>x)`.
- `app.js:454-456` — `saveProgram` parses id-less JSON into `new Program`.
- `app.js:92-96` — `migrateLog` backfills `exerciseId` by name+day, then name.
- `app.js:103` — `matchLift` prefers `exerciseId` when both sides have it.
- Confirm the bug is reproducible before changing anything (see Step 0).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope** (only `app.js` + the test):
- `app.js` — keep ids in the JSON editor **and** make `saveProgram` carry ids
  forward by matching parsed rows to existing exercises when ids are absent
  (so hand-authored JSON without ids still preserves history).
- `test/simulation.mjs` — a regression check: JSON round-trip preserves ids and
  history stays linked across a rename.

**Out of scope** (do NOT touch):
- The visual editor (already id-stable).
- CSV export (Plan 007 surfaces `exercise_id` separately).
- Removing `migrateLog`'s name fallback — keep it as a safety net for old logs.

## Git workflow

- Branch: `advisor/006-preserve-exercise-ids`
- Commit per step. Do NOT push/PR unless asked.

## Steps

### Step 0: Reproduce the bug (record evidence before fixing)

In the browser at `http://localhost:8000/`: log a session for a Day 1 exercise,
then Program → Advanced → Save JSON (no edits). Inspect
`JSON.parse(localStorage.repforge_v1)`: the program exercise's `id` changed, and
the logged rows still hold the old `exerciseId`. Confirm `matchLift` now relies
on the name fallback. This is the STOP-condition baseline: after the fix, the id
must be stable.

### Step 1: Stop stripping ids in the editor

Change `app.js:379` to keep ids:

```js
if(document.activeElement!==$("#programJson"))$("#programJson").value=JSON.stringify(prog.toJSON(),null,2);
```

(Ids become visible; that's intentional and is what power users asked for.)

### Step 2: Carry ids forward on save even if JSON omits them

Hand-authored JSON may still lack ids. In `saveProgram` (`app.js:454`), before
constructing the new `Program`, backfill ids by matching name+day (then name)
against the **current** program, mirroring `migrateLog`'s matching:

```js
function saveProgram(){try{const parsed=JSON.parse($("#programJson").value);if(!Array.isArray(parsed))throw Error();
  const byId=new Map(prog.exercises.map(e=>[e.id,e]));
  for(const row of parsed){if(row.id&&byId.has(row.id))continue;
    const match=prog.exercises.find(e=>e.name===row.name&&e.day===row.day)||prog.exercises.find(e=>e.name===row.name);
    if(match&&!parsed.some(r=>r.id===match.id))row.id=match.id}
  prog=new Program(parsed);persistProgram();clearDraft();day=prog.days()[0]||"Day 1";if(migrateLog())save();render();toast("Program saved.")}
  catch{toast("That JSON didn't parse. Check the brackets and commas.")}}
```

Notes: the `!parsed.some(r=>r.id===match.id)` guard avoids assigning the same id
to two rows. `new Program` already de-dupes any colliding ids (`app.js:61`).

**Verify**: `node --check app.js` → 0. Re-run Step 0's repro: after Save JSON
(no edits), the exercise `id` is now **unchanged** and logged rows still match by
id.

### Step 3: Regression check in the simulation

In `test/simulation.mjs`, add a check that a JSON round-trip preserves ids. Use
the program editor selectors (`grep -n "programJson\|saveProgram\|Advanced" test/simulation.mjs`
for existing patterns; if none, drive via `page.fill("#programJson", …)` and
`page.click("#saveProgram")`):

```js
await nav(page, "program");
// capture current program JSON (with ids) and the first exercise id
const before = await page.evaluate(() => JSON.parse(document.querySelector("#programJson").value));
const firstId = before[0].id;
assert(!!firstId, "Program JSON exposes exercise ids", "No id field in program JSON", "Program → Advanced → JSON shows id");
// round-trip save, no edits
await page.evaluate(() => document.querySelector("details.advanced")?.setAttribute("open",""));
await page.click("#saveProgram");
await page.waitForTimeout(120);
const after = await page.evaluate(() => JSON.parse(document.querySelector("#programJson").value));
assert(after[0].id === firstId, "JSON round-trip preserves exercise ids",
  `id changed ${firstId} → ${after[0].id}`, "Program → Save JSON with no edits → ids unchanged");
```

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js` after each edit.
- Manual: Step 0 repro now shows stable id post-fix; renaming an exercise in the
  JSON editor keeps its history (top-load chart still shows old sessions).
- Simulation: new id-stability check; existing 61 stay green.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] `#programJson` textarea includes `id` for every exercise
- [ ] Saving unedited JSON does NOT change any exercise `id`
- [ ] Editing only a `name` in JSON keeps that exercise's logged history linked
- [ ] Hand-authored JSON without ids still adopts the matching existing id
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] Only `app.js` + test changed; `plans/README.md` status updated

## STOP conditions

- Drift: the excerpts at `app.js:45,379,454` don't match live code.
- If exposing ids in the textarea breaks the existing program tests because they
  assert the textarea has no `id` field, that assertion encodes the bug — update
  the test to expect ids and note it; do not revert to stripping ids.

## Maintenance notes

- With ids stable, Plan 007 can safely add `exercise_id` to CSV export, and Plan
  013 (session mode) can key progress off ids.
- Keep `migrateLog`'s name fallback for backups created before this fix.
