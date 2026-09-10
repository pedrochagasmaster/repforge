# Taurifer — architecture audit and refactoring plan

**Audit date:** 9 September 2026<br>
**Repository:** `pedrochagasmaster/repforge`<br>
**Historical audit snapshot:** `77c6a011e1bba5121ebd2ee15db85d77275c6ee5` (9 September 2026)<br>
**Current-main reconciliation:** `e4a5e31c0fdc695beffbda02e4bcc3d6a0e81e6d` (10 September 2026, after PR228 and merged PR238)<br>
**Status:** Proposed engineering guidance; no runtime or product changes. This document does not create a second backlog, authorize a plan, or override approved product decisions.

The measured inventory, local test count, failure evidence, line anchors, and S1–S19 source links below describe the historical `77c6a011` snapshot. They remain historical evidence and are not claims about current main.

## Baseline and current-main reconciliation

Current main is `e4a5e31c0fdc695beffbda02e4bcc3d6a0e81e6d`, the merge of PR238 on top of PR228's Plan 052 block-transition provenance merge at `e3c798855c6f25963543f4578a4288df741772fd`. The head retains `program-transition.js`, the transition and recovery contract, the recovery-carrier and block-identity implementation, and related `app.js` and test changes. It also integrates PR238's test-runner, affected-selection, and visual-selection changes. Those are CI operating contracts, not application-architecture guidance. At this head, `app.js` is 15,280 lines, `program-transition.js` is present, and `docs/ci.md` records 109 executable commands. The detailed measurements below stay pinned to `77c6a011`; they are not a new current-main audit.

Plan 052 is integrated at this current head. Structural transitions require both the localStorage and IndexedDB replicas for a `committed` result. A one-replica or partial write remains an explicit deferred, partial, or recovery outcome. Any later durable-state extraction must preserve Plan 052's whole-state reconciliation, `recoveryTransitions` quarantine, opaque block identity, reassessment CAS, DraftV2 checkpoint authority, and `_storageDraftTransaction` semantics.

At this reconciliation, PR235 is still an open draft and its Plan 053 client and service work is not in current main. The transfer path in the target direction is therefore planned PR235/Plan 053 scope, not an existing client. It remains the narrow ADR 0013 exception: one hour, token-derived AEAD, EU Durable Object processing, the transfer cookie, the approved clone scope, and no account or synchronization platform. The durable refactor does no work inside PR235. After PR235 receives owner approval and merges, first normalize one outcome-oriented durable transaction result without changing partial-write truth. Then extract foreground commit, WAL, locks, replica settlement, DraftV2, and boot recovery behind the accepted contracts.

Nothing in this document authorizes Plan 054 or any later plan. Candidate work remains subordinate to `docs/backlog.md`, the current plan files, the cross-plan steering sequence, and each plan's owner, visual, staging, physical-device, and same-SHA gates.

## Recommendation

Keep Taurifer as a statically deployed application with a small number of deep JavaScript modules. Do not rewrite it in a framework, replace its storage protocol, or turn each screen into an independently managed subsystem.

The highest-leverage change is to make **durable state commit and recovery one owned module**, then place workout-session and program-entry orchestration behind outcome-oriented interfaces. The safest first production refactor is **explicit gesture-controller ownership**, which removes a concrete cross-file takeover protocol without changing stored data. Both changes should simplify work covered by Plans 051–059, subject to their existing owners and gates, rather than delay that initiative with a separate architecture program.

The main problem is not that `app.js` is large. It is that callers must understand details that should belong to the implementation: draft receipts, replica outcomes, recovery timing, setup-draft cleanup, and the identities of another module's event listeners. Moving those functions into different files without changing what callers need to know would preserve the problem. [S1–S6]

## 1. Scope, evidence, and limits

The audit used the merged repository documentation, a local source snapshot from the successful GitHub Pages artifact for the exact baseline SHA, targeted source inspection, recent PR/change context, selected open-PR diffs, current CI results, and focused executable checks. Representative artifact files were verified against Git blob hashes. The artifact is a deployed-source snapshot, not a local Git checkout with full history.

Inspection covered persistence and boot recovery; DraftV2 and workout completion; progression, compiler, entry and editor interfaces; import/share paths and exercise identity; gesture installation; telemetry; service-worker asset policy; test ownership and CI documentation. Open PRs #228, #235, and #238 were inspected for overlap. Their selected diffs inform sequencing, not a complete correctness or merge-readiness verdict. This is not a line-by-line security audit, a quantitative Git-churn study, or a production performance profile.

### Measured source inventory

| File | Lines | Architectural interpretation |
|---|---:|---|
| `app.js` | 13,440 | Persistence, workflows, projections, UI, and boot remain concentrated together. |
| `progression-engine.js` | 1,943 | An existing substantial pure module; size alone is not a reason to split it. |
| `shared-setup.js` | 1,555 | A versioned compatibility codec, not redundant entry UI. |
| `program-entry.js` | 1,496 | An existing pure entry state machine. |
| `workout-draft.js` | 1,191 | An existing aggregate/reducer with meaningful invariants. |
| `program-compiler.js` | 1,031 | A shared compiler worth preserving. |
| `program-editor.js` | 947 | A reusable editor with distinct setup and installed-program hosts. |
| `motion-layer.js` | 648 logical lines | A useful optional runtime whose installation currently leaks across files. |
| `program-entry-adapter.js` | 606 | Useful compiler integration, plus some broader vocabulary ownership. |
| `telemetry.js` | 388 | A valuable closed schema and third-party isolation seam. |

