# Plan 017: Program-only export/import

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

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction (feature)
- **Planned at**: commit `ff67850`, 2026-07-01
- **Source**: Report §5 "Next 2 months" — "**Program-only export/import** —
  Coach-adjacent without platform". Coach persona wants to hand a program to a
  lifter without touching their training log; today the only way is copy/pasting
  the raw-JSON textarea by hand.

## Why this matters

RepForge already has a full-state backup (program + log + settings) and a raw
program-JSON textarea, but no way to move *just a program* between devices or
people as a file. Sharing a split is the one coach-shaped feature the product
guardrails allow (export-shaped, opt-in, no accounts). Users currently
productize this by hand: select-all in the `#programJson` textarea, paste into
a message, and have the recipient paste it back. Two buttons close that gap
with zero data-model change — the file format is exactly `prog.toJSON()`.

## Current state

- `app.js` (~693 lines) is the whole app; no build step, no framework.
  `index.html` holds all markup; `styles.css` all styles.
- The Program tab (`index.html:95-109`) has a visual editor plus an advanced
  raw-JSON section:

  ```html
  <!-- index.html:100-105 -->
  <details class="advanced">
    <summary>Advanced · edit raw JSON</summary>
    <p class="lede">Editing here replaces the whole program. Use the visual editor above for everyday changes.</p>
    <label class="field">Program JSON<textarea id="programJson" rows="14" spellcheck="false"></textarea></label>
    <button id="saveProgram" class="btn btn--forge" type="button">Save JSON</button>
  </details>
  ```

- `saveProgram` (`app.js:595-601`) parses the textarea, preserves exercise IDs
  by name/day match, replaces the program, and never touches the log:

  ```js
  // app.js:595-601
  function saveProgram(){try{const parsed=JSON.parse($("#programJson").value);if(!Array.isArray(parsed))throw Error();
    const byId=new Map(prog.exercises.map(e=>[e.id,e]));
    for(const row of parsed){if(row.id&&byId.has(row.id))continue;
      const match=prog.exercises.find(e=>e.name===row.name&&e.day===row.day)||prog.exercises.find(e=>e.name===row.name);
      if(match&&!parsed.some(r=>r.id===match.id))row.id=match.id}
    prog=new Program(parsed);persistProgram();clearDraft();day=prog.days()[0]||"Day 1";if(migrateLog())save();render();toast("Program saved.")}
    catch{toast("That JSON didn't parse. Check the brackets and commas.")}}
  ```

- File download/import conventions already exist:
  - `download(text,name,type)` helper at `app.js:29`.
  - Full-backup export `exportJson` at `app.js:636-638` (uses
    `shareOrDownload`); full-backup import `importJson` at `app.js:639-647`
    reads a `<input type="file">`.
  - The Settings import control markup pattern (`index.html:136`):
    `<label class="btn btn--steel file">Import backup JSON<input id="importJson" type="file" accept=".json,application/json"></label>`
- Button wiring lives in `init()` (`app.js:649-679`), e.g.
  `$("#saveProgram").onclick=saveProgram;` at `app.js:668`.
- Product guardrails (from `plans/README.md`, non-negotiable): no accounts, no
  cloud, no backend, no sixth nav tab. This feature is file-based only.

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
- `index.html` — export button + import file control on the Program tab.
- `app.js` — `exportProgram()` / `importProgram()` functions and wiring in `init()`.
- `test/simulation.mjs` — checks for round-trip and log preservation.
- `plans/README.md` — status row update.

**Out of scope** (do NOT touch, even though they look related):
- `importJson` / `exportJson` (`app.js:636-647`) — the full-backup path stays
  as-is; Plan 020 changes it separately.
- Program sharing via URL/link, QR codes, or any network transport.
- `sw.js` — no new cached assets are added.

## Git workflow

