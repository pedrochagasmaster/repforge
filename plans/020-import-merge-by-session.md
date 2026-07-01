# Plan 020: Import merge by session id

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ff67850..HEAD -- app.js index.html styles.css test/simulation.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the data-safety path; a merge bug can duplicate or drop history)
- **Depends on**: none (Plans 004 backup hygiene and 014 IndexedDB are DONE,
  which is what the backlog was waiting for)
- **Category**: direction (feature) / correctness
- **Planned at**: commit `ff67850`, 2026-07-01
- **Source**: Report §5 "Next 6 months" — "**Import merge** by session ID |
  Data safety"; `plans/README.md` backlog ("Land after 004 + 014 so merge is
  written once against IndexedDB" — both landed). Privacy-maximalist persona.

## Why this matters

Import is currently nuclear: it REPLACES all data after one confirm. The
real-world flow it fails is *two devices*: a lifter logs on a phone and a
tablet, exports from one, imports on the other — and silently destroys
whichever sessions only existed on the target. Sessions already carry
globally unique ids (`${date}_${day}_${uid()}`), so a safe union is cheap:
add sessions from the file that the device doesn't have, keep everything
else. Replace stays available for genuine restores.

## Current state

- Import lives in `importJson` (`app.js:639-647`):

  ```js
  // app.js:639-647
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

- Session ids are unique per save: `` `${date}_${day}_${uid()}` `` in
  `saveWorkout` (`app.js:346`); `uid()` is `crypto.randomUUID()` with a
  fallback (`app.js:16`).
- `applyState(s)` (`app.js:151`) normalizes settings, rebuilds the `Program`,
  runs `migrateLog()`, and persists — the replace path keeps using it.
- Persistence is dual: `persist()` writes `localStorage` + IndexedDB
  (`app.js:153-155`). Merge only needs to mutate `state.log` and call
  `save()` — no storage-layer work.
- An existing custom overlay pattern to copy: the glossary popover —
  markup `index.html:154-158` (`<div id="glossary" class="glossary hidden"
  role="dialog" ...>`), show/hide via the `hidden` class, close wiring in
  `init()` (`app.js:656-658`), styles under `.glossary` in `styles.css`.
- The Playwright harness auto-accepts native dialogs (`test/simulation.mjs:158-160`)
  and drives import via `page.setInputFiles("#importJson", path)` (line 628).
  Existing import checks at lines ~628-659 assume replace semantics — they
  will exercise the new chooser.
- Import control markup: `index.html:136`.

## Design decision (already made — do not re-litigate)

Replace the single native `confirm` with a small in-app chooser dialog
(pattern: glossary popover) offering three actions with the session-count
preview that Plan 004 introduced:

- **Merge** — union by session id: append log rows of sessions the device
  doesn't have; existing sessions, program, and settings unchanged.
- **Replace all** — the current behavior (`applyState`), same warning text.
- **Cancel** — no-op.

If a session id exists on both sides, the device's copy wins (skip the file's
rows) — ids are write-once, so identical ids mean identical sessions in
practice; do not attempt row-level diffing.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` (repo root, keep running) | serving on :8000 |
| Simulation deps (once) | `cd test && npm install && npx playwright install chromium` | exit 0 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` (85+ passed) |

There is no linter, type-checker, or bundler in this repo — do not look for one.

## Scope

**In scope** (the only files you should modify):
- `app.js` — chooser dialog logic; merge implementation; `importJson` rework.
- `index.html` — chooser dialog markup.
- `styles.css` — chooser styles (reuse glossary/card idioms).
- `test/simulation.mjs` — update existing import checks to click through the
  chooser; add merge checks.
- `plans/README.md` — status row update.

**Out of scope** (do NOT touch, even though they look related):
- Program-only import (Plan 017) — different control, stays confirm-based.
- Row-level or field-level merge/conflict resolution — session id is the only
  merge key.
- Settings/program merging — merge imports log sessions ONLY.
- The export path (`exportJson`) and `sw.js`.

## Git workflow

- Branch: `advisor/020-import-merge` (or the operator's requested branch).
- Commit per step; message style matches `git log` (short imperative).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Chooser dialog markup + styles

In `index.html`, next to the glossary dialog (`index.html:154-158`), add:

```html
<div id="importChoice" class="importchoice hidden" role="dialog" aria-modal="true" aria-label="Import backup">
  <p class="importchoice__title">Import backup</p>
  <p class="importchoice__body" id="importChoiceBody"></p>
  <div class="btnrow">
    <button type="button" id="importMerge" class="btn btn--forge">Merge</button>
    <button type="button" id="importReplace" class="btn btn--danger">Replace all</button>
    <button type="button" id="importCancel" class="btn btn--steel">Cancel</button>
  </div>