Counts are descriptive, not complexity scores or refactoring targets. The inventory also finds 911 column-zero function declarations in `app.js`; that is a lexical count, not an AST-derived complexity metric.

### Verification actually performed

All **16 root JavaScript files passed `node --check`**. Six dependency-free test files passed under Node 22.16.0, producing **54 passing Node test-runner results**, with no failures or skips:

```sh
node --test \
  test/program-entry.mjs \
  test/program-entry-production-adapter.mjs \
  test/progression-engine.mjs \
  test/shared-setup-unit.mjs \
  test/telemetry-unit.mjs \
  test/program-family-fixtures.mjs
```

These results do not mean that every assertion or every scenario in the product was independently counted as one test. The full browser, property, visual, and physical-device matrices were not rerun locally. In particular, `test/workout-draft.mjs` requires `fast-check` and was not included in this dependency-free run.

The baseline's GitHub Simulation run **34310771684 failed**. Its state lane passed 16 of 17 commands. `test/persistence-race.mjs` failed the destructive-delete/total-write-failure draft-preservation assertion; the recorded detail had `draftByteEquivalent: false`, while both durable log copies and the live session remained present. Its diagnostic replay passed, and the aggregate correctly stayed red. That is unresolved nondeterminism, not proof of either a production data-loss defect or a harmless test flake. Other listed lanes succeeded. Establish its cause before treating the baseline as a refactoring safety net. [S18]

## 2. Architecture decisions to preserve

The current source of truth is newer than several historical conversations about Taurifer. The canonical backlog makes Plans 049–059 the active pre-alpha initiative and records Plans 045–048 as implemented. ADR 0010 establishes generator-first acquisition and the deterministic Free engine; ADR 0012 governs the UI overhaul. This plan does not revive a coach-SaaS thesis, introduce a fake paywall, or reschedule deferred product work. [S1, S2, S3]

Preserve static deployment and existing browser/CommonJS module conventions. The two approved vendored interaction runtimes remain optional enhancements; this is not a zero-library application, nor does their presence justify an application framework or build pipeline. Preserve deterministic training behavior, version-pinned programs, historical movement identity, and the local ownership/export of training data. Keep telemetry optional and schema-bound. The approved temporary install-transfer exception is not permission to introduce accounts or general synchronization. [S1, S2, S17]

Storage and compatibility are particularly sensitive: retain historical keys, IndexedDB names, lock identifiers, WAL formats, checkpoint/tombstone semantics, and supported legacy readers. Distinguish ordinary program import/share from full backup replacement, history-only merge, and the specified install-transfer clone. Their different data scopes are intentional, not duplication to erase. [S1, S8, S17]

### Existing modules that pass the deletion test

Deleting the progression engine would scatter strategy and numeric rules back into callers. Deleting DraftV2 would scatter set identity, correction, validation, and serialization rules. Deleting the compiler would duplicate family/version/prescription behavior. Deleting the shared-setup codec would spread compatibility rules across entry paths. Deleting the editor would duplicate substantial interaction behavior between two real hosts. Deleting telemetry would leak schema and privacy responsibility into every event producer.

These are earned modules. Preserve and consume them; do not create replacement implementations with different names. Their interfaces can improve when concrete caller friction is demonstrated, but neither size nor export count is sufficient evidence. [S5, S7–S11]

## 3. Prioritized deepening candidates

“Strong” means the source shows concrete cross-module knowledge or workflow coupling. “Worth exploring” means there is a plausible benefit that must be demonstrated in a bounded slice. These candidates remain subordinate to `docs/backlog.md`, the current plan owners, the steering sequence, and all owner and device gates. They do not authorize speculative platform work or Plan 054+ implementation.

### A. Own durable commit and recovery — **Strong; highest leverage**

**Evidence:** `app.js:1–1357`, especially `enqueueStateChange` at 1212–1357; `commitProgramReplacement` at 3372; commit interfaces around 3640–3666; boot replay in `resolveBootReplicas` at 13220 onward. [S4]

The write interface includes program identity, fingerprint, storage revision, first-run eligibility, setup-draft bytes, session reconciliation, day renames, draft effects, and a lock-held preflight callback. It both coordinates persistence and interprets application-specific conditions. The same file separately owns boot recovery and UI consequences. Production protocol branches also depend on `io === storageIO`; replacing just the two write functions does not exercise every production path.

**Before:** callers assemble proposals and transaction details → shared globals coordinate journal/lock/replicas/draft effects → callers interpret low-level outcomes; boot separately reconstructs these obligations.

**After:** domain workflows submit supported operations → one local-state module owns durable execution and recovery → callers receive explicit, stable outcomes. Browser storage and a deterministic fault rig sit behind an internal seam; boot recovery belongs to the same owner.

The module must absorb the hard coordination, not just rename `enqueueStateChange`. Keep semantic operation preparation near its domain owner, but keep raw receipt construction, rollback markers, replica healing, ordering, and journal cleanup out of screen code. Initially preserve the existing algorithm and disk formats behind a temporary compatibility facade. Do not simultaneously replace the protocol with a new generic command bus.

