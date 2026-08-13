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
> `git diff --stat a909933..HEAD -- app.js index.html styles.css i18n.js i18n-en.json i18n-pt.json notify.js manifest.webmanifest sw.js README.md test .github/workflows/simulation.yml`
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
- **Depends on**: `plans/040-launch-readiness-ui-ux-audit.md`
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
- There is no application build, framework, backend, account, or cloud sync.
  Do not introduce one.
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

## Commands you will need

Run commands from the repository root unless the command says otherwise.

| Purpose | Command | Expected on success |
|---|---|---|
| Syntax | `for f in app.js i18n.js notify.js schedule.js test/*.mjs; do node --check "$f" || exit 1; done` | exit 0 |
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
| Patch hygiene | `git diff --check` | exit 0, no output |

The focused browser scripts import the repository's existing Playwright test
dependency through `test/browser.mjs`. Do not add application dependencies or
a root build system. If the current environment cannot resolve that existing
test dependency, use the existing CI environment; if neither local execution
nor CI is available, that is a STOP condition—not permission to mark browser
verification as passed.

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
- `test/simulation.mjs`
- `test/notifications.mjs`
- `test/focus-mode.mjs`
- `test/persistence.mjs` (new)
- `test/accessibility.mjs` (new)
- `test/i18n.mjs` (new)
- `.github/workflows/simulation.yml`
- `plans/README.md` (status only when implementation completes)

**Out of scope**:

- Accounts, cloud sync, a backend, telemetry, or remote error reporting.
- AI coach work, new analytics, new navigation tabs, or a visual redesign.
- Implementing 12/26/52-week chart range selection or clickable PR record
  details. UX-12 is fixed pre-launch by removing false affordances.
- Making the Progress period global. UX-13 is fixed by removing the duplicate
  global-looking control and retaining the already-scoped `#volWindow`.
- A new factory-reset feature. UX-15 is fixed by naming the existing
  log-and-draft deletion honestly.
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
   treat legacy snapshots as revision `0`. Extend `applyState()` so imported
   backup revision metadata is ignored; applying an import creates a new local
   revision.
3. Add small pure helpers near the IndexedDB functions:
   - validate the minimum state shape (`program` and `log` arrays);
   - read a revision, defaulting legacy state to `0`;
   - choose the newest valid localStorage/IndexedDB snapshot;
   - break equal-revision ties in favor of IndexedDB, preserving existing
     pre-migration behavior.
4. Change `boot()` to read **both** stores independently. One parse/read failure
   must not hide the other store. Choose the highest valid revision, normalize
   it, then heal the missing/stale replica.
5. Serialize IndexedDB writes through one promise queue. Clone each snapshot
   before queueing so later `state` mutations cannot alter an earlier write.
   Increment the revision once per logical `persist()` call and return/retain a
   promise that tests can await.
6. Keep the localStorage write synchronous. Track each store's latest write
   result separately. When only one store accepts a write, keep the data but
   expose a persistent degraded-storage line in Settings and one localized
   toast; when both fail, use the existing storage-full/error treatment.
7. Export a copy of `state` with `_storageRevision` removed. Import/merge and
   program-only export formats remain unchanged.
8. Expose only a narrow test hook:
   `window.__repforgeStorage = { flush, chooseSnapshot }`. Do not expose state
   mutation through the hook.

Create `test/persistence.mjs`, following the result/`assert` style of
`test/notifications.mjs`. Cover:

- legacy localStorage-only migration to both stores;
- localStorage revision 2 vs IndexedDB revision 1 → revision 2 boots and heals;
- IndexedDB revision 3 vs localStorage revision 2 → revision 3 boots and heals;
- malformed JSON/object in either store → valid peer wins;
- equal legacy revisions → IndexedDB wins;
- 20 rapid Settings mutations followed by `flush()` leave both stores byte-
  equivalent at the highest revision;
- a downloaded JSON backup omits `_storageRevision`;
- replace and merge import still persist to both stores.

Do not rely on a flaky browser-quota failure to test reconciliation. Seed
intentional mismatched snapshots; the one-sided failure is the mechanism, and
newest-valid selection/healing is the required result.

**Verify**:

```bash
for f in app.js test/persistence.mjs; do node --check "$f" || exit 1; done
node test/persistence.mjs
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
   - `__sessionNotes` and `__bodyweight`.
2. Add one `hydrateWorkoutDraft()` helper that:
   - clears and rebuilds `committed`, `touched`, `warmups`, `skipped`, and
     `substituted`;
   - accepts only exercise IDs present in the current program;
   - accepts substitutions only for their owning exercise and caps custom text
     at the existing 80-character rule;
   - restores day only when it still exists;
   - restores an ISO date, note text, and bodyweight text without coercing them.
3. Update `saveDraft()` to serialize those values along with existing set
   fields/effort/exercise notes. Wire `#notes`, `#bodyweight`, and `#date` to
   save on input/change. Skip and substitution handlers must call
   `saveDraft()` **before** re-rendering.
