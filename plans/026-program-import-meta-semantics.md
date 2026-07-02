# Plan 026: Importing a shared program adopts its name but not its lifecycle

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f9da669..HEAD -- app.js test/simulation.mjs docs/design/program-abstraction.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (domain-model correctness)
- **Planned at**: commit `f9da669` (PR #19 branch `cursor/program-abstraction-df5f`), 2026-07-02

## Why this matters

PR #19's export v2 wraps the program as `{ version: 2, meta, exercises }`,
where `meta` is the exporter's full `programMeta`: `id`, `name`, `started`,
`created`, `updated`. On import, `importProgramFile` writes that meta into the
importer's state wholesale. This conflates two domain concepts the feature was
built to separate: the **program as a shared template** (the coach's split,
identified by its name and exercises) and the **program as the lifter's
running instance** (when *this lifter* started it, tracked by `started` and
used to compute the Week chip and adherence context).

Concretely: a coach exports a program they started on 2026-01-05 and a lifter
imports it on 2026-07-02 — the lifter's Program tab now claims they are on
Week 26 of a program they began today, and their `programMeta.id`/`created`
are silently replaced by the coach's. The PR's own tracker row (PROG-19 in
`docs/feature-tracker.csv`) states the intent: "shared templates carry a name
and start **anchor**" — the name should transfer; the recipient's lifecycle
should not be overwritten by the sender's.

The confirm dialog also still says "Your training log and settings are not
touched", which is true, but the user is not told their program name/start
date will change — fix the copy while you are in that function.

## Current state

Relevant files:

- `app.js` — import/export and meta normalization (all excerpts below).
- `docs/design/program-abstraction.md` — the design note this PR added; its
  Export row says `v2 { version: 2, meta, exercises }; array-only import
  forever` but does not yet specify which meta fields import applies. You
  will amend it (docs stay truthful — a stale design doc is worse than none).

`app.js:830-840` — export and import as they exist today:

```javascript
function exportProgram(){const payload={version:2,meta:state.programMeta,exercises:prog.toJSON()};
  download(JSON.stringify(payload,null,2),`repforge_program_${today()}.json`,"application/json")}
async function importProgramFile(e){const f=e.target.files?.[0];if(!f)return;
  try{const parsed=JSON.parse(await f.text()),imp=parseProgramImport(parsed);
    if(!imp?.exercises?.length)throw Error();
    const list=imp.exercises;
    if(!confirm(`Replace your current program with ${list.length} exercises from this file?\n\nYour training log and settings are not touched.`)){e.target.value="";toast("Program import cancelled.");return}
    if(imp.meta){state.programMeta=normalizeProgramMeta(imp.meta,state.log);save()}
    $("#programJson").value=JSON.stringify(list,null,2);saveProgram()}
  catch{toast("That file isn't a RepForge program export.")}
  e.target.value=""}
```

`app.js:192-196` — `normalizeProgramMeta(m, log)` keeps `m.id`, `m.started`,
`m.created`, `m.updated` whenever they are well-formed strings — so passing a
foreign meta through it preserves the foreign lifecycle:

```javascript
function normalizeProgramMeta(m,log=[]){const now=new Date().toISOString(),base=defaultProgramMeta(log);
  if(!m||typeof m!=="object")return base;
  const started=typeof m.started==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(m.started)?m.started:(m.started===null?null:base.started);
  return{id:typeof m.id==="string"&&m.id?m.id:base.id,name:typeof m.name==="string"?m.name.trim():"",started,
    created:typeof m.created==="string"?m.created:base.created,updated:typeof m.updated==="string"?m.updated:now}}
```

`app.js:201-204` — `persistProgramMeta(partial)` already implements exactly the
"apply selected fields, stamp `updated`" behavior you need (reuse it; do not
write a second partial-update path):

```javascript
function persistProgramMeta(partial={}){if(!state.programMeta)state.programMeta=defaultProgramMeta(state.log);
  if(partial.name!==undefined)state.programMeta.name=String(partial.name??"").trim();
  if(partial.started!==undefined){const v=partial.started;state.programMeta.started=v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null}
  state.programMeta.updated=new Date().toISOString();save()}
```

Distinguish from the **full backup** path, which is out of scope: Settings →
Import backup JSON → Replace all goes through `applyState` (`app.js:199-200`)
and correctly restores the device's own meta from its own backup. Only the
Program tab's program-only import (`importProgramFile`) crosses devices/users.

Domain vocabulary to honor (from `CONTEXT.md`, added by this PR):
**Program metadata** = "identity and lifecycle fields for the active program".
The decision this plan encodes: on program-only import, the *identity* the
recipient adopts is the template's `name`; the *lifecycle* (`id`, `started`,
`created`, `updated`) remains the recipient's own.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Static server (terminal 1, repo root) | `python3 -m http.server 8000` | serves on :8000 |
| Simulation (terminal 2) | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |
| Test deps (once, if missing) | `cd test && npm install && npx playwright install chromium` | exit 0 |

At commit `f9da669` the simulation reports `PASSED: 111`.

## Scope