Define outcomes that distinguish committed, already committed, conflict, rejected, recovery required, and deferred settlement. Preserve finer existing distinctions in the mapping. For a structural transition, `committed` requires both the localStorage and IndexedDB replicas to settle. A one-replica or partial write remains an explicit deferred, partial, or recovery result; it must not be reported as a committed replacement, recovery, or reassessment. Replica health is separate for operations that permit one-replica durable acceptance: the other replica's failure must not turn that permitted acceptance into a workflow failure. Conversely, “some bytes were written” must not automatically mean “the workflow completed.” Keep compensation diagnostics inside the module rather than asking every caller to combine booleans.

**Dependency category:** local-substitutable, with browser-only integration obligations. The test substitute must exercise the same coordinator, not bypass WAL or locks because its object identity differs. Use explicit fault scheduling for local storage, asynchronous IndexedDB, journal failure, and lock contention. Keep real-browser cross-tab tests because an in-memory rig cannot establish browser lock, unload, or service-worker behavior.

**Acceptance:** the existing race/recovery matrix passes; a rejected operation cannot appear committed after reload; a duplicate cannot mint another session/archive; a newer acknowledged draft survives stale work; UI observes one authoritative completion result; recovery uses the same protocol implementation as foreground writes.

**Sequencing:** first create the characterization and ownership map. Do no durable extraction work inside PR235. After PR235 receives owner approval and merges, normalize one outcome-oriented durable transaction result behind a compatible seam without changing partial-write truth. Then extract foreground commit, WAL, locks, replica settlement, DraftV2, and boot recovery from the accepted Plan 052 and Plan 053 contracts, with one writer responsible for the affected code at a time. Architectural priority is high; scheduling remains subordinate to `docs/backlog.md`, the current plan files, the steering sequence, and their owner and device gates.

### B. Make workout-session lifecycle an explicit module — **Strong**

**Evidence:** DraftV2 integration around `app.js:2230–2890`; `saveWorkoutV2` at 5878–5925; `saveWorkout` at 5927–5934; `workout-draft.js`; Plan 055. [S5, S6]

The pure aggregate is already extracted and authoritative. The remaining problem is orchestration: completion drains pending work, captures identity/revision, compiles history rows, creates a destructive receipt, persists, resets session identity, manages recovery, sends events, manipulates a button, rerenders, and opens a summary.

**Before:** Focus/List projections and UI globals → DraftV2 plus persistence details plus completion UI.

**After:** renderer → workout-session interface → existing DraftV2 and durable-state owner; renderer consumes acknowledged projections and completion/recovery outcomes.

Move orchestration, not progression mathematics, into the session module. Give it the lifecycle that actually exists: start/resume, dispatch a supported draft command, obtain the acknowledged projection, finish, leave, and perform explicit recovery actions. Exact naming is provisional. Do not expose mutable `state`, arbitrary setters, or the full draft-store implementation to the renderer.

Finish must own the capture-to-acknowledgement sequence and clear the completed in-memory identity before a successor can be created. A pending correction or failed suggestion refresh must not silently compile an older draft. Formatting, DOM focus, toasts, and celebratory animation remain presentation responsibilities. Telemetry consumes approved workflow outcomes through the existing telemetry interface; no durable outbox or exactly-once analytics platform is needed.

**Dependency category:** in-process aggregate plus the real local persistence seam. Clock/ID substitution is justified by deterministic tests; a general dependency-injection container is not.

**Acceptance:** correcting/uncommitting preserves values; immediate Complete → Finish waits for acknowledged work; stale finish cannot clear a successor; total failure preserves recoverable input; leaving preserves the draft; a read-only preview writes nothing; summary and history describe the acknowledged session. Keep the existing Plan 055 capability-parity gate before deleting List.

**Sequencing:** if Plan 055 accepts this candidate, implement it as bounded work that consumes Plan 051 and follows Plan 055's gates. Do not rebuild DraftV2, introduce a second session store, or make the entire storage extraction a new prerequisite for every Focus UI slice. Where necessary, use a temporary narrow delegate to the existing coordinator.

### C. Own entry workflow and activation — **Strong**

**Evidence:** import/review functions from `app.js:8917`; entry orchestration from 10334; `activateEntryPreview` at 12091–12187; `program-entry.js`, `program-entry-adapter.js`, `program-editor.js`, and shared-setup codec. [S7–S10]

A pure entry state machine already exists. Nevertheless, the app host knows the setup-draft write queue, candidate versions, activation readiness, prior activation receipts, raw setup-draft CAS, preview-to-program mapping, custom-exercise merging, destructive confirmation, durable conflict handling, and cleanup order.

**Before:** onboarding host assembles route-specific details and durable activation details while managing UI state.

**After:** entry workflow owns setup-draft lifetime and candidate orchestration → program lifecycle confirms the reviewed candidate → screen renders entry state and explicit outcomes.

Keep the pure state machine and compiler adapter. Deepen the imperative host around them. The entry renderer should not construct archival or journal metadata. Activation must use the candidate actually reviewed, preserve its version/provenance envelope, revalidate against the acknowledged durable head, and recognize an already committed activation before cleaning up its setup record.

Do not force every inbound format through one permissive “normalize everything” function. Program imports/shared setup produce executable candidates; full backup replacement restores a different aggregate; backup merge imports historical sessions; install transfer has its own approved clone scope. Raw free-form source/reply remains tab-scoped and is cleared at its specified exits. Display-name matching must never silently repoint established exercise identity.

