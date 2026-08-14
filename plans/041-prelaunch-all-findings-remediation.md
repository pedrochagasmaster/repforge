# Plan 041: Remediate every launch-readiness finding before release

> **Executor instructions**: This plan implements every retained finding in
> `plans/040-launch-readiness-ui-ux-audit.md`. Follow the steps in order. Run
> each step's verification and keep every commit green before continuing. If a
> STOP condition occurs, stop and report it; do not silently narrow scope or
> defer a finding. When complete, update this plan's status in
> `plans/README.md`.
>
> **Owner priority override**: the audit originally separated a nine-item launch
> gate from P1/P2 follow-up. The owner has explicitly moved **all 24 findings**
> into pre-launch scope. Nothing in the coverage matrix below may be deferred.
>
> **Drift check (run first)**:
> `git diff --stat a909933..HEAD -- AGENTS.md app.js index.html styles.css i18n.js i18n-en.json i18n-pt.json notify.js manifest.webmanifest sw.js README.md plans/README.md test .github/workflows/simulation.yml`
>
> If an in-scope file changed after `a909933`, compare the current code against
> the anchors in this plan. If storage, draft, onboarding, dialog, History, or
> test-harness behavior no longer matches, stop and re-plan the affected step
> before editing.

## Status

- **Priority**: P0 — all findings are pre-launch by owner decision
- **Effort**: L
- **Risk**: HIGH (persistence, draft recovery, lifecycle, and broad interaction
  semantics change in one release train)
- **Depends on**: none (`plans/040-launch-readiness-ui-ux-audit.md` is
  provenance only; this plan is executable without reading it)
- **Category**: correctness / accessibility / performance / docs / UX
- **Planned at**: commit `a909933`, 2026-08-13
- **Implementation status**: TODO

## Why this matters

RepForge is a local-only tracker, so user trust depends on three properties:
saved data must not roll back, an unfinished workout must resume exactly, and
every visible control/status must tell the truth. The audit found 24 violations
or rough edges across those properties. This plan fixes all of them before
release without adding product scope: unavailable controls become honest static
content, existing destinations become explicit, and current state machines gain
safe transaction boundaries and tests.

The work is intentionally split into small, ordered commits. The data-safety
foundation lands first; lifecycle and validation use it; accessibility and
interaction semantics follow; copy, analytics, and History performance finish
the pass. The final step runs one release gate over the integrated result and
bumps the service-worker cache once.

## Finding coverage matrix

Every retained audit ID appears exactly once as a primary implementation owner.
Some steps also strengthen adjacent behavior, but no finding is left implicit.

| Finding | Required outcome | Owning step |
|---|---|---:|
| DATA-01 | Newer valid state wins across IndexedDB/localStorage and heals the stale replica | 1 |
| UX-01 | RIR mode cannot destroy an active draft | 2 |
| UX-02 | Save, Edit, and onboarding Import all finalize setup | 4 |
| UX-03 | Invalid workout/history values are rejected atomically | 3 |
| UX-04 | Notification UI reflects effective browser permission | 5 |
| UX-05 | Bodyweight has one localized unit-aware label | 8 |
| UX-06 | Pinch zoom works without reintroducing repeated-tap zoom | 8 |
| UX-07 | Every modal has focus entry, containment, Escape, and focus return | 6 |
| UX-08 | A block is archived only after successor onboarding succeeds | 4 |
| UX-09 | Beginner template gets a new truthful program identity | 4 |
| UX-10 | Rest duration is a non-negative whole number of seconds | 3 |
| UX-11 | History filtering and session expansion are explicit and keyboard-operable | 7 |
| UX-12 | Exercise-detail elements never look actionable without behavior | 9 |
| UX-13 | The 7/28-day control is visibly scoped to the data it changes | 9 |
| UX-14 | The feature tour teaches the current Focus UI | 9 |
| UX-15 | Destructive-action copy matches the actual deletion scope | 9 |
| UX-16 | Every Settings disclosure exposes expanded/controlled state | 6 |
| UX-17 | Coaching rows disclose their destination before activation | 10 |
| UX-18 | Installed-app and README positioning match current equipment support | 9 |
| UX-19 | A resumed draft retains skip/substitution and session context | 2 |
| UX-20 | “Stable” counts only actual flat comparisons from this week | 10 |
| A11Y-01 | Meaningful normal text reaches at least 4.5:1 contrast | 8 |
| A11Y-02 | Status, selection, activation, focus, and touch semantics are exposed | 6 and 8 |
| PERF-01 | History builds and reuses one linear session index per render | 7 |

Count check: 1 DATA + 20 UX + 2 A11Y + 1 PERF = **24 findings**.

## Current state and constraints

### Application shape

- RepForge is a static PWA. Runtime files are `index.html`, `styles.css`,
  `app.js`, `schedule.js`, `notify.js`, `i18n.js`,
  `manifest.webmanifest`, and `sw.js`.
- There is no application build, framework, backend, account, cloud sync, or
  application dependency. Do not introduce one. The existing browser harness
  is different: it has test-only npm metadata under `test/` and requires its
  pinned Playwright dependency in a fresh checkout.
- Serve the repository root over HTTP. Opening `index.html` as a file is not a
  valid test because service workers, manifest loading, and browser storage are
  origin-bound.
- All new user-visible strings must exist in `i18n-en.json`,
  `i18n-pt.json`, and both runtime dictionaries in `i18n.js`. There is no
  generator in the repository; keep all three representations synchronized.
- Preserve existing IDs used by tests and rendering. Prefer changing semantics
  or wrappers over renaming selectors.

### Persistence and draft anchors

- `app.js:1-18` defines `KEY`, `DRAFT`, IndexedDB helpers, and the
  `repforge/kv` store.
- `app.js:519-524` normalizes loaded/imported state.
- `app.js:767-774` writes localStorage synchronously and starts an unawaited
  IndexedDB write.
- `app.js:3239-3252` prefers any IndexedDB value and reads localStorage only
  when IndexedDB is empty.
- `app.js:149-167` owns draft clearing/loading/unit conversion.
- `app.js:469-474` keeps skipped/substituted/committed/touched/warmup state in
  module collections.
- `app.js:1850-1858` serializes fields, effort, notes, and set-state arrays but
  omits skips, substitutions, selected day/date, session note, and bodyweight.
- `app.js:1913-1923` changes skip/substitution state without saving it.
- `app.js:2024-2058` turns draft/UI state into durable log rows.

### Program lifecycle and validation anchors

- `app.js:167` (`posNum`) silently clamps invalid values to zero.
- `app.js:2024-2058` validates load incompletely and writes the workout.
- `app.js:2513-2536` edits saved sessions in place before filtering zero-load
  rows out.
- `app.js:703-733` archives blocks and starts successors as separate mutations;
  onboarding can be cancelled between them.
- `app.js:2869-2875`, `app.js:2902`, and `app.js:2984-2992` implement program
  import, beginner replacement, and three onboarding exits with divergent
  metadata behavior.
- `app.js:2829-2838` commits all Settings values together, clears drafts on
  RIR changes, and accepts decimal rest seconds.

### Interaction/accessibility anchors

- `index.html:453-477` marks three overlays modal, while
  `app.js:703-733` and `app.js:2887-2893` only toggle `.hidden`.
- `app.js:3111-3120` is the existing focus-trap exemplar for the exercise-note
  sheet. Consolidate this behavior rather than creating more one-off traps.
- `index.html:519` contains a visual-only toast.
- `app.js:1223-1232` makes a `role="status"` session banner clickable without
  keyboard action semantics.
- `app.js:895` changes List/Focus only through `.active`.
- `app.js:3159-3165` toggles one period label and six Settings panels without
  complete disclosure state.
- `styles.css:178-180` provides the global focus treatment, but
  `styles.css:343` removes it from flat Settings selects.
- `styles.css:18` defines `--ink-faint:#98948C`; it measures 3.02:1 on white
  and 2.70:1 on `--bg`. `--accent:#E04E14` also fails 4.5:1 for normal text.
  `--accent-deep:#B8410E` is compliant on current surfaces.

### History, coaching, and honest-affordance anchors

- `app.js:2447-2484` repeatedly filters `state.log` once per session.
- `app.js:2469-2478` renders mouse-only expandable session `<div>` elements.
- `app.js:2089-2101` derives `flatGuess` instead of using
  `weeklySnapshot().flatLifts`.
- `app.js:2114-2126` and `app.js:2374-2385` send similar coaching rows to
  three different destinations without visible destination labels.
- `app.js:2603-2608` renders range/record buttons without handlers.
- `index.html:133-135` presents `#statsPeriod` as a global-looking clickable
  span even though only completed hard-set volume changes.
- Tour step 3 in both locale files describes a removed bottom Focus bar.
- `manifest.webmanifest:4` and `README.md:7` still say “machine-only.”

### Existing verification shape

- `test/simulation.mjs` is the broad year-of-usage harness. It already contains
  helpers for seeding both stores, mobile viewports, keyboard events, contrast
  calculations, imports/exports, onboarding, block lifecycle, skip,
  substitution, History, and PWA checks.
- `test/notifications.mjs`, `test/recover-gate.mjs`, and
  `test/focus-mode.mjs` are focused browser suites.
- `test/schedule.mjs` is dependency-free and must remain green.
- `.github/workflows/simulation.yml` provisions Chromium but currently runs
  only the broad simulation and Focus suite. Step 11 adds every release suite.
- Service-worker shell edits are cache-sensitive. Change `sw.js` only in the
  final integration step and increment `CACHE` exactly once.
- `AGENTS.md` currently describes the application as localStorage-only and says
  there is no test package, while the live app uses localStorage + IndexedDB and
  the browser harness has test-only npm dependencies. Step 11 corrects those
  setup facts without changing the dependency-free application architecture.

### Load-bearing current excerpts (drift tripwires)

These excerpts inline the seams the executor must still find before editing.
Line movement alone is harmless; changed behavior is a STOP condition.

`app.js:767-774` currently makes persistence fire-and-forget and does not return
an accepted-write result:

```js
function save(){persist()}
function persist(){
  dropMemo.clear();baselineMemo.clear();
  let lsOk=true;
  try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){lsOk=false;console.warn("localStorage mirror failed",e)}
  idbSet(KEY,state).catch(e=>{console.warn("idb persist failed",e);
    // Only alarm the user when neither store took the write — data is genuinely at risk.
    if(!lsOk&&!persist.warned){persist.warned=true;toast(t("toast.storage_full"))}})}
```

