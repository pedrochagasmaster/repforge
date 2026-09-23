# Plan 008: Typing in the exercise picker no longer rescans the workout history or re-normalizes the library on every keystroke

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `advisor-plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat ff9991cf..HEAD -- app.js test/exercise-picker.mjs`
> Re-locate the functions below by name (`grep -n "function exerciseMatches\|function loggedExerciseRefs\|function renderPickerList\|const exerciseSearchText\|const foldSearch" app.js`).
> A body that differs from the excerpt is a STOP; shifted lines are fine.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (textual neighbour of plans 007, 012, 013, and 019 in `app.js`)
- **Category**: perf
- **Planned at**: commit `ff9991cf`, 2026-09-22
- **Backlog**: not in `docs/backlog.md`. The owner must accept it there, or approve it directly, before execution.

## Why this matters

The exercise picker re-renders its whole list synchronously on every keystroke. Each render:

1. walks the entire workout history (`loggedExerciseRefs()` iterates `state.log`; tested scale is 20,000 rows) and Unicode-normalizes every logged name;
2. rebuilds and NFD-normalizes the search text of every one of ~270+ library entries;
3. re-normalizes the typed query once *per entry*.

None of that changes between keystrokes. Caching it keeps typing responsive on the low-end phones the product targets. No debounce is added, because that would add perceived latency and could break tests that read the list right after `page.fill`.

## Current state

`app.js` at `ff9991cf`:

```js
// app.js:10647
const foldSearch=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
// app.js:10655-10663
const exerciseSearchText=e=>foldSearch(`${e.name} ${e.namePt||""} ${e.primary||""} ${e.secondary||""}`);
function exerciseMatches(e,query,muscleGroup,equipment){
  if(equipment&&!(e.equipment||[]).includes(equipment))return false;
  if(muscleGroup){ … }
  if(!query)return true;
  const hay=exerciseSearchText(e);
  return foldSearch(query).split(/\s+/).filter(Boolean).every(w=>hay.includes(w))}
// app.js:10676-10683
function loggedExerciseRefs(){
  const ids=new Set(),names=new Set();
  for(const r of state.log||[]){
    if(r?.performedLibraryId)ids.add(String(r.performedLibraryId));
    if(r?.performedName)names.add(foldSearch(r.performedName));
    if(r?.name)names.add(foldSearch(r.name))}
  for(const e of state.program||[])if(e.libraryId)ids.add(String(e.libraryId));
  return{ids,names}}
// app.js:10748-10760 (renderPickerList, excerpt)
  const all=source.filter(e=>!exclude.has(e.id)&&exerciseMatches(e,query,muscle,equipment));
  const inProgram=programLibraryIds(),logged=loggedExerciseRefs();
  …
  const familiar=e=>inProgram.has(e.id)||logged.ids.has(e.id)||
    logged.names.has(foldSearch(e.name))||logged.names.has(foldSearch(e.namePt||""));
// app.js:15497
  if(pkSearch)pkSearch.oninput=()=>{if(pickerState){pickerState.query=pkSearch.value;renderPickerList()}};
```

`exerciseMatches` has a second caller (`app.js:11488`, the library flow), so its signature must stay the same. Custom exercises can be edited, so any per-entry cache must detect a changed name. The test hook `window.__repforgeOpenPicker=opts=>openExercisePicker(opts)` exists (`app.js:7501`). The existing suite `test/exercise-picker.mjs` (lane `entry`) types into `#exPickSearch` with `page.fill`.

Measurement technique to reuse: `test/history.mjs:76-104` `makeCountingLog`, a `Proxy` over the log array that counts iterator visits. `state` is a global lexical binding reachable from `page.evaluate`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Setup | `(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)` | exit 0 |
| Syntax | `node tools/check-production-syntax.mjs` | exit 0 |
| Picker suite | `node tools/run-tests.mjs entry --suite exercise-picker` | exit 0 |
| Library flow | `node tools/run-tests.mjs entry --suite library-flow` | exit 0 |
| Cache lockstep | `node test/exercise-library.mjs` | exit 0 |

## Scope

**In scope:** `app.js` (`exerciseSearchText`, `exerciseMatches`, `loggedExerciseRefs`, the `familiar` line in `renderPickerList`); `test/exercise-picker.mjs` (one new case); the cache ritual files `sw.js`, `index.html`, and `test/exercise-library.mjs`.

**Out of scope:** debounce or throttling of `oninput`; `foldSearch` itself; `libTabList`/`pickerCandidates`; ranking and sorting behavior.

## Git workflow

Branch `advisor/008-picker-keystroke`; commits `test(picker): count history visits while typing`, `perf(picker): cache folded search text and logged refs`, `chore(cache): advance cached shell revision`. Do not push.