The audited `77c6a011` snapshot predates `program-transition.js`. Current main at `e4a5e31c0fdc695beffbda02e4bcc3d6a0e81e6d` includes the accepted PR228 implementation, its reviewed recovery-carrier and block-identity changes, and the merged PR238 CI contracts. Use that implementation as the starting point for transition semantics, not a reason to create a parallel transition implementation. Consume the accepted contract; do not infer current merge readiness from historical PR-body blockers.

**Dependency category:** pure candidate/state computation, browser-local draft storage, and the planned PR235/Plan 053 transfer seam only where its accepted contract requires it. No network adapter belongs in ordinary compilation or import parsing.

**Acceptance:** cancellation is storage-silent for the active program; retry after activation/cleanup interruption does not create another successor; stale cross-tab confirmation fails clearly; user-reviewed identity and prescriptions survive activation; legacy supported import/share versions still decode; full backups and transfer do not lose their extra authorized fields.

**Sequencing:** these are candidate alignments, not authorization. Entry-host deepening remains under Plan 054's owner and device gates, transition integration remains under Plan 052's accepted contract, and installed-editor convergence remains under Plan 057. Do not start or merge Plan 054+ work from this document, and do not merge those whole plans into one refactoring PR.

### D. Give gestures one owner and an explicit lifetime — **Strong; safest first refactor**

**Evidence:** `motion-layer.js:580–648`; documented listener-name requirements in `AGENTS.md`; existing Motion and vendor tests. [S1, S11]

Motion waits on a 25 ms polling timer for a global boot flag. It then removes named fallback handlers from `app.js`, installs different listeners, replaces `focusAnimateTo`, patches a test-visible object, and installs additional observers/listeners. Correctness depends on another file's global names and registration details.

**Before:** app installs fallback → Motion polls boot → Motion removes another owner's listeners → Motion replaces globals.

**After:** boot explicitly mounts one gesture owner → that owner uses the supported Motion capability or the fallback → its returned handle owns disposal and cancellation.

Retain current gesture physics, hit regions, scroll arbitration, reduced-motion semantics, keyboard behavior, and fallback behavior. Move listener installation and replacement into one lifetime. Use the actual existing two runtime paths; do not invent a general animation plugin system. A disposal handle must remove its listeners, stop pending work, disconnect its observers, and release gesture state. Preserve historical external identifiers through temporary delegates where needed.

**Dependency category:** in-process controller logic plus real DOM/browser behavior; two existing capability implementations justify the seam.

**Acceptance:** mounting twice cannot cause duplicate navigation; disposal during a drag is safe; pointer cancellation returns to the correct card; Escape cancels without stray work; missing Motion still leaves a working app; no boot polling or cross-file listener removal remains. Use physical-device proof in the existing release gate for browser-sensitive behavior, not as an unsupported claim from Chromium alone.

**Sequencing:** if an existing owner accepts this candidate, coordinate the bounded runtime PR with Plan 055 and its gates. It can precede the persistence extraction without changing storage or product semantics.

### E. Own historical evidence projections — **Worth exploring**

**Evidence:** `sessionsFor`, capacity helpers, and session deltas at `app.js:3731–3798`; `progressionInput` at 3913; recommendation formatting at 4032; summary construction at 5850; history indexing around 6597. [S12]

Several consumers walk and interpret history, and memo correctness depends on invalidation elsewhere. The code already calls the shared progression engine; this is not evidence of five duplicate engines. Some formulas intentionally describe different things: RIR-adjusted capacity, performed e1RM, and actual volume must remain distinct.

**Before:** Today, workout recommendations, summary, and Progress each reach into live state and history helpers.

**After:** those consumers request explicit projections from an acknowledged snapshot; the existing progression engine remains the sole owner of progression decisions.

Extract one proven slice, such as lift/session history selection or summary facts, and demonstrate at least two genuine consumers before generalizing. Return data rather than translated copy or HTML. Key any memo/index to explicit snapshot validity, not undocumented assumptions about array length and the final timestamp. Do not add persistent indexes or a second database without measured need.

**Acceptance:** identical historical snapshots produce identical results; renames do not change movement identity; archived and current sessions are not conflated; same-length corrections invalidate results; display formatting cannot alter engine inputs. Measure representative small and accumulated histories before claiming faster input or render performance.

**Sequencing:** if Plan 056 accepts this candidate, align it with the surfaces that plan actually changes and its gates. Defer a broad read-model subsystem until the first extraction proves reuse and meaningful improvement.

### F. Make release/cache ownership explicit — **Strong for checks; broader tooling conditional**

**Evidence:** `index.html:951–968`, `sw.js:1–105`, and release assertions in `test/exercise-library.mjs:240–275`. Core runtime registration spans HTML, precache entries, cache-policy sets, and revision assertions. For example, `progression-engine.js` is precached but absent from the network-first `SHELL` set, while versioned compiler/entry/app scripts follow a different path. This is a concrete policy distinction to characterize, not a reproduced mixed-version failure. [S13]

**Before:** a module extraction requires manually remembering several partially overlapping lists and their exceptions.

**After:** one executable release contract derives the relevant script inventory and verifies an explicit policy for every runtime asset: required versus optional, load order, versioning, and caching.