4. Hydrate context before `init()` overwrites date/bodyweight defaults and
   before the first workout render. Old drafts with none of the new keys must
   behave exactly as before.
5. Include skip/substitution/context-only progress in `draftHasProgress()` so
   **Continue workout** remains truthful.
6. Replace the `oldRirMode !== newRirMode → clearDraft()` branch with a guarded
   `changeRirMode()` transition:
   - no-progress draft: apply the mode normally;
   - active draft: keep the old radio/mode, preserve every draft byte, and show
     localized copy explaining that the workout must be finished or explicitly
     discarded first.
7. Clear all new module collections and draft keys only after successful
   workout finish or an already-confirmed destructive program/import/reset
   transition.

Add regression phases to `test/simulation.mjs` and `test/focus-mode.mjs`:

- List: enter values, note, bodyweight, non-today date, skip one exercise,
  choose a predefined substitution and a custom substitution, leave, reload,
  continue, and assert every value/state remains;
- Focus: reload on a deck with a skipped exercise and substitution; assert deck
  count/name and final `performedName`;
- finish the resumed workout and assert skipped rows are absent and substituted
  rows retain `performedName`;
- change RIR with no draft (succeeds), then with touched, committed, warmup,
  note-only, skip-only, and substitution-only draft progress (refuses and
  preserves);
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
3. Make **Save set** and **Finish workout** call the same validator. Validate
   only touched/committed/warmup rows; pristine suggestions remain unsaved.
   On failure:
   - do not mutate `state.log`;
   - retain draft text exactly;
   - set `aria-invalid="true"` on and focus the first bad field;
   - show a localized field-specific status message.
4. Refactor `saveSessionEdit()` into parse/validate-then-commit:
   - build a proposed copy of the session;
   - validate every remaining row and date;
   - replace durable rows only when all proposed rows are valid.
5. Add a localized **Remove set** / **Undo remove** control per History editor
   row. Removal is staged in the editor and applied only with a fully valid
   **Save changes**. Blank load is no longer a deletion gesture.
6. Normalize `restSec` in both `normalizeSettings()` and `commitSettings()` as a
   non-negative integer. Choose one rule and test it consistently: reject
   fractional user input while rounding legacy stored decimals to the nearest
   whole second. Render through `fmtClock()` so Settings and the live timer use
   one formatter.

Extend `test/simulation.mjs` with:

- workout and per-set cases for negative/blank/non-numeric load, zero/negative/
  fractional/blank reps, negative/blank RIR, and invalid bodyweight;
- proof that a failed finish adds zero rows and keeps the draft;
- valid decimal load and RIR cases in EN/PT numeric input;
- History invalid edit leaves the complete stored session byte-equivalent;
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
2. Add `finalizeProgramSetup({ exercises, name, answers, destination })`:
   - creates `Program` once;
   - writes program and complete metadata once;
   - selects its first day;
   - closes onboarding;
   - routes to Today or Program edit as requested;
   - starts tour/install follow-up exactly once;
   - persists one coherent state transition.
3. Call it from onboarding **Save**, **Edit before saving**, and successful
   first-run program Import. First-run import may adopt the imported template
   name, but it must create a local identity/start/lifecycle and must not copy a
   sender's ID, completion status, or block history.
4. Add a `pendingBlockTransition` module value containing the review and intended
   strategy. Choosing onboarding from Block Review closes the review and starts
   onboarding without changing durable block status.
5. Add `commitNextBlock()`:
   - for non-onboarding strategies, archive the old program exactly once and
     install the successor in one mutation/save;
   - for onboarding, archive only when Save/Edit/Import successfully finalizes
     the successor;
   - Cancel clears the pending transition and leaves the old block active and
     unarchived.
6. Replace `switchToBeginnerProgram()` with `applyProgramTemplate()` using a
   localized `program.beginner_name`. It creates fresh identity/start/lifecycle
   metadata, preserves log/settings/history, and does not pretend the old custom
   program name still applies.
7. Guard exactly-once archival by old program ID. A repeated event or double
   click must not add duplicate `programHistory` entries.

Extend the program/onboarding/block phases in `test/simulation.mjs`:

- Save/Edit/Import each set `onboarded:true`, preserve answers where applicable,
  survive reload, and trigger follow-up once;
