# Plan 024: Mesocycle blocks

> **DRAFT — pending design review of `docs/design/mesocycle-blocks.md`**
>
> **Do not execute this plan until a human has reviewed the design document
> and resolved open questions marked "Blocks build? = Yes" in that doc.**
>
> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ff67850..HEAD -- app.js index.html`
> On any change, compare "Current state" excerpts against live code; reconcile
> with `docs/design/mesocycle-blocks.md` before proceeding.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED (data-model touch across Stats/History/export)
- **Depends on**: Plan 023 design review (this plan); Plan 018 merge and Plan
  019 warmup may land first — composition notes in the design doc still apply
- **Category**: direction (feature)
- **Planned at**: commit `ff67850`, 2026-07-02 (drafted from Plan 023 spike)
- **Source**: `docs/design/mesocycle-blocks.md`; Report §5 "Mesocycle blocks";
  spreadsheet maximalist persona

## Why this matters

Block tagging lets lifters filter stats and volume by training phase without
maintaining a parallel spreadsheet. The design spike chose denormalized
`block` on log rows (Candidate A) to match the flat-log model used by
`notes` and `bodyweight`, keep Plan 018 merge trivial, and add a CSV column
the spreadsheet persona expects.

## Current state

- Sessions are implicit: rows sharing a `session` id (`saveWorkout`,
  `app.js:345-359`). No session entity; `notes` and `bodyweight` repeat on
  every row.
- No `block` field or block filter exists anywhere in `app.js` / `index.html`.
- Stats consumers that will gain optional block filtering (inside `#statsDeep`
  only): `summaries()` (`app.js:361-367`), `renderStats` chart/trend/recent/tops
  (`app.js:369-401`), `renderCompleted` (`app.js:418-428`), `draw`/`redrawChart`
  (`app.js:430-465`).
- Recommendation engine (`sessionsFor`, `recommendation`) stays full-history —
  **not** block-scoped per design.
- Session editor (`sessionEditor` / `saveSessionEdit`, `app.js:488-511`) is
  the retroactive assignment surface.
- CSV export (`app.js:618-635`) has no `block` column.
- Product guardrails: no sixth nav tab; block UI off the set-row path; Stats
  depth collapsed by default (`index.html:70-86`).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope**:

- `index.html` — `#currentBlock` on Log; stats scope + `#blockFilter` inside
  `#statsDeep`; block field in session editor markup (via JS template).
- `app.js` — `settings.currentBlock` in `normalizeSettings`; stamp `block` on
  save; filter helper for Stats deep section; retroactive edit; CSV column;
  History session card label.
- `styles.css` — minimal layout for `.blockpick`, `.field--inline`, scope bar
  (reuse existing `.seg` patterns).
- `test/simulation.mjs` — block persist, filter, CSV, merge round-trip checks.

**Out of scope** (do NOT touch):

- `state.blocks` date-range registry (Candidate B) or `state.sessionMeta`
  (Candidate C) — rejected for v1 in the design doc.
- Block filter on recommendations / attention board / top-line metrics tiles.
- Block type enum (accumulation/deload).
- Bulk block rename across history.
- `plans/README.md` status updates unless instructed by operator.

## Git workflow