Start by extending the existing checks; derive what is possible from HTML instead of introducing another manually maintained list. Move runtime-release assertions out of the exercise-library suite only when their new owner is registered once and preserves coverage. A generated manifest is optional and must eliminate duplication rather than create a fourth authority. No bundler, application build requirement, or runtime dependency is necessary.

Test cold boot, cached offline boot, an older controlled client during upgrade, missing optional telemetry configuration, unavailable optional runtimes, and required-code failure. Specifically characterize engine/compiler/app pairing and executable-request fallback behavior before changing cache policy. A shell HTML fallback is not interchangeable with a valid JavaScript response.

**Acceptance:** a newly extracted required script cannot be omitted from offline coverage; optional PostHog configuration never becomes a required precache dependency; vendored immutability remains deliberate; old/new client and draft migration tests still pass; missing required code fails visibly rather than presenting successful boot.

**Sequencing:** if an existing plan accepts this candidate, add these protections with the first script extraction under that plan's gates. Do not turn release-tooling improvements into an independent pre-alpha platform project.

### G. Move tests to the interfaces they protect — **Strong; cross-cutting**

**Evidence:** `test/telemetry-call-sites.mjs` scans only `app.js` for reviewed producers and forbidden direct SDK use. Other checks intentionally inspect source for purity, caching, or vendor constraints. At the historical snapshot, CI already had a single executable inventory of 94 commands. The merged #238 runner and selector contracts now govern current CI feedback; they are operational CI guidance, not an application-architecture recommendation. [S14–S16]

**Before:** some safeguards know file names or internal helper structure; moving behavior can either break a test needlessly or move behavior outside its scan.

**After:** behavioral tests exercise the same interface as production; deliberate source/privacy/release checks cover all owned runtime modules; one inventory owns scheduling.

Do not characterize the entire test suite as implementation-coupled. The existing real-browser fault, race, offline-upgrade, and identity regressions are valuable. Replace incidental implementation assertions only when corresponding behavior is proved at the new seam. Maintain explicit old-scenario → new-test evidence before removing redundant tests. Source checks for forbidden network access or direct SDK ingress can remain appropriate.

With the first event-producer extraction, update the telemetry scan to cover the real runtime source scope and retain runtime hostile-sentinel tests. Update i18n scanning and affected-test mapping similarly. Unknown extracted files must fall back to conservative test selection, not silently select nothing.

**Acceptance:** internal refactoring does not require changing outcome assertions; privacy scanning covers every production event producer; initial CI failures remain authoritative even if diagnostic replay passes; no duplicate suite scheduler is introduced; deleted coverage has an explicit replacement.

**Sequencing:** treat this as a concern of each accepted extraction. Use the integrated #238 runner and selector contracts rather than building another runner. This audit makes no unmeasured CI speedup claim and does not turn CI tooling into an architecture recommendation.

### H. Align exercise vocabulary and presentation ownership — **Worth exploring**

**Evidence:** `app.js:8217` and `8412–8415` obtain shared equipment and general picker vocabulary from `RepForgeProgramEntryAdapter`; that adapter defines picker muscle groups and shared equipment mappings. CSS also includes a separate motion-polish overlay, while ADR 0012 and Plan 058 already govern semantic convergence. [S3, S10, S19]

**Before:** non-entry search/share consumers depend on the entry integration module; visual behavior can span established styles and later overrides.

**After:** genuinely shared catalogue/search vocabulary belongs to a coherent exercised module; entry-only enums remain with the pure entry state machine. Presentation rules converge under existing semantic roles, not a parallel design system.

Move a coherent operation with its vocabulary when demonstrated by actual consumers. Do not extract a constants-only junk drawer, generic `utils.js`, or a screen-component framework. Likewise, fold a CSS override into its owner when that surface is already being changed and its visual evidence exists; do not mechanically split or reorder the entire cascade.

**Acceptance:** picker/import/share identity fixtures remain unchanged; pure entry remains free of runtime dependencies; both locales/themes and the required enlarged-text variants preserve approved semantics and visual identity.

**Sequencing:** these are candidate alignments only. Search and identity work remains with Plans 054/057 when those owners and gates permit it; CSS convergence remains with Plan 058. Broad token migration or List removal is not authorized by this refactoring candidate.

## 4. Target dependency direction

This is a responsibility map, not a mandatory directory tree or an instruction to create every box immediately.

```text
Explicit application boot / composition
             |
             +--> Entry renderer ------> Entry workflow ------> Program lifecycle
             |                               |                       |
             |                         Existing entry state     Existing transition
             |                         machine/compiler/editor  semantics (Plan 052)
             |
             +--> Workout renderer ----> Workout session ------> Existing DraftV2
             |
             +--> Progress renderer ---> Snapshot projections --> Existing progression engine
             |
             +--> Gesture owner -------> Motion capability or fallback

Workflow owners --------> One durable-state commit / recovery owner
                                       |
                              Internal browser-storage seam
                              (real browser / fault rig)

Approved workflow outcomes --> Existing telemetry interface --> PostHog adapter
Planned PR235/Plan 053 --> Planned scoped transfer client --> Owned transfer endpoint
```

Workflows may use the durable-state owner; renderers must not construct journals or inspect individual replicas. Pure domain modules must not import the application host, telemetry, or DOM. Boot creates the few required instances explicitly. Avoid an event bus, service locator, global dependency container, or one file for every helper. Keep the current root-level deployment conventions during the initial slices; a repository-wide path reorganization can wait.