`app.js:3239-3251` currently prefers IndexedDB and then persists immediately:

```js
async function boot(){
  let raw=null;
  try{raw=await idbGet(KEY)}catch(e){console.warn("idb read failed",e)}
  if(raw==null){try{const ls=localStorage.getItem(KEY);
    if(ls){raw=JSON.parse(ls);try{await idbSet(KEY,raw)}catch(e){console.warn("idb migration failed",e)}}}
  catch(e){console.warn("localStorage read failed",e)}}
  state=normalizeLoaded(raw);
  prog=new Program(state.program);state.program=prog.toJSON();
  state.programMeta=normalizeProgramMeta(state.programMeta,state.log);
  day=days()[0]||"Day 1";
  applyGotoParam();
  migrateLog();
  persist();
}
```

`app.js:1850-1858` currently serializes only DOM fields plus three set-state
collections, omitting session context and skip/substitution state:

```js
function saveDraft(){const d={};$$("#workout input").forEach(x=>d[x.dataset.k]=x.value);
  $$("#workout .effort__btn.active").forEach(b=>d[`${b.dataset.eff}_effort`]=b.dataset.e);
  $$("#workout [data-effspin]").forEach(e=>d[`${e.dataset.effspin}_effort`]=e.dataset.e);
  // Store every note field, empty included — an empty value is the lifter clearing a carried-forward note.
  const notes={};$$("#workout [data-exnote]").forEach(t=>notes[t.dataset.exnote]=t.value);
  if(Object.keys(notes).length)d.__exnotes=notes;
  d.__done=[...committed];d.__touched=[...touched];d.__warm=[...warmups];
  if(lastCommitAt&&committed.size)d.__lastCommitAt=lastCommitAt;
  localStorage.setItem(DRAFT,JSON.stringify(d))}
```

`app.js:703-733` currently archives before starting the successor and opens
modals by toggling `.hidden`:

```js
function finishBlockAndStart(strategy){const review=blockReviewCurrent;if(!review)return;
  completeCurrentProgram(review);startNextMesocycle(strategy);closeBlockReview()}
function openBlockReview(review){blockReviewCurrent=review;renderBlockReviewPanel(review);const d=$("#blockReview");if(!d)return;
  d.classList.remove("hidden");$("#blockReviewClose").onclick=closeBlockReview}
function promptEndBlock(){const d=$("#endBlockConfirm");if(!d)return;
  d.classList.remove("hidden");
  $("#endBlockGo").onclick=()=>{d.classList.add("hidden");openBlockReview(buildBlockReview(state.programMeta,state.program,state.log))};
  $("#endBlockCancel").onclick=()=>d.classList.add("hidden")}
```

`app.js:2447-2491` currently re-scans the full log per session and again for
calendar PRs:

```js
function renderHistory(){
  if(!histMonth){const n=new Date();histMonth={y:n.getFullYear(),m:n.getMonth()}}
  renderHistoryCalendar();
  let sessions=[...new Map(state.log.map(x=>[x.session,x])).values()].sort((a,b)=>{
    const dd=String(b.date).localeCompare(String(a.date));return dd||String(b.created).localeCompare(String(a.created))});
  const q=histQuery.trim().toLowerCase();
  if(q)sessions=sessions.filter(s=>{
    const sets=state.log.filter(r=>r.session===s.session);
    return String(s.day).toLowerCase().includes(q)||sets.some(r=>displayName(r).toLowerCase().includes(q))});
}
```

Inside the session mapping, `app.js:2458` scans again:

```js
const sets=state.log.filter(r=>r.session===s.session).sort((a,b)=>String(displayName(a)).localeCompare(String(displayName(b)))||a.set-b.set);
```

`app.js:2489-2491` independently re-scans for calendar data:

```js
const monthSessions=state.log.filter(r=>String(r.date).startsWith(`${y}-${String(m+1).padStart(2,"0")}`));
const byDay=new Map();for(const r of monthSessions){const d=+String(r.date).slice(8,10);if(!byDay.has(d))byDay.set(d,{sets:0,pr:false});byDay.get(d).sets++}
for(const ev of detectPRs(state.log)){if(String(ev.date).startsWith(`${y}-${String(m+1).padStart(2,"0")}`)){const d=+String(ev.date).slice(8,10);const o=byDay.get(d)||{sets:0,pr:false};o.pr=true;byDay.set(d,o)}}
```

`i18n.js:1645-1653` supports placeholder, ARIA, and title attributes; all three
belong in parity checks:

```js
document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
  el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
});
document.querySelectorAll("[data-i18n-aria]").forEach(el => {
  el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
});
document.querySelectorAll("[data-i18n-title]").forEach(el => {
  el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
});
```

At this plan's baseline, `sw.js:1-9,22` used cache `repforge-v53`; `ASSETS` was
broader than `SHELL`, and both lists remain release invariants:

```js
const CACHE = "repforge-v53";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest",
  "./schedule.js", "./notify.js", "./i18n.js",
  "./icons/icon.svg", "./icons/favicon-32.png", "./icons/icon-192.png",
  "./icons/icon-512.png", "./icons/icon-1024.png",
  "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png",
  "./fonts/plexsans.woff2",
  "./fonts/plexmono-400.woff2", "./fonts/plexmono-500.woff2", "./fonts/plexmono-600.woff2"
];
const SHELL = new Set(["/","/index.html","/app.js","/styles.css","/i18n.js","/manifest.webmanifest"]);
```

## Commands you will need

Run commands from the repository root unless the command says otherwise.

| Purpose | Command | Expected on success |
|---|---|---|
| Test-only bootstrap (fresh checkout) | `(cd test && npm ci && npx playwright install chromium --with-deps)` | exit 0; installs only the pinned browser-harness dependency/browser, not an application dependency |
| Syntax | `for f in app.js i18n.js notify.js schedule.js sw.js test/*.mjs; do node --check "$f" || exit 1; done` | exit 0 |
| Static server | `python3 -m http.server 8000` | serves repository on `:8000`; leave it running |
| Pure schedule | `node test/schedule.mjs` | `schedule tests: 8 passed, 0 failed` |
| i18n parity (new) | `node test/i18n.mjs` | exit 0, no missing/divergent keys |
| Persistence (new) | `node test/persistence.mjs` | `0 failed` |
| Notifications | `node test/notifications.mjs` | `0 failed` |
| Recovery signals | `node test/recover-gate.mjs` | `0 failed` |
| Accessibility (new) | `node test/accessibility.mjs` | `0 failed` |
| Focus mode | `node test/focus-mode.mjs` | `0 failed` |
| Quick integrated simulation | `REPFORGE_SIM_WEEKS=12 node test/simulation.mjs` | `FAILED: 0` |
| Full integrated simulation | `REPFORGE_SIM_WEEKS=52 REPFORGE_PROFILE=1 node test/simulation.mjs` | `FAILED: 0`; timings printed |
| Manual-fixture helper (new) | `node test/manual-matrix.mjs --self-test` | six cells and deterministic fixture hashes reported; exit 0 |
| HTTPS release-candidate identity | `REPFORGE_RC_ORIGIN=https://…; export REPFORGE_RC_ORIGIN; commit=$(git rev-parse HEAD); evidence="/opt/cursor/artifacts/repforge_rc_identity_${commit}.log"; printf 'origin=%s\ncommit=%s\n' "$REPFORGE_RC_ORIGIN" "$commit" \| tee "$evidence"; for f in index.html styles.css app.js schedule.js notify.js i18n.js i18n-en.json i18n-pt.json manifest.webmanifest sw.js icons/icon.svg; do local_sha=$(sha256sum "$f" \| awk '{print $1}'); remote_sha=$(curl -fsS -H 'Cache-Control: no-cache' "$REPFORGE_RC_ORIGIN/${f}?commit=$commit" \| sha256sum \| awk '{print $1}'); test "$local_sha" = "$remote_sha" \|\| exit 1; printf '%s local=%s remote=%s\n' "$f" "$local_sha" "$remote_sha" \| tee -a "$evidence"; done` | exit 0; evidence log prints origin, full commit, filename, local SHA, and matching remote SHA for every shell asset |
| Patch hygiene | `git diff --check` | exit 0, no output |

Run the test-only bootstrap once in every fresh checkout before a browser gate;
CI must run the equivalent pinned install. The focused browser scripts import
Playwright through `test/browser.mjs`. Do not move it to the root, add
application dependencies, or introduce an application build. A failed
`npm ci`/browser install after one clean retry is a STOP condition—not
permission to mark browser verification as passed.

## Suggested executor toolkit

- Use the repository's browser-control/UI skill, if available, for the final
  keyboard, mobile, offline, and screen-reader-semantics smoke pass.
- Use the existing `test/simulation.mjs` helpers and assertion style. Do not add
  a second test framework.
- Use browser DevTools Application storage only for manual confirmation; the
  automated suites remain the source of truth for data reconciliation.

## Scope

**In scope** (the only product/test files that may change):

- `app.js`
- `index.html`
- `styles.css`
- `i18n.js`
- `i18n-en.json`
- `i18n-pt.json`
- `notify.js` (only if the permission API needs a small truth-state helper)
- `manifest.webmanifest`
- `sw.js`
- `README.md`
- `AGENTS.md` (factual test/bootstrap, dual-store, and cache guidance only)
- `test/simulation.mjs`
- `test/notifications.mjs`
- `test/focus-mode.mjs`
- `test/persistence.mjs` (new)
- `test/persistence-race.mjs` (new)
- `test/thermonuclear-races.mjs` (new)
- `test/accessibility.mjs` (new)
- `test/history.mjs` (new)
- `test/i18n.mjs` (new)
- `test/adversarial-draft-transactions.mjs` (new)
- `test/program-draft-conflicts.mjs` (new)
- `test/program-draft-day-rename.mjs` (new)
- `test/program-draft-set-reduction.mjs` (new)
- `test/workout-day-context-discard.mjs` (new)
- `test/manual-matrix.mjs` (new; deterministic fixture/reset helper only)
- `.github/workflows/simulation.yml`
- `plans/README.md` (status plus factual verification/setup corrections only)
- `plans/041-prelaunch-all-findings-remediation.md` (audited scope, gate,
  and release-evidence corrections only)

**Out of scope**:

- Accounts, cloud sync, a backend, telemetry, or remote error reporting.
- AI coach work, new analytics, new navigation tabs, or a visual redesign.
- Implementing 12/26/52-week chart range selection or clickable PR record
  details. UX-12 is fixed pre-launch by removing false affordances.