- Branch: `advisor/017-program-export-import` (or the operator's requested branch).
- Commit per step; message style matches `git log` (short imperative, e.g.
  "Add program-only export/import").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the controls to the Program tab

In `index.html`, inside the `<details class="advanced">` block after the
`#saveProgram` button (`index.html:104`), add:

```html
<div class="btnrow">
  <button id="exportProgram" class="btn btn--steel" type="button">Export program JSON</button>
  <label class="btn btn--steel file">Import program JSON<input id="importProgram" type="file" accept=".json,application/json"></label>
</div>
```

`btnrow` and `file` classes already exist in `styles.css` (used on the
Settings data card) — no CSS changes needed.

**Verify**: reload `http://localhost:8000/` (hard-reload — the service worker
caches `index.html`), open Program → Advanced; both controls render.

### Step 2: Implement export

In `app.js`, next to `exportJson` (`app.js:636`), add:

```js
function exportProgram(){download(JSON.stringify(prog.toJSON(),null,2),`repforge_program_${today()}.json`,"application/json")}
```

Wire it in `init()` beside `app.js:673`:
`$("#exportProgram").onclick=exportProgram;`

**Verify**: `node --check app.js` → exit 0. In the browser, click "Export
program JSON" → a `repforge_program_YYYY-MM-DD.json` file downloads containing
a JSON array of exercise objects with `id,day,order,name,sets,min,max,primary,secondary,notes`.

### Step 3: Implement import

In `app.js`, next to `importJson` (`app.js:639`), add an import handler that
accepts **either** a program-only array **or** a full backup object (pulling
its `.program`), confirms, and routes through the same ID-preserving logic as
`saveProgram`:

```js
async function importProgramFile(e){const f=e.target.files?.[0];if(!f)return;
  try{const parsed=JSON.parse(await f.text());
    const list=Array.isArray(parsed)?parsed:(Array.isArray(parsed?.program)?parsed.program:null);
    if(!list||!list.length)throw Error();
    if(!confirm(`Replace your current program with ${list.length} exercises from this file?\n\nYour training log and settings are not touched.`)){e.target.value="";toast("Program import cancelled.");return}
    $("#programJson").value=JSON.stringify(list,null,2);saveProgram()}
  catch{toast("That file isn't a RepForge program export.")}
  e.target.value=""}
```

Routing through `$("#programJson")` + `saveProgram()` deliberately reuses the
existing parse/ID-preservation/render path instead of duplicating it. Wire in
`init()`: `$("#importProgram").onchange=importProgramFile;`

**Verify**: `node --check app.js` → exit 0. Manually: export the program, edit
one exercise name in the file, import it → toast "Program saved.", the name
changes, History still shows all sessions.

### Step 4: Simulation checks

In `test/simulation.mjs`, add a phase after the existing CSV-export phase
(after ~line 696). Follow the existing download/import patterns
(`page.waitForEvent("download")` at line 601; `page.setInputFiles` at line
628; the dialog auto-accept handler at line 158 accepts the confirm):

```js
console.log("\nPhase: program-only export/import");
await nav(page, "program");
const progPath = join(tmpDir, "program.json");
const [progDl] = await Promise.all([
  page.waitForEvent("download"),
  page.click("#exportProgram"),
]);
await progDl.saveAs(progPath);
const progFile = JSON.parse(readFileSync(progPath, "utf8"));
assert(Array.isArray(progFile) && progFile.length > 0 && progFile[0].id && progFile[0].day,
  "Program export is an exercise array",
  `Got: ${JSON.stringify(progFile).slice(0, 80)}`,
  "Program → Advanced → Export program JSON");
const logBefore = (await getState(page)).log.length;
progFile[0].name = "IMPORTED_RENAME";
writeFileSync(progPath, JSON.stringify(progFile));
await page.setInputFiles("#importProgram", progPath);
await page.waitForTimeout(250);
const stAfter = await getState(page);
assert(stAfter.program.some(x => x.name === "IMPORTED_RENAME"),
  "Program import applies the file", "Renamed exercise not found",
  "Export program → rename in file → Import program JSON");
assert(stAfter.log.length === logBefore,
  "Program import leaves the log untouched",
  `log ${logBefore} → ${stAfter.log.length}`,
  "Import program JSON → History unchanged");
```

Note: the `#programJson` textarea must not be focused when this runs (the
editor skips refreshing it while focused, `app.js:520`) — navigating to the
Program tab fresh via `nav` is sufficient.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`, with the 3 new
checks passing.

## Test plan

- `node --check app.js` after each step.
- Simulation: round-trip export→modify→import, log preservation (Step 4).
- Manual: import a full backup file through the *program* importer → only the
  program is applied; import a garbage file → error toast, state unchanged.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`, including 3 new program
      export/import checks
- [ ] `grep -c "exportProgram\|importProgram" app.js index.html` ≥ 4 (controls + wiring)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row for 017 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `saveProgram` no longer matches the excerpt in "Current state" (drift).
- The dialog auto-accept in the simulation does not fire for the new confirm
  (would indicate the harness changed) — do not switch the confirm to a custom
  dialog to work around it.
- You find yourself modifying `importJson`/`exportJson` — that's Plan 020's
  territory.

## Maintenance notes

- Plan 020 (import merge) redesigns the *full-backup* import dialog; this
  program-only path stays confirm-based and should not be merged into it.
- The "import a full backup, take only its program" branch is intentional
  ergonomics — a reviewer should check it is covered by a manual test at least.
- Future "beginner program variant" (backlog) would ship as one of these
  program JSON files; keep the format stable.