**In scope** (the only files you should modify):
- `app.js` — `importProgramFile` only.
- `test/simulation.mjs` — the existing program export/import checks in the
  Phase 8 area (search for `"Program import applies meta from v2 export"`).
- `docs/design/program-abstraction.md` — one-line amendment to the Export row
  or a short "Import semantics" bullet under it.

**Out of scope** (do NOT touch, even though they look related):
- `exportProgram` — keep exporting the full meta; the exporter's `started` is
  legitimate provenance for the file, the fix is what the *importer* applies.
- `normalizeProgramMeta`, `persistProgramMeta`, `applyState`, `importJson`,
  `mergeLog` — full-backup restore must keep restoring the device's own meta
  verbatim.
- `parseProgramImport` — shape detection is correct as is.

## Git workflow

- Branch off the PR #19 branch: `git checkout cursor/program-abstraction-df5f && git checkout -b <your-branch>`.
- Commit style from `git log`: single-line imperative summaries.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Apply only the template name on import

In `importProgramFile` (`app.js:837`), replace

```javascript
    if(imp.meta){state.programMeta=normalizeProgramMeta(imp.meta,state.log);save()}
```

with

```javascript
    if(typeof imp.meta?.name==="string"&&imp.meta.name.trim())persistProgramMeta({name:imp.meta.name});
```

`persistProgramMeta` trims, stamps `updated`, and saves — the recipient's
`id`, `started`, and `created` are untouched. An import whose meta has no
usable name leaves the current name in place (do not blank it).

**Verify**: `node --check app.js` → exit 0.

### Step 2: Make the confirm dialog honest

In the same function, extend the `confirm` message so the second line reads:

```
Your training log and settings are not touched. The program name comes from the file; your start date stays.
```

(Keep the first line and the `\n\n` separator as they are.)

**Verify**: `node --check app.js` → exit 0.

### Step 3: Update the simulation's import-meta assertions

In `test/simulation.mjs`, find the v2 import block (the code that sets
`progFile.meta = { ...progFile.meta, name: "Imported Template" }` and later
asserts `"Program import applies meta from v2 export"`). Adjust and extend:

1. Before writing the modified file, also plant a foreign lifecycle in it:

```javascript
  progFile.meta = { ...progFile.meta, name: "Imported Template", started: "2020-01-01", id: "foreign-id" };
```

2. Capture the recipient's meta before the import (add above the
   `setInputFiles("#importProgram", …)` call):

```javascript
  const metaBeforeImport = (await getState(page)).programMeta;
```

3. Keep the existing assert that `programMeta.name === "Imported Template"`,
   and add directly after it:

```javascript
  assert(
    stAfter.programMeta.started === metaBeforeImport.started &&
      stAfter.programMeta.id === metaBeforeImport.id,
    "Program import keeps the recipient's start date and id",
    `started ${metaBeforeImport.started} → ${stAfter.programMeta?.started}; id ${metaBeforeImport.id} → ${stAfter.programMeta?.id}`,
    "Export v2 → edit meta.started/id in file → Import program JSON"
  );
```

**Verify**: with the static server running, `cd test && node simulation.mjs`
→ `FAILED: 0`, PASSED ≥ 112, both import-meta checks `✓`.

### Step 4: Amend the design note

In `docs/design/program-abstraction.md`, in the "Decision summary" table,
change the Export row's Choice cell to:

```
v2 `{ version: 2, meta, exercises }`; array-only import forever. Import applies `meta.name` only — the recipient keeps their own `id`/`started`/`created` (a shared file is a template, not the sender's running instance).
```

**Verify**: `git diff docs/design/program-abstraction.md` shows only that cell
changed.

## Test plan

- Updated simulation check: import of a v2 file with a foreign
  `started`/`id` adopts the name but keeps the recipient's lifecycle
  (Step 3). This is the regression test for the finding.
- Existing checks that must keep passing: "Program import applies meta from
  v2 export" (name adoption), "Program import leaves the log untouched",
  "Legacy array-only program import works". Full run ends `FAILED: 0`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` exits 0 with `FAILED: 0` and PASSED ≥ 112
- [ ] `grep -n "normalizeProgramMeta(imp.meta" app.js` returns no matches
- [ ] No files outside `app.js`, `test/simulation.mjs`,
      `docs/design/program-abstraction.md` are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `importProgramFile` in `app.js` does not match the "Current state" excerpt.
- The simulation's v2 import block has been restructured so the assertions
  named in Step 3 no longer exist.
- You find yourself wanting to change `exportProgram`'s payload shape or bump
  the version number — that is a format change, not this fix; report instead.

## Maintenance notes

- If a future "multi-program library" (Phase 3 in the design note) lands,
  import will create a *new* program entry instead of mutating the active one,
  and this whole question dissolves — note the connection in that future plan.
- Reviewer should scrutinize: full-backup Replace-all import
  (`Settings → Import backup JSON → Replace all`) must still restore
  `programMeta` verbatim from the backup — that path is `applyState`, not
  `importProgramFile`, and must be unaffected.
- Deferred deliberately: prompting the user to set a fresh start date right
  after importing a template (nice UX, but a new dialog is out of proportion
  for this fix; the Started field is directly editable on the same card).