- Making the Progress period global. UX-13 is fixed by removing the duplicate
  global-looking control and retaining the already-scoped `#volWindow`.
- A new general factory-reset feature. UX-15 is fixed by naming the existing
  log-and-draft deletion honestly. Step 1's confirmed **Start fresh** escape
  hatch appears only when neither storage replica is valid; it is not a normal
  Settings action.
- Replacing the vanilla-JS architecture or splitting `app.js` as unrelated
  cleanup. Add small helpers at the existing seams.
- Changing recommendation thresholds, capacity math, workout volume rules,
  backup schema, or CSV columns except where this plan explicitly says so.

## Git workflow

- Work on the executor-provided remediation branch, not directly on `main`.
- Make one commit per numbered implementation step. Keep the branch green after
  every commit.
- Suggested commit subjects:
  1. `fix: reconcile local storage replicas`
  2. `fix: preserve complete workout drafts`
  3. `fix: validate logged set values`
  4. `fix: make program setup transactional`
  5. `fix: reflect notification permission`
  6. `fix: standardize accessible interactions`
  7. `perf: index history sessions once`
  8. `fix: meet visual accessibility contract`
  9. `fix: remove misleading UI affordances`
  10. `fix: clarify progress coaching actions`
  11. `test: enforce prelaunch release gate`
- Do not squash data-safety, lifecycle, and visual work into one commit. A
  reviewer must be able to revert any later presentation commit without
  reverting storage recovery.

## Execution rules

1. For each step, add the named regression assertions first and confirm they
   fail for the intended reason. Implement the fix, then run the focused suite
   plus the quick integrated simulation before committing.
2. Never mutate durable state until all inputs for that transition validate.
3. Never use display text or translated names as durable identity; use exercise
   and program IDs.
4. Never silently discard an old backup/draft shape. Normalize it and test it.
5. Every new string lands in EN JSON, PT JSON, and both `i18n.js` dictionaries
   in the same commit.
6. After `index.html`, `styles.css`, `app.js`, `i18n.js`, or the manifest
   changes, hard reload or clear the service worker during manual development.
   Do not bump the cache until Step 11.

## Steps

### Step 1: Make dual-store persistence versioned, ordered, and recoverable

**Findings**: DATA-01.

Implement a storage-only revision without wrapping the existing state shape:

1. Add a reserved top-level numeric field such as `_storageRevision` to the
   copies stored under `repforge_v1`. Existing tests and diagnostic reads must
   still see `settings`, `program`, `programMeta`, `log`, and
   `programHistory` at the root.
2. Extend `normalizeLoaded()` to accept a non-negative integer revision and
   treat legacy snapshots as revision `0`. Before replace import, capture the
   current local revision. Ignore any incoming revision (including a forged
   higher value) and every incoming storage-only UI marker, assign the proposal
   the captured local revision, clear any superseded local marker, and let
   exactly one successful `persist()` advance it.
3. Add small pure helpers near the IndexedDB functions:
   - validate the minimum state shape (`program` and `log` arrays);
   - read a revision, defaulting legacy state to `0`;
   - compare snapshots canonically while excluding storage-only metadata;
   - choose the higher revision only when it is unambiguous.
4. Change `boot()` to read **both** stores independently and distinguish absent,
   invalid, and read-failed results:
   - two successful absent reads are the only first-run case;
   - one valid snapshot may win over an absent peer;
   - one valid plus one invalid peer is unresolved until the invalid raw value
     is successfully exported/preserved or the user explicitly confirms its
     discard; make zero writes before that resolution;
   - one valid plus one read-failed peer is unresolved because the unreadable
     copy could be newer; block mutation/heal, offer Retry, and allow using the
     readable copy only after explicit overwrite confirmation;
   - canonically equal legacy/equal-revision snapshots may use IndexedDB as the
     tie and migrate to the next revision;
   - valid but divergent snapshots with equal/legacy revisions are not
     orderable and must not overwrite each other;
   - no-valid-snapshot plus malformed or read-failed data must not normalize to
     defaults or persist over the raw replicas.
5. Add a blocking native `#storageRecovery` dialog for the unresolved states
   above. For divergent valid copies, show program name, session/set counts, and
   latest log date for Copy A/B; allow export of both raw copies and an explicit
   **Use Copy A/B** choice. For valid+invalid/read-failed, show the valid-copy
   summary plus export/Retry/explicit-overwrite actions. For no-valid-snapshot,
   offer Retry and raw export; show **Start fresh** only behind a destructive
   confirmation. Do not initialize normal app mutation handlers or call
   `persist()` until recovery resolves.
6. Put real localStorage/IndexedDB calls behind a tiny internal `storageIO`
   adapter and make the shared `writeSnapshot(snapshot, io)` function accept an
   adapter. `persist()` always supplies the real adapter; tests supply
   deterministic failing/delayed fakes. Serialize real IndexedDB writes through
   one rejection-absorbing promise queue. Each logical write gets its own
   result promise, while the internal queue tail is reset to a fulfilled
   sentinel on both resolution and rejection (equivalent to
   `tail = operation.then(()=>undefined,()=>undefined)`); never assign a
   potentially rejected operation directly as the next queue tail. `flush()`
   awaits that absorbing tail. Clone each snapshot before queueing so later
   `state` mutations cannot alter an earlier write. Before queueing a real
   browser write, synchronously store its base/live/proposal intent without a
   revision as an immutable, uniquely keyed `repforge_pending_v1:<uuid>` entry;
   this is an ordered unload-safety journal, not a third authoritative replica.
   A later enqueue must never overwrite an earlier entry. Under the
   origin-scoped Web Lock, reread both durable replicas, rebase intents in
   deterministic order onto the selected head, and only then allocate each new
   revision. Remove an entry inside the lock only after acceptance or a proven
   stale transition identity; total failure retains that entry and its ordered
   tail. Boot rereads/repairs under the same lock, migrates an old un-suffixed
   `repforge_pending_v1` entry first, and replays all surviving valid entries
   before initializing the app. An entry may carry only a bounded draft receipt:
   Finish uses match-only `clear-draft`; destructive program/log changes use
   abort-on-change `clear-draft`; and a transactional day rename uses
   same-day-conflict `replace-draft`. Enforce each receipt before the durable
   write and apply it after one or both stores accept, including replay, so a
   newer cross-tab draft either survives with the state change rejected or
   remains unrelated and usable. Make
   `save()`/`persist()` return the individual
   result promise containing `{ revision, localOk, idbOk }` so transactional
   callers can distinguish one accepted replica from total failure.
7. Add `commitProposedState(proposal, io=storageIO)` at this persistence seam.
   It deep-clones the proposal, queues its intent, assigns the next revision
   from the locked durable head, writes that snapshot, and updates live
   `state`/`prog`/memoized derivatives only when `localOk || idbOk`. If both
   fail, live globals remain byte-equivalent to their pre-call values.
   High-risk transitions in Steps 2 and 4 use this path; ordinary existing
   mutators may continue calling `persist()`.
8. Refactor full-backup Replace and Merge to build proposals and use
   `commitProposedState(proposal, io)`. Replace clears draft/storage-only marker
   and closes the chooser only after acceptance; Merge appends unique sessions
   only after acceptance. Total failure leaves live state/draft/chooser intact,
   shows no success, and permits retry.
9. Keep every unversioned localStorage write-ahead entry synchronous and
   immutable; never use a shared read/append/write array or publish a revisioned
   `repforge_v1` snapshot before the lock, because cross-tab writers can race and
   a stale tab could overwrite another intent or outrank newer IndexedDB data.
   Track each authoritative store's latest write result separately. When only
   one store accepts a write,
   keep the data but expose a persistent degraded-storage line in Settings and
   one localized toast; when both fail, use the destructive storage error
   treatment. A later successful write to both stores clears the degraded
   warning.
10. Export a copy of `state` with `_storageRevision` and any reserved
   storage-only UI transition marker removed. Import/merge and program-only
   export formats remain unchanged.
11. Expose only a narrow test hook:
   `window.__repforgeStorage = { flush, chooseSnapshot, writeWithAdapter,
   health }`. `writeWithAdapter` must require an explicit fake adapter and may
   not default to real browser storage; do not expose arbitrary app-state
   mutation through the hook.

Create `test/persistence.mjs`, following the result/`assert` style of
`test/notifications.mjs`. Cover:

- legacy localStorage-only migration to both stores;
- canonically identical revisionless replicas migrate without a prompt;
- divergent revisionless/equal-revision replicas show recovery, preserve and
  export both raw copies, and heal only after each explicit A/B choice;
- localStorage revision 2 vs IndexedDB revision 1 → revision 2 boots and heals;
- IndexedDB revision 3 vs localStorage revision 2 → revision 3 boots and heals;
- valid+absent in both store directions boots the valid peer and heals;
- valid+invalid and valid+read-failed cases in both store directions write
  nothing before recovery, preserve/export raw bytes faithfully, then heal only
  after explicit resolution;
- both malformed replicas and read-failure-plus-absent-peer block default
  persistence, preserve raw data, and expose Retry/recovery;
- injected IndexedDB failure/localStorage success → degraded status, then
  reload from the newer local snapshot and heal IndexedDB;
- injected IndexedDB failure/localStorage success followed, without reload, by
  an allowed write: the second operation runs despite the first rejection,
  `flush()` resolves, both replicas contain the second operation's highest
  revision, and degraded health clears;
- injected localStorage failure/IndexedDB success → degraded status, then
  reload from the newer IndexedDB snapshot and heal localStorage;
- injected failure of both stores → destructive-failure alert and no false
  “saved” health state;
- delayed writes resolved in adversarial order cannot leave a lower revision;
- 20 rapid Settings mutations followed by `flush()` leave both stores byte-
  equivalent at the highest revision;
- an IndexedDB-only accepted workout survives repeated Settings writes from a
  stale tab, and the unversioned journal replays once after an interrupted
  write without becoming an authoritative revision;
- Finish and Settings queued behind one lock, followed by writer unload, retain
  two distinct entries that replay in order and drain without losing either
  intent;
- a boot queued immediately behind an accepting writer cannot replay that
  writer's not-yet-cleaned entry; an accepted replay followed by total failure
  returns the accepted head while retaining only the failed ordered tail;
- boot repair that waits behind a newer locked write rereads the replicas and
  cannot roll them back;
- same-page workout/Settings, cross-tab Settings, destructive reset, and
  same-old-program block-completion races converge without losing a session or
  creating two successors;