- Branch: `advisor/024-mesocycle-blocks` (or operator's requested branch).
- Commit per step. Do NOT push/PR unless asked.

## Steps

### Step 1: Settings + normalize

Extend `DEFAULTS` and `normalizeSettings` (`app.js:47-49`):

```js
const DEFAULTS={/* existing */,currentBlock:""};
// in normalizeSettings:
currentBlock:typeof s?.currentBlock==="string"?s.currentBlock.trim():"",
```

Add filter helper (near `daysAgo`, `app.js:24`):

```js
function logForStats(scope,blockFilter){
  let rows=state.log;
  if(scope==="7"||scope==="28"){
    const cutoff=daysAgo(+scope-1);
    rows=rows.filter(x=>String(x.date)>=cutoff)}
  if(blockFilter==="__none__")rows=rows.filter(x=>!x.block);
  else if(blockFilter)rows=rows.filter(x=>x.block===blockFilter);
  return rows}
function blockLabels(){return[...new Set(state.log.map(r=>r.block).filter(Boolean))].sort()}
```

Replace module `volWindow` (`app.js:136`) with `statsScope="all"` and
`blockFilter=""`.

**Verify**: `node --check app.js` → exit 0. DevTools:
`JSON.parse(localStorage.repforge_v1).settings.currentBlock` is `""` on fresh
load.

### Step 2: Current block on Log form

In `index.html` after the date picker (`index.html:42`):

```html
<label class="blockpick">Block
  <input id="currentBlock" type="text" list="blockSuggestions"
         placeholder="Optional" autocomplete="off">
</label>
<datalist id="blockSuggestions"></datalist>
```

In `app.js`:

- `renderBlockSuggestions()` — fill `#blockSuggestions` from `blockLabels()`.
- `renderWorkout` end (`app.js:271`): call `renderBlockSuggestions()`; set
  `#currentBlock.value=state.settings.currentBlock`.
- `saveWorkout` (`app.js:345-359`): read trimmed `#currentBlock`; if non-empty,
  add `block` to each row; set `state.settings.currentBlock` before `save()`.
  Do not clear `#currentBlock` after save.

In `styles.css`, add `.blockpick` inline with `.datepick` (flex, compact).

**Verify**: Log a session with block "Accumulation 1" → all saved rows carry
`block:"Accumulation 1"`; reload → field prefilled; set-row flow unchanged
(no extra taps per set).

### Step 3: Stats scope + block filter (deep section only)

In `index.html` inside `#statsDeep`, replace `#volWindow` (`index.html:79-82`)
with scope bar + block select per design doc (`docs/design/mesocycle-blocks.md`
§ UI design §2).

Wire in `init` (`app.js:672` area):

```js
$$("#statsScope button").forEach(b=>b.onclick=()=>{statsScope=b.dataset.scope;renderStats()});
$("#blockFilter").onchange=()=>{blockFilter=$("#blockFilter").value;renderStats()};
```

Refactor `renderStats` (`app.js:369-401`):

- Keep `#metrics` and exercise name list derived from **full** `state.log`
  (actionable default).
- For chart/trend/recent/tops: build a filtered log via `logForStats`, run
  `summaries()` on that subset (extract `summariesFrom(rows)` or pass rows).
- Populate `#blockFilter` options: Any, Unassigned (`__none__`), then
  `blockLabels()`.

Refactor `renderCompleted` (`app.js:418-428`):

- When `blockFilter` is non-empty, filter by block only (ignore date window).
- When `blockFilter` is empty, keep rolling `statsScope` 7/28 behavior
  (rename from `volWindow`).

**Verify**: Log sessions in two blocks; open Stats → Dig deeper → filter block A
→ chart and completed volume show only block A rows; top metrics unchanged;
recommendations on Log tab still use full history.

### Step 4: History — display + retroactive edit

In `sessionEditor` (`app.js:488-500`), add block input in `.edhead` with
`data-ed="block"`, prefilled from `sets[0]?.block ?? ""`.

In `saveSessionEdit` (`app.js:502-511`), after date loop:

```js
const blockVal=card.querySelector('[data-ed="block"]')?.value.trim()??"";
for(const r of state.log){if(r.session!==sid)continue;
  /* existing field updates */
  if(blockVal)r.block=blockVal; else delete r.block}
```

In `renderHistory` session card (`app.js:475-476`), show block in subtitle when
set.

Optional: add Block column to `#historyTable` when any row has `block`.

**Verify**: Edit an old session → assign block → all rows in session updated;
clear block → `block` key absent on rows.

### Step 5: CSV export

In `exportCsv` cols (`app.js:620-630`), after `day`:

```js
["block",r=>r.block??""],
```

**Verify**: Export CSV → header includes `block`; rows show assigned values,
empty for unassigned.

### Step 6: Import / merge compatibility

No code change required if Plan 018 merge is landed — merged rows retain
`block`. If Plan 018 is **not** landed, skip merge-specific simulation only.

Document in code comment at `mergeLog` (Plan 018): merged rows preserve optional
`block` field.

**Verify**: Export backup with blocks → import merge on second device → block
values present on merged sessions.

### Step 7: Simulation checks

In `test/simulation.mjs`, add a phase after existing import/export checks:

```js
console.log("\nPhase: mesocycle blocks");
await nav(page, "log");
await selectDay(page, "Day 1");
await page.fill("#currentBlock", "Block Alpha");
const meta = await getExerciseMeta(page, "Day 1");
await fillExerciseSets(page, meta[0].id, meta[0].sets, 100, 6, 1);
await saveWorkout(page);
let st = await getState(page);
assert(
  st.log.every(r => r.block === "Block Alpha"),
  "Block stamps every row in the session",
  "Not all rows carry block",
  "Log → set block → Save"
);
assert(
  st.settings.currentBlock === "Block Alpha",
  "currentBlock persists in settings",
  `settings.currentBlock = ${st.settings.currentBlock}`,
  "Log → save → settings.currentBlock"
);
await nav(page, "stats");
await page.click("#statsDeep summary");
await page.selectOption("#blockFilter", "Block Alpha");
await page.waitForTimeout(100);
// assert filtered chart/table non-empty; filter Unassigned excludes rows
await page.click("#exportCsv");
// read download or evaluate exportCsv via page.evaluate — assert header has block
```

Add merge round-trip if Plan 018 chooser exists (`#importMerge` click pattern
from Plan 018 Step 4).

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js`.
- Manual: two blocks, filter in Stats deep section, retroactive edit, CSV
  column, empty block optional.
- Simulation: stamp, settings persist, filter, CSV header, merge round-trip
  (if 018 landed).
- Hard reload after `sw.js` asset change if `index.html` cached.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] Optional `#currentBlock` on Log; stamps `block` on save; prefills from
      `settings.currentBlock`; set-row flow unchanged
- [ ] Stats deep section: scope 7/28/all + block filter; top metrics unfiltered
- [ ] Session editor assigns/clears block on all session rows
- [ ] CSV includes `block` column
- [ ] Plan 018 merge preserves `block` on imported rows (when 018 landed)
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] No sixth nav tab; no block field on set rows
- [ ] `plans/README.md` status updated (by operator/orchestrator)

## STOP conditions

- Human has not approved `docs/design/mesocycle-blocks.md` — this plan is
  **DRAFT**; stop if asked to execute without review.
- Drift: `saveWorkout` or `#statsDeep` structure doesn't match excerpts — reconcile
  with design doc first.
- Maintainer rejects Candidate A during review — stop and wait for revised design.
- Implementing Candidate B or C without a new spike — out of scope.
- Block filter requested on `recommendation()` — product decision required.

## Maintenance notes

- Bulk block rename and block type enum are backlog (see design doc open
  questions).
- Future `sessionMeta` refactor (Candidate C) could subsume `block`, `notes`, and
  `bodyweight`; until then, denormalization matches Plan 009.
- Plan 019 warmups: block filter must not bypass `isWork` where warmups are
  excluded from volume stats.
- Plan 021 substitution: block tags are session-level, not exercise-level.