The transfer path is not in current main. PR235/Plan 053 owns the planned client and endpoint, and ADR 0013 keeps it to a one-hour, token-derived AEAD, EU Durable Object, transfer-cookie, exact-clone exception with no account or synchronization platform. It is not an existing adapter for this audit's durable-state owner.

## 5. Candidate slices and PR boundaries

The following are **non-binding candidate slices**, not a roadmap, newly allocated plan numbers, or a second queue. The R0–R9 labels only make later discussion precise; they do not impose an order or authorize a branch. `docs/backlog.md` is the repository's only ordered queue. Accepted work belongs under the existing plan owners, current plan files, and `docs/ui-overhaul-implementation-sequence.md`; owner, visual, staging, physical-device, and same-SHA gates remain required. The dependency notes are architectural observations, not calendar estimates or permission to start Plan 054+ work.

| Candidate | Delta and existing owner | Prerequisite | Definition of done |
|---|---|---|---|
| R0 — Reconcile baseline | Diagnose the recorded persistence race; reconcile the integrated #236/#237/#238 test-runner contracts. | Current main and current PR status re-read. | Deterministic explanation/fix or explicit unresolved release blocker; full authoritative CI evidence retained; no retry-to-green. |
| R1 — Record ownership | Add a compact architecture map and scenario-to-owner matrix to existing docs. Define temporary facade and removal criteria. | R0 understanding, not a new design framework. | Every selected workflow has a production interface, real caller, test owner, preserved invariants, and exclusions. |
| R2 — Own gesture lifetime | Replace polling/takeover with explicit mount/dispose; coordinate with Plan 055. | Established runtime baseline. | One listener owner; fallback/reduced-motion/cancellation tests; unchanged UI evidence where behavior is unchanged. |
| R3 — Protect extraction seams | Extend release, telemetry and i18n source-scope checks; keep suite registration singular. | First affected runtime extraction. | Deliberately omitting a required script or adding an unreviewed producer fails the appropriate check. |
| R4 — Normalize, then extract durable protocol | After owner-approved PR235/Plan 053 merges, first normalize one outcome-oriented durable transaction result without changing partial-write truth. Then move foreground commit, boot recovery, journal, replica, and DraftV2-sidecar coordination as one owner; preserve old exports via temporary delegates. No work belongs inside PR235. | Accepted and integrated Plan 052 contract, owner-approved PR235/Plan 053, no concurrent edits to owned regions, and adequate fault characterization. | Existing on-disk bytes/formats and fault outcomes are preserved; structural `committed` requires both replicas; partial writes remain explicit deferred/partial/recovery outcomes; UI effects stay outside the protocol; production and fault rig use the same coordinator. |
| R5 — Hide caller protocol details | Route one workout finish and one program activation/replacement path through outcome-oriented interfaces; then migrate remaining callers incrementally. | R4 or a clearly bounded compatible delegate during active-plan work. | Callers no longer assemble receipts or interpret replica health as workflow status; crash, retry, and duplicate cases survive. |
| R6 — Own workout lifecycle | Candidate alignment with Plan 055: move pending-work, acknowledgement, finish, and recovery orchestration into the session module. | Plan 051; storage interface understood; R2 coordinated; Plan 055's existing gates. | Renderer consumes projections; exact draft identity is preserved; no duplicate store; parity precedes List deletion. |
| R7 — Own entry/lifecycle host | Candidate alignment with Plans 054/057: consolidate setup-draft lifetime and activation delegation while consuming Plan 052 semantics and planned PR235/Plan 053 transfer scope only where specified. | Accepted prerequisite contracts, prior-plan gates, and Plan 054 owner/device gates. | Reviewed candidate equals activated candidate; cleanup retry is idempotent; import, backup, and transfer scopes remain distinct. |
| R8 — Prove a shared projection | Candidate alignment with Plan 056: extract one history/summary projection with two consumers. | Stable snapshot inputs, measured baseline, and Plan 056's gates. | Same answers, explicit invalidation, demonstrated locality or performance benefit. Stop if it only adds delegation. |
| R9 — Remove obsolete paths and converge | Candidate cleanup after affected callers and capability gates are complete; delete temporary facade code, retire only proven-replaced tests, and perform touched CSS ownership changes under Plan 058. | All affected callers and capability gates verified. | No dual authorities; current docs match implementation; Plan 059 same-SHA release evidence, including devices, remains required. |

These candidate notes do not schedule work. If an existing plan accepts one, its owner controls the slice and its gates. R2 and narrowly scoped R3 work may be useful without the full storage extraction, but no slice may bypass `docs/backlog.md`, current-plan dependencies, PR235 owner approval, Plan 054+ owner/device gates, or Plan 059's same-SHA evidence. R4 and R5 must be serial with ongoing storage/provenance edits. Do not make conditional candidates prerequisites for launch. Every accepted slice must reduce risk or effort in an already approved workflow.

### Standard contents of an implementation PR

Start from the latest accepted base and identify the exact functions moving. State the new module's responsibility and what it refuses to own. Include a before/after dependency sketch and the invariants being preserved. Move one coherent workflow, migrate its real callers, test through its production interface, and delete the abandoned path. If a temporary delegate remains, name its consumers and removal condition. Update only the existing governing documents needed to describe the delta.