- a downloaded JSON backup while a follow-up marker is pending omits both
  `_storageRevision` and the marker;
- replace import at local revision 17 finishes at 18 whether the file has no
  revision or claims revision 999; a forged follow-up marker is never adopted;
  merge import also preserves ordering;
- full-backup Replace and Merge under `(true,true)`, `(true,false)`,
  `(false,true)`, `(false,false)`: either accepted replica reloads/heals; total
  failure leaves live state/draft/chooser byte-equivalent, emits no success,
  and retries without duplicate sessions.

Do not rely on a flaky browser-quota failure. Use the fake adapter for write
outcomes/delays, then seed the resulting one-sided snapshots into real browser
stores to verify boot selection and healing.

**Verify**:

```bash
for f in app.js test/persistence.mjs test/persistence-race.mjs test/thermonuclear-races.mjs; do node --check "$f" || exit 1; done
node test/persistence.mjs
node test/persistence-race.mjs
node test/thermonuclear-races.mjs
REPFORGE_SIM_WEEKS=12 node test/simulation.mjs
```

Expected: both browser scripts exit 0; persistence reports `0 failed`;
simulation reports `FAILED: 0`.

### Step 2: Make the workout draft a complete, resumable session

**Findings**: UX-01, UX-19.

Treat the draft as the semantic session, not only its visible set fields:

1. Extend the backwards-compatible draft object with:
   - `__skipped`: exercise-ID array;
   - `__substituted`: object mapping exercise ID to performed name;
   - `__day` and `__date`;
   - `__sessionNotes` and `__bodyweight`;
   - `__contextTouched`: own-property flags for day, date, session note, and
     bodyweight so absent/default and explicitly cleared values differ.
2. Add one `hydrateWorkoutDraft()` helper that:
   - clears and rebuilds `committed`, `touched`, `warmups`, `skipped`, and
     `substituted`;
   - accepts only exercise IDs present in the current program;
   - accepts substitutions only for their owning exercise and caps custom text
     at the existing 80-character rule;
   - restores day only when it still exists;
   - uses own-property checks so an explicit empty note/bodyweight stays empty;
   - leaves untouched legacy drafts on today's date/last bodyweight defaults.
3. Update `saveDraft()` to serialize those values along with existing set
   fields/effort/exercise notes. Wire `#notes`, `#bodyweight`, and `#date` to
   set their context flag and save on input/change. Capture current day/date
   when the first meaningful set/skip/substitution progress starts.
4. Hydrate context before `init()` overwrites date/bodyweight defaults and
   before the first workout render. Old drafts with none of the new keys must
   behave exactly as before.
5. Route direct skip/restore, **Show all**, fatigue trim, and predefined/custom
   substitution through shared draft mutators that save before render. Route
   day tabs, Today → Up next, session-banner navigation, exercise/coaching deep
   links, and every `enterWorkout({day})` caller through
   `requestWorkoutDay(nextDay)`; callers must not assign `day` first. Because
   one draft represents one session, refuse a day change after meaningful
   progress unless the user confirms explicit draft discard.
6. Extend `convertDraftUnits()` to convert a present, nonblank, parseable
   `__bodyweight`; preserve blank/invalid draft text. DOM-only conversion is not
   sufficient because reload reads the draft.
7. Include skip/substitution/context-only progress in `draftHasProgress()` so
   **Continue workout** remains truthful.
8. Replace the `oldRirMode !== newRirMode → clearDraft()` branch with a guarded
   `changeRirMode()` transition:
   - no-progress draft: apply the mode normally;
   - active draft: run this guard before any settings/unit mutation, keep the old
     radio/mode, preserve the raw draft string byte-for-byte, and show localized
     copy explaining that the workout must be finished or explicitly discarded.
9. Refactor `saveWorkout()` to build a proposed deep-cloned state and commit it
   through `commitProposedState(proposal, io)`. Assign globals, clear the raw
   draft, and reset session collections only when `localOk || idbOk`; total
   failure leaves globals and the byte-identical draft unchanged for retry and
   cannot add duplicate rows.
10. After an accepted finish, explicitly clear `committed`, `touched`,
    `warmups`, `skipped`, `substituted`, and context-touch state. Other
    destructive program/import/reset transitions may clear the draft only after
    their confirmed proposal is accepted.

Add regression phases to `test/simulation.mjs` and `test/focus-mode.mjs`:

- List: enter values, note, bodyweight, non-today date, skip one exercise,
  choose a predefined substitution and a custom substitution, leave, reload,
  continue, and assert every value/state remains;
- Focus: reload on a deck with a skipped exercise and substitution; assert deck
  count/name and final `performedName`;
- finish the resumed workout and assert skipped rows are absent and substituted
  rows retain `performedName`;
- change RIR with no draft (succeeds), then with touched, committed, warmup,
  note-only, bodyweight-only, date-only, day-only, skip-only, substitution-only,
  and explicitly cleared context (refuses and preserves the exact raw string);
- direct skip, fatigue trim, Show all, and predefined/custom substitution each
  survive/reconcile correctly after reload;
- for day tab, Up next, session banner, deep-link/coaching, and
  `enterWorkout({day})` entry points: Cancel preserves raw draft/current day;
  Confirm clears the old draft, selects/restores the new day, and survives
  reload;
- kg → lb → reload → finish preserves canonical stored bodyweight;
- Finish workout under adapter outcomes `(true,true)`, `(true,false)`,
  `(false,true)`, `(false,false)`: either accepted replica commits one session,
  clears the draft, and reload/heals; total failure keeps zero new rows and the
  exact draft for a duplicate-free retry;
- after accepted finish, start another workout without reload and assert every
  exercise is restored with no old substitution/date/note/bodyweight context;
- load a legacy draft and finish it successfully.

**Verify**:

```bash
node --check app.js
node test/focus-mode.mjs
REPFORGE_SIM_WEEKS=12 node test/simulation.mjs
```

Expected: both browser suites exit 0 with no failures.

### Step 3: Validate sets atomically and normalize rest seconds

**Findings**: UX-03, UX-10.

Create one input contract used by per-set commit, workout finish, and History:

1. Add pure parsing/validation helpers near `parseDec()`:
   - load: finite and greater than zero for any set being saved;
   - reps: finite, positive, and an integer;
   - numeric RIR: finite and non-negative (fractional RIR remains valid);
   - effort mode: one known effort enum;
   - optional bodyweight: blank or finite and greater than zero.
2. Return structured validation results (`value` or `field/key/message`) rather
   than clamping. Keep `posNum()` only for legacy-data normalization and
   derived calculations; do not use it at user save boundaries.
3. Make **Save set** and **Finish workout** call the same validator. Collect and
   validate every non-pristine touched/committed/warmup candidate, optional
   bodyweight, and a real calendar date before mutating collections, timers,
   unfinished-reminder state, `state.log`, or persistence. Pristine suggestions
   remain unsaved.
   On failure:
   - do not mutate `state.log`;
   - retain draft text exactly;
   - set `aria-invalid="true"` on and focus the first bad field;
   - show a localized field-specific status message.
4. Refactor `saveSessionEdit()` into parse/validate-then-commit:
   - deep-clone every proposed row (a shallow array copy is not atomic);
   - validate every remaining row and real calendar date;
   - replace durable rows only when all proposed rows are valid.
5. Add a localized **Remove set** / **Undo remove** control per History editor
   row. Removal is staged in the editor and applied only with a fully valid
   **Save changes**. Blank load is no longer a deletion gesture. Do not allow
   the final row to be removed through this control; direct the user to the
   existing explicit session deletion action instead.
6. Normalize `restSec` in both `normalizeSettings()` and `commitSettings()` as a
   non-negative integer. Choose one rule and test it consistently: reject
   fractional user input while rounding legacy stored decimals to the nearest
   whole second. A rejected user edit retains the prior value, marks/focuses the
   field, and announces why. Render through `fmtClock()` so Settings and the
   live timer use one formatter.

Extend `test/simulation.mjs` with:

- workout and per-set cases for negative/blank/non-numeric load, zero/negative/
  fractional/blank reps, negative/blank RIR, and invalid bodyweight;
- blank, malformed, impossible, valid leap-day, and invalid leap-day dates for
  Finish workout and History Save changes;
- proof that failed Save set/Finish adds zero rows, keeps the draft, does not
  commit/start rest/arm unfinished reminders, then survives an unrelated
  Settings save + storage `flush()` + reload with the complete log deep-equal;
- valid decimal load and RIR cases in EN/PT numeric input;
- History invalid edit leaves in-memory and stored session deep-equal even after
  an unrelated Settings save + `flush()` + reload;
- explicit remove + undo, remove + save, and invalid sibling + remove (nothing
  commits);
- `90.5` user input rejected; legacy `90.5` normalized once and displayed as a
  valid `M:SS` string.

**Verify**:

```bash
node --check app.js
REPFORGE_SIM_WEEKS=12 node test/simulation.mjs
```

Expected: exit 0 and `FAILED: 0`.

### Step 4: Make onboarding, templates, and block succession transactional

**Findings**: UX-02, UX-08, UX-09.

Replace divergent program-install paths with explicit transitions:

1. Add a `buildProgramMeta()` helper that creates a fresh program identity:
   new ID, localized name, `started:today()`, active mesocycle, no completion
   timestamp, `onboarded:true`, and normalized onboarding answers.
2. Track onboarding origin explicitly as `first-run`, `settings`, or `block`;
   do not infer origin from log length or `onboarded`.
3. Add `finalizeProgramSetup({ exercises, name, answers, destination, origin })`:
   - builds a proposed Program/state/day without assigning live globals;
   - writes program and complete metadata once through
     `commitProposedState(proposal, io)`;
   - awaits `{localOk,idbOk}` and assigns globals, closes onboarding, and routes
     only when at least one is true;
   - leaves onboarding and all globals unchanged for retry when both are false.
4. Call it from onboarding **Save**, **Edit before saving**, and successful
   onboarding Import:
   - first-run/settings onboarding creates a local identity and never copies a
     sender's ID, start, completion status, or history;
   - block onboarding additionally commits the pending successor;
   - normal Program-tab import remains the Plan 026 template-name-only
     replacement and preserves the recipient ID/start/history, but builds one
     complete proposal rather than saving metadata and program separately.
