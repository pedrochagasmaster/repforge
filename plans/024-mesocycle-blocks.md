# Plan 024: Mesocycle blocks

> **READY — design reviewed and approved by a human on 2026-07-02.**
>
> The DRAFT gate is lifted. All "Blocks build? = Yes" open questions in
> `docs/design/mesocycle-blocks.md` are resolved; that doc's revision note
> (2026-07-02) records the locked decisions and **supersedes the original
> spike** where they differ. The most important delta: **top-line Stats tiles
> now follow the block filter** (open question #3 flipped from "No" to "Yes"),
> so the scope + block control lives **above `#metrics`**, not inside the
> collapsed `#statsDeep`. Step 3 below is written to that decision.
>
> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first — line numbers ARE stale)**: this plan was drafted
> at `ff67850`; since then Plans 017–019 and 025–028 landed on `main` and
> `app.js` grew substantially (~693 → ~930 lines). The `file:line` excerpts
> below are **approximate** — re-grep for each function name
> (`saveWorkout`, `renderStats`, `renderCompleted`, `sessionEditor`,
> `saveSessionEdit`, `exportCsv`, `normalizeSettings`, `mergeLog`) before
> editing and reconcile against `docs/design/mesocycle-blocks.md`. Run
> `git diff --stat ff67850..HEAD -- app.js index.html` and read the diff.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED (data-model touch across Stats/History/export)
- **Depends on**: Plan 023 design review — **DONE** (human-approved 2026-07-02).
  Plans 018 (import merge) and 019 (warmup flag) are now **DONE on `main`**, so
  the merge round-trip and warmup-exclusion composition notes are testable and
  **required**, not optional.
- **Status**: READY (was DRAFT; design gate lifted 2026-07-02)
- **Category**: direction (feature)
- **Planned at**: commit `ff67850`, 2026-07-02 (drafted from Plan 023 spike);
  decisions finalized 2026-07-02 after grilling review
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

### Step 3: Stats scope + block filter (tiles follow the filter)

> **Human-review decision (supersedes the original spike):** the tiles are
> **not** kept all-time. `#metrics`, the exercise list, chart, trend, recent,
> tops, and completed volume all read the **same filtered rows**. The scope +
> block control therefore lives **above `#metrics`**, visible without expanding
> "Dig deeper" — an all-time tile above a filtered chart would look broken.
> Only `#attention` (the action board) stays unfiltered. Follow
> `docs/design/mesocycle-blocks.md` § UI design §2 (revised) exactly.

In `index.html`, add a `statsbar` above `#metrics` (below the attention board)
and **remove** the old `#volWindow` segment from `#statsDeep` — the deep section
no longer owns a window control; it reads shared state. The bar holds
`#statsScope` (All time / 7 days / 28 days), `#blockFilter` (`<select>`), and
`#statsScopeLabel` (context line). See the design doc §2 for the markup.

Wire in `init` (re-grep for the init/wiring block near the other `onclick`
bindings):

```js
$$("#statsScope button").forEach(b=>b.onclick=()=>{statsScope=b.dataset.scope;renderStats()});
$("#blockFilter").onchange=()=>{blockFilter=$("#blockFilter").value;renderStats()};
```

Refactor `renderStats` (re-grep — approx `app.js:369-401` at spike time):

- Compute `const rows=logForStats(statsScope,blockFilter)` once at the top.
- Derive **`#metrics` tiles (Sessions / Sets / Volume / Best e1RM), the
  exercise picker, chart, trend, recent, and tops all from `rows`** — not from
  full `state.log`. Extract `summariesFrom(rows)` or pass `rows` into
  `summaries()`.
- **`#attention` stays on full `state.log`** (forward-looking; do not filter).
- **Context label** `#statsScopeLabel`: `All time` (no filter) /
  `Block: <name>` / `Last 7 days` / `<name> · last 7 days`.
- **Empty state**: when `rows.length===0`, render tiles as `—` (not `0`) and a
  single `No sessions match this filter.` line in the deep section.
- Populate `#blockFilter` options each render: `Any block` (`""`),
  `Unassigned` (`__none__`), then `blockLabels()` sorted.