## Steps

### Step 1: Failing measurement case

In `test/exercise-picker.mjs`, add a case in its existing style (its `assert(cond, name, detail)` helper and `freshPage`/`waitForApp`). In the page:

1. Build 2,000 rows `{session:"s"+i, date:"2024-01-01", name:"Row "+(i%50), exerciseId:"x", set:1, load:50, reps:8, rir:1, created:"2024-01-01T12:00:00.000Z"}`, wrap them with a copy of `makeCountingLog`, and assign `state.log = counted.proxy`.
2. Call `window.__repforgeOpenPicker({})`, then type `p`, `pr`, `pre`, `pres`, `press` by setting `#exPickSearch`'s value and dispatching `input` each time.
3. Read `visits` and restore `state.log`.

Assert `visits <= 2000` (one pass). Name: `"typing five characters walks the log at most once"`.

**Verify**: `node tools/run-tests.mjs entry --suite exercise-picker` → this case **fails** with well over 2,000 visits (one full walk per render). If it already passes, STOP: the cost is already gone.

### Step 2: Cache logged refs per log identity

Replace `loggedExerciseRefs` with:

```js
let loggedRefsCache=null;
function loggedExerciseRefs(){
  const log=state.log||[],program=state.program||[];
  if(loggedRefsCache&&loggedRefsCache.log===log&&loggedRefsCache.len===log.length&&loggedRefsCache.program===program)return loggedRefsCache.refs;
  const ids=new Set(),names=new Set();
  for(const r of log){
    if(r?.performedLibraryId)ids.add(String(r.performedLibraryId));
    if(r?.performedName)names.add(foldSearch(r.performedName));
    if(r?.name)names.add(foldSearch(r.name))}
  for(const e of program)if(e.libraryId)ids.add(String(e.libraryId));
  const refs={ids,names};loggedRefsCache={log,len:log.length,program,refs};return refs}
```

Before relying on this, run `grep -n "loggedExerciseRefs()" app.js` and confirm that no caller mutates the returned sets (`.add(`/`.delete(` on them). If one does, STOP.

**Verify**: the Step 1 case passes.

### Step 3: Cache folded text and query

```js
const searchTextCache=new WeakMap();
const exerciseSearchText=e=>{
  const src=`${e.name} ${e.namePt||""} ${e.primary||""} ${e.secondary||""}`,hit=searchTextCache.get(e);
  if(hit&&hit.src===src)return hit.hay;
  const hay=foldSearch(src);searchTextCache.set(e,{src,hay});return hay};
let lastQuery=null,lastWords=[];
```

In `exerciseMatches`, replace the final line with:

```js
  if(query!==lastQuery){lastQuery=query;lastWords=foldSearch(query).split(/\s+/).filter(Boolean)}
  return lastWords.every(w=>hay.includes(w))}
```

In `renderPickerList`, the `familiar` lambda may keep calling `foldSearch(e.name)`. That cost is minor, so leave it unchanged to keep the diff small.

**Verify**: `node tools/check-production-syntax.mjs` → exit 0. `node tools/run-tests.mjs entry --suite exercise-picker` → exit 0. `node tools/run-tests.mjs entry --suite library-flow` → exit 0.

### Step 4: Cache ritual

Read NN via `grep -o 'repforge-v[0-9]*' sw.js`, bump every `repforge-vNN` / `?v=NN` in `sw.js` and `index.html` to NN+1, and set `expectedRevision` in `test/exercise-library.mjs`.

**Verify**: `node test/exercise-library.mjs` → exit 0. `node tools/run-tests.mjs entry` → exit 0.

## Test plan

A new case in `test/exercise-picker.mjs` bounds history visits while typing (deterministic, counted by a Proxy). Existing picker and library-flow cases prove unchanged results and ranking.

## Done criteria

- [ ] `grep -c "loggedRefsCache" app.js` → at least `2`; `grep -c "searchTextCache" app.js` → at least `2`
- [ ] `node tools/run-tests.mjs entry` exits 0, including the new case
- [ ] Only in-scope files changed; the `advisor-plans/README.md` row is updated

## STOP conditions

- A caller mutates the `ids`/`names` sets.
- Any existing picker or library-flow assertion changes result order or content.
- `state.log` is mutated in place without length change anywhere (for example, row replacement by index during History edit while the picker is open). Check this with `grep -n "state.log\[" app.js`. If that happens, the length-based key is insufficient: STOP and report.

## Maintenance notes

- The logged-refs cache is keyed by log array identity plus length plus program identity. If a future edit path replaces a row in place, add an explicit `loggedRefsCache=null` there.