5. Define follow-up timing explicitly. Save and onboarding Import start
   tour/install once after accepted persistence. Edit finalizes metadata and
   opens Program edit, but stores a reserved one-shot marker in the same
   revisioned dual-store proposal (not `repforge_ui_v1`); omit it from backups.
   The first Program **Done** clears the marker through another accepted write,
   then starts follow-up. A failed clear does not launch follow-up; reload cannot
   duplicate or lose the marker.
6. Before block onboarding, deep-copy `pendingBlockTransition` with
   `oldProgramId`, old metadata, old program, review, and intended strategy.
   Choosing onboarding closes the review and starts onboarding without changing
   durable block status.
7. Add async `commitNextBlock()`:
   - for non-onboarding strategies, archive the old program exactly once and
     install the successor in one proposed state;
   - for onboarding, archive only when Save/Edit/Import successfully finalizes
     the successor;
   - Cancel clears the pending transition and leaves the old block active and
     unarchived;
   - verify active ID still matches the captured old ID, guard in-flight work by
     old ID, and archive the captured old program/meta/review—not live globals;
   - close UI/clear pending only after at least one replica accepts the write;
     if both stores fail, restore old globals and leave retry possible.
8. Replace `switchToBeginnerProgram()` with `applyProgramTemplate()` using a
   localized `program.beginner_name`. It creates fresh identity/start/lifecycle
   metadata, preserves log/settings/history, and does not pretend the old custom
   program name still applies. It also builds one proposal and clears an active
   draft only after accepted persistence.
9. Guard exactly-once archival by old program ID. A repeated event or double
   click must not add duplicate `programHistory` entries.
10. Make `finalizeProgramSetup`, normal Program import,
    `applyProgramTemplate`, `commitProposedState`, and `commitNextBlock` accept
    an internal storage adapter; production callers always pass `storageIO`.
    Expose a narrow fake-adapter transition test entry point so tests exercise
    real proposal/assignment/rollback logic, not detached writes.

Extend the program/onboarding/block phases in `test/simulation.mjs`:

- clear `repforge_ui_v1` between isolated first-run cases;
- Save/Edit/Import from each onboarding origin set `onboarded:true`, preserve
  answers where applicable, and survive reload;
- Save/Import trigger follow-up once; Edit triggers none before Program Done,
  exactly one after Done, and none again after reload;
- imported sender lifecycle fields are not adopted;
- normal Program-tab import preserves recipient ID/start/history;
- block-review onboarding Cancel leaves old ID active and history unchanged;
- subsequent onboarding Save/Edit/Import archives the captured old
  program/meta/review exactly once and activates a new ID;
- for first-run/settings/block Save, Edit, and Import plus direct block
  strategies, normal Program import, and beginner replacement, test adapter
  outcomes `(true,true)`, `(true,false)`, `(false,true)`, `(false,false)`:
  either one accepted replica commits and reload/heals; total failure rolls all
  globals/pending UI back, preserves any draft, and permits retry;
- double click/repeated completion creates one archive/successor;
- beginner replacement gets a localized new name/ID/start date, active status,
  preserves all log rows, and keeps prior program-history entries;
- Settings → Create program → Cancel remains a no-op for lifecycle.

**Verify**:

```bash
node --check app.js
REPFORGE_SIM_WEEKS=12 node test/simulation.mjs
```

Expected: exit 0 and `FAILED: 0`.

### Step 5: Make notification preference and permission agree

**Findings**: UX-04.

1. Add one async `setNotificationsEnabled(wanted)` path backed by a monotonic
   intent generation and a latest-desired-state value. An enable call captures
   its generation, awaits `RepForgeNotify.request()`, and may apply its result
   only if that generation is still current, the latest intent is still on,
   and the browser's current permission agrees. Turning off or observing
   revocation increments the generation, persists off immediately, and makes
   any outstanding request result stale. Coalesce duplicate enable clicks for
   the same generation, expose pending state with `aria-busy` and localized
   status copy, but leave Off available to invalidate the request. Never
   persist enabled before a current request resolves `granted`:
   - `granted`: store enabled and render on;
   - `default`, `denied`, or `unsupported`: store disabled, render off, and
     show localized next-step copy.
2. On Settings render and `visibilitychange`, reconcile a previously enabled
   preference with current browser permission. Revocation turns effective
   enabled state off but preserves individual reminder-type choices.
3. Disable reminder-type controls whenever notifications are not effectively
   enabled. Distinguish unsupported, prompt-needed, denied, and granted status
   text.
4. Give `#notifyToggle` a translated accessible name and keep `aria-pressed`
   synchronized with the effective state.
5. Do not promise background delivery and do not change service-worker
   notification fallback behavior in `notify.js`.

Extend `test/notifications.mjs` using isolated contexts/init scripts for:

- unsupported API;
- request returns `default`;
- request returns `denied`;
- request returns `granted`;
- external permission revocation followed by `visibilitychange`;
- rapid on → off while a permission request is unresolved (the late grant must
  not turn the setting back on), duplicate on clicks (one request), and
  revocation/`visibilitychange` while a request is unresolved;
- reminder-type preferences survive failed permission/revocation;
- toggle, pending state, status text, disabled controls, persisted state, and
  `aria-pressed` agree in every case.

**Verify**:

```bash
for f in app.js notify.js test/notifications.mjs; do node --check "$f" || exit 1; done
node test/notifications.mjs
REPFORGE_SIM_WEEKS=12 node test/simulation.mjs
```

Expected: both browser suites exit 0 with zero failures.

### Step 6: Standardize modal, status, selection, and disclosure semantics

**Findings**: UX-07, UX-16, A11Y-02 (semantic portion).

Add two small shared interaction helpers, not a UI framework:

1. `openModal(element,{initialFocus,returnFocus,onEscape})` /
   `closeModal(element)`:
   - remember the trigger;
   - show the element and set initial focus;
   - snapshot `inert` on every direct `body` child and inert every sibling
     except the active dialog, its scrim, and a dedicated noninteractive
     `#announcementHost` (top-level legacy controls and other overlays must not
     remain interactive);
   - contain forward/reverse Tab within enabled focusables;
   - close on Escape when allowed;
   - restore every sibling's prior inert state and return focus on close;
   - allow only one active modal. A second open is rejected unless the caller
     uses an explicit atomic handoff that transfers the original opener and
     never exposes or focuses the background between dialogs.
2. Migrate Block Review, Import Choice, End Block Confirm, and the exercise-note
   sheet to the helper. Preserve each overlay's visual classes/animation.
   Keep the native storage-recovery dialog blocking and route it through the
   same active-modal registry so another modal cannot open behind it. Implement
   this policy table exactly:

   | Dialog | Initial focus | Escape / outside policy | Close timing and return |
   |---|---|---|---|
   | Storage Recovery | first non-destructive recovery action; otherwise the focusable dialog heading | Escape and outside click do nothing until a valid recovery choice | synchronous after resolution; return to its opener, or focus the Today heading when boot opened it |
   | Block Review | `#blockReviewClose` | Escape closes; there is no dismissing scrim | synchronous; return to the original opener (`#endBlock` after the normal flow) |
   | Import Choice | `#importCancel` | Escape is Cancel; outside click does nothing | synchronous; return to the import trigger |
   | End Block Confirm | `#endBlockCancel` | Escape is Cancel; outside click does nothing | Cancel returns to `#endBlock`; Review performs an atomic handoff to Block Review and transfers `#endBlock` as the final return target |
   | Exercise Note | `#exNoteText` | Escape and `#exNoteScrim` are Cancel | keep trap/inertness until transition end (or the reduced-motion/imposed timeout fallback), then hide and return to the exact note trigger |

   Save follows the same close timing as Cancel for Exercise Note. No close path
   may restore focus before its element is actually hidden.
3. Add `setDisclosure(button,panel,open)` and wire Rest timer, RIR mode,
   progression, notification types, backup, and import rows. Every button gets
   `aria-expanded` and `aria-controls`; every panel's hidden/visible state and
   chevron follow the same boolean.
4. Convert the session reminder's main action into a real button. Keep its
   independent dismiss button; do not nest buttons.
5. Add `#announcementHost` as a direct `body` child with no focusable
   descendants and no pointer interaction. It remains outside modal inertness
   solely so announcements work while a modal is open. Put `#toast` inside it
   as a persistent `role="status"`, `aria-live="polite"`,
   `aria-atomic="true"` region. Update `toast()` in an order that reliably
   announces new text after the live region is visible. Support an explicit
   assertive/`role="alert"` path only for destructive persistence failures such
   as both stores rejecting a save; routine validation remains polite. Do not
   repeatedly announce rest-timer ticks through either path.
6. Remove `aria-live` from the ticking `#restBar`. Add/update a separate polite
   completion status inside `#announcementHost` exactly once when the timer
   reaches zero, independent of whether OS reminder delivery is enabled.
7. Add `aria-pressed` to List/Focus layout buttons and synchronize it in
   `setLogMode()` and `enterWorkout()`.

Create `test/accessibility.mjs`, reusing `test/browser.mjs`. At this step it
must cover:

- each modal's initial focus, forward/reverse wrap, Escape policy, background
  inertness, and trigger focus return (storage recovery intentionally cannot
  Escape until resolved);
- two consecutive and End Block Confirm → Block Review chained modals do not
  leak inertness/listeners and return to the original opener;
- a both-store persistence failure raised while Import Choice is open remains
  exposed as an assertive announcement, while `#announcementHost` contains no
  operable background content;
- all six disclosure buttons report and control their panel state;
- session banner action works with Enter and Space; dismiss remains independent;
- new and repeated-identical toast text appears in mutation-observed order in an
  atomic polite status region; a simulated both-store failure uses the
  assertive alert path and the next routine toast restores polite semantics;
- rest countdown mutations are not live; foreground expiry and
  `visibilitychange` catch-up each announce completion exactly once with OS
  notifications enabled and disabled, including across repeated visibility
  changes;
- List/Focus always has exactly one pressed button.

**Verify**:

```bash
for f in app.js test/accessibility.mjs; do node --check "$f" || exit 1; done
node test/accessibility.mjs
REPFORGE_SIM_WEEKS=12 node test/simulation.mjs
```

Expected: both browser suites exit 0 with zero failures.

### Step 7: Build one History index and make History operable

**Findings**: UX-11, PERF-01.