</div>
```

In `styles.css`, add `.importchoice` modeled on `.glossary` (fixed position,
card background, border, z-index above content) — center it as a small modal
(`position:fixed;inset:auto 16px 96px 16px` or centered with transform;
match the app's card look, reuse existing custom properties only).

**Verify**: hard-reload; in DevTools run
`document.querySelector("#importChoice").classList.remove("hidden")` → the
dialog renders with three buttons; add the class back.

### Step 2: Rework `importJson` around the chooser

Replace the `confirm` block in `importJson` (`app.js:643-645`) with the
chooser. Keep validation and the catch exactly as-is. Shape:

```js
async function importJson(e){const f=e.target.files?.[0];if(!f)return;
  try{const s=JSON.parse(await f.text());if(!s.program||!Array.isArray(s.log))throw Error();
    const inSessions=new Set(s.log.map(r=>r.session)).size,inSets=s.log.length;
    const curSessions=new Set(state.log.map(r=>r.session)).size,curSets=state.log.length;
    const have=new Set(state.log.map(r=>r.session));
    const newSessions=new Set(s.log.filter(r=>!have.has(r.session)).map(r=>r.session)).size;
    openImportChoice({s,inSessions,inSets,curSessions,curSets,newSessions})}
  catch{toast("That file isn't a valid RepForge backup.")}
  e.target.value=""}
```

Add the dialog controller next to it:

```js
function openImportChoice(ctx){const d=$("#importChoice");
  $("#importChoiceBody").textContent=
    `This device: ${ctx.curSessions} sessions, ${ctx.curSets} sets.\n`+
    `File: ${ctx.inSessions} sessions, ${ctx.inSets} sets (${ctx.newSessions} new to this device).\n\n`+
    `Merge adds the ${ctx.newSessions} new sessions and keeps everything else. `+
    `Replace all overwrites program, settings, and log — this cannot be undone.`;
  d.classList.remove("hidden");
  const close=()=>{d.classList.add("hidden")};
  $("#importCancel").onclick=()=>{close();toast("Import cancelled.")};
  $("#importReplace").onclick=()=>{close();applyState(ctx.s);clearDraft();day=days()[0]||"Day 1";render();toast(`Imported ${ctx.inSessions} sessions.`)};
  $("#importMerge").onclick=()=>{close();mergeLog(ctx.s)};}
```

(`white-space:pre-line` on `.importchoice__body` in CSS makes the `\n`s work.)

**Verify**: `node --check app.js` → exit 0. Manually: import a valid backup →
the chooser shows both counts and the new-session count; Cancel leaves state
untouched; Replace all behaves exactly like the old import.

### Step 3: Implement `mergeLog`

```js
function mergeLog(s){const have=new Set(state.log.map(r=>r.session));
  const rows=s.log.filter(r=>r&&r.session&&!have.has(r.session));
  const added=new Set(rows.map(r=>r.session)).size;
  if(!added){toast("Nothing to merge — this device already has every session in the file.");return}
  state.log.push(...rows);
  migrateLog();save();
  render();toast(`Merged ${added} new session${added===1?"":"s"}.`)}
