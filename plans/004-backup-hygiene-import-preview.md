# Plan 004: Backup hygiene — last-export stamp, import preview, Web Share

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js index.html styles.css`
> On any change, compare "Current state" excerpts against live code; mismatch
> = STOP. Pay special attention to `exportJson`/`importJson` (`app.js:469-471`).

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (land before Plan 014 IndexedDB)
- **Category**: correctness / dx
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: Privacy maximalist ("Warnings are not durability … import is
  silent about what it's destroying"), minimalist. Report §5 "Next 2 weeks".

## Why this matters

Import is a **silent, nuclear overwrite** of all training data with a single
toast of consent (`importJson`, `app.js:470-471`), and nothing tells the user
when they last backed up. This is the report's highest-severity data-safety
gap. Fixes stay fully local: a "last export" timestamp, a confirm-with-preview
before import replaces state, and Web Share so the exported file actually
lands somewhere the user can find it.

## Current state

- Export/import (`app.js:468-471`):

  ```js
  function exportCsv(){const h=["session","date","day","name","set","load","reps","rir","notes","created"],csv=[h.join(","),...state.log.map(r=>h.map(k=>`"${String(r[k]??"").replaceAll('"','""')}"`).join(","))].join("\n");download(csv,`repforge_log_${today()}.csv`,"text/csv")}
  function exportJson(){download(JSON.stringify(state,null,2),`repforge_backup_${today()}.json`,"application/json")}
  async function importJson(e){const f=e.target.files?.[0];if(!f)return;try{const s=JSON.parse(await f.text());if(!s.program||!Array.isArray(s.log))throw Error();
    applyState(s);clearDraft();day=days()[0]||"Day 1";render();toast("Backup imported.")}catch{toast("That file isn't a valid RepForge backup.")}e.target.value=""}
  ```

  `importJson` calls `applyState` (`app.js:99`) which **replaces** `state`
  entirely — no diff, no confirm, no undo.
- `download()` helper (`app.js:16`) creates an anchor and clicks it — no Web
  Share path.
- Settings "Your data" card (`index.html:109-117`) has Export JSON / Export CSV /
  Import buttons and a `#storageNote` (`app.js:459`) that only warns.
- State is persisted under `KEY="repforge_v1"` (`app.js:1`) via `save()`
  (`app.js:100`). There is no `lastExport` field anywhere:
  `grep -n "lastExport\|navigator.share\|confirm(" app.js` → only unrelated
  `confirm()` calls for delete.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:
- `app.js` — record `state.settings.lastExport` (ISO) on JSON export; show
  "Last backup: …" in the storage note; add an import **preview + confirm**
  before `applyState`; add Web Share for the JSON export when available.
- `index.html` — storage note already exists; no structural change required
  (optionally add a `#lastExport` line — prefer reusing `#storageNote`).
- `test/simulation.mjs` — extend the existing invalid-import check and add a
  valid-import-with-confirm check.

**Out of scope** (do NOT touch):
- Import **merge** by session id (backlog; this plan is preview + confirm only,
  still a replace on confirm).
- IndexedDB (Plan 014).
- CSV format changes (Plan 007).
- Encryption (backlog).

## Git workflow

- Branch: `advisor/004-backup-hygiene`
- Commit per step. Do NOT push/PR unless asked.

## Steps

### Step 1: Record and surface last-export time

Add `lastExport` to settings so it rides along in the same blob. In `DEFAULTS`
(`app.js:17`) add `lastExport:""`. In `normalizeSettings` (`app.js:19`) preserve
it: `lastExport:typeof s?.lastExport==="string"?s.lastExport:""`.

In `exportJson` (`app.js:469`), stamp the time **before** serializing so the
backup records its own creation, and persist:

```js
function exportJson(){state.settings.lastExport=new Date().toISOString();save();
  const text=JSON.stringify(state,null,2),name=`repforge_backup_${today()}.json`;
  shareOrDownload(text,name,"application/json");renderSettings()}
```

In `renderSettings` (`app.js:458-459`), extend `#storageNote`:

```js
const le=state.settings.lastExport;const ago=le?`Last backup: ${le.slice(0,10)}.`:"Last backup: never.";
$("#storageNote").textContent=`${ago} Everything lives in this browser under "${KEY}". There is no cloud copy — export before clearing site data or switching phones.`;
```

**Verify**: `node --check app.js` → 0. Export JSON → storage note updates to
"Last backup: <today>."; reload → note persists.

### Step 2: Web Share when available

Add a helper near `download` (`app.js:16`):

```js
async function shareOrDownload(text,name,type){
  try{if(navigator.canShare){const file=new File([text],name,{type});
    if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"RepForge backup"});return}}}catch{}
  download(text,name,type)}
```

Desktop/unsupported browsers fall back to the existing download. (The
simulation runs headless Chromium where `navigator.canShare` is undefined, so
it exercises the `download` fallback — good.)

**Verify**: `node --check app.js` → 0. In the browser, Export JSON still saves a
file on desktop.

### Step 3: Import preview + confirm

Rewrite `importJson` (`app.js:470-471`) so it parses, **counts what's about to
be replaced**, and requires explicit confirmation before `applyState`:

```js
async function importJson(e){const f=e.target.files?.[0];if(!f){return}
  try{const s=JSON.parse(await f.text());if(!s.program||!Array.isArray(s.log))throw Error();
    const inSessions=new Set(s.log.map(r=>r.session)).size,inSets=s.log.length;
    const curSessions=new Set(state.log.map(r=>r.session)).size,curSets=state.log.length;
    const ok=confirm(`Import will REPLACE all current data.\n\nCurrent: ${curSessions} sessions, ${curSets} sets.\nImporting: ${inSessions} sessions, ${inSets} sets.\n\nThis cannot be undone. Continue?`);
    if(!ok){e.target.value="";toast("Import cancelled.");return}
    applyState(s);clearDraft();day=days()[0]||"Day 1";render();toast(`Imported ${inSessions} sessions.`)}
  catch{toast("That file isn't a valid RepForge backup.")}
  e.target.value=""}
```

**Verify**: `node --check app.js` → 0. Import a valid backup → confirm dialog
shows current vs incoming counts; Cancel keeps current data; OK replaces it.
Import an invalid file → error toast, data untouched.

### Step 4: Simulation checks

The current invalid-import check exists (Phase 11 "Invalid import shows error
toast"). Add a valid-import-with-confirm check. Playwright must accept the
`confirm()` dialog — register a handler:

```js
// near where the import test runs
page.once("dialog", d => d.accept());
```

Add a check that a valid import replaces state (model after existing import
handling in `test/simulation.mjs`; the file uses `page.setInputFiles` or writes
a temp JSON — reuse whatever the existing import check uses;
`grep -n "importJson\|setInputFiles\|Invalid import" test/simulation.mjs`).
Assert the log count equals the imported count after accepting the dialog.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js` after each edit.
- Manual: export stamps date; import confirm shows counts; cancel is a no-op;
  invalid file rejected.
- Simulation: keep the invalid-import check; add a confirm-accept valid-import
  check. Existing 61 stay green.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] Exporting JSON writes `settings.lastExport` and the storage note shows it
- [ ] Importing shows a confirm with current-vs-incoming session/set counts
- [ ] Cancelling import leaves `state.log` unchanged
- [ ] Web Share path is attempted when `navigator.canShare` exists, else download
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] No files outside scope changed; `plans/README.md` status updated

## STOP conditions

- Drift: `exportJson`/`importJson` no longer match the excerpts.
- The simulation's existing import check can't accept a `confirm()` dialog
  without also breaking other dialogs (delete/reset use `confirm` too,
  `app.js:339`,`app.js:486`) — scope the `page.once("dialog", …)` to the import
  step only; if global dialog auto-accept breaks the delete/reset checks, STOP
  and use a scoped handler.

## Maintenance notes

- Import **merge** (by session id) is the natural follow-up (backlog) and should
  be built after IndexedDB (Plan 014) so it's written once.
- Keep `lastExport` in `settings` (not a new top-level key) so existing backups
  remain forward/backward compatible with `normalizeSettings`.