1. Add a pure `buildHistoryIndex(log)` helper that performs one pass and returns:
   - one copied row array plus stable session/row identities so source access
     ends after the input pass;
   - sorted session records with their row arrays;
   - normalized searchable day/exercise text;
   - chronological per-lift session metrics, predecessor links, and the
     precomputed delta counts used by each session summary;
   - date/month groupings with session/set counts and calendar PR marks,
     deriving PRs from the copied rows rather than calling
     `detectPRs(state.log)`;
   - the flattened rows needed by the “Every set” table.
   Sorting and derived reductions may inspect the copied arrays after the one
   source iteration; they may not return to the input object.
2. `renderHistory()` builds the index once and passes it to
   `renderHistoryCalendar(index)`. Filtering, summaries, editor rows, month
   grouping, and the “Every set” table reuse the model; no code inside a
   per-session loop—or after the model is built—may read `state.log`.
3. Add `searchHistoryIndex(index,query)` with the current contract:
   case-insensitive substring matching over day plus displayed exercise name.
   Expose a read-only
   `window.__repforgeHistory = { buildIndex, searchIndex, renderWithSource,
   diagnostics }`. `renderWithSource(source)` must save the original
   `state.log`, bind `state.log` to the injected source, call the exact
   production render pipeline, and restore the original in `finally`; it may
   not be a test-only reimplementation. This makes closed-over helpers hit the
   same guarded source. Diagnostics remain useful for reporting builds and
   source-row consumption, but they are not the proof that no hidden source
   reads occurred.
4. Render each session as an article containing a dedicated expansion button
   with `aria-expanded` and `aria-controls`; render Edit/Delete in a separate
   controlled region so no button nests inside another.
5. Give `#historySearchBtn` `aria-expanded`/`aria-controls` and the search input
   a translated accessible name. Add a visible translated Clear action. Search
   cannot collapse while non-empty; Clear empties/rerenders first, after which
   the toggle may collapse it.
6. Add translated **No matching sessions** copy distinct from the first-run
   empty state. Keep the unfiltered “Every set” table behavior explicit.

Extend `test/simulation.mjs` for query-by-day/name, clear, no-match copy,
hide/show persistence rule, Enter/Space expansion, expanded-state attributes,
and independent Edit/Delete actions.

Add a deterministic algorithmic check to `test/accessibility.mjs` or a focused
History phase:

- seed at least 5,000 sessions / 20,000 rows;
- wrap the source array in a Proxy/counting iterable that counts index,
  iterator, and length access and throws on any access after index construction;
- assert `buildHistoryIndex` consumes exactly 20,000 source rows (one visit per
  row) and returns exact session ordering, per-lift predecessor/delta results,
  PR/month marks, search text, table ordering, and edit/delete identities;
- assert filtering five different queries touches indexed session search text,
  not the original row iterable (its count must remain 20,000);
- reset diagnostics, invoke `renderWithSource(proxy)` so both the production
  renderer's argument and closed-over `state.log` reference the same
  self-revoking Proxy; revoke source access immediately after index
  construction. Assert one index build, exactly 20,000 source-row visits, no
  thrown post-build access, restoration of the original `state.log` in both
  success and injected-error cases, and the same ordering, delta, PR/month,
  table, search, and edit/delete results;
- render and search the large fixture while collecting elapsed time as
  diagnostic output, but make the non-quadratic iteration bound the CI gate.

Do not replace this with a tight wall-clock-only threshold; shared CI timing is
too noisy. The release invariant is linear source-row consumption plus correct
large-fixture UI behavior.

**Verify**:

```bash
node --check app.js
node test/accessibility.mjs
REPFORGE_SIM_WEEKS=12 REPFORGE_PROFILE=1 node test/simulation.mjs
```

Expected: zero failures; History fixture reports a linear iteration count.

### Step 8: Meet the visual accessibility contract and fix bodyweight copy

**Findings**: UX-05, UX-06, A11Y-01, A11Y-02 (focus/touch portion).

1. Change the viewport meta to
   `width=device-width, initial-scale=1, viewport-fit=cover`; remove
   `maximum-scale` and `user-scalable=no`.
2. Retain `touch-action:manipulation` and 16px-or-larger editable fields so
   repeated steppers and iOS focus remain stable. Change nested Focus gesture
   policies so zoom is not re-blocked: the Focus card and scrollable ledger use
   `pan-y pinch-zoom`; a non-scrolling ledger uses `pinch-zoom`. Preserve
   horizontal card swipes through the existing pointer handlers.
3. Change `--ink-faint` to a token that reaches at least 4.5:1 on `--bg`,
   `--surface`, and `--well`. `#716D66` is a verified starting value
   (4.60:1 on `--bg`); remeasure after final CSS.
4. Use `--accent-deep` for normal-size orange text/links. Keep the brighter
   `--accent` for non-text graphics, focus outlines, borders, chart marks, or
   sufficiently large text.
   Replace `draw()`'s hard-coded faint/accent text colors with a
   `chartPalette()` read from compliant CSS tokens; chart lines/points may keep
   the brighter graphical accent.
5. Restore a visible `:focus-visible` treatment for Settings and Strength
   selects by fixing both later CSS overrides. Do not remove the global focus
   outline.
6. Bring compact actionable controls to at least 44×44 CSS pixels, including
   the session-banner close target. Preserve dense layout by enlarging hit area
   rather than glyphs where necessary.
7. Replace `updateBodyweightField()`'s inserted English text node with one
   update to the existing translated `<span>`. Reuse and verify the existing
   `log.bodyweight_unit` EN/PT key with `{unit}`. Exactly one label must appear
   in kg/lb and EN/PT.
8. Extend `test/accessibility.mjs`:
   - viewport does not prohibit zoom;
   - root/controls retain `touch-action:manipulation`; Focus card/ledger expose
     the pinch-compatible policies above;
   - every visible editable input/select/textarea has computed font size ≥16px;
   - walk every visible text node—not a token/selector allowlist—in empty and
     populated states for every view, modal, tour step, chart, toast, banner,
     editor, and error state in EN/PT. Resolve literal colors, all CSS tokens,
     inherited opacity, pseudo-element text, translucent ancestors/overlays,
     and alpha-composite foreground/background layers before asserting every
     normal-size meaningful text instance reaches 4.5:1. Keep each
     large-text/disabled exemption explicit and individually justified;
   - expose `window.__repforgeChartPalette` or intercept canvas
     `fillText`/`fillStyle`; exercise both `#chart` and `#exChart` in empty and
     populated EN/PT states and assert every canvas text color is 4.5:1 against
     its alpha-composited chart background while graphical strokes remain
     exempt;
   - inventory `button`, `a[href]`, `summary`, visible
     `input:not([type=hidden])`, `select`, `textarea`, `[role=button]`,
     `[role=tab]`, `[role=switch]`, `[role=checkbox]`,
     `[tabindex]:not([tabindex="-1"])`, and any element recorded by the test's
     pre-init click/keyboard-listener registry. Across all dynamic states and
     all three launch viewports, every visible action—including inline
     `.term[data-term]`—must have both computed hit-box width **and** height
     ≥44px. There are no target-size exemptions; use pseudo-elements/padding
     when visual density must stay unchanged;
   - Settings and Strength selects show a non-zero focus outline/ring;
   - bodyweight label is singular and translated in four language/unit states.
9. Update the old simulation assertion that currently requires disabled zoom
   and the Focus suite assertion that currently requires `pan-y`/`none`.

Manual testing must include pinch zoom over the Focus card, scrolling and
non-scrolling Focus ledgers, List set table, and History rows, plus rapid
repeated stepper taps on a touch-capable browser. Automated metadata checks
alone do not prove those gestures coexist.

**Verify**:

```bash
for f in app.js test/accessibility.mjs test/simulation.mjs; do node --check "$f" || exit 1; done
node test/accessibility.mjs
node test/focus-mode.mjs
REPFORGE_SIM_WEEKS=12 node test/simulation.mjs
```

Expected: every suite exits 0 with zero failures.

### Step 9: Remove misleading affordances and stale product copy

**Findings**: UX-12, UX-13, UX-14, UX-15, UX-18.

Use the launch-safe treatments already chosen in the audit:

1. In `renderExerciseView()`, render **12 weeks** as static text without caret/
   button styling. Render load/e1RM record summaries as static rows without
   chevrons. Keep **See all PRs** as the only button because it has a handler.
   Static range/record elements must have no button role, pointer cursor, caret,
   chevron, or actionable class.
2. Remove the duplicate page-header `#statsPeriod` and its click handler.
   Retain `#volWindow` inside **Completed hard sets** as the sole 7/28-day
   control; its existing tab semantics must stay synchronized.
3. Update tour step 3 in EN/PT to teach swipe plus header chevrons in Focus.
   Define deterministic, non-mutating choreography:
   - step 0: Today dashboard;
   - step 1: active List with overflow open so day/date are visible;
   - step 2: active List with overflow open so List/Focus controls are visible;
   - step 3: Focus with overflow closed and header arrows visible;
   - step 4: Focus with header rest control visible;
   - step 5: List with Finish workout scrolled into view;
   - steps 6–10: Progress, History, Program, Settings, install as named.
   Give Tour `aria-modal="true"` and use the Step 6 modal helper: initial focus
   is Skip, Tab is contained, Escape means Skip, and the preview surface is
   inert so only tour controls can mutate state. Track origin explicitly:
   `first-run` or `replay`. For replay, snapshot and restore active view,
   Settings/program/stats subview, workout active/left state, List/Focus mode,
   focus index/edit state, overflow state, selected day/date, and per-view
   scroll positions on both Skip and Done; return focus to `#replayTour`.
   First-run Skip and Done mark the tour complete and end on the Today dashboard
   with focus on `#startWorkout`.

   Choreography uses a render-only preview model. If all real exercises are
   skipped, preview the program's unfiltered first exercise without changing
   `skipped`; if rest is disabled, show the existing header rest-control
   location in a disabled preview with localized enable-in-Settings guidance,
   and never start a timer. Never synthesize/save sets or mutate draft, log,
   program, Settings, notification state, workout context, or persisted UI
   state other than the first-run `tourDone` flag. Review all tour copy against
   current labels without changing the number of steps.
4. Rename **Delete all data** to **Delete workout history** (localized).
   Confirmation and supporting copy must state that saved log rows plus the
   active draft/unfinished reminder are removed, while program and Settings
   remain. Keep behavior aligned with that copy.
5. Change the manifest description and README feature/data wording from
   machine-only/localStorage-only to the current local-only progressive-
   overload product with machines, cables, dumbbells, barbells, and bodyweight.
   Do not promise account sync or cross-device recovery.
