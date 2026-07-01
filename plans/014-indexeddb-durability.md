# Plan 014: Migrate persistence from localStorage to IndexedDB

> **Executor instructions**: Follow step by step. Run every verification
> command and confirm the result before moving on. On a STOP condition, stop
> and report. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1d68b68..HEAD -- app.js`
> On any change, compare the `load`/`save`/`applyState` excerpts against live
> code; mismatch = STOP.

## Status

- **Priority**: P3 (durability foundation; higher risk than the quick wins)
- **Effort**: L
- **Risk**: HIGH (touches all persistence; get the migration + gate right)
- **Depends on**: land AFTER Plan 004 (backup hygiene) so import/preview logic
  isn't rewritten twice.
- **Category**: tech-debt
- **Planned at**: commit `1d68b68`, 2026-07-01
- **Source**: Privacy maximalist ("You've chosen the most fragile durable
  storage … synchronous, quota-capped, eviction-prone"). Report §2.3 —
  "Local-safe, not just local-only."

## Why this matters

All state lives in synchronous, quota-capped `localStorage` (`repforge_v1`).
As the log grows this janks the main thread and is eviction-prone. IndexedDB is
async, higher-quota, and a better fit for a growing training log — **still no
server, still no accounts**. The migration must be transparent: read existing
`localStorage` on first run, copy it into IndexedDB, and keep behavior identical.

## Current state

- Storage keys and access (`app.js:1`): `const KEY="repforge_v1",DRAFT="repforge_draft_v1";`
- Read: `load()` (`app.js:97-98`) `JSON.parse(localStorage.getItem(KEY))`.
- Write: `save()` (`app.js:100`) `localStorage.setItem(KEY,JSON.stringify(state))`.
- Draft: `saveDraft`/`loadDraft`/`clearDraft` (`app.js:181,21,20`) use
  `localStorage` with `DRAFT`.
- Import/export read/write the same blob (`app.js:469-471`).
- App boot is **synchronous**: `state=load()` runs at module top
  (`app.js:88`), then `render()` in `init()` (`app.js:488`). IndexedDB is async —
  this is the core structural change and the main risk.
- Confirm no existing IDB usage: `grep -n "indexedDB\|IDBDatabase" app.js` → none.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Syntax check | `node --check app.js` | exit 0 |
| Serve app | `python3 -m http.server 8000` | serving on :8000 |
| Simulation | `cd test && node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope** (only `app.js` + the test):
- `app.js` — an IndexedDB-backed store with a tiny async API (`idbGet`/`idbSet`),
  a one-time migration from `localStorage`, an async boot that awaits the initial
  read before first `render()`, and a `save()` that writes to IDB (keeping a
  `localStorage` mirror as a safety net during rollout is optional — see Step 4).
- `test/simulation.mjs` — the harness reads `localStorage` via `getState`
  (`test/simulation.mjs:37-43`). Keep a `localStorage` mirror so those reads
  still work, OR update `getState` to read IDB. Prefer the mirror (Step 4) to
  avoid rewriting many checks.

**Out of scope** (do NOT touch):
- Encryption (backlog).
- Import **merge** (backlog).
- Changing the JSON backup shape.
- The draft key mechanism can stay on `localStorage` (small, per-session; moving
  it is optional and out of scope).

## Git workflow

- Branch: `advisor/014-indexeddb`
- Commit per step, gate green each time. Do NOT push/PR unless asked.

## Steps

### Step 1: Minimal IndexedDB helper

Add near the top of `app.js` (after the key consts, `app.js:1`):

```js
const DB="repforge",STORE="kv";
function idbOpen(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbGet(key){const db=await idbOpen();return new Promise((res,rej)=>{
  const tx=db.transaction(STORE,"readonly").objectStore(STORE).get(key);tx.onsuccess=()=>res(tx.result);tx.onerror=()=>rej(tx.error)})}
async function idbSet(key,val){const db=await idbOpen();return new Promise((res,rej)=>{
  const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(val,key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
```

**Verify**: `node --check app.js` → 0.

### Step 2: Async boot with one-time migration

The module currently initializes synchronously at `app.js:88-90`. Wrap boot so
the first read is awaited. Replace the synchronous `state=load()` bootstrap and
the `init()` call at the bottom (`app.js:490`) with an async bootstrap:

```js
async function boot(){
  let raw=await idbGet(KEY);
  if(raw==null){ // migrate from localStorage once
    try{const ls=localStorage.getItem(KEY);if(ls){raw=JSON.parse(ls);await idbSet(KEY,raw)}}catch{}
  }
  state=normalizeLoaded(raw);            // see Step 3
  prog=new Program(state.program);state.program=prog.toJSON();
  day=days()[0]||"Day 1";
  if(migrateLog())await persist();
  init();
}
```

Move the module-level `let state,prog,day,...` declarations (`app.js:88`) to be
declared (uninitialized) before `boot()` and assigned inside it. Keep the other
`let installPrompt=null,saving=false,...` as-is.

Call `boot()` at the very end instead of `init()`.

### Step 3: `load()`/`save()` become IDB-aware

- Refactor the pure normalization out of `load()` (`app.js:97-98`) into
  `normalizeLoaded(s)` that takes a parsed object (not localStorage) and returns
  the `{settings,program,log}` shape (reuse the existing guards).
- Replace `save()` (`app.js:100`) with an async persist that writes to IDB and
  (optionally) mirrors to localStorage:

  ```js
  function save(){persist()} // keep sync-looking callers working; fire-and-forget
  async function persist(){try{await idbSet(KEY,state);localStorage.setItem(KEY,JSON.stringify(state))}catch(e){console.warn("persist failed",e)}}
  ```

  Keeping the `localStorage` mirror means (a) the test harness's `getState`
  (`test/simulation.mjs:37`) keeps working unchanged and (b) there's a fallback
  if IDB is unavailable. This is the lowest-risk path — do this.

- `applyState` (`app.js:99`) calls `save()`; that now persists to IDB too.
  `importJson`/`exportJson` continue to operate on `state` and call `save()`.

**Verify**: `node --check app.js` → 0. Fresh browser: log a session, reload →
data persists (now from IDB). Inspect DevTools → Application → IndexedDB →
`repforge` → `kv` → `repforge_v1` holds the state.

### Step 4: Migration + harness compatibility

- Confirm the one-time migration: seed `localStorage.repforge_v1` (via an old
  backup), clear IDB, reload → data appears and is copied into IDB.
- Because `persist()` mirrors to `localStorage`, `getState`
  (`test/simulation.mjs:37-43`) still returns state. If you chose NOT to mirror,
  update `getState` to read IDB via `page.evaluate` with an async IDB read — but
  the mirror avoids touching ~60 checks.

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`.

## Test plan

- `node --check app.js` after each step.
- Manual: fresh-load persistence via IDB; migration from an existing
  `localStorage` blob; offline still works; export/import round-trip intact.
- Simulation: the whole suite must pass unchanged (mirror keeps `getState`
  valid). This is the key regression guard for a HIGH-risk change.

## Done criteria

- [ ] `node --check app.js` exits 0
- [ ] State reads/writes go through IndexedDB (`repforge/kv/repforge_v1`)
- [ ] Existing `localStorage` data is migrated once on first IDB-less load
- [ ] `localStorage` mirror keeps `test/simulation.mjs` `getState` working
- [ ] First `render()` happens only after the initial async read resolves (no
      flash of empty/default state on reload with data)
- [ ] Export/import and offline behavior unchanged
- [ ] `cd test && node simulation.mjs` → `FAILED: 0`
- [ ] Only `app.js` (+ test if `getState` changed) modified; `plans/README.md`
      status updated

## STOP conditions

- Drift: `load`/`save`/`applyState`/boot don't match excerpts.
- If the async boot introduces a race where `render()` runs before `state` is
  set (blank UI flash or console errors), STOP and ensure `boot()` fully awaits
  the read and assigns `state`/`prog` before calling `init()`.
- If dropping the `localStorage` mirror is required by the operator, the test
  harness's `getState` MUST be updated to read IDB in the same PR — do not leave
  the suite red.

## Maintenance notes

- With IDB in place, import **merge** by session id (backlog) and encrypted
  export (backlog) become tractable; sequence them after this.
- Keep the `localStorage` mirror at least one release for safety; a later plan
  can remove it once IDB is proven in the wild.
