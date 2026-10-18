# Taurifer: architecture for safe, local changes

Status: proposed engineering specification, 18 October 2026. **Specification only; no application port is implemented or authorized by this document.** The implementation proposal contains **20 numbered PR-sized slices**, not twenty new product initiatives. `docs/backlog.md` remains the only ordered queue. This proposal supersedes the target direction in the September [architecture audit](../taurifer-architecture-refactoring-plan.md) for future architectural work; its historical evidence remains historical. Existing ADR product, data, privacy, generator and editor decisions remain authoritative.

## 1. Decision and evidence baseline

Keep a static, local-first mobile PWA and its DOM UI. Rebuild ownership around a few deep modules: pure training rules, one durable storage kernel, named application commands, feature-owned presentation, and one browser composition root. Use native JavaScript ES modules with strict JSDoc type checking, no framework, application dependency resolution, transpiler, runtime container or generic state framework. Extend the existing deployment assembler to give the ESM graph one immutable release identity. Do not replace storage technology, rewrite algorithms, change saved schemas or redesign screens during this migration.

The north star is locality: an agent adding a metric rule should need the metric interface and its owning proof, not the Focus renderer, storage replay algorithm and import host. A directory split is useful only when callers learn fewer invariants. File length is evidence of search cost, not a quality score.

### Audited revision and method

Fresh GitHub `main`, fetched independently of the saved checkout: **`147e4afa07fea3243efd42b5b7d167c196c6a7ca`**, merge of #440. The saved checkout was `c1d64320`; it was not used as the final audit base. Source measurements below are from the fresh revision. The isolated documentation checkout is based exactly on that revision. Source links below pin it; line numbers are audit landmarks, not proposed module interfaces.

Read root/test/tools `AGENTS.md`, `CONTEXT.md`, the product thesis, CI/evidence guidance, ADRs and the relevant generator/editor plans. Traced boot, Finish, installed edits, exports, worker generation, storage callbacks and concurrent diffs. These are source-inspection findings, not runtime performance or correctness certification. No exhaustive application suite was executed for this prose-only change. No quantitative churn/fan-out history or complete AST call graph is claimed. Proposed thresholds and estimates are acceptance targets, not achieved measurements.

Reproduce lexical measurements from the audited checkout:

```sh
wc -l app.js durable-state.js program-editor.js program-entry.js workout-draft.js styles.css index.html
rg -c '^(async )?function ' app.js
rg -c '^let ' app.js
rg -n 'configureHost|createHistoryUi|new Proxy|commitProposedState|saveWorkoutV2|async function boot' app.js durable-state.js history-ui.js
```

| Observed source | Lines | Interpretation |
| --- | ---: | --- |
| `app.js` | 21,703 | 1,422,534 UTF-8 bytes; 1,526 column-zero function declarations; 116 column-zero `let` declaration lines, not 116 variables |
| `durable-state.js` | 3,035 | Valuable existing WAL/replica/DraftV2 safety kernel, still dependent on host policy |
| `program-entry.js` / `workout-draft.js` | 2,069 / 1,959 | Existing substantial domain models worth preserving |
| `program-editor.js` / `program-review.js` | 1,930 / 1,320 | Shared editing concerns, different hosts; review mixes pure replay with DOM mounting |
| `history-ui.js` | 1,054 | View also owns indexing, editing, persistence orchestration and host coupling |
| `program-compiler.js` / `progression-engine.js` | 1,090 / 605 | Preserve shared algorithms; not the whole training domain currently in `app.js` |
| `generation-layout.js` / `generation-candidates.js` / `generation-identity.js` | 432 / 202 / 212 | Current generator 073.4 policy/layout/identity, not retired prototype scaffolding |
| `program-engine.js` / `exercise-catalog.js` / `exercise-metrics.js` | 208 / 210 / 264 | Worker/fallback, integrity-pinned catalog loading, source metric semantics |
| `styles.css` / `index.html` | 7,880 / 1,340 | Shared tokens, feature styling, static shell and boot-sensitive markup |
| Generated `i18n.js` / `exercises.js` | 5,637 / 1,359 | Generated data size is not architecture debt |

`index.html` has 33 external script tags, including optional vendor runtimes. Runtime third-party dependencies are the committed Motion and dnd-kit bundles; package locks exist for tests, vendor generation and the install-transfer service, not root application npm resolution. The app also has approved opted-in telemetry and a narrow one-hour install-transfer service: “local-first” does not mean no network code exists.

### Moving integration inputs

Observed through GitHub metadata, changed-file patches and selected source/contracts on 18 October 2026. Status is a checkpoint, not a promise to merge. Refresh heads and checks before every affected slice; a PR body is author evidence, not independent execution evidence.