6. Add `test/i18n.mjs`:
   - scan each locale's raw JSON token stream before `JSON.parse()` and fail on
     any duplicate object key at any nesting level (plain parsing silently keeps
     only the last duplicate), then parse both locale JSON files;
   - evaluate/extract the two runtime dictionaries from `i18n.js` in an isolated
     VM context;
   - assert exact key/value parity between each JSON and runtime dictionary;
   - assert every `data-i18n`, `data-i18n-aria`,
     `data-i18n-placeholder`, and `data-i18n-title` key in `index.html` exists
     in both languages;
   - extract every literal `t()`/`tp()` key referenced from JavaScript and
     maintain an explicit finite expansion table for each dynamic family
     (including tour steps, onboarding steps, months, weekdays, status/delta
     families, and plural forms). Fail when a dynamic expression has no
     enumerated family instead of silently skipping it;
   - assert EN/PT values use identical `{placeholder}` name sets for every key;
   - run the populated simulation views in both languages with missing-key/raw-
     key fallback instrumentation and fail if any static or dynamic key renders
     as a raw key or fallback language.
7. Extend simulation assertions: static exercise-detail range/records have no
   semantic/visual action residue: no actionable element/ancestor, `tabindex`,
   pointer cursor, actionable class, `onclick`, or registered activation
   listener. Dispatch click, Enter, and Space and prove route, draft, log, and
   selection stay unchanged. Assert `#statsPeriod` is absent, tour
   copy/choreography matches current controls in both languages, modal focus
   behavior passes, first-run exit is deterministic, replay restores the full
   snapshot after both Skip and Done, and disabled-rest/all-skipped previews are
   non-mutating,
   deletion copy and retained state agree, manifest/README positively name
   broad equipment support and no longer claim machine-only or localStorage-only,
   and tour previews never change draft/log state.

**Verify**:

```bash
for f in app.js i18n.js test/i18n.mjs test/simulation.mjs; do node --check "$f" || exit 1; done
node test/i18n.mjs
REPFORGE_SIM_WEEKS=12 node test/simulation.mjs
```

Expected: i18n parity passes; simulation exits 0 with `FAILED: 0`.

### Step 10: Make coaching counts and destinations truthful

**Findings**: UX-17, UX-20.

1. Replace `flatGuess` in `renderThisWeek()` with
   `weeklySnapshot().flatLifts`. Do not redefine recommendation or attention
   groups.
2. Add visible, localized destination labels to coaching rows:
   - Ready to progress → **Details** (Exercise detail);
   - new/stale → **Log**;
   - reduce/volume/fatigue → **View trend**.
3. Keep existing destinations unless a current handler is broken. The fix is
   predictability before tapping, not another navigation redesign.
4. Store exercise ID—not display name—in each coaching row's data attribute and
   resolve destinations by ID so duplicate exercise names cannot misroute.
5. Ensure the destination phrase participates in the accessible name and is
   not conveyed only by color/chevron.
6. Extend simulation fixtures:
   - an improved, flat, regressed, one-session, and old-but-untrained lift;
   - assert “stable” equals only exact flat comparisons from the current week;
   - assert each coaching group shows the right destination verb and activation
     lands on the advertised view/content;
   - include duplicate exercise names on different days and prove each row
     opens/logs the exercise ID it represents.

**Verify**:

```bash
node --check app.js
REPFORGE_SIM_WEEKS=12 node test/simulation.mjs
```

Expected: exit 0 and `FAILED: 0`.

### Step 11: Enforce the integrated pre-launch gate and refresh the PWA shell

**Findings**: all 24 integrated.

1. Update `.github/workflows/simulation.yml` so CI runs the pinned test-only
   bootstrap `(cd test && npm ci && npx playwright install chromium --with-deps)`
   before the existing server setup, then:
   - syntax for all runtime/test JS, including `sw.js`;
   - `test/schedule.mjs`;
   - `test/i18n.mjs`;
   - `test/persistence.mjs`;
   - `test/persistence-race.mjs`;
   - `test/thermonuclear-races.mjs`;
   - `test/adversarial-draft-transactions.mjs`;
   - `test/notifications.mjs`;
   - `test/recover-gate.mjs`;
   - `test/accessibility.mjs`;
   - `test/history.mjs`;
   - `test/focus-mode.mjs`;
   - `test/program-draft-conflicts.mjs`;
   - `test/program-draft-set-reduction.mjs`;
   - `test/program-draft-day-rename.mjs`;
   - `test/workout-day-context-discard.mjs`;
   - `test/manual-matrix.mjs --self-test`;
   - the full 52-week profiled integrated simulation.
2. Increase the job timeout explicitly (start at 30 minutes and adjust only from
   measured green-run evidence). Do not hide failures with `continue-on-error`.
3. Advance the implementation branch's `sw.js` cache version after the final
   shell edits (the audited final value is `repforge-v61`). Confirm every
   changed runtime asset remains in `ASSETS`/`SHELL`.
4. Extend PWA assertions from a new browser context and one canonical
   `http://127.0.0.1:8000` origin. Unregister workers, delete CacheStorage,
   clear origin storage and the browser HTTP cache, seed canonical training
   state, register/wait for `repforge-v61`, then:
   - fetch each shell asset online with cache bypass and compare its bytes and
     content type with the matching CacheStorage response;
   - clear the HTTP cache again without deleting CacheStorage, switch the
     context offline, require navigation/shell responses to report
     `fromServiceWorker()`, and reload/navigate all four tabs;
   - before offline, while offline, and after reconnect, read both
     `repforge_v1` replicas plus `repforge_draft_v1`. Compare a stable
     key-sorted canonical domain snapshot (all program, log, Settings, metadata,
     and draft fields; `_storageRevision` compared separately) and require both
     replicas to agree. An HTTP-cache fallback or one-store-only comparison is
     a failure.
5. Implement `test/manual-matrix.mjs` as the deterministic reset/fixture helper
   specified below. Before any physical-device cell, require a branch-
   addressable HTTPS release-candidate origin serving the exact implementation
   commit and run the local/remote shell-asset hash command from **Commands you
   will need**. A production URL, a preview of another commit, or loopback on
   the phone is not acceptable. If the repository has no such preview
   deployment, this is a STOP prerequisite: request/provision the preview
   origin before claiming the manual gate. Then perform the six-cell matrix,
   keeping a per-cell evidence ledger, two concise successful physical-device
   videos (iOS/VoiceOver and Android/TalkBack), and one final-state screenshot
   per cell. Do not attach failed attempts.
6. Correct setup guidance in `AGENTS.md` and the verification preamble in
   `plans/README.md`: the application remains build-free/dependency-free and
   local-only, durable state is mirrored in localStorage + IndexedDB, draft
   state is localStorage-only, browser suites use pinned test-only dependencies
   under `test/`, and the documented service-worker shell matches `sw.js`.
   Do not add generic npm/build instructions for running the application.
7. Mark Plan 041 DONE in `plans/README.md` only after automated and manual gates
   both pass. Plan 040 remains an audit record, not “fixed” documentation.

**Verify**:

```bash
(cd test && npm ci && npx playwright install chromium --with-deps)
for f in app.js i18n.js notify.js schedule.js sw.js test/*.mjs; do node --check "$f" || exit 1; done
node test/schedule.mjs
node test/i18n.mjs
node test/persistence.mjs
node test/persistence-race.mjs
node test/thermonuclear-races.mjs
node test/adversarial-draft-transactions.mjs
node test/notifications.mjs
node test/recover-gate.mjs
node test/accessibility.mjs
node test/history.mjs
node test/focus-mode.mjs
node test/program-draft-conflicts.mjs
node test/program-draft-set-reduction.mjs
node test/program-draft-day-rename.mjs
node test/workout-day-context-discard.mjs
node test/manual-matrix.mjs --self-test
REPFORGE_SIM_WEEKS=52 REPFORGE_PROFILE=1 node test/simulation.mjs
git diff --check
```

Expected: every command exits 0; every browser suite reports `0 failed`;
simulation reports `FAILED: 0`; patch hygiene is clean.

## Manual pre-launch matrix

This is exactly **six paired combinations, not twelve**:

| Cell | Viewport / locale / unit | Required platform assignment |
|---|---|---|
| C1 | 320×568 / English / kg | Desktop Chromium responsive mode; keyboard and 200% browser zoom; notification adapter covers unsupported/default/pending races |
| C2 | 390×844 / English / kg | Physical iOS Safari; real pinch and VoiceOver; native notification prompt where supported |
| C3 | 430×932 / English / kg | Physical Android Chrome; real pinch and TalkBack; native grant then site-settings revocation |
| C4 | 320×568 / Portuguese / lb | Desktop Chromium responsive mode; keyboard and 200% browser zoom; notification adapter covers denied/granted/revoked |
| C5 | 390×844 / Portuguese / lb | Physical iOS Safari; real pinch and VoiceOver; native denial/grant or the truthful unsupported state |
| C6 | 430×932 / Portuguese / lb | Physical Android Chrome; real pinch and TalkBack; native grant then site-settings revocation |

Use only `http://127.0.0.1:8000` for desktop cells. Set
`REPFORGE_RC_ORIGIN` to one branch-addressable HTTPS release-candidate origin
for physical cells; never alternate hostnames within a cell. Before C2/C3/C5/C6,
run and save the shell-asset hash verification command and `git rev-parse HEAD`.
If any byte differs or no exact-commit HTTPS origin exists, stop the physical
matrix. Record the verified commit, exact origin, browser/OS version, device,
and screen reader in the evidence ledger.

Implement `test/manual-matrix.mjs` with these deterministic commands:

```bash
node test/manual-matrix.mjs --self-test
node test/manual-matrix.mjs --emit-fixtures /tmp/repforge-launch-041
node test/manual-matrix.mjs --prepare C1 --fixture clean --permission unsupported --headed
```

- `--self-test` validates the six cell definitions, fixed seed
  `repforge-launch-041`, fixture schemas, expected row/session counts, and
  stable hashes.
- `--emit-fixtures` writes, outside the repository, full-backup JSON plus
  Web-Inspector/remote-debugging seed snippets for `clean`, `populated`,
  `block-review`, `local-newer`, `idb-newer`, `legacy-divergent`,
  `large-history`, and `coaching`. Dates are deterministic offsets from the
  run's recorded test date; IDs come from the fixed seed.