A PR whose only outcome is fewer lines in `app.js`, more files, or extra layers of pass-through functions is not sufficient. A PR mixing a storage-format migration, UI redesign, progression-policy change, and architectural extraction is too broad to establish behavioral equivalence.

## 6. Test strategy and migration safeguards

| Risk | Required proof | Test surface |
|---|---|---|
| Draft mutation and finish ordering | Pending correction, refresh failure, exact revision capture, duplicate finish, successor protection. | Workout-session interface plus existing DraftV2/browser tests. |
| Partial writes and compensation | Both-success, local-only, IDB-only, both-fail; classify each result without flattening it into `committed`; rollback that succeeds on the opposite replica; deferred cleanup. | Same durable coordinator with fault rig, followed by real reload proof. |
| Cross-tab/unload | Journal before lock wait; unload before/after commit; fresh head under lock; newer canonical/checkpoint/sidecar. | Existing browser race and adversarial suites. |
| Program activation | Immutable reviewed candidate, stale revision, retry after committed receipt, archive exactly once, transition provenance. | Entry/lifecycle interface and Plan 052 integration suites. |
| Compatibility | Supported setup versions; legacy draft writer and newer checkpoint; raw recovery fidelity; export field scopes. | Existing codec, backup, storage and SW-upgrade fixtures. |
| Identity | Display aliases do not repoint library IDs; historical performed snapshots remain meaningful; custom imports stay stable. | Identity and import fixtures plus actual activation. |
| Interaction | Single controller, disposal, cancelled drag, reduced motion, missing vendor runtime, focus restoration. | Mounted gesture interface and browser interaction suites. |
| Privacy | No free-form/raw workout data leaks; optional analytics failure is isolated; closed event semantics after extraction. | Runtime-wide source guards and hostile-sentinel browser tests. |
| Release | Old/new controlled client, offline boot, required/optional script policy, cache revision coverage. | Existing SW tests plus strengthened release contract. |
| Presentation | PT/EN, light/dark, approved size/overflow/semantic variants and affected physical-device behavior. | Existing capture/semantic harness and Plans 041/059 evidence. |

Replace tests only when a new seam-level test preserves the old observable behavior and fault condition. Do not delete historical regressions merely because a new happy-path test mentions the same feature. Keep short behavioral tests near their module and a deliberately smaller set of end-to-end journeys; allow the evidence map, not a desired test-count reduction, to determine what is redundant.

### Rollback discipline

Initial extraction slices must not change durable schemas or historical identifiers. Retain readable recovery artifacts and old-client compatibility. Roll back by reverting the code extraction and issuing the appropriate release/cache revision, not by deleting client data. Test that the fallback release reads data written by the extracted implementation. Never run old and new persistence writers simultaneously as a comparison experiment. Pure calculations may be compared in tests; durable side effects must have one owner.

Do not call a deferred operation rejected unless the durable protocol guarantees it cannot later commit. Do not clear raw recovery data merely to obtain a clean test environment. Record affected cache versions and the exact verified SHA in evidence. A browser automation pass does not substitute for the required iOS/Android device cells.

## 7. What not to do

Do not introduce React, a global state library, a DI framework, a bundler, or a TypeScript migration as prerequisites. Do not move storage to a new database to avoid understanding its existing guarantees. Do not turn transfer into account sync, add a generalized backend, or couple training to PostHog. Do not create an entitlement framework while refactoring deterministic Free behavior.

Do not split the progression engine or compiler into dozens of shallow files. Do not merge all inbound formats into one lossy representation. Do not add a generic repository abstraction with one meaningful implementation, a generic event bus, or a global utility bag. Do not delete List or the old tour ahead of their approved plan gates. Do not launch a second design-system migration. Do not introduce a release manifest that merely duplicates existing lists. Do not sell projected CI or render-time improvements as measured results.

These exclusions are not permanent prohibitions on future decisions. They identify changes unsupported by this audit and unnecessary for the current product-validation work.

## 8. Measures of success and stopping rules

For each extraction, record the number of places that must understand the workflow before and after, the kinds of caller knowledge removed, and the changed test surface. The aim is fewer independent decisions per change, not an arbitrary line-count ceiling.

Measure focused-test feedback and full CI separately, including failing runs and setup costs. Record cold/offline startup, critical interaction behavior, and representative history projection cost before and after relevant changes. Use the existing telemetry taxonomy to observe product behavior; this refactor does not require collecting additional personal or workout data.

A successful first tranche yields an explicit gesture lifetime, a protected runtime source scope, and a coherent durable-state owner with fewer protocol-aware callers. Stop deepening a candidate when further separation adds delegation without hiding new complexity, or when it would require new product/schema decisions that the existing plan does not authorize. Conditional read-model, vocabulary, and tooling work must earn its place through an actual second consumer or measured failure/cost.

The result should be a codebase where “change workout completion” leads to one workflow owner and its tests, not a tour through boot, persistence, UI globals, and analytics. The athlete should see the same trusted training behavior, with less risk when the next approved change lands.

## 9. Source register

S1–S19 are historical references pinned to the `77c6a011` audit snapshot. The current-main reconciliation uses the exact `e4a5e31c0fdc695beffbda02e4bcc3d6a0e81e6d` sources in S20. PR links are live work references; re-read their current accepted state before execution. References support the observations; proposed interfaces and candidate sequencing remain subordinate to the canonical backlog, current plan owners, and their gates.