- imported sender lifecycle fields are not adopted;
- block-review onboarding Cancel leaves old ID active and history unchanged;
- subsequent onboarding Save archives the old ID once and activates a new ID;
- repeated completion cannot duplicate history;
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

1. Add one async `setNotificationsEnabled(wanted)` path. When enabling, await
   `RepForgeNotify.request()` before persisting:
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
- reminder-type preferences survive failed permission/revocation;
- toggle, status text, disabled controls, persisted state, and
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
   - make `main` and bottom `nav` inert while open;
   - contain forward/reverse Tab within enabled focusables;
   - close on Escape when allowed;
   - remove inertness and return focus on close;
   - allow only one active modal.
2. Migrate Block Review, Import Choice, End Block Confirm, and the exercise-note
   sheet to the helper. Preserve each overlay's visual classes/animation.
   Choose safe initial focus: Close/Cancel for destructive choices and textarea
   for the note sheet.
3. Add `setDisclosure(button,panel,open)` and wire Rest timer, RIR mode,
   progression, notification types, backup, and import rows. Every button gets
   `aria-expanded` and `aria-controls`; every panel's hidden/visible state and
   chevron follow the same boolean.
4. Convert the session reminder's main action into a real button. Keep its
   independent dismiss button; do not nest buttons.
5. Make `#toast` a persistent `role="status"`, `aria-live="polite"`,
   `aria-atomic="true"` region. Update `toast()` in an order that reliably
   announces new text after the live region is visible. Do not repeatedly
   announce rest-timer ticks through this region.
6. Add `aria-pressed` to List/Focus layout buttons and synchronize it in
   `setLogMode()` and `enterWorkout()`.

Create `test/accessibility.mjs`, reusing `test/browser.mjs`. At this step it
must cover:

- each modal's initial focus, forward/reverse wrap, Escape, background inertness,
  and trigger focus return;
- two consecutive modals do not leak inertness/listeners;
- all six disclosure buttons report and control their panel state;
- session banner action works with Enter and Space; dismiss remains independent;
- new toast text appears in an atomic polite status region;
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
   - sorted session records with their row arrays;
   - normalized searchable day/exercise text;
   - date/month groupings needed by the calendar and recent list.
2. `renderHistory()` builds the index once and passes it to
   `renderHistoryCalendar(index)`. Filtering, summaries, editor rows, and month
   grouping reuse indexed session rows. The “Every set” table may make one
   additional linear pass; no code inside a per-session loop may scan
   `state.log`.
3. Expose a read-only `window.__repforgeHistory = { buildIndex }` hook for a
   deterministic complexity test.
4. Render each session as an article containing a dedicated expansion button
   with `aria-expanded` and `aria-controls`; render Edit/Delete in a separate
   controlled region so no button nests inside another.
5. Give `#historySearchBtn` `aria-expanded`/`aria-controls`. Add a visible,
   translated Clear action. Do not allow a non-empty query to become invisible:
   either keep search open until cleared or render an explicit active-filter
   chip.
6. Add translated **No matching sessions** copy distinct from the first-run
   empty state. Keep the unfiltered “Every set” table behavior explicit.

Extend `test/simulation.mjs` for query-by-day/name, clear, no-match copy,
hide/show persistence rule, Enter/Space expansion, expanded-state attributes,
and independent Edit/Delete actions.

Add a deterministic algorithmic check to `test/accessibility.mjs` or a focused
History phase:

- seed at least 5,000 sessions / 20,000 rows;
- wrap the input iterable so row iteration is counted;
- assert `buildHistoryIndex` consumes each source row once and returns correct
  session/search/month counts;
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
   repeated steppers and iOS focus remain stable.
3. Change `--ink-faint` to a token that reaches at least 4.5:1 on `--bg`,
   `--surface`, and `--well`. `#716D66` is a verified starting value
   (4.60:1 on `--bg`); remeasure after final CSS.
4. Use `--accent-deep` for normal-size orange text/links. Keep the brighter
   `--accent` for non-text graphics, focus outlines, borders, chart marks, or
   sufficiently large text.
5. Restore a visible `:focus-visible` treatment for Settings selects. Do not
   remove the global focus outline.
6. Bring compact actionable controls to at least 44×44 CSS pixels, including
   the session-banner close target. Preserve dense layout by enlarging hit area
   rather than glyphs where necessary.
7. Replace `updateBodyweightField()`'s inserted English text node with one
   update to the existing translated `<span>`. Add
   `log.bodyweight_unit` in EN/PT and include `{unit}`. Exactly one label must
   appear in kg/lb and EN/PT.