Refactor `renderCompleted` (re-grep — approx `app.js:418-428`):

- Read the same `logForStats(statsScope,blockFilter)` rows. Block filter
  applies first; the 7/28 rolling window applies when `statsScope` is `7`/`28`.
- Rename the old `volWindow` module variable to `statsScope` (one control, not
  two parallel windows — see design doc §2).

**Verify**: Log sessions in two blocks; open Stats → pick block A in the scope
bar → **top tiles, chart, and completed volume all show only block A rows**;
the context label reads `Block: A`; switch to `Unassigned` → only untagged rows;
pick a block with no sessions → tiles show `—` and the empty-state line;
`#attention` and Log-tab recommendations still use full history.

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

Plan 018 (import merge) is **DONE on `main`**, so this is no longer optional —
merged rows must retain `block`, and the simulation **must** prove it (Step 7).
No `mergeLog` code change is expected: it unions rows by session id and carries
each row wholesale, so a `block` field rides along for free.

Add a one-line comment at `mergeLog` noting merged rows preserve the optional
`block` field, so a future editor of the merge path keeps it in mind.

**Verify**: Export backup with blocks → import merge (the Plan 018 chooser) →
block values present on merged sessions. This path is covered by the required
merge round-trip check in Step 7.

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
await page.selectOption("#blockFilter", "Block Alpha");
await page.waitForTimeout(100);
// tiles follow the filter now: assert #metrics + chart/table reflect only Block Alpha rows.
// then select "__none__" (Unassigned) and assert those rows are excluded.
await page.click("#exportCsv");
// read download or evaluate exportCsv via page.evaluate — assert header has block
```

**Required merge round-trip** (Plan 018 is DONE on `main`, so this is not
optional): export a backup containing blocked rows, import it via the Plan 018
merge chooser (`#importMerge` click pattern from Plan 018 Step 4), and assert
the merged sessions still carry their `block` values.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js`.
- Manual: two blocks, scope-bar filter drives **tiles + charts** together,
  context label correct, empty-filter `—` state, retroactive edit, CSV column,
  empty block optional.
- Simulation: stamp, settings persist, filter (tiles + deep), CSV header, and
  the **required** merge round-trip.
- Hard reload after `sw.js` asset change if `index.html` cached.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] Optional `#currentBlock` on Log; stamps `block` on save; prefills from
      `settings.currentBlock` (sticky — not cleared after save); set-row flow
      unchanged
- [ ] Scope + block bar **above `#metrics`**: scope 7/28/all + block filter;
      **tiles, chart, trend, recent, tops, and completed volume all follow the
      filter**; `#attention` stays unfiltered; context label + `—` empty state
- [ ] Session editor assigns/clears block on all session rows (per-session only)
- [ ] CSV includes `block` column
- [ ] **Merge round-trip: Plan 018 import preserves `block` on merged rows
      (required, tested in the simulation)**
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] No sixth nav tab; no block field on set rows; block is freeform text +
      `<datalist>` (no enum, no managed list)
- [ ] `plans/README.md` status updated (by operator/orchestrator)

## STOP conditions

- Drift: `saveWorkout`, `renderStats`, `renderCompleted`, or the Stats markup
  doesn't match the (approximate) excerpts — re-grep and reconcile with
  `docs/design/mesocycle-blocks.md` before editing.
- Maintainer reverses the "tiles follow the filter" decision — Step 3 changes
  materially; stop and re-confirm.
- Implementing Candidate B (date-range blocks) or C (`sessionMeta`) without a
  new spike — out of scope.
- Block filter requested on `recommendation()` / `#attention` — product
  decision required; both stay full-history by design.

## Maintenance notes

- Bulk block rename and block type enum are backlog (see design doc open
  questions).
- Future `sessionMeta` refactor (Candidate C) could subsume `block`, `notes`, and
  `bodyweight`; until then, denormalization matches Plan 009.
- Plan 019 warmups: block filter must not bypass `isWork` where warmups are
  excluded from volume stats.
- Plan 021 substitution: block tags are session-level, not exercise-level.