```

Notes: `migrateLog()` (`app.js:144-148`) re-links `exerciseId` and coerces
numeric fields on the incoming rows — running it is what keeps merged rows
consistent with locally-created ones; `save()` must run regardless of its
return value. Program and settings are deliberately untouched.

**Verify**: `node --check app.js` → exit 0. Manually: export a backup, log one
more session on the device, re-import the old file → Merge reports "Nothing to
merge"; craft a file with one extra session (edit a session id in the file) →
Merge adds exactly that session, History shows both.

### Step 4: Update + extend simulation

The existing import checks (`test/simulation.mjs:628-659`) relied on the
native confirm auto-accept. Update them to click through the chooser:
after each `page.setInputFiles("#importJson", ...)`, add

```js
await page.waitForSelector("#importChoice:not(.hidden)");
await page.click("#importReplace");
```

before the existing `waitForTimeout`/assertions (they test replace semantics —
keep them meaning that).

Then add merge checks in the same phase:

```js
// Merge: file with one session this device doesn't have
const mergeSrc = JSON.parse(readFileSync(jsonPath, "utf8"));
const donor = mergeSrc.log.filter(r => r.session === mergeSrc.log[0].session)
  .map(r => ({ ...r, session: "merge_test_session_1" }));
writeFileSync(join(tmpDir, "merge.json"),
  JSON.stringify({ ...mergeSrc, log: [...mergeSrc.log, ...donor] }));
const beforeMerge = (await getState(page)).log.length;
await page.setInputFiles("#importJson", join(tmpDir, "merge.json"));
await page.waitForSelector("#importChoice:not(.hidden)");
await page.click("#importMerge");
await page.waitForTimeout(200);
const afterMerge = await getState(page);
assert(afterMerge.log.length === beforeMerge + donor.length &&
  afterMerge.log.some(r => r.session === "merge_test_session_1"),
  "Merge adds only the new session's rows",
  `rows ${beforeMerge} → ${afterMerge.log.length}, expected +${donor.length}`,
  "Import file with 1 new session → Merge");
```

Mind the ordering: this snippet assumes the device state matches `jsonPath`'s
content at that point in the run — place it immediately after the replace
checks so it does, or re-derive `beforeMerge` accordingly.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`; the pre-existing
import assertions still pass (now via the chooser) and the merge check passes.

## Test plan

- `node --check app.js` after each step.
- Simulation (Step 4): replace path unchanged in effect; merge adds exactly
  the new session; "nothing to merge" path exercised manually.
- Manual: invalid file still toasts the validation error without opening the
  chooser; Cancel via the button; chooser text shows correct counts; merged
  rows appear on Stats/History without reload (render() call).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`, including the merge check
      and the updated replace checks
- [ ] `grep -c "mergeLog\|importChoice" app.js index.html` ≥ 5
- [ ] `grep -n "confirm(" app.js` no longer shows the import-REPLACE confirm
      (other confirms — delete session, delete log, program editor — remain)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row for 020 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `importJson` doesn't match the "Current state" excerpt (drift — Plan 004's
  shape is assumed).
- Existing simulation import checks fail for a reason other than the missing
  chooser click-through — that means replace semantics regressed; fix before
  layering merge on top, and stop if the cause isn't in your diff.
- You find yourself merging program or settings — explicitly out of scope.

## Maintenance notes

- Merge trusts session-id uniqueness; if a future feature ever rewrites
  session ids (e.g. dedup tooling), this union logic must be revisited.
- The chooser is the first in-app modal replacing a native dialog; if more
  follow (e.g. Plan 017's confirm), extract a shared helper then — not now.
- Reviewer focus: the `e.target.value=""` reset still runs on every path
  (validation failure and chooser paths) so re-selecting the same file works.