| Input | Audited head and observed status | Reconciliation rule |
| --- | --- | --- |
| [Program Lab #432](https://github.com/pedrochagasmaster/repforge/pull/432) | `ce0b4403341ee9dbdd34dc6994a1244172189fb8`, open draft; exact-head `ci` success, run 39088737854 | Shared compiler gains explicit policy/diagnostics; engine gains strict worker execution. Preserve default parity, native catalog identities and separate Lab packaging/storage. Do not recreate Lab. |
| [Test redesign #446](https://github.com/pedrochagasmaster/repforge/pull/446) | `5754a0482871f8f00456ff922ca2df2fd7702024`, open draft at final reconciliation (previous inspected heads `5a501e0a` and `9448989d`). Exact-head ordinary `ci` success, run 39136557642; paired benchmark run 39136557619 in progress at reconciliation. Earlier benchmark runs 39133818814 and 39134455479 failed `report`; ordinary CI does not establish performance acceptance. | 97 commands: 57 fast, 39 browser, one service, versus 208 commands/195 files on audit base. Integrate its risk/retirement ledger, not its command count as a coverage claim. Keep its parser extraction and #434 fixes once. The final two-commit advance changes only the telemetry proof and ledger/docs: transfer-specific credential rejection, qualified-settlement veto, consent and milestone/reboot suppression moved into the fast telemetry owner; no runtime/interface change. The subsequent `9448989d → 5754a048` diff changes only `tools/critical-ui.mjs` and `test/ci.mjs`: follow benchmark artifact-directory symlinks and prove the aggregation path; no app/interface change. |
| [Incremental #444](https://github.com/pedrochagasmaster/repforge/pull/444) | `306f4dbb70b7c6b2a0905aea63543903d0042984`, open draft, explicitly superseded by #446 | Historical measurement context only; do not develop a second reduction plan. |
| [Focused-name Back #445](https://github.com/pedrochagasmaster/repforge/pull/445) | `39581e85ca9850c9dd2baf28742a9215b3063227`, open draft; exact-head `ci` success, run 39123332208 | Pending unblurred program/day-name text is dirty. Apply/Discard/Keep editing, whitespace control and reload proof must survive the new renderer/controller seam. |
| [Guides #435](https://github.com/pedrochagasmaster/repforge/pull/435) | `7c0c438c8f654c7bb12c25db0e9b95c3932c0bbc`, open draft; observed `ci` failure, run 39098232613 | Native modal, held first tap/replay, focus return, viewport placement and #439 sampler correction remain its owner's work; #441 held finding is not architecture scope. |
| [#434](https://github.com/pedrochagasmaster/repforge/issues/434), [editor #437](https://github.com/pedrochagasmaster/repforge/pull/437), [Plan 074](../../plans/074-program-editor-candidate-a.md) | #434 is an open **issue**, not a draft PR. #437 is the open draft implementation at `1b3de1b8ea8bdfb7bd8d4c85736b9fefa5f149e8`; observed `ci` failure, run 39099257350. ADR 0021/Plan 074 already on main. | Preserve installed candidate A, Build's separate host and staged intents. Removal/cross-day movement must renumber every affected day's canonical slots. #446 carries selective fixes too: reconcile one implementation, never overwrite either owner's branch. |

Implementation intake records `(main SHA, input PR head, interface diff, owning proof, disposition)` in the slice PR. Rebase source moves after an owner integrates, or coordinate an agreed interface patch with them; do not cherry-pick an entire feature into an architecture PR merely to unblock a rename. If an input remains unmerged, its row stays conditional and the slice excludes overlapping behavior; slice 18 delivers a concrete Lab compatibility patch/proof map for its owner without making production completion depend on that PR merging. #432 does not block unrelated UI extraction; its shared engine interface must be reconciled before slices 4/18/19. #446 is the validation partner, not a prerequisite for writing this spec or for preserving current tests.

## 2. Current architecture and leaks

The current app is a classic-script graph, with global lookup and Node `require` branches rather than declared browser imports. The static HTML orders globals; `app.js` builds models, IO, orchestration and renderers in one lexical environment. Some existing extracted modules are deep; others expose implementation obligations back to the host.

```text
index.html → ordered scripts → app.js → boot()/init()/render()
                                  ↕ host callbacks
                            durable-state.js → localStorage + IndexedDB + Web Locks
                                  ↕ DraftStore/checkpoints/WAL
                            workout-draft.js
app.js → Program/Exercise + metrics/log projection + progression/progress models
app.js → entry adapter/compiler → identity + candidates + layout + metric semantics
app.js → program-engine client → exact-script worker → compiler + verified catalog
app.js → program-editor/review/history-ui → host callbacks → app.js
app.js → backup/program/setup/transfer paths → different persistence/privacy contracts
sw.js → ASSETS inventory → deployment assembler → dist/ public-only assets
```

This is a representative operational dependency graph, not a claimed exhaustive static graph. There is a concrete `app → durable → app` callback cycle; an import-cycle counter alone would miss it.

| Flow and pinned source evidence | Actual behavior and agent hazard |
| --- | --- |
| [Boot and host wiring](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/app.js#L21600) | `boot` resolves storage/catalog and transfer preboot, runs transfer/standalone arbitration, then boots telemetry, recovers committed setup, prepares setup proposal, initializes workout draft, resumes editor follow-up and calls `init`. `configureHost` supplies 18 host properties to durable storage, including domain validation, rebasing and live snapshot mutation. Boot ordering is business behavior; parallelizing awaits could use the wrong identity or overwrite recovery. |
| [Finish](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/app.js#L9128) | `saveWorkout → saveWorkoutV2 → WorkoutSession.finish → commitProposedState → enqueueStateChange`. It drains pending input, validates DraftV2, compiles metric-aware rows, captures exact raw draft, commits log plus draft effect, then only on `committed && settled` resets session and presents summary/telemetry. A UI success flag cannot replace durable settlement. |
| [Commit policy](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/app.js#L4431), [storage](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/durable-state.js#L1723) | Host canonicalizes muscle attribution and program structure, supplies lock-held preflight/rebase/custom-reference checks; kernel journals, coordinates replicas/draft sidecars and settles. `applyAcceptedSnapshot` also rebuilds `Program` and clears memo maps. Moving the storage file alone does not hide these obligations. |
| [Installed edits](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/app.js#L11440) | Editor document/token → intent staging → `syncEditorCanonicalIntent` → rebase against current head → draft impact/confirmations → commit. Display rows and canonical definition have to change together. #434 demonstrates fan-out: a visible row removal could be refused because canonical slot orders had gaps. |
| [History host](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/history-ui.js#L69) | Factory destructures dozens of functions, proxies `getState()` and calls durable settlement and `renderApp`. An agent cannot safely edit a correction flow using the view interface alone; identity/fingerprint/replay and UI responsibilities are mixed. |
| [Render](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/app.js#L7805) | `render()` can auto-resume workout state, set workout visibility, render tabs and enqueue guide presentation. Rendering is also a state transition and effect scheduler, so redraw frequency can change behavior. |
| [Worker](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/program-engine.js#L1), [catalog](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/exercise-catalog.js#L65) | One script is both page executor and worker; it receives exact page-loaded dependency URLs and loads its own integrity-checked catalog. Worker/main fallback is a real varying adapter. Transition derivation also has a hidden global catalog default; the target must require that input. Catalog `snapshot()` returns a cached object; immutable usage is intended, deep immutability must be enforced rather than assumed. |
| [Export](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/app.js#L12794) | Backup export commits `settings.lastExport` before sharing, accepting either successful replica under its current policy. It is not a pure formatter, and must not silently acquire Finish's stricter success policy. Program export/setup/clone have different allowlists. |
| [Release inventory](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/sw.js#L1), [assembly](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/scripts/build-pages-dist.mjs#L1) | `ASSETS`, HTML query URLs, worker dependency discovery and tests coordinate release identity manually. Current SW skips waiting, claims clients and deletes old caches. Native imports cannot inherit an entry script's query version. An ESM migration without a release/activation plan creates a new leak. |

Other observed shared mutable state includes `state/prog/day`, live draft/raw/recovery, pending input maps and sequence counters, rest-clock handles, modal/route/gesture handles, installed-edit session, entry flow, custom picker, UI preferences and catalog/executor caches. They have different lifetimes. Putting them all in a new “store” would recreate the monolith with dispatch syntax.

Repeated concepts needing one owner include display/input load conversion across Focus/History/import, logged metric projection across History/Progress/CSV, row↔canonical slot synchronization, custom-definition identity/remapping, and program/model normalization at boot/commit/import. Some repetitions encode deliberately different privacy or failure policies. #446 already extracts `parseLoadInput` into the shipped metrics module; preserve it instead of making a competing parser. The extent of semantic duplication elsewhere is a hypothesis until characterization proves equal input/output behavior.

## 3. Technical choices and their costs

| Decision | Plausible alternatives | Chosen design and reason |
| --- | --- | --- |
| Language | Plain unchecked JS; strict checkJs; TS emitted to JS | **Strict checkJs with JSDoc** and owner-local typedefs. Keeps browser/Node source recognizable and existing algorithms intact; catches command/result and identity mistakes without a source/output debugging split. Pin TypeScript only under `tools/typecheck/`. New public inputs use `unknown` + validation, never `any`. TS would improve some discriminated-union authoring but adds conversion/build work without a demonstrated product need; revisit only with measured authoring failures. |
| Modules/tooling | Classic globals; unbundled ESM; esbuild/Vite | **Native ESM and release assembly**, no bundler. Relative `.js` imports, no aliases/barrels/package workspace. Existing `scripts/build-pages-dist.mjs` grows graph assembly/validation. CI uses a TypeScript-parser-based import rule checker from the same tool dependency. This introduces verification dependencies and packaging rules, not app runtime dependencies. |
| UI | Retain DOM; Web Components; React/Preact/Svelte rewrite | **Retain DOM and CSS**, feature `mount/update/dispose` lifecycles, shared markup only for demonstrated reuse (ADR 0021 editors). A framework could regularize rendering but would make Focus geometry, modal lifetimes, SW and every browser proof move at once. Component technology is not the present limiting invariant. |
| Routing/state | Hand-written globals; router/store package; explicit shell state | **One small shell router** for current tabs/pushed pages, modal stack, Browser Back and focus/scroll restoration. Feature controllers own local state; application session owns acknowledged training snapshot and draft handle. Browser history is a projection of shell routes, not a second persisted program. No URL-state migration or new deep-link product scope. |
| Training | UI helpers; mega “domain service”; pure named modules | **Pure training modules**, retaining compiler/progression algorithms, authoring, metrics, log projections and workout aggregate. Explicit catalog/reference date/time/IDs at command creation. Date arithmetic may use `Date.UTC`; reading wall clock, locale or random state inside training computation is forbidden. |
| Persistence | IDB-only rewrite; generic repository; current safety kernel | **Preserve dual replicas and recovery protocol**. A durable factory owns IO, queue, locks, WAL, checkpoints and settlement. Snapshot policy is pure and owned with the durable aggregate; application commands supply named intent and expected identity, not a screen-built arbitrary write callback. No format change in the 20 slices. |
| Interchange | One serializer; purpose-specific contracts | **Separate backup, program file, setup v4, CSV and exact transfer**. Share low-level canonical/metric validation, never their inclusion policies. Import is parse → validate → review → command → commit; no validation path writes. |
| Platform | Ports for every helper; browser calls anywhere | **Concrete browser modules** for catalog load, executor, notification, file/share, preferences, telemetry, install transfer and motion. Inject clock/ID or IO only at actual varying/fault-tested seams. No hypothetical native adapter or generalized backend client. |
| Program Lab | Fork engine; embed workbench in PWA; separate consumer | **Separate consumer of shared generation**. Lab owns scenarios, comparisons, provenance, bounded archives and its own IDB on a separate origin. Production ships no Lab UI, store or archive code. Shared policy remains default-preserving; no Lab configuration changes production defaults. |

Release assembly uses `dist/releases/<content-id>/` for all release-coupled JS, CSS, catalog and media paths. The content ID covers the normalized module/asset manifest and bytes, excluding generated self-referential output fields. Mirror the repository layout inside the release directory, including `src/`, `styles/`, `assets/` and vendor files; copy relative imports unchanged. For example, `src/platform/catalog.js` resolves `../../assets/exercise-catalog.json` with `new URL(..., import.meta.url)` in both raw source and assembled output. The executor resolves its sibling `./program-worker.js` the same way; CSS asset URLs resolve relative to their unchanged owning stylesheet. Rewrite only the root HTML entry/style references, not per-feature URLs. No feature guesses deployment depth or reads `document.baseURI` to discover code dependencies. Root HTML points to that release's entry and styles; root manifest/scope/icon behavior and historical storage/cookie identifiers remain stable. No runtime resolver, import map, code splitting planner or module federation. Static and dynamic imports/worker URLs must be literal and discoverable. Missing files, traversal, foreign origins and undeclared executable assets fail assembly. Root preview can serve source; CI also runs real assembled-dist boot/worker/offline proofs using the existing isolated preview owner.

This is an intentional evolution of the repo's “no build step” wording: there is already deployment assembly, and this proposal adds graph-aware assembly and type verification, not transpilation. Slice 2 updates the applicable guidance when implementation is authorized. It does not smuggle a root package manager into Phase 1.

## 4. Target source tree and dependency rules

Folders below are ownership locations, not mandatory one-file-per-concept scaffolding. A small implementation stays in its public file; add `internal/` only when complexity warrants it. Existing pure files may stay substantial. No empty feature folders or universal `utils` bucket.

```text
index.html                         # static shell + tiny theme/update bootstrap
manifest.webmanifest               # stable app identity/scope
src/
  app/
    browser.js                     # only browser composition root
    session.js                     # acknowledged snapshot publication, command serialization
    workout.js                     # session start/leave/dispatch/finish
    program.js                     # activate/edit/replace/custom-definition commands
    history.js                     # correct/delete session commands
    interchange.js                 # reviewed import/export command orchestration
    boot.js                        # explicit ordered recovery/transfer/restore protocol
  training/
    metrics.js                     # units, grammar, source compositions
    identity.js                    # canonical hashes + catalog/generator identity
    model.js                       # Program/Exercise, structure and immutable log projection
    generation.js                  # public compiler/generation/transition surface
    generation/internal/           # candidates, layout, compiler, validated transition capabilities
    authoring.js                   # edit/replay/rebase; entry draft/profile rules
    authoring/internal/            # distinct entry/recommendation/installed edit rules
    workout.js                     # pure DraftV2 aggregate/reducer/log compilation
    progress.js                    # session comparison, progression, volume and calendar models
  persistence/
    durable.js                     # factory; boot/read/commit/settle/draft protocol
    internal/                      # IO/locks, WAL, checkpoints, arbitration
    snapshot.js                    # canonical validation/rebase/receipts policy, no live host
    preferences.js                 # device UI/notify metadata + explicit tab-scoped flows
  interchange/
    backup.js                      # full training backup + compatibility validation
    program-file.js                # canonical program + referenced custom definitions
    setup-link.js                  # v4 codec, settings allowlist, bounds/refusal
    csv.js                         # existing export contract
    transfer-contract.js           # exact-clone schema/limits/hash, shared service consumer
  platform/
    catalog.js                     # lazy integrity-pinned fetch/cache, immutable input
    program-executor.js            # page worker/main fallback, cancellation/dispose
    program-worker.js              # dedicated module-worker composition root
    files.js                       # user-initiated share/download/read
    notifications.js               # permissions, SW readiness, device time
    telemetry.js                   # consent, closed event schema and transport
    install-transfer.js            # credentials, crypto/HTTP, freeze and cleanup protocol
    motion.js                      # Motion/dnd optional capability lifetimes
    install.js                     # browser/standalone/install policy
  ui/
    shell.js                       # router, Back, modal/sheet/focus/gesture lifetimes
    format.js                      # presentation localization, escaping and units
    editors.js                     # genuinely shared editor markup/controls, no edit store
    today/                         # controller.js, view.js, styles.css as needed
    workout/                       # session presentation including summary
    focus/                         # pending field feedback, shelf, rest presentation
    history/                       # calendar/session selection and correction UI
    progress/                      # overview/evidence/detail/chart
    entry/                         # landing, Generate/Build/import/recommendation review
    program/                       # installed editor host and overview
    library/                       # picker/custom editor/browse
    settings/                      # settings/privacy/backup/install/profile/guides
styles/
  tokens.css                       # shared theme/type/spacing; DESIGN.md remains authority
  shell.css                        # shared primitives and layout, imports feature styles
assets/ fonts/ icons/ vendor/        # retained reviewed data/media and pinned runtimes
programlab/                        # own composition root/UI/domain/store/archive/workers
scripts/build-pages-dist.mjs        # public release assembler; excludes Lab and private files
tools/typecheck/                   # pinned verification-only compiler + lock
tools/check-architecture.mjs       # proposed parser-based rules, in existing test inventory
test/                              # existing runner, owner fixtures, risk-based contracts
docs/architecture/                 # this decision, current map and eventual maintenance guide
services/install-transfer/          # existing narrow service; not a new account platform
```

`tools/check-architecture.mjs` is a future path; no checker is implemented by this spec.

Allowed direction: `ui → app → training`; `app → persistence/interchange/platform`; `persistence → snapshot/training`; `interchange → training`; `platform → training or interchange contracts`; composition roots wire concrete platform capabilities. UI formatting has no application import. Training imports only training. Persistence must never import app/UI/platform; browser IO needed by persistence is internal concrete implementation. Service can consume portable transfer contracts, never browser boot/UI. Program Lab imports public training/executor/catalog contracts, not production app/session or durable storage. UI features cannot import another feature's internals; shell and editor primitives serve real shared consumers. No directed import cycles, dynamic `require`, global module lookup or cross-owner deep import.

Each owning public file exports named operations and owner-local JSDoc types; only those declared public entry files may be imported externally. Implementation helpers stay private, not re-exported wholesale. Names express behavior (`finishSession`, `parseBackup`, `deriveSuccessor`), not architecture (`Manager`, `Service`, `Provider`, `BaseRepository`). A `create` factory is justified by owned lifetime or independent instances, not as a default wrapper for pure functions. Cross-owner records are immutable snapshots/validated values; no shared mutable Maps, proxies, DOM nodes or view callbacks in training/storage contracts.

### Contracts that hide complexity

These sketches specify semantics, not a new normative saved schema. Use the real production validators as schema authority; keep typedefs adjacent and verify them against behavior.

```js
// training/generation.js: deterministic, caller supplies verified catalog.
generateProgram(request, catalog, options) // => GenerationResult
// options preserve bundled defaults; Lab policy/diagnostics only as reconciled from #432.
deriveSuccessor(input, catalog) // => validated proposal capability or typed conflicts

// persistence/durable.js: one instance per page composition root.
createDurableStore({ io, snapshotPolicy, mutationGate }) // => DurableStore
store.boot()                           // => recovered snapshot + draft/recovery status
store.read()                           // => acknowledged durable head, not live UI data
store.commit(change)                   // => existing truthful durable outcome fields
store.draft(command)                   // => CAS aggregate result, no partial object patch
store.settle(receipt)                   // => replay/cleanup outcome; never invent success

// app/workout.js: returned promise includes required durability, not renderer work.
workout.dispatch(command, expectedDraft) // => acknowledged draft or conflict/recovery
workout.finish({ expectedDraft, completion }) // => completed summary input or explicit failure

// app/program.js
program.applyEdits({ baseToken, edits, draftDecision }) // => applied/conflict/recovery
program.activate({ reviewedDraftId, expectedHead })    // same receipt/draft atomicity

// ui feature: ephemeral state is private and disposable.
mountHistory(host, { commands, format }) // => { update(readModel), dispose() }
```

`change` is a closed discriminated set of durable operations (session finish, program commit, history correction, settings change, import replacement), with expected revision/program/block/draft identities and operation ID. Commands construct it; views cannot. Each contains validated data and a declarative draft effect, not arbitrary mutation functions. Existing lock-held preflight is retained internally during extraction, then replaced by named pure intent rebase/validation in `snapshot.js`. **The whole preflight/rebase/validation executes against the refreshed head under the lock.** Moving validation outside the lock is not completion.

The durable interface is deliberately more than one `save()` method: boot, CAS draft writes and settlement represent different required protocols. Its result retains accepted/committed/settled, replica outcomes, conflicts, recovery and pending receipts; no boolean “success” collapses them. Public callers learn the completion rule for their command; WAL keys, draft closing markers and replica repair stay implementation. Finish/activation require committed and settled. Preserve backup-export's current either-replica policy and lastExport ordering; changing that is separate behavior work. Expected failure is a result, not an exception swallowed into an empty state. Unexpected programming errors reject; user data and recoverable raw bytes remain untouched.

`session.js` is the sole owner of the published acknowledged training snapshot. Durable storage owns its persisted head/queue, not a second editable model. Commands serialize and publish results through this owner; features receive immutable read models. Pending Focus input belongs to the Focus controller until acknowledged by DraftV2; it cannot be dropped on redraw/blur/Back/Finish. Editor document/replay logs remain speculative until Apply. Route selection, theme and modal state never become training fields. One explicit root update callback publishes acknowledged changes; no general pub/sub event bus. Catalog fetch and executor caches are instance-private; dispose releases workers/listeners/timers/observers. No module performs IO, mounts UI or starts timers merely because it was imported.

### Worked change: remove a non-final program slot

The program view emits `exercise_remove(slotId)` with the editor token, including pending unblurred names in dirty-state handling. `training/authoring.js` applies the intent to the canonical definition and its row projection, renumbers all affected days and validates; it never writes storage. `app/program.js` refreshes/rebases under the durable command, checks workout impact, and commits both definition/projection plus the exact draft effect. UI renders the acknowledged result or a conflict; it does not call WAL settlement itself. Owning proofs cover non-final remove, moved-first remove, cross-day move, empty day, stale second tab, Apply/reload and next-workout prescription. Ordinary behavior changes touch these three owning modules plus fixtures; storage, worker and shell remain unchanged. This example preserves #434/#437/#446's owned fix and #445's editing guarantee, rather than implementing them again.

Do **not** introduce generic repositories, entity CRUD layers, event sourcing, global event buses, Redux/state libraries, DI frameworks, CQRS stacks, per-function ports, plugin systems, micro-frontends, a general task scheduler, schema registries, generated domain classes, speculative cloud sync or a native platform layer. Keep whole-state snapshots; there is no evidence for normalized entity storage. Do not unify all editors by sharing their speculative state or turn all interchange formats into a flag-driven codec. An abstraction earns its cost only if deleting it would redistribute a real invariant across existing callers.

## 5. Responsibility disposition: no orphaned concepts

This is exhaustive at runtime-file and repository-subtree level, with `app.js` responsibilities expanded below. Internal helper assignment follows the owning responsibility; it is not permission to copy files into a second implementation. Unlisted files introduced by concurrent work must be inventoried at intake. Generated and historical evidence are not rewritten to match a proposed tree.

| Current source/responsibility | Disposition and final owner | Slice |
| --- | --- | --- |
| `progression-engine.js`, `progress-model.js`, `schedule.js` | Retain algorithms; move to `training/progress.js` internals. Calendar/device-hour policy explicit; no duplicate formulas in views. | 3, 14 |
| `exercise-metrics.js` | Retain metrics/grammar, adopt #446 shipped parser once; `training/metrics.js`. | 3 |
| `generation-identity.js` | Retain canonical bytes, finite-value/accessor/cycle guards and IDs in `training/identity.js`. | 4 |
| `generation-candidates.js`, `generation-layout.js`, `program-compiler.js`, `program-transition.js` | Retain current 073.4 chain and validated capabilities under generation; required catalog input replaces global fallback. Preserve authored historical structure independent of current generation eligibility. | 4 |
| `program-engine.js` | Split page executor/worker entry; retain queue/cancel/dispose and fallback, plus conditional #432 strict mode. | 4 |
| `exercise-catalog.js` | Split pure lookups as needed from integrity/loading cache; `platform/catalog.js`, explicit immutable snapshot. | 4 |
| `program-entry.js`, `program-entry-adapter.js` | Retain entry reducer/profile/normalization and compilation mapping under authoring; activation orchestration to app. No second generator eligibility list. | 5, 9, 15 |
| `program-review.js` | Split pure apply/replay/changes/blockers into authoring and mounted recommendation review into entry UI; shared visual controls to `ui/editors.js`. Tab-scoped undo keeps its distinct identity/fingerprint validation. | 5, 15 |
| `program-editor.js` | Retain intents/document/token/dirty semantics, move pure editing to authoring and rendering to program/entry hosts; preserve ADR 0021 candidate A and Build distinction. Optional dnd owner stays here via concrete motion capability. | 5, 16 |
| `workout-draft.js` | Retain aggregate/reducer/parser/serialization/metric log compiler in training workout, side effects in app workout/durable. | 3, 8 |
| `durable-state.js` | Retain safety algorithms, split private IO/WAL/checkpoint/arbitration only for readability; replace singleton host protocol with owned factory + pure snapshot policy. | 6, 7 |
| `shared-setup.js` | Retain current v4 codec/limits/canonical generated shorthand; `interchange/setup-link.js`. Unsupported old versions remain unsupported and raw source retained. | 10 |
| `install-transfer-contract.js` | Retain portable exact clone validation/hash/limits in interchange, shared service/browser consumer. | 10 |
| `install-transfer.js` | Retain crypto/HTTP/state-machine/credential behavior in platform; app interchange owns local clone import and boot orchestration. | 10 |
| `history-ui.js` | Split index/selectors and metric projection to training model/progress, correction settlement to app history, view/selection to history UI. Delete proxy/host helper bag. | 3, 14 |
| `motion-layer.js`, `motion-polish.css` | Retain optional runtime/fallback behavior and gesture ownership, concrete platform motion + UI styles. Lifecycle disposal remains required. | 11, 13 |
| `notify.js`, `install-policy.js`, `guide-registry.js` | Retain notification/SW readiness, install eligibility, pure guide state rules; notifications/install platform and settings/shell guide controller. Guide presentation follows #435 after reconciliation. | 11, 17 |
| `telemetry.js`, `posthog-init.js`, optional `posthog-config.js` | Retain consent/identity/closed schema/transport; platform telemetry. Config stays deployment input; do not move sensitive data into events. | 11 |
| `unsupported-workout-grammar.js` | Retain portable refusal grammar near program-file/freeform contract, no LLM integration. | 10 |
| `exercises.js`, `assets/exercise-catalog.json` | Retain generated search/full catalog plus hash relation and UUIDs; no hand edits. Paths pinned in release assembly. | 4, 19 |
| `i18n-en.json`, `i18n-pt.json`, `i18n.js` | Retain source/generated relationship; tiny runtime becomes explicit UI/platform input. No domain-localization dependency. | 11, 19 |
| `index.html`, `styles.css`, `motion-polish.css` | Retain appearance/semantic behavior; extract styles by ownership without redesign. Root tokens/markup remain until owner slice replaces them; final release assembly closes URL inventory. | 11–17, 19 |
| `sw.js`, `manifest.webmanifest`, `.nojekyll` | Retain scope/install identity, routing/error/privacy policies; SW template/release inventory evolves atomically with packaging. Do not rename cache prefix. | 2, 19 |
| `vendor/`, `fonts/`, `icons/`, `assets/brand/`, `assets/exercises/` | Retain pinned/licensed artifacts, optional fallback and offline policy. No architecture-driven media replacement. | 19 |
| `scripts/build-pages-dist.mjs`, `scripts/generate-posthog-config.mjs` | Extend existing assembly, preserve public-only allowlist and optional deployment config; no second production build. | 2, 19 |
| `tools/`, `test/`, `.github/workflows/` | Retain single runner/inventory, generated-data/vendor/CI owners; update import/preview/release maps in same slice as moves. Redesign belongs #446. No parallel migration runner. | 1–20 |
| `services/install-transfer/` | Retain service source/config/tests/operations unchanged except portable contract import paths and exact-head compatibility checks if required. No redeploy/credential/operations task authorized here. | 10, 19 |
| `programlab/*`, `engine-policy.js`, `tools/build-programlab.mjs` from #432 | Conditional intake: shared policy to generation; retain Lab-owned domain/store/archive/services/UI/workers, update package graph/provenance once, exclude from production output. | 4, 18 |
| `AGENTS.md`, `CLAUDE.md`, `.agents/`, `.claude/`, `skills-lock.json` | Retain installed instructions/provenance. Shorten first-party navigation guidance, link domain instructions; do not edit third-party skills during port. | 1, 20 |
| `CONTEXT.md`, `DESIGN.md`, `PRODUCT.md`, `README.md`, `NOTICE.md`, `docs/`, `plans/`, `advisor-plans/`, `.audit/`, `.impeccable/` | Retain strategic, design, glossary and historical evidence; maintain one current architecture map and cross-links, do not rename archived plans or manufacture a second queue. | 1, 20 |
| `.env.example`, config examples, `.git*`, research ZIP and other non-runtime root files | Retain private/source artifacts and existing exclusions; no architecture relevance warrants deletion or public exposure. | 19 inventory check |

`app.js` is fully retired; its responsibility mapping is semantic, because many sections interleave concerns:

| Audited region / representative symbols | Target ownership |
| --- | --- |
| 1–942: fallback gestures, catalog boot, transfer guards, notify metadata, state validation/rebase/storage delegates | Gestures to shell/platform motion (11); catalog/executor (4); transfer (10); notify prefs (11); pure snapshot policy (6) and durable factory (7). Thin durable delegates delete when their last caller migrates. |
| 943–2008: DOM helpers, routes/modals, date/load/effort formatting, log projections, program defaults/custom identity | Shell (11); UI format (11); training metrics/model/progress (3); authoring (5). No duplicated default program is minted. |
| 2009–2308: `Exercise`, `Program`, catalog maps, engine setup and retired family-slot helpers | Training model (3), generation/catalog/executor (4); delete retired `DAY_TYPES`/unused family consumers after reachability proof. |
| 2309–3480: live draft/pending state, commands, migration/recovery, day-change decisions, log migration | Pure workout/model (3); durable protocol (7); app workout (8); Focus feedback (13). Preserve raw-copy/retry/recovery UI. |
| 3480–4430: loaded state/meta normalization, review/block/recovery presentations and program replacement proposals | Snapshot (6), generation/authoring (4/5), program commands (9), progress/program UI (14/16). Separate historical carrier preservation from current generation policy. |
| 4431–5323: commit preflight, transfer local clone/markers/freeze/rollback | Snapshot policy + durable named operations (6/7), interchange + boot transfer (10). |
| 5324–6431: `makeProgram`, recommendations, attribution, comparisons, UI formatting, rest/exercise helpers | Training model/progress (3); app workout (8); UI format/shell (11); Focus/rest UI (13). |
| 6432–7804: rest/note/day/sheet gestures, Today, session/early-finish/exercise-action sheets | Shell (11), Today/workout (12), Focus (13); pure time/draft decisions remain app/training. |
| 7805–9247: render coordinator, deck/shelf/pads/input, set validation, `WorkoutSession`, Finish | App session/workout (8), shell (11), workout (12), Focus (13). Rendering no longer mutates training/route state. |
| 9248–11199: summary, progress/evidence/PR/volume/detail/chart/History binding | Training model/progress (3), app history + history/progress UI (14), workout summary (12); chart motion capability (11). |
| 11200–12793: installed editor canonical sync/rebase/impact/commit, program/settings render | Authoring (5), app program (9), program/library (16), settings (17). |
| 12794–15425: backup/program/CSV/setup share, pickers/artwork/custom edit, import validation/review/freeform | Interchange (10), library (16), entry import/review/freeform (15); platform file/clipboard/share (11). |
| 15426–19405: entry/setup storage/generation/edit/review/activation and flow DOM | Authoring (5), tab preferences (7), app program (9), entry UI (15). Profile/Basics and recommendation replay exclusions stay explicit. |
| 19406–20886: UI prefs/theme/install/landing/Why/guide presentations | Preferences (7), platform/shell (11), entry (15), settings/guides (17), Focus Why (13). |
| 20887–21703: `init` event binding, route wiring, boot, durable host config | Feature controllers receive their own listeners (12–17); app/browser/boot composition (19). Delete monolithic init and all runtime global lookup after cutover. |

Region boundaries are navigation aids, not safe mechanical cut lines. A function serving several regions moves once to the owner of its invariant. Every extraction PR lists moved symbols and deleted source spans, and reports unmapped symbols; zero unmapped executable responsibilities is slice 20's gate.

### Delete versus compatibility

**Dead/conceptually retired:** empty `DAY_TYPES` and unreachable family-generator consumers; superseded jobs/doses/time-cut policies (do not restore); inline guide cue when #435 replaces it; optional-progress fallback renderers once that module is a required coherent release asset; old classic/UMD loader indirection; storage host Proxy/helper bags; diagnostics-only test-hook exports after tests use public contracts. Prove call reachability and owning behavior before removal; a `legacy` name alone proves nothing.

**Compatibility retained:** actual saved-state/DraftV2/WAL/checkpoint readers, unsupported-version refusal with raw preservation, historical field/metric/provenance preservation, `repforge` storage/DB/lock/cache/cookie identities, service clone versions. Current Plan 067 intentionally refuses setup v1–v3; this plan does not resurrect them or promise a new historical program migration. Unknown/uninterpretable profiles and unsafe records remain recoverable, never coerced to empty/default.

**Temporary architecture only:** one `src/compat/legacy-host.js` bridge permitted in slices 2–18. Slice 2 replaces the immediate classic-app startup with one temporary asynchronous readiness gate: run the release check, await the migrated ESM bridge, then load/start the remaining classic host exactly once. Remove its previous direct auto-start script path; do not rely on deferred module tags finishing before classic scripts. The tiny prepaint theme snippet stays synchronous, and transfer still runs before telemetry or feature mounting. Reject bridge failure into explicit recovery, never a second boot. It exposes named migrated operations to the existing boot path; it contains no algorithm, owns no store and writes no alternate durable format. Each migrated caller replaces/deletes its old body in the same PR. Each bridge export records introducing slice, last consumer and removal slice; final root switches in 19 and bridge/UMD/global scaffolding deletes in 20. No new bridge export after 18. These are removal stages, not speculative calendar dates. Persistent compatibility decoders are not temporary architecture and are not deleted merely to meet a deadline.

## 6. Migration: exactly 20 implementation slices

Do not execute this plan from the documentation PR. Each row below is one reviewable PR, including its tests and relevant guidance/import/selector updates. Estimates assume one agent implementer, one independent reviewer, existing product behavior, and #446's owning risk proofs available or mapped to current equivalents. Effort is focused person-days including correction, not unattended generation time or CI queue time. Rows requiring more than the range must be split **by amending this explicit count and dependency plan**, not silently adding “cleanup later.” No data-schema migration is budgeted.

### Common release and rollback contract

Every slice starts from a fresh `main` plus reconciled input heads and records moved symbol inventory. First produce failing proof for a changed risky interface; preserve existing product expectations rather than snapshotting the new code's own normalizer. Run exact owning contracts, architecture/type checks for converted owners, assembled path proof where relevant, then final-head CI. Unknown ownership widens through the existing runner. UI slices use the current approved visual policy; if #446 has landed this is its representative matrix plus affected new states, not the retired exhaustive guarantee.

A slice is releasable only if the old implementation of its migrated responsibility is removed and there is one authoritative runtime owner. Before step 19, the existing page/session remains the live snapshot owner; new pure modules and commands operate through its one explicit bridge, never a second editable store. Step 8 extracts this owner into `app/session.js` and rewires remaining legacy readers/writers through one scoped compatibility binding; direct mutations remain tracked transitional debt until converted. No clone-on-every-render shadow model. Slice PRs count remaining direct writers. By 19 only commands may publish state.

Rollback for every format-preserving row: revert its code/asset set as a unit and rerun the matching-release upgrade proof; do not reset storage, rewrite WAL revisions or restore arbitrary old JS against a new shell. Reverting this architecture work never authorizes a pre-DraftV2 or pre-Plan067 writer. Each row's extra rollback boundary below supplements that rule. Deletions unlocked are part of the same PR or their named dependent slice.

| # | Scope / inputs and dependencies | Affected owners | Behavior preservation and objective completion | Rollback boundary / deletions unlocked | Effort |
| ---: | --- | --- | --- | --- | --- |
| 1 | Baseline and reconciliation contract; no dependency | Architecture map, current fixtures, test inventory links | Freeze source/PR heads and source-produced corpus covering metric logs, definitions, archives, profiles, draft/WAL crash cases and worker parity. Each risk has one named owner and independent expected values. | Docs/test-only revert; no app writes. Delete no product proof merely because #446 reduces inventory. | 1–2 |
| 2 | ESM/checkJs and release protocol, after 1 | tools/typecheck, architecture checker, existing assembler/preview, release template, tiny compat entry | Ship one real leaf through the awaited bridge, no root npm. Implement complete graph inventory/cache/start-gate/activation safety now, not in 19. Prove pre-protocol worker→leaf upgrade, no-SW/first-visit/registration-failure startup, blocked install and offline gated restart. Checker negatives reject forbidden import/cycle/global IO; raw/scoped assembled paths work. | Revert tool+loader+inventory together; existing classic boot still authoritative. Unlock global lookup deletion for each converted leaf. | 2–4 |
| 3 | Pure values/model/log/progression extraction, after 2 | training metrics/model/progress/workout; old app helpers/history projections | Corpus reproduces load/unit/effort/source metrics/per-side/bodyweight/null behavior, current Program/Exercise and immutable log rows. No wall clock/random/IO. #446 parser reused. | Preserve serialized bytes and IDs; revert owner+callers. Delete duplicate formulas/parsers/model wrappers once replaced. | 3–5 |
| 4 | Generator/catalog/executor ESM, after 3; reconcile #432 first | generation + identity + platform catalog/executor/worker, build inventories | 073.4 complete result parity, explicit catalog, exact generator namespace/UUID ordering, worker/fallback/supersession. If #432 integrated, default corpus, policy/diagnostic/strict-mode proofs also pass. SHA mismatch cannot yield empty catalog. | Keep whole worker/dependency/catalog release set; no algorithm change. Delete global/require resolution and DOM script-tag URL discovery. | 2–4 |
| 5 | Authoring/entry/edit/replay pure seams, after 4 | authoring; entry/review/editor pure portions | Same validated edit sequences, token/dirty rules, replay fingerprint, every-cycle/null/RIR values; no DOM/storage imports. Preserve separate speculative hosts, ADR 0021. | No activation/storage change. Delete duplicate canonical edit logic only after its real host consumes shared rule. | 2–4 |
| 6 | Pure snapshot policy, after 3/5 | persistence snapshot, normalization/rebase/receipts from app | Source-produced state normalizes equivalently; unknown/profile/historical provenance and current guarded missing-ID/name/day backfill preserved, including ambiguous-name negatives. Domain invariants rerun on lock-held current head; no callback reads live UI. | No wire/schema change; normalization and callers revert together. Unlock domain callbacks' removal from durable. | 2–4 |
| 7 | Durable instance and preferences ownership, after 6 | durable/WAL/checkpoints/IO, device/tab preference owners | Real two-replica fault matrix, lock/CAS/preflight races, journal replay, tombstones/closing/rollback retain exact semantics. No accepted→committed promotion. UI/notify/tab records retain distinct transfer/export rules. | Retain exact keys/bytes; do not combine with protocol simplification. Delete singleton/configureHost lifecycle and app storage delegates when rewired. | 3–5 |
| 8 | App session/workout commands, after 7 and 3 | app session/workout, WorkoutSession, pending input handoff | One published state owner; Finish drains edits and commits exact captured draft. Partial/unsettled result cannot reset session or show success. Duplicate Finish/races retain session/draft/log identities. | Command+live-owner bindings revert together; retained draft is recovery boundary. Delete old WorkoutSession body and global training writer paths it replaces. | 3–5 |
| 9 | Program/custom/history command policy, after 8 and 5 | app program/history, activation/edit replacement/custom mutation | Rebase intent under lock, archive predecessor/transition pairing, stale confirmation and workout impact. Pending names/Back and non-final/cross-day renumbering remain covered by incoming owners. | Activation/edit receipts and draft follow-up stay recoverable; no new state format. Delete screen-level arbitrary commit/preflight assembly. | 3–5 |
| 10 | Interchange and transfer local orchestration, after 8/9 | interchange modules, app interchange/boot transfer, portable service contract | Ordinary backup/program/setup/CSV/clone allowlists, v4-only/refusal, profile/custom references, import rejection no writes, clone exactness, local verified commit + cleanup-only retries, credentials/privacy. No service feature work. | Local-verified transfer commit is irreversible: rollback code never rolls recipient data back; pending cleanup survives. Delete app serializers/transfer clone writers after callers switch. | 3–5 |
| 11 | Browser capabilities and shell lifecycles, after 2/8 | platform files/notify/install/telemetry/motion, UI shell/format | Back/scroll/focus/modal/gesture disposal, reduced/no runtime, notification ready failure, rest/background/resume/device-time semantics, consent and transfer identity order. Pure rendering schedules no writes or guide state transitions. | Keep matching shell+CSS+runtime set, no navigation redesign. Delete cross-feature listener takeover/timer globals per migrated owner. | 3–5 |
| 12 | Today/workout/summary presentation, after 8/11 | today/workout UI and styles | Fresh no-program, draft resume/leave, early finish, manual load carry, saved summary then History/Progress. Read models immutable; view does not write persisted state. | Feature mount+markup+styles revert together. Delete owning app render/event sections. | 2–4 |
| 13 | Focus/shelf/rest/Why presentation, after 12 | Focus UI, pending field feedback, rest controller | Acknowledged/pending input survives redraw, blur, route switch and Finish; per-side/metric pads, geometry/text size, rest cancel/resume/notification, gestures/Why unchanged. | Never drop pending edits at cutover; flush or retain exact recovery value. Delete old deck/pad/floor/Why bindings. | 3–5 |
| 14 | History and Progress presentation, after 9/11 (parallel with 12/13) | history/progress UI, app history, shared selectors | Correct/delete/duplicate/stale/replay through real storage reload, no changes on invalid metric input; identity/attribution/session delta/calendar/DST/chart representatives. Proxy and helper bag gone. | Keep correction receipt/pending journal semantics; revert read-model+view together. Delete History host glue and app statistical renderers. | 3–5 |
| 15 | Entry/landing/Build/import/recommendation UI, after 4/5/9/10/11 | entry controller/views/styles, tab-scoped source/replay | No-program cancellation, reviewed activation only, Generate supersession, six freeform exits, undo reload validation, body profile exclusions and onboarding Back/focus. | Never activate speculative definition during rollback. Delete monolithic entry DOM flows; preserve setup receipt recovery. | 3–5 |
| 16 | Installed program/library/custom UI, after 5/9/11 | program/library UI, shared editor visuals | Preserve #437/Plan 074 host behavior, shared editing language, alternates/custom archive constraints, #445 focused names, #434 empty/removal/move negatives, actual next-workout definition. | Whole editor host+view+styles revert; canonical schema unchanged. Delete app editor/picker/custom view sections and obsolete renderer branches. | 3–5 |
| 17 | Settings/profile/privacy/install/guides UI, after 10/11; reconcile #435 | settings + guide controller + preferences | Theme prepaint and device-only export exclusion; meaningful destination prefs protected; Basics deletion, backup lastExport behavior, live guide held-tap/replay/focus/placement, privacy offline. | Never clear malformed/unknown preferences on rollback. Delete old settings/guide/install presentation and superseded cue only when owner replacement present. | 2–4 |
| 18 | Lab consumer/package reconciliation, after 4; reconcile #432 without requiring its merge | existing Lab package/domain/services/workers/archive/store | If merged, preserve shared engine, isolated store, corpus, provenance, historical read-only results and archive/cancel/atomicity proofs. If still unmerged, deliver a concrete import/path/package migration patch and proof mapping against its recorded head for its owner; no Lab implementation is copied. This closes the production-side intake without promising merge; Lab acceptance remains on its branch. | Lab artifact reverts independently; keep provenance IDs. Unmerged-branch patch remains its owner's moving input. Remove production bridge at 19/20; Lab patch targets the final interface, never forks generation. | 1–3 |
| 19 | Coordinated composition/ESM release cutover, after 10–18 | browser/boot root, HTML/SW/release assembler, app removal | Every writer now owned, boot order explicit, all module paths resolve offline under root and scoped host; old/new releases and pending draft/WAL/transfer updates pass. Remove final classic startup using the release protocol already shipped in 2; do not introduce release safety for the first time here. | One atomic shell/graph/cache cutover PR. Hold install on incomplete assets; retain usable old release. Delete app.js, monolithic init and old boot ownership. | 2–4 |
| 20 | Remove temporary architecture and prove agent navigation, after 19 | compat deletion, root/domain guidance, current map, fixtures/contracts | No bridge/UMD/global module resolution, zero unexplained direct writers/unmapped responsibilities, no cycles/forbidden dependencies, all acceptance tasks below pass; exact-head CI green. | Revert cleanup with matched release if necessary; keep data decoders and identity names. Delete compat directory, unused fallback renderers and retired diagnostic hooks with owner proof. | 1–3 |

The sum is **47–86 focused person-days**, not a deadline. Calendar time adds owner integration, review and physical-device gates; parallel work reduces elapsed time but not aggregate effort. Re-estimate after 1/2/7; engine or storage parity failures pause downstream slices rather than consuming a speculative contingency rewrite.

Dependency backbone: `1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10/11 → UI owners → 19 → 20`. Generation branch `3 → 4 → 15/18 → 19`; Focus branch `11/12 → 13 → 19`. Critical path is whichever of storage-to-Focus, entry/generation or Lab reconciliation completes last; unmerged Lab product acceptance does not block production architecture completion; with input interfaces reconciled, data ownership then UI conversion dominates. Authoring 5 uses the canonical definition validator from 4 and cannot precede it; 12/13, 14, 15, 16 and 17 can proceed by separate owners once their prerequisites land. Avoid parallel edits to the residual monolith: reserve source spans, merge small extraction PRs serially, and give each PR a base-symbol manifest. No parallel “new app” is maintained. Slice 19 is unavoidably coordinated because native module URLs, worker URLs, cached shell and SW release identity cannot safely switch independently.

## 7. Data, offline and rollback risk register

| Risk / severity | Invariant and validation | Owner / stop condition |
| --- | --- | --- |
| Saved user data loss / critical | Format-preserving moves; keep storage/DB/lock/key names, revision ordering, unknown raw profile, custom references and program/log schema interpretation. Real app-produced bytes through load/commit/reload; independent raw localStorage + IDB + visible observation. | 6/7/10. Any unexplained field/byte-semantic loss blocks release. No reset/default fallback. |
| Session/workout/history identity / critical | Session ID remains draft identity; exercise-instance, slot/library UUID, block/program, performed snapshot and chronology retain meaning. Metric IDs/definitions/values/origin/loading context/bodyweight remain whole. Test duplicate Finish, rename/move/swap, correction after program replacement. | 3/8/9/14. No regenerated historical IDs or new name-based inference. Preserve only the existing characterized legacy missing-ID backfill in `migrateLogSnapshot`, including its exact name/day and performed-identity guards, until separately authorized work retires it. |
| WAL/DraftV2 races and partial writes / critical | Aggregate+identity/revision CAS, authoritative checkpoint/tombstone, pending/closing effects and exact captured raw draft. Inject failures before/after each replica/checkpoint/settlement, awaited preflight and freeze boundary. | 7/8. `accepted` or one-replica success cannot masquerade as settled Finish. |
| Archive/transition integrity / high | Archive uses predecessor program identity; transition links and semantic records stay paired; compiler-produced capability must be validated in the process that commits it. JSON clone cannot forge WeakSet-validated proposals. | 4/9/10. Compare semantic contents, not only hash or ID shape. Preserve unknown historical record without making it executable. |
| Import/export compatibility/privacy / high | Distinct contracts: full backup includes profile/history but excludes device appearance; program file contains canonical definition/referenced custom definitions; setup v4 carries allowlisted settings/language and generated identity; exact transfer includes approved preferences/identity/drafts. Review undo/freeform text never travels in a clone/export/event. | 10/15. Corrupt/oversize/version-unsupported inputs must leave source bytes and recipient data untouched. No resurrection of retired link formats. |
| Deterministic engine drift / high | Same canonical requests/catalog/options yield complete equal results/conflicts, IDs, ordering, prescriptionsByCycle, nulls and timing estimates. Compare fixed default corpus and seeded boundaries, worker/main and Lab strict mode. No generator semantic-version bump for a pure move. | 3/4/18. Any difference requires separate domain change, not golden regeneration. |
| Transfer import/rollback / critical | Freeze guards all training/device/identity writers, including in-flight async preflight and replica writes. Preboot transfer precedes telemetry identity boot. Verify local clone read-back/hash before irreversible local commit; remote acknowledgment failure means cleanup retry only. | 7/10/19. Unknown outcome must remain explicit; no recipient rollback after verified commit, no duplicate transfer. |
| Mixed release, offline update or rollback / critical | For controlled/offline startup, complete release graph+worker+catalog+styles cached before starting; uncontrolled network startup follows the explicit exception below. Required failed assets never replace good cache. Preserve root/scope/cookie behavior and service bypass rules. Test base release→target with draft/WAL, offline reload, stale open tab, interrupted install, failed asset and rollback to compatible release. | 2/19. Incomplete release fails closed with existing data retained. Never certify by cache bump alone. |
| Time/platform/notification drift / medium | Explicit reference date, ISO timestamps and device timezone conversion; keep schedule's local-hour behavior, DST/session boundaries and storage persist permission timing. Real browser rest/background/permission-denied/no-SW tests. | 3/11/13. Device-only policy cannot enter deterministic generation. |
| Lab cross-contamination / high | Separate origin/store/artifact; production package cannot import Lab. Provenance captures engine/catalog/build fingerprints, historical incompatible results remain read-only. Bounds/worker cancellation/atomic archive import retained. | 18/19. No “helpful” automatic adoption of Lab policy in production. |
| Type/architecture veneer / medium | No public `any`, no unchecked cross-owner casts, no mutation behind read-model Proxy, no hidden import IO. Checker seeded negatives and representative agent tasks, not a file-size metric. | 2/20. Suppression needs owner/rationale/removal slice; zero permanent architecture exemptions. |

### Release activation policy

Current SW's unconditional `skipWaiting`/`clients.claim` and deletion of every old cache cannot be carried into the namespaced ESM release unchanged. New releases install/verify the whole graph and **wait normally**. Existing controlled tabs keep their worker and complete cached graph. Do not activate a new worker over an active workout, transfer or pending operation. Show an explicit update/close-and-reopen affordance after draft settlement; no forced reload or mid-session takeover. Cache deletion occurs only after the old controlled clients are gone. A compatible code rollback is another complete release, not an old script substituted into a current graph.

The release protocol lands in slice 2 and protects every intermediate slice. For the first classic→ESM upgrade, a tiny root bootstrap distinguishes uncontrolled startup from an incompatible controlling worker before enabling the new app. An old controller may network-fetch new HTML without knowing its module inventory. With a controlling worker that has no release handshake, or a mismatched installed manifest, show a read-only update/reopen state, register the new worker and retain all stored bytes; do not import the writer graph or assume an intermediate bridge release was visited. An uncontrolled first visit, unavailable SW API, private-mode restriction or rejected registration may start the exact immutable network-loaded graph once its required imports/catalog inputs load; lack of offline installation must not disable training. Report offline readiness only when actually installed. Import failure remains explicit recovery, never partial boot. The pre-protocol network-first worker may already have cached new gated HTML over its old shell: an offline restart may therefore remain read-only/update-required until installation succeeds. Do not promise old-shell availability in that case. A still-cached matching old shell continues its existing behavior. Test no-SW/uncontrolled and first-install reload, skipped-intermediate upgrade, already-open old clients, old-worker/new-HTML then offline restart, blocked installation and all-old-tabs-closed→successful-reopen liveness; each historical fixture serves its matching release shell. The contradictory generic “historical scripts against current HTML” paragraph in current guidance must be reconciled with actual Plan 064 fixtures, not used to retain hidden shell IDs forever.

The bootstrap is not a new runtime loader: the browser still resolves native modules; it only gates starting a coherent installed release. Release graph/cache membership checks and required-asset failures belong to assembly/SW. No indefinite release archive or changed hosting configuration is required. Waiting rather than early takeover avoids needing old deployed files after their active worker still serves its cache. If platform behavior cannot satisfy these guarantees, stop slice 2 or the first affected slice and amend the design; final cutover remains blocked; do not add a silent network fallback to an arbitrary version.

## 8. Agent workflow, boundaries and acceptance

Root guidance should fit roughly one screen: purpose/privacy, historical naming prohibition, current map pointer, “find owner → change contract → exact proof → final-head CI,” and the small set of critical data/boot invariants. Keep detailed domain instructions next to training, persistence, UI and Lab; each says what it owns, public entry file, prohibited dependencies and exact owning tests. Keep the product glossary in current `CONTEXT.md`; do not fork it into an architecture glossary. Future README links point to one current map, not a chain of completed plans. Preserve strategic approval gates by linking rather than duplicating their prose.

| Task an agent receives | Start here | Expected verification |
| --- | --- | --- |
| Change source-metric input/unit rule | training metrics public contract; Focus/History consume same parser | Shipped parser boundary/property negatives and one real input→save→History reload journey |
| Change a training prescription/generator constraint | generation public interface and Plan 073 parity contract | Fixed complete-result corpus, deterministic conflict/identity boundaries, actual worker/fallback; Lab consumers if shared policy changes |
| Fix History correction persistence | app history command, then history view | Current owning real two-replica/race/reload proof; invalid input no-write negative |
| Add an installed editor intent | training authoring + app program + program view, ADR 0021 | Intent validation/rebase plus production Apply/reload/next-workout; pending Back regression |
| Adjust guide presentation | settings guide controller + shell modal primitive | Incoming #435 trigger/held tap/replay/focus/placement contract, affected critical frames |
| Change saved-state recovery | persistence durable/snapshot public interface | Failure-first protocol negatives plus real local+IDB/old-writer/reload proof, independent migration review |
| Change Program Lab comparison | Lab domain/UI and shared generation contract only if needed | Lab own store/archive/provenance/package journey; production data sentinel unchanged |

Proposed enforcement in the single existing test inventory:

- Strict `allowJs/checkJs/strict/noEmit` for converted owners, progressing by closed directory, never excluding a troublesome public contract. Unknown external data enters as `unknown`; runtime validators establish trusted values. No `@ts-nocheck`; temporary legacy bridge suppression is listed and removed by 20. JSDoc cannot replace runtime import validation.
- Parser-based dependency rules reject cycles, deep/private imports, banned direction, computed imports outside approved composition roots, global module discovery and new shared mutable globals. Training forbids DOM/storage/fetch/time reads/randomness; explicit calendar arithmetic is allowlisted. Import-time IO/registration/timers forbidden outside tiny entry roots. Negative fixture mutations must demonstrate each rule fails, through the actual checker.
- One tracked writer inventory for training snapshot/draft, device prefs, session flows, telemetry identity and transfer markers. By 19 no UI code writes them directly. Mechanical grep is useful feedback; meaningful real command tests establish behavior.
- Fixtures live under existing `test/fixtures/<owner>/` (or current owner paths until a necessary move). The owner of the producer owns canonical examples. One fixture feeds its real consumers; do not duplicate a normalizer inside tests. Lab baseline results are historical immutable evidence, not regenerated to conceal drift. CI/source/seed/browser/initial outcome artifacts use the existing `.ci-results` protocol.
- New architecture checks are governance checks, not product tests. Production behavior keeps the highest realistic seam; isolate canonicalization/combinatorial algorithms/protocol faults only with an explicit reason and failing proof before implementation. Replace redundant helper tests when a stronger owning interface proof takes over; preserve unique negatives.

Acceptance is measurable and evaluated at 20:

1. Zero import cycles, forbidden direction/private imports, runtime global module lookup, import-time app effects, unowned durable writers or undeclared production assets. Every public command documents inputs, identity/preconditions, ordering, error modes, durability and disposal where applicable.
2. Zero unexplained differences in the frozen engine and saved-data semantic corpus. Raw preserved unknown fields and rejected inputs remain recoverable. No schema/key/catalog/generator identity changes under “refactor.”
3. Finish and activation only report completion after their required durable settlement; fault/race tests falsify lost update, stale draft, duplicate history and transfer rollback mistakes. Backup export preserves its distinct current failure policy.
4. Execute six representative tasks: metric rule, non-final editor removal, History correction, guide presentation, generator constraint and Lab comparison. An agent given only root guidance must locate the public owner and exact proof without searching completed plans. Record files read/changed and wrong-owner attempts. Target ordinary non-cross-cutting change ≤3 owning runtime modules plus tests/assets; exceptions must identify a real cross-cutting invariant. This is a scope budget, not an incentive to hide hundreds of helpers in one file.
5. One session snapshot owner, one DraftV2 aggregate, explicit speculative editor/input lifetimes, repeatable mount/dispose without duplicate listeners/workers/timers. Render/update does not publish training or route changes.
6. A complete assembled release boots, generates in worker/fallback, saves/reloads, imports/exports and works offline at root and scoped deployment paths. Upgrade/revert with active draft/WAL and an old tab is tested; no manual cache clearing as acceptance evidence.
7. Final-head ordinary `ci` passes under the then-current inventory. If #446 is integrated, preserve its 97-command risk semantics and retirement transparency; **do not freeze the count at 97** as Lab and architecture proofs are added. Its performance claim requires its own successful paired benchmark; this architecture spec does not certify that target.

### Concrete verification ownership with the redesign

These are observed production-backed owners present on the audit base and retained by the inspected #446 inventory, not tests executed for this documentation PR. For exact commands use `node tools/run-tests.mjs <lane> --suite-id <id>`; an unparameterized file `test/workout-draft.mjs` has ID `test-workout-draft-mjs`. Discover parameterized IDs with the runner's `--list`, rather than inventing a second command list. Slice 1 reconciles these owners against the actual integrated inventory and its retirement ledger.

| Migration slices / risk | Existing executable owner files and lane | Additional planned acceptance (not yet implemented/passed) |
| --- | --- | --- |
| 3–5: pure model, generator, authoring | `test/workout-draft.mjs`, `workout-draft-migration.mjs`, `generation-identity.mjs`, `program-generation-parity.mjs`, `program-review.mjs`, `program-entry.mjs` in fast; `test/program-engine-worker.mjs` in entry | Require new ESM public imports directly; same complete output corpus, source metric and authored-edit contracts, no private-source extraction. |
| 6–9: durable state/session/program | `test/durable-outcome-contract.mjs` in fast; `test/persistence.mjs`, `persistence-race.mjs`, `draftv2-staged-cas.mjs`, `workout-draft-storage.mjs`, `adversarial-draft-transactions.mjs`, `program-transition-crash-replay.mjs` in state; `test/workout-finish-boundary.mjs` in workout | Named operation/preflight under lock, source-produced raw values through real replicas, state-owner publication only after required settlement. |
| 9/14: history edits and replay | `test/history-delete-replay.mjs` in workout; retained History correction negatives in `test/catalog-metric-program-browser.mjs` (entry), `persistence-race.mjs`/`thermonuclear-races.mjs` (state) | #446 retires standalone History edit suites; map their unique semantics to these real consumers, not to pure selector assertions. |
| 10: archive/interchange/transfer | `test/shared-setup-unit.mjs`, `install-transfer-client-contract.mjs`, `install-transfer-plan067-contract.mjs`, `install-transfer-limits.mjs`, `telemetry-unit.mjs` in fast; `test/program-transition-backup.mjs`, `install-transfer-import.mjs`, `install-transfer-ui.mjs` in state; `test/shared-setup-flow.mjs`, `program-freeform-import.mjs` in entry | Separate allowlists and rejection/no-write observations, exact clone/credentials/cleanup behavior and current service consumer. |
| 12/13: session input/Focus | `test/focus-pending-field.mjs`, `workout-draft-parity.mjs`, `workout-finish-boundary.mjs`, `management-summary.mjs` in workout; `test/per-side-execution-mode-capture-browser.mjs`, `catalog-metric-program-browser.mjs` in entry | View/controller separation must preserve pending values and raw recovery through blur/Back/reload/Finish. |
| 15–17: editor, guide, critical presentation | `test/program-editor-text-fields.mjs`, `program-entry-s4.mjs`, `program-import-review.mjs` in entry; `test/ui-system.mjs` in workout | Preserve incoming #445/#437/#435 failure detection, including guide state protocol and affected new critical frames. The inspected #446 representative matrix alone does not certify every future guide/editor state. |
| 2/19: assembly, offline and upgrade | `test/pages-deploy-boundary.mjs` in fast; `test/sw-upgrade.mjs`, `sw-error-responses.mjs`, `sw-launch-redirect.mjs`, `install-transfer-sw-upgrade.mjs`, `workout-draft-sw-upgrade.mjs`, `program-transition-sw-upgrade.mjs` in state | Add pre-protocol→first-ESM leaf, no-SW/network startup, incomplete graph, old tabs, new-HTML/offline restart and eventual reopen liveness to real browser owners; seeded architecture-checker negatives are separate governance proofs. |
| 18: isolated Lab | Conditional #432 owners: `test/programlab-default-parity.mjs`, `programlab-native-policy.mjs`, `programlab-domain.mjs`, `programlab-archive.mjs`, `programlab-package.mjs`, `programlab-archive-limits.mjs`; browser `programlab-store.mjs` and parameterized `programlab-ui.mjs` | Reconcile all ten incoming commands with #446 rather than dropping them to retain a numeric test-count goal. Keep actual worker/store/archive and production-data sentinel proofs. |

## 9. Codebase-design reference: adoption and departures

Read the actual upstream files via GitHub at **`d80fa0f4ebe0c5714af0adf8670336065233ecc6`**, the latest path-changing commit observed for the requested directory: [SKILL.md](https://github.com/mattpocock/skills/blob/d80fa0f4ebe0c5714af0adf8670336065233ecc6/skills/engineering/codebase-design/SKILL.md), [DEEPENING.md](https://github.com/mattpocock/skills/blob/d80fa0f4ebe0c5714af0adf8670336065233ecc6/skills/engineering/codebase-design/DEEPENING.md), [DESIGN-IT-TWICE.md](https://github.com/mattpocock/skills/blob/d80fa0f4ebe0c5714af0adf8670336065233ecc6/skills/engineering/codebase-design/DESIGN-IT-TWICE.md). No external scripts were installed or executed. This is technical reference, not authority to publish unrelated changes or supersede Taurifer's product/data rules.

Adopt depth as leverage at the interface, locality, the deletion test and tests crossing the real caller seam. The durable module earns its cost by hiding replicas/WAL/checkpoints; a factory forwarding 18 host callbacks does not. Authoring earns its cost by preserving row/definition/slot invariants for both hosts; an `EditService` wrapper around unchanged host mutation does not. Worker/main fallback and optional motion are real varying adapters. Pure generation is in-process; browser storage is a real local dependency exercised through production storage; the owned transfer service has a real transport seam. Do not expose every local dependency as a port just to mock it.

Adopt replace-rather-than-layer for redundant tests only after the new owning proof demonstrably detects the old risk. Depart from an overly literal “one interface means one method” reading: durable boot/CAS/commit/settle have distinct required semantics, and hiding them behind `save()` would leak ordering. Keep private fault-injection seams for protocol failures ordinary journeys cannot deterministically exercise. Compare alternative designs in section 3 and independently challenge them; do not generate three hypothetical extensibility frameworks merely to satisfy a process pattern. The referenced exploration technique informs design judgment; it is not a mandate to install its setup tools. Root/domain structure stays Taurifer's, rather than adopting a `packages/*/lib` monorepo for a single PWA.

## 10. Review, implementation gates and owner decisions

Two independent reviewers inspected fresh-main responsibilities: architecture/discoverability and migration/data safety. Their substantive corrections are incorporated: current v4-only setup contract; matching historical shell fixtures; full metrics/profile/undo scope; real compiler/catalog/worker responsibilities; lock-held validation without host callbacks; distinct backup-export success policy; immutable release activation/retention; irreversible transfer commit; and no automatic deletion of compatibility readers. Review closure and documentation checks are recorded in [review and validation evidence](review-evidence.md).

No new product or schema decision is required to write this spec. Owner decisions genuinely needed **before implementation scheduling** are whether to fund this 20-slice migration against the product queue, who owns the concurrent interface reconciliations, and whether to authorize verification-only tooling/graph-aware release assembly as the documented Phase 1 exception. Recommended technical defaults are fully specified here; these are approval of scope/cost, not unresolved framework choices. A future schema simplification, expanded historical import support, native shell, production Lab exposure, account/sync platform or transfer-service redeploy needs its own authorized work and evidence. None is bundled into this proposal.