- **S1:** [AGENTS.md](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/AGENTS.md), [CONTEXT.md](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/CONTEXT.md).
- **S2:** [Canonical backlog](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/docs/backlog.md), [ADR 0010](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/docs/adr/0010-product-business-thesis-and-validation-sequencing.md).
- **S3:** [ADR 0012](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/docs/adr/0012-ui-overhaul-canonical-reconciliation.md), [Overhaul sequence](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/docs/ui-overhaul-implementation-sequence.md).
- **S4:** [Write protocol](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/app.js#L1212-L1357), [program replacement](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/app.js#L3372-L3450), [boot recovery](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/app.js#L13220-L13330).
- **S5:** [Workout completion](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/app.js#L5878-L5934), [DraftV2 module](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/workout-draft.js).
- **S6:** [Plan 055](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/plans/055-focus-only-workout.md), [Plan 051](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/plans/051-workout-draft-state-foundation.md).
- **S7:** [Entry host](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/app.js#L10334-L10364), [activation](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/app.js#L12091-L12187), [entry state machine](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/program-entry.js).
- **S8:** [Shared-setup codec](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/shared-setup.js), [import/review implementation](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/app.js#L8917-L9900).
- **S9:** [Compiler](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/program-compiler.js), [editor](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/program-editor.js).
- **S10:** [Production entry adapter](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/program-entry-adapter.js), [non-entry vocabulary consumers](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/app.js#L8408-L8423).
- **S11:** [Motion takeover/install](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/motion-layer.js#L580-L648), [telemetry module](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/telemetry.js).
- **S12:** [Historical evidence helpers](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/app.js#L3731-L3798), [progression engine](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/progression-engine.js).
- **S13:** [Runtime script order](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/index.html#L951-L968), [service worker](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/sw.js), [release assertions](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/test/exercise-library.mjs#L240-L275).
- **S14:** [Telemetry call-site guard](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/test/telemetry-call-sites.mjs).
- **S15:** [CI contract](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/docs/ci.md), [suite inventory](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/test/suites.mjs), [runner](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/tools/run-tests.mjs).
- **S16:** [PR #238](https://github.com/pedrochagasmaster/repforge/pull/238), selected diff `tools/test-selection.mjs`; [merged PR #236](https://github.com/pedrochagasmaster/repforge/pull/236), [merged PR #237](https://github.com/pedrochagasmaster/repforge/pull/237).
- **S17:** [ADR 0013](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/docs/adr/0013-temporary-install-transfer.md), [PR #235](https://github.com/pedrochagasmaster/repforge/pull/235), changed-file inventory and selected transport diff; [PR #228](https://github.com/pedrochagasmaster/repforge/pull/228), changed-file inventory and selected entry/recovery-policy diffs.
- **S18:** [Baseline CI run](https://github.com/pedrochagasmaster/repforge/actions/runs/34310771684), [state-job log](https://github.com/pedrochagasmaster/repforge/actions/runs/34310771684/job/102336801212), [source artifact provenance](https://github.com/pedrochagasmaster/repforge/actions/runs/34310771572).
- **S19:** [Plan 058](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/plans/058-design-system-convergence.md), [motion-polish stylesheet](https://github.com/pedrochagasmaster/repforge/blob/77c6a011e1bba5121ebd2ee15db85d77275c6ee5/motion-polish.css).
- **S20:** [Current main after PR228 and PR238](https://github.com/pedrochagasmaster/repforge/tree/e4a5e31c0fdc695beffbda02e4bcc3d6a0e81e6d), [current backlog](https://github.com/pedrochagasmaster/repforge/blob/e4a5e31c0fdc695beffbda02e4bcc3d6a0e81e6d/docs/backlog.md), [current plan index](https://github.com/pedrochagasmaster/repforge/blob/e4a5e31c0fdc695beffbda02e4bcc3d6a0e81e6d/plans/README.md), [Plan 052 transition contract](https://github.com/pedrochagasmaster/repforge/blob/e4a5e31c0fdc695beffbda02e4bcc3d6a0e81e6d/docs/block-transition-provenance.md), [current CI inventory](https://github.com/pedrochagasmaster/repforge/blob/e4a5e31c0fdc695beffbda02e4bcc3d6a0e81e6d/docs/ci.md), [overhaul steering sequence](https://github.com/pedrochagasmaster/repforge/blob/e4a5e31c0fdc695beffbda02e4bcc3d6a0e81e6d/docs/ui-overhaul-implementation-sequence.md), [Plan 053 status](https://github.com/pedrochagasmaster/repforge/blob/e4a5e31c0fdc695beffbda02e4bcc3d6a0e81e6d/plans/053-ios-install-transfer-foundation.md), and [ADR 0013](https://github.com/pedrochagasmaster/repforge/blob/e4a5e31c0fdc695beffbda02e4bcc3d6a0e81e6d/docs/adr/0013-temporary-install-transfer.md).
- **Method:** [Requested architecture skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md), [codebase-design vocabulary](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md), [deepening/testing guidance](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/DEEPENING.md), [visual-report format](https://github.com/mattpocock/skills/blob/main/skills/engineering/improve-codebase-architecture/HTML-REPORT.md). These informed the analysis; the recommendations are specific to the inspected Taurifer code.