- `--prepare <C1..C6>` rejects a viewport/locale/unit mismatch, unregisters
  workers, deletes CacheStorage, clears localStorage, IndexedDB, drafts,
  sessionStorage, HTTP cache, and prior permission overrides for the exact
  origin, seeds both stores, applies one of `native`, `unsupported`, `default`,
  `denied`, `granted`, `revoked`, or `pending` through the same permission
  adapter seam as the focused suite, prints before/after store hashes, and opens
  the headed desktop cell.
  `pending` exposes explicit test controls to resolve the outstanding request;
  those controls must never ship in normal app rendering.
- On iOS, reset the exact release-candidate origin through Safari Website Data;
  on Android, use Chrome Site settings → the exact origin → Clear & reset.
  Then import the emitted full-backup fixture or run its generated storage seed
  snippet through Safari Web Inspector/Android remote debugging. Record the
  emitted fixture hash in the ledger before testing.
- Re-run `--prepare` or the physical-device reset before every checklist row.
  Do not reuse a mutated profile from a prior row. Use `clean` for first-run,
  the named conflict fixtures for persistence, `block-review` for lifecycle,
  `large-history` for History, `coaching` for Progress, and `populated`
  elsewhere.

Copy this checklist to
`/opt/cursor/artifacts/repforge_prelaunch_matrix.md`. Replace every box with
`PASS — <artifact path>#<timestamp/region>`; a blank cell is a failed gate.
Expected results are part of each row:

| Scenario and expected result | C1 | C2 | C3 | C4 | C5 | C6 |
|---|---|---|---|---|---|---|
| Persistence: newer replica wins/heals; legacy divergence blocks until each explicit choice; both raw copies export | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Onboarding/block: Save, Edit, Import complete from first-run/Settings/block; Cancel is a no-op; predecessor archives once | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| List workout: context, warmup, skip, substitutions and valid sets resume/finish; invalid values commit nothing | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Focus workout: swipe/arrows, committed-set edit, timer, note sheet, skip/reload and finish preserve one coherent draft/log | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| RIR/rest: active draft blocks numeric↔effort; empty draft permits it; rest remains a whole non-negative duration | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| History: search/clear/no-match, keyboard expansion, atomic edit/remove, calendar/deltas and large fixture stay correct/responsive | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Progress: exact stable count, ID-correct advertised destinations, scoped 7/28 control, static range/records | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Settings/notifications/delete: assigned permission states and pending races stay truthful; disclosures work; deletion preserves program/Settings | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Tour: every step matches its preview; focus is contained; disabled-rest/all-skipped cases work; Skip and Done obey origin-specific restoration | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Accessibility: modal lifecycle, visible focus, zoom/pinch, rapid taps, 44×44 targets, contrast, repeated toast, destructive alert and one rest completion announcement all pass | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| PWA: v56 controls, install copy is current, all four tabs work offline from the worker, and both stores/draft are byte-equivalent after reconnect | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |

Use VoiceOver for every C2/C5 live-region cell and TalkBack for every C3/C6
live-region cell; the Chromium accessibility tree is supplementary in C1/C4.
Capture one concise successful iOS/VoiceOver video and one Android/TalkBack
video showing the primary flow, real pinch, and live announcements, plus one
final-state screenshot for each C1–C6. A checklist cell may cite a timestamp in
one of those videos or a bounded region in its cell screenshot, so redundant
artifacts are unnecessary.

Any fixture/hash mismatch, data mismatch, console error, keyboard trap,
untranslated/raw key, stale worker asset, missing evidence cell, or failed
suite blocks release.

## Test plan by file

| Test file | New responsibility |
|---|---|
| `test/persistence.mjs` | Replica selection, legacy-conflict recovery, corrupt-state protection, healing, write ordering, import/backup metadata |
| `test/persistence-race.mjs` | Same-page/cross-tab state-change rebasing and transactional destructive reset races |
| `test/thermonuclear-races.mjs` | One-sided acceptance, delayed boot repair, Finish locking, and same-old-program cross-tab completion |
| `test/notifications.mjs` | Permission/preference truth table and revocation |
| `test/accessibility.mjs` | Dialog lifecycle, disclosures, live status, controls, zoom, contrast, focus, targets, large History index |
| `test/i18n.mjs` | EN/PT JSON ↔ runtime dictionary ↔ DOM/JavaScript key parity, placeholder parity, and raw-fallback rejection |
| `test/manual-matrix.mjs` | Deterministic six-cell definitions, resets, fixture emission/seeding, permission modes, and evidence metadata |
| `test/focus-mode.mjs` | Resumed Focus skip/substitution/draft context |
| `test/program-draft-set-reduction.mjs` | Program set-count reductions cannot orphan meaningful active-draft sets |
| `test/workout-day-context-discard.mjs` | Confirmed day switches discard stale session date, note, and bodyweight context while Cancel preserves the draft byte-for-byte |
| `test/simulation.mjs` | Integrated validation, onboarding/block/template, History, coaching, copy, manifest, PWA |
| `test/recover-gate.mjs` | Existing recommendation recovery regressions; unchanged behavior |
| `test/schedule.mjs` | Existing scheduling baseline; unchanged behavior |

No test may rely only on a screenshot, translated English text while the app is
in Portuguese, or a wall-clock microbenchmark. Assert durable state and
semantics directly, then use visual artifacts as supplementary evidence.

## Done criteria

All items are mandatory:

- [ ] The coverage matrix still contains all 24 unique audit IDs.
- [ ] DATA-01: explicit revisions boot the highest valid snapshot and heal the
      other store; equal/legacy divergence never overwrites either copy without
      user selection; invalid/no-valid state never silently resets; imports and
      backups preserve local ordering.
- [ ] UX-01/19: every meaningful in-progress session field survives reload and
      unit changes; every skip/day mutator persists; RIR mode cannot change the
      raw draft.
- [ ] UX-02/08/09: every program-install path produces coherent metadata and
      block archival is exactly-once, uses the captured predecessor, and occurs
      only after at least one replica accepts the successor.
- [ ] UX-03/10: invalid set/history data never mutates in-memory or durable log
      state/side effects and rest displays valid whole-second clock text.
- [ ] UX-04: persisted/effective notification state, permission status, and
      controls agree for unsupported/default/denied/granted/revoked; stale
      pending results cannot override the latest intent.
- [ ] UX-05/06 and A11Y-01: singular localized bodyweight copy, zoom allowed,
      repeated taps stable, meaningful text ≥4.5:1.
- [ ] UX-07/11/16 and A11Y-02: modal, History, live-status, selection,
      disclosure, focus, and touch semantics pass keyboard/browser tests.
- [ ] UX-12/13/14/15/18: no dead controls, false global period, stale tour,
      misleading deletion, or stale machine-only positioning remains.
- [ ] UX-17/20: coaching destinations are visible and weekly stable count is
      exact.
- [ ] PERF-01: History source rows are indexed linearly once per render and the
      large fixture remains correct/responsive.
- [ ] EN/PT dictionaries, DOM/JavaScript key families, and placeholders have
      exact parity; raw locale files contain no duplicate keys; no raw-key
      fallback appears.
- [ ] A fresh checkout completes the test-only bootstrap, and `AGENTS.md` /
      `plans/README.md` accurately distinguish the dependency-free application
      from the pinned browser-test harness and document both durable replicas.
- [ ] `node test/schedule.mjs` reports 8/8.
- [ ] Every focused browser suite exits 0 with zero failures.
- [ ] Full simulation exits 0 with `FAILED: 0`.
- [ ] CI runs the entire release suite without allowed failures.
- [ ] Service-worker cache version is incremented; cached bytes match the
      network shell; offline responses come from the worker; both replicas and
      the draft remain canonically identical.
- [ ] All six paired manual cells (three viewports × EN/kg and PT/lb), not
      twelve independent combinations, have PASS evidence with the assigned
      physical pinch/screen-reader coverage, and the recorded HTTPS shell hashes
      match the implementation commit.
- [ ] No files outside Scope changed, except this plan's status row.
- [ ] `git diff --check` exits 0.

## STOP conditions

Stop and report; do not improvise, defer, or silently change product behavior if:

- The implementation would need to wrap/rename `repforge_v1` in a way that
  breaks existing backups or root-level state consumers. Re-plan the migration.
- The storage-recovery dialog cannot preserve/export both unresolved raw
  replicas or requires an automatic choice between divergent equal revisions.
- An old draft cannot be normalized without losing set values; preserve it and
  add a migration fixture before continuing.
- Validation changes recommendation/capacity behavior for already-stored legacy
  rows. Input validation must be prospective.
- Program transition tests show duplicate/wrong archive entries, log loss, or
  globals that cannot roll back after total persistence failure.
- Browser permission cannot be deterministically controlled in the focused
  suite; add a narrow notification adapter/test seam rather than deleting the
  denied/revoked cases.
- The pinned test-only `npm ci` or Chromium install fails after one clean retry,
  or would require adding a root/application dependency. Preserve the existing
  `test/` boundary and report the bootstrap failure.
- No branch-addressable HTTPS release-candidate origin serves byte-identical
  shell assets for the implementation commit. Do not substitute production,
  another commit's preview, or phone loopback; provision/identify the exact
  preview before physical-device testing.
- Shared modal handling breaks the note-sheet animation or leaves any background
  region inert after close.
- Contrast compliance appears to require removing the editorial hierarchy.
  Adjust compliant tokens/weight/spacing; do not waive 4.5:1.
- History optimization changes ordering, search semantics, calendar counts, or
  edit/delete identity.
- A new user-facing string cannot be translated accurately into Portuguese.
  Stop for copy review; do not ship English fallback as PT.
- Any focused suite fails after two reasonable corrections, the full simulation
  reports a failure, or CI/browser verification is unavailable.
- Completing a finding appears to require an out-of-scope feature (new chart
  ranges, factory reset, global analytics period). Use the explicit launch-safe
  treatment in this plan instead.

## Maintenance notes

- `_storageRevision` is storage metadata, not user backup/domain data. Future
  persistence changes must preserve newest-valid selection and serialized
  writes.
- New draft fields remain backwards-compatible and ID-keyed. Program edits must
  discard only orphaned context, never the entire remaining draft implicitly.
- All program replacement/creation work should go through the transition
  helpers introduced in Step 4; bypassing them can recreate UX-02/08/09.
- All new modals and Settings panels must use the shared helpers from Step 6.
- Keep History index construction pure enough for the deterministic
  single-pass test.
- When changing shell assets after this plan, increment `sw.js` cache again.
- Reviewers should inspect Steps 1–4 for data invariants first, then run
  accessibility and copy review on Steps 5–10. Visual polish must not obscure a
  storage or lifecycle regression.
