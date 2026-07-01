# Plan 020: Import merge by session id (non-destructive restore)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ff67850..HEAD -- app.js index.html test/simulation.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (plans 004 backup preview + 014 IndexedDB DONE)
- **Category**: direction
- **Planned at**: commit `ff67850`, 2026-07-01
- **Source**: Privacy maximalist persona §346; report §5 "Next 6 months"

## Why this matters

Import still **replaces** all local data after a single confirm. Users who export
incrementally and import an older file on a new phone lose newer sessions. Merge
by `session` id lets backups combine safely: new sessions add, overlapping ids
resolve with explicit policy (keep newer `created` timestamp by default).

## Current state

Nuclear import with preview counts (plan 004) but no merge path:

```639:647:app.js
async function importJson(e){const f=e.target.files?.[0];if(!f)return;
  try{const s=JSON.parse(await f.text());if(!s.program||!Array.isArray(s.log))throw Error();
    const inSessions=new Set(s.log.map(r=>r.session)).size,inSets=s.log.length;
    const curSessions=new Set(state.log.map(r=>r.session)).size,curSets=state.log.length;
    const ok=confirm(`Import will REPLACE all current data.\n\nCurrent: ${curSessions} sessions, ${curSets} sets.\nImporting: ${inSessions} sessions, ${inSets} sets.\n\nThis cannot be undone. Continue?`);
    if(!ok){e.target.value="";toast("Import cancelled.");return}
    applyState(s);clearDraft();day=days()[0]||"Day 1";render();toast(`Imported ${inSessions} sessions.`)}
  catch{toast("That file isn't a valid RepForge backup.")}
  e.target.value=""}
```

State application centralizes in `applyState` (`app.js:151`).

Persistence uses localStorage mirror + IndexedDB (`persist`, `boot` at `680-691`).

Settings track `lastExport` (`renderSettings` `605-606`) — unrelated to merge.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:

- `app.js` — `mergeState(current, incoming)` pure function; import flow offers
  **Replace** vs **Merge** after preview; merge policy documented in confirm text
- `index.html` — optional: replace `confirm()` with lightweight modal (only if
  confirm strings exceed UX needs — prefer native confirm for v1)
- `test/simulation.mjs` — merge adds sessions, replace still works, collision policy

**Out of scope**:

- Program merge (conflicting `state.program`) — on merge, **keep current program**,
  only merge `log` arrays unless operator expands scope
- Encrypted backup (backlog)
- Three-way diff UI

## Git workflow

- Branch: `cursor/import-merge-fb30`
- Do NOT push unless instructed

## Steps

### Step 1: `mergeLogs(currentLog, incomingLog)` pure function

Rules (document in function comment):

1. Index both logs by `session` id
2. Sessions only in incoming → append all rows
3. Sessions in both → keep side with later max `created` ISO timestamp on any row;
   drop the other side's rows for that session
4. After merge, sort is not required globally; existing render sorts as needed
5. Run `migrateLog()` on result

Return `{ merged, added, updated, skipped }` stats for toast.

**Verify**: `node --check app.js` → exit 0. Quick node REPL or simulation
evaluate with fixture objects.

### Step 2: Import UX — Replace vs Merge

After parsing backup, show preview (existing counts). Replace `confirm` with
**two-step** or single confirm with explicit choice:

Recommended v1 (minimal DOM):

```
Import backup: 12 sessions, 84 sets.
Current device: 8 sessions, 52 sets.

OK = Merge (add new sessions; newer wins on same session id)
Cancel = abort

Hold Shift+OK? Too hidden. Better: use `confirm` for merge question, second
confirm for replace — or add two buttons in Settings card (small HTML change).
```

**Preferred**: Add two buttons in Settings replacing single file input handler:

- "Import merge" — calls merge path
- "Import replace" — existing nuclear path with scary confirm

Keep one hidden file input triggered by both.

**Verify**: Manual — device A 2 sessions, import backup with 1 new + 1 overlapping →
3 sessions total with overlap resolved.

### Step 3: Settings merge path

On merge success:

- `state.log = mergeLogs(state.log, s.log).merged`
- Keep `state.program` and `state.settings` from **current device** (document this)
- Optionally merge settings: **don't** for v1
- `save(); clearDraft(); render(); toast('Merged: +2 sessions, 1 updated')`

**Verify**: After merge, `persist()` writes to IDB + localStorage; reload preserves.

### Step 4: Simulation

1. Seed state with session `s1`
2. Import JSON with `s1` (older created) + `s2` (new) via merge API exposed to
   `page.evaluate` or Settings UI automation
3. Assert session count and row counts

Add replace regression: existing import replace test still passes.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`

## Test plan

- Merge adds only-new sessions
- Collision: newer `created` wins
- Merge does not wipe program edits on device
- Invalid backup still rejected
- Empty incoming log merge → unchanged

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] Replace import path still available with explicit warning
- [ ] Merge never silently drops unique incoming sessions
- [ ] `plans/README.md` row 020 updated

## STOP conditions

Stop if:

- Merge requires program reconciliation beyond log-only — report for scope expansion
- Session ids are not stable in exported backups (they are `{date}_{day}_{uid()}` — verify)

## Maintenance notes

- Warmup `kind` and `performedName` (plans 018/017) must survive merge
- Future: merge program by exercise id is a separate plan