8. Extend `test/accessibility.mjs`:
   - viewport does not prohibit zoom;
   - root/controls retain `touch-action:manipulation`;
   - input computed font size prevents forced mobile text zoom;
   - token ratios and representative meaningful text in every view meet 4.5:1;
   - every visible non-inline action in the three launch viewports has a 44px
     hit dimension;
   - Settings selects show a non-zero focus outline/ring;
   - bodyweight label is singular and translated in four language/unit states.
9. Update the old simulation assertion that currently requires disabled zoom.

Manual testing must include pinch zoom and rapid repeated stepper taps on a
touch-capable browser. Automated metadata checks alone do not prove those two
gestures coexist.

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
2. Remove the duplicate page-header `#statsPeriod` and its click handler.
   Retain `#volWindow` inside **Completed hard sets** as the sole 7/28-day
   control; its existing tab semantics must stay synchronized.
3. Update tour step 3 in EN/PT to teach swipe plus header chevrons in Focus.
   Review all tour steps against current labels while there; change only stale
   statements, not the number or structure of steps.
4. Rename **Delete all data** to **Delete workout history** (localized).
   Confirmation and supporting copy must state that saved log rows plus the
   active draft/unfinished reminder are removed, while program and Settings
   remain. Keep behavior aligned with that copy.
5. Change the manifest description and README feature/data wording from
   machine-only/localStorage-only to the current local-only progressive-
   overload product with machines, cables, dumbbells, barbells, and bodyweight.
   Do not promise account sync or cross-device recovery.
6. Add `test/i18n.mjs`:
   - parse both locale JSON files;
   - evaluate/extract the two runtime dictionaries from `i18n.js` in an isolated
     VM context;
   - assert exact key/value parity between each JSON and runtime dictionary;
   - assert every `data-i18n`, `data-i18n-aria`, and
     `data-i18n-placeholder` key in `index.html` exists in both languages.
7. Extend simulation assertions: no unbound button exists in the exercise
   detail target region, `#statsPeriod` is absent, tour copy names current
   controls in both languages, deletion copy and retained state agree, and
   manifest/README-facing description no longer says machine-only.

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
4. Ensure the destination phrase participates in the accessible name and is
   not conveyed only by color/chevron.
5. Extend simulation fixtures:
   - an improved, flat, regressed, one-session, and old-but-untrained lift;
   - assert “stable” equals only exact flat comparisons from the current week;
   - assert each coaching group shows the right destination verb and activation
     lands on the advertised view/content.

**Verify**:

```bash
node --check app.js
REPFORGE_SIM_WEEKS=12 node test/simulation.mjs
```

Expected: exit 0 and `FAILED: 0`.

### Step 11: Enforce the integrated pre-launch gate and refresh the PWA shell

**Findings**: all 24 integrated.

1. Update `.github/workflows/simulation.yml` so CI runs, after the existing
   server setup:
   - syntax for all runtime/test JS;
   - `test/schedule.mjs`;
   - `test/i18n.mjs`;
   - `test/persistence.mjs`;
   - `test/notifications.mjs`;
   - `test/recover-gate.mjs`;
   - `test/accessibility.mjs`;
   - `test/focus-mode.mjs`;
   - the 12-week integrated simulation.
2. Keep the workflow timeout realistic for all focused suites. Do not hide
   failures with `continue-on-error`.
3. Increment `sw.js` from `repforge-v53` to the next cache version exactly once.
   Confirm every changed runtime asset remains in `ASSETS`/`SHELL`.
4. Run the full 52-week profiled simulation locally or in CI after all focused
   suites are green.
5. Perform the manual launch matrix below. Record one concise successful video
   covering the primary mobile flow and screenshots for any state that cannot
   fit clearly in that video. Do not attach failed attempts.
6. Update `plans/README.md`: mark Plan 041 DONE only after automated and manual
   gates both pass. Plan 040 remains an audit record, not “fixed” documentation.

**Verify**:

```bash
for f in app.js i18n.js notify.js schedule.js test/*.mjs; do node --check "$f" || exit 1; done
node test/schedule.mjs
node test/i18n.mjs
node test/persistence.mjs
node test/notifications.mjs
node test/recover-gate.mjs
node test/accessibility.mjs
node test/focus-mode.mjs
REPFORGE_SIM_WEEKS=52 REPFORGE_PROFILE=1 node test/simulation.mjs
git diff --check
```

Expected: every command exits 0; every browser suite reports `0 failed`;
simulation reports `FAILED: 0`; patch hygiene is clean.

## Manual pre-launch matrix

Use clean storage for first-run scenarios and a separately populated profile
for history/block scenarios. Test at 320×568, 390×844, and 430×932. Run once in
English/kg and once in Portuguese/lb where marked.

1. **Persistence recovery**: seed newer localStorage/older IndexedDB, then the
   reverse; reload and inspect Settings storage health and healed stores.
2. **Onboarding**: complete Save, Edit, and Import independently; reload each.
   From Block Review choose onboarding, Cancel, then repeat and Save.
3. **Workout List**: notes, bodyweight, non-today date, warmup, skip,
   predefined/custom substitution, invalid values, leave/reload/continue, finish.
4. **Workout Focus**: swipe and header arrows, edit a committed set, timer,
   note sheet, skip/reload/continue, finish.
5. **RIR safety**: attempt numeric↔effort with active draft and without one.
6. **History**: active/cleared/no-match search, keyboard session expansion,
   invalid atomic edit, staged remove/undo/save, large seeded history.
7. **Progress**: stable count fixture, every coaching destination label/action,
   scoped 7/28-day control, static exercise records/range.
8. **Settings/notifications**: unsupported, default, denied, granted, externally
   revoked; every disclosure with keyboard; honest delete-history copy and
   retained program/settings.
9. **Accessibility**: keyboard-only modal loops/Escape/focus return, visible
   focus, toast announcement inspection, 200% zoom, pinch zoom, rapid steppers,
   44px targets, EN/PT contrast.
10. **PWA**: hard reload to activate the new worker, install metadata/copy,
    offline navigation to all four tabs, then reconnect without data change.

Any data mismatch, console error, keyboard trap, untranslated key, stale worker
asset, or failed suite blocks release.

## Test plan by file

| Test file | New responsibility |
|---|---|
| `test/persistence.mjs` | Replica selection, migration, healing, write ordering, backup metadata |
| `test/notifications.mjs` | Permission/preference truth table and revocation |
| `test/accessibility.mjs` | Dialog lifecycle, disclosures, live status, controls, zoom, contrast, focus, targets, large History index |
| `test/i18n.mjs` | EN/PT JSON ↔ runtime dictionary ↔ DOM key parity |
| `test/focus-mode.mjs` | Resumed Focus skip/substitution/draft context |
| `test/simulation.mjs` | Integrated validation, onboarding/block/template, History, coaching, copy, manifest, PWA |
| `test/recover-gate.mjs` | Existing recommendation recovery regressions; unchanged behavior |
| `test/schedule.mjs` | Existing scheduling baseline; unchanged behavior |

No test may rely only on a screenshot, translated English text while the app is
in Portuguese, or a wall-clock microbenchmark. Assert durable state and
semantics directly, then use visual artifacts as supplementary evidence.

## Done criteria

All items are mandatory:

- [ ] The coverage matrix still contains all 24 unique audit IDs.
- [ ] DATA-01: mismatched valid replicas always boot the highest revision and
      heal the other store; legacy snapshots and backups still work.
- [ ] UX-01/19: every meaningful in-progress session field survives reload and
      RIR mode cannot clear it.
- [ ] UX-02/08/09: every program-install path produces coherent metadata and
      block archival is exactly-once and post-success.
- [ ] UX-03/10: invalid set/history data never mutates durable log state and
      rest displays valid whole-second clock text.
- [ ] UX-04: persisted/effective notification state, permission status, and
      controls agree for unsupported/default/denied/granted/revoked.
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
- [ ] EN and PT dictionaries/DOM keys have exact parity.
- [ ] `node test/schedule.mjs` reports 8/8.
- [ ] Every focused browser suite exits 0 with zero failures.
- [ ] Full simulation exits 0 with `FAILED: 0`.
- [ ] CI runs the entire release suite without allowed failures.
- [ ] Service-worker cache version is incremented and offline smoke passes.
- [ ] Manual matrix passes at all three viewports, including EN/PT and kg/lb.
- [ ] No files outside Scope changed, except this plan's status row.
- [ ] `git diff --check` exits 0.

## STOP conditions

Stop and report; do not improvise, defer, or silently change product behavior if:

- The implementation would need to wrap/rename `repforge_v1` in a way that
  breaks existing backups or root-level state consumers. Re-plan the migration.
- Replica conflict resolution cannot distinguish versions without discarding a
  valid legacy snapshot.
- An old draft cannot be normalized without losing set values; preserve it and
  add a migration fixture before continuing.
- Validation changes recommendation/capacity behavior for already-stored legacy
  rows. Input validation must be prospective.
- Program transition tests show duplicate archive entries or log loss.
- Browser permission cannot be deterministically controlled in the focused
  suite; add a narrow notification adapter/test seam rather than deleting the
  denied/revoked cases.
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
