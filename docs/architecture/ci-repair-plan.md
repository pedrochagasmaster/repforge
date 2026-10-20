# PR #448: exact-head CI repair plan

## Scope and evidence boundary

- Repository: `pedrochagasmaster/repforge`; integration PR [#448](https://github.com/pedrochagasmaster/repforge/pull/448).
- Inspected source: `959c037b33d2623ff7a218f2f817bdae813112b7` only.
- [Ordinary CI 39153112814](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814): completed, failed.
- [Paired benchmark 39153112792](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112792): completed, failed at the same head.
- Prepared 18 October 2026 UTC from GitHub connector source reads, job logs and artifact inventory. No checkout, repository execution, remote modification, workflow rerun or deployment was performed for this document. Proposed commands below are acceptance work, not reported executions.
- This plan repairs retained validation consumers and investigates remaining production behavior. It does not authorize new incoming features, relax migration requirements, or authorize merge/deployment.

Read alongside the pinned [migration ledger](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/docs/architecture/migration-status.md) and [work sequence](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/docs/architecture/work-sequence.md). The ledger's current acceptance is **5/20**, with slices 1, 3, 4, 6 and 7 accepted. Older 1/20 paragraphs are historical checkpoints. CI cleanup must not silently close the remaining fifteen slices.

## Source diagnosis follow-up (18 October, 19:47 UTC)

Read the subsequent [offline upgrade diagnosis](offline-upgrade-diagnosis.md) and [DraftV2 recovery diagnosis](draft-recovery-diagnosis.md) before implementing Batches 3–4. The failure ledger below preserves the initial triage; these follow-ups narrow its previously unresolved causes.

- Both SW early timeouts are explained by test/protocol mismatches: the new workers deliberately neither skip waiting nor claim existing pages. The draft fixture must release its old controlled client before natural activation; the redirect fixture needs a navigation after readiness. Downstream assertions remain unexecuted, so this is not proof of repaired offline behavior.
- The draft-recovery trace preserves raw bytes and the newer-winner CAS. Its production banner drops the nested stale-program classification carried by `stale-recovery`, causing generic text and a hidden discard button. Repair the narrow presentation adapter; never enable discard for every recovery status.
- Correct artifact mapping: draft SW upgrade is `shard-10-1`, artifact `12145508417`; `shard-6-1` / `12145704699` contains redirect and draft-storage evidence.
- No runtime or test correction has been applied or executed by these documentation commits. Acceptance gates below remain open.

## Critical UI follow-up (18 October, 19:53 UTC)

The [six-cell diagnosis](critical-ui-diagnosis.md) traces five early failures to obsolete test setup/observation seams, including a recommendation observer that misses real native workers. The remaining failure is a production hub projection eagerly requesting nonexistent `entry.entry.title`; the inspected import frame does not visibly render that key. Minimal proposals preserve the full matrix and independent fixture outcomes. None has been applied or executed; all six cells remain open pending validation.

## Verified status

Architecture checking, configured TypeScript checking, native-source asset checking, test inventory checking and Plan073 verification passed before the fast tests. Fast contracts finished **111/113**. Service passed. Browser shards **1, 4, 6, 7, 11, 12 and 13 of 14** failed; the other seven passed. The aggregate `ci` job failed because selected jobs failed; its complete critical-UI validation step was skipped. This is not a green final-head risk suite.

The benchmark report rejects `before/2/14: every initial execution must have passed`, reports the same six incomplete critical UI cells, and produced no summary artifact. Do not derive a current speedup or acceptance claim from this pair. Both scopes must pass their initial executions before timing comparison is meaningful. Diagnostic replays do not replace failed initial executions.

### Failure ledger

| Contract | Observed failure | Classification and confidence |
| --- | --- | --- |
| `test/exercise-library.mjs` | 35 checks pass, 2 fail: native HTML entry and exact assembled runtime URL | **Proven obsolete selector.** Test expects `script[data-module][src="app.js?v=N"]`; actual HTML has `link[rel="taurifer-entry"][href="app.js?v=480"]` plus `src/bootstrap.js`, which creates the module script after the release gate. The second assertion depends on the missing `appEntry`. This does not by itself disprove release correctness. |
| `test/vendor-runtimes.mjs` | 104 checks pass, 2 fail: sheet cancellation and no-runtime fallback | **Proven obsolete source location.** Assertions scan `app.js` (and partly Shell) for `rec.motion.cancel()` and drag fallback. Actual sheet owner is `src/ui/shell/sheet-gestures.js`, which contains cancellation. Behavioral completeness still needs an executable oracle. |
| `test/program-transition-crash-replay.mjs` | Activation says generator/catalog unavailable in `window` | **Proven obsolete producer access.** Test still uses `window.RepForgeProgramCompiler` and `window.RepForgeExerciseCatalog`. Remaining body also uses other retired names; fix the whole consumer rather than just its first crash. |
| `test/per-side-engine-bodyweight-browser.mjs` | Undefined `.snapshot`, 0 passed / 1 failed | **Proven obsolete catalog access.** Setup calls `window.RepForgeExerciseCatalog.snapshot()`, followed by old compiler calls. No bodyweight/history correctness result was reached. |
| `test/sw-upgrade.mjs` | `updated shell includes program entry code` fails | **Proven obsolete readiness oracle.** Source checks `!!window.RepForgeProgramEntry`, including a later offline assertion. Replace with actual native Entry readiness/behavior while retaining upgrade and offline invariants. |
| `test/sw-error-responses.mjs` | Requires protected `app.js?v=N` script URL in index | **Proven obsolete HTML entry assumption.** Must cover the bootstrap and actual protected entry/release graph, not merely change a regex until green. |
| `test/shell-lifetime.mjs` | `idempotent gesture mount` | **Proven fixture-interface mismatch; not proven duplicate mounting.** The assertion combines same-controller identity with `fallback.mount` invocation count. Current Motion's typed fallback supports `navigate`/`cancel`; Motion directly registers listeners. There is no `fallback.mount` call to increment this counter. Later fallback disposal assertion is also stale. Preserve actual listener/disposal behavior. |
| `test/workout-draft-sw-upgrade.mjs` | 30s timeout waiting for current worker takeover and old-cache removal; installed waiting worker, active controller, caches `repforge-v186` and `repforge-v480` | **Observed lifecycle failure; cause unresolved.** Do not classify as generic flakiness or force activation without release-safety review. |
| `test/sw-launch-redirect.mjs` | 15s wait for `navigator.serviceWorker.controller` at line101 | **Observed controller-acquisition failure; cause unresolved.** Distinguish registration URL/scope, installation, redirected response, claim and navigation lifecycle. |
| `test/workout-draft-storage.mjs` | 80/81; recovery detail says “This unfinished workout needs recovery”, `discardVisible:false` | **Observed recovery-contract mismatch.** Source's stale-program assertion requires unchanged bytes, an “earlier program” title and explicit discard. Current detail contradicts title/action expectations; do not assume byte corruption or blame copy alone. Retrieve full output to separate the conjuncts. |
| `test/ui-system.mjs` | Six failed/incomplete critical cells | **Mixed failures.** Several fixture consumers visibly use retired globals; remaining readiness and translation failures need independent diagnosis. Details below. |

## Repair order and ownership

Keep one integration owner for shared helpers/composition/release files. Retained tests remain under the ledger's explicit root/auditor edit allocation; production feature owners should not independently weaken retained assertions. Make separate, reviewable commits for consumer migration versus actual behavior fixes.

### Batch 0 — preserve the evidence and pin the working revision

1. Record the exact start SHA/tree, clean status, toolchain and browser revision for the future executor. Refresh PR head first; if it moved, keep this failure ledger pinned and compare the delta before applying it.
2. Preserve initial logs and artifacts before their **25 October 2026** expiry. Relevant artifact inventory, verified unexpired at review:
   - `fast-1`: 12145998052.
   - replay `shard-0-1`: 12146340196.
   - critical UI `shard-3-1`: 12146286015.
   - SW/DraftV2 `shard-6-1`: 12145704699.
   - shell/error-response `shard-11-1`: 12145763551.
   - bodyweight `shard-12-1`: 12145932910.
3. Retain full initial output and separate diagnostic replay output, trace, screenshots and structured reports. This review inspected inventory and job-log excerpts, not ZIP contents; full DraftV2 and UI traces remain execution-owner inputs.
4. Treat the nine independent-oracle corrections (`7365489b`, `58ffa739`) as protected. Their six-owner packet passed on **817b9858346c1992f209af89921a4edc746b7a34**, not this head. Do not relabel that historical proof.

Exit: reproducible evidence map with exact SHA and no ambiguous claim that failures have already been fixed.

### Batch 1 — migrate proven stale consumers without restoring production globals

Affected paths:

- `test/program-transition-crash-replay.mjs`
- `test/per-side-engine-bodyweight-browser.mjs`
- `test/sw-upgrade.mjs`
- `test/sw-error-responses.mjs`
- `test/exercise-library.mjs`
- `test/training-browser.mjs` only if a narrowly missing public composition helper is genuinely required

Approach:

1. Reuse the existing test-owned `installBrowserTraining(page)` in `test/training-browser.mjs`. It imports the actual public generation/catalog/workout/authoring/metrics owners from the page's release-relative graph, loads the catalog and exposes test-owned composition. Do not reintroduce `RepForge*` production namespaces or duplicate compiler/persistence policy.
2. Migrate all retired accesses in each touched contract, including later transition/workout uses, not just the first exception. Keep the same production activation/commit paths and actual replica/lock fault injection.
3. Resolve the entry marker and bootstrap independently in the HTML/release tests. Verify `src/bootstrap.js`, the `taurifer-entry` href, deferred module loading, required manifest membership and exact byte hashes. Verify the assembled href rather than retaining the obsolete `src=` assumption.
4. For SW error responses, preserve the original network/error poisoning scenarios across the real bootstrap and entry dependencies. An HTTP-error asset must not become a valid immutable offline response.
5. For upgraded Entry readiness, drive or query the actual Entry owner/UI after native boot and repeat offline. Merely importing an Entry module proves code availability, not that the app correctly composed it.

Acceptance:

- Run each of these six retained contracts individually, then owning state/entry/workout scopes.
- Transition crash/replay must still reject incomplete and poisoned journals, preserve both replicas/revision/DraftV2/archives, clear only permitted artifacts and permit exact retry; valid ordinary inherited transitions replay once.
- Bodyweight/per-side must retain fixed source exercise/metric identities, captured session context and literal expected history/progression values.
- Native entry/release tests must fail if the marker, required dependency, release URL or source hash is deliberately corrupted. Keep corruption expectations independently authored.
- Old production globals remain absent; runtime-isolation contract remains green.

### Batch 2 — make gesture lifetime proof observe the current owner

Affected paths: `test/vendor-runtimes.mjs`, `test/shell-lifetime.mjs`; inspect `src/platform/motion.js`, `src/ui/shell.js`, `src/ui/shell/sheet-gestures.js`. Change production only if retained behavior is actually broken.

1. Move the sheet source inventory to the actual owner. Keep source-location assertions small; do not make a newly copied source body its own expected oracle.
2. Replace `fallback.mount`/returned-fallback-disposer counts with direct observations of actual event registration and effects. Prove two mounts return one live controller, one pointer/keyboard event invokes one handler, dispose unregisters handlers and cancels active work, repeated disposal is safe, and remount establishes exactly one new lifetime.
3. Exercise no-runtime navigation, pointercancel, Escape, mid-animation sheet teardown and interrupted/reversed movement. Verify transforms and scheduled work cannot repaint a disposed sheet.
4. Keep reduced-motion and actual vendor-runtime paths alongside fallback coverage; avoid testing only a hand-written fake Motion implementation.

Acceptance: shell-lifetime and vendor-runtimes pass; focused real sheet/Focus/editor lifetime contracts pass. A mutation that skips listener removal or cancellation must fail. Do not restore removed callback APIs solely to satisfy old counters.

### Batch 3 — diagnose and repair service-worker upgrade/redirect lifecycle

Priority is high because this affects old installed clients and offline safety. It may be investigated in parallel with Batches 1–2, but acceptance depends on repaired, behavior-level release tests.

Affected paths: `test/workout-draft-sw-upgrade.mjs`, `test/sw-launch-redirect.mjs`, `test/browser.mjs` worker-wait helper, `src/bootstrap.js`, `src/release/gate.js`, `sw.js`, `scripts/release-worker.mjs`, `scripts/release-assembly.mjs`.

Evidence: `startRelease` refuses a historical controller lacking the release handshake; bootstrap owns registration and loads the writer graph only through that gate. An absent controller is explicitly a network-only first visit. These protections are intentional and must survive repair.

Required investigation:

1. Capture registration script URL/scope, worker state transitions, release-query/reply, controllerchange, cache keys and all live controlled pages during the old-to-current upgrade. Determine whether the test is waiting for a lifecycle the approved release protocol deliberately defers until all old clients close.
2. For redirected-host startup, capture requested/final document URLs, `document.baseURI`, registration URL/scope, install failures and controller lifecycle. Compare raw-source and assembled deployment at root and a non-root scope.
3. If the fixture assumes the obsolete immediate-takeover protocol, rewrite its user-visible close/reopen/update flow while preserving real old cache/draft inputs. If runtime registration/claim/cache handling is wrong, fix the actual owner and add a failing-first regression.
4. Never add unconditional `skipWaiting`, bypass release handshakes, remove old-cache checks, lengthen waits blindly or enable a new writer under an incompatible historical controller to obtain green CI.

Acceptance: both failing contracts pass; source and assembled release upgrade/rollback tests pass online and offline; current release controls after the specified lifecycle, required assets are cached, incompatible writers stay blocked, and saved DraftV2/raw state remains intact. Repeat multi-tab old/new-release cases and optional-resource failure. Preserve historical release fixtures rather than regenerating them from the successor.

### Batch 4 — isolate DraftV2 stale-program recovery regression

Affected paths: `test/workout-draft-storage.mjs`; actual recovery owners `src/app/storage-recovery.js`, `src/ui/storage-recovery.js`, plus the current DraftV2/workout and durable command owners reached by that scenario.

1. Extract full initial failure details from `shard-6-1`. The source seeds acknowledged lifter input, changes program identity/content/revision, reloads, then jointly checks exact raw bytes, stale-program classification and explicit discard. Record each result separately without weakening any assertion.
2. Trace classification and projected action eligibility from actual persisted draft/program to the recovery view. Verify whether the generic title/no-discard state is a legitimate refusal or a lost stale-program reason/action during extraction.
3. Repair the responsible policy/view/fixture boundary after reproducing it. Do not alter the fixture to an easier malformed state or normalize away the raw-byte mismatch if one exists.
4. Keep the competing-winner confirmation race: discard uses the displayed draft identity and cannot delete a newer winner. Keep pristine stale-draft replacement distinct from acknowledged-work recovery.

Acceptance: **all 81 retained storage checks** pass in one execution, with raw-byte preservation, newer-winner refusal, export, CAS and replica/checkpoint invariants unchanged. Run adjacent adversarial/staged-CAS/recovery contracts. Add a negative control that drops the stale classification or exposes an unsafe discard and verify the proper assertion fails.

### Batch 5 — repair every critical UI cell, preserving the matrix

Primary paths: `tools/ui-screens/screens-app.mjs`, `tools/ui-screens/screens-onboarding.mjs`, `tools/ui-screens/session.mjs`, `tools/ui-screens/catalog-contract.mjs`, `test/ui-system.mjs`, `test/language-browser.mjs`, native Entry/Focus/Progress owners only where runtime defects are established.

| Required cell | Evidence and next step |
| --- | --- |
| `workout/focus-per-side__phone-390-dark-en` | 15s timeout. Screens-app contains waits for removed catalog globals and old compiler/adapter accesses. Migrate fixture setup through actual public composition, then verify the production Focus result. |
| `progress/exercise-chart__phone-390-light-pt-text200` | 15s timeout. Inspect fixture's old catalog/metrics inputs and actual chart readiness separately. Keep Portuguese and 200% text conditions. |
| `program/custom-exercise-recovery__phone-390-dark-en` | Undefined `.storageIO`; screens-app directly reads `window.RepForgeDurableState.storageIO`. Replace with a test-owned fixture at the actual durable boundary or browser storage fault injection, without a production global facade. |
| `onboarding-recommend/result__phone-390-light-pt-text200` | Offer verification waits 40s; result step exists but engineCount 0/jobs []. Screens-onboarding intercepts `window.RepForgeProgramEngine`. Investigate that obsolete observation seam first; then prove the real foreground result and identity rather than accepting empty jobs. |
| `onboarding-import/review__phone-390-dark-en` | Missing requested translation key `entry.entry.title` at `language.t()`. Trace caller/key namespace and real language map. Do not suppress missing-key validation or accept the key string as UI text. Runtime versus capture instrumentation cause remains open. |
| `onboarding-shared/gate__phone-390-light-pt` | 20s timeout. Trace actual shared-route readiness, seed and remaining Entry/global accesses. Do not reduce to a boot-only screenshot. |

Acceptance: all six cells complete with semantic/contrast/layout assertions under their exact locale/theme/viewport/text-size conditions, then the **entire existing critical matrix** passes in one initial execution. Keep cell IDs, completeness aggregation and failure evidence. No dropped cells, screenshot blanket rebaselining, changed thresholds or diagnostic-replay promotion. Mutate one required fixture input/semantic outcome to prove the repaired path remains discriminating.

### Batch 6 — integrated independent proof and final-head gates

Only start final claims after coherent repair commits are integrated. Record final SHA/tree and preserve it throughout each command.

1. Re-run architecture/type/native asset/inventory checks; retain the existing strict graph, public dependency boundaries and negative controls.
2. Re-run all six protected oracle owners together on the repaired head: historical Entry inputs, compiler feasible/search cases, generative inventory self-test, all 27 generative properties at 300 runs, real browser credential persistence, and complete service gate. The ledger's 817b9858 pass is provenance, not a waiver. Preserve literal fixtures, external expected values, historical raw inputs and targeted mutation controls.
3. Run complete fast, service and all 14 browser shards, including the full critical UI report. Use the repository runner and pinned dependencies/browser; system-Chromium behavior evidence does not certify pinned visual or physical-device results.
4. Repeat assembled/offline upgrade and rollback, independent architecture and data review, and representative agent-navigation/change walkthroughs required by slices 19–20.
5. If retaining the benchmark deliverable, run both complete scopes with all initial executions passing and complete artifacts before publishing the summarized timing. Record toolchain, SHA and measured scope; do not compare only successful remnants.
6. Update `docs/architecture/migration-status.md` with exact commands, outputs, review evidence and unresolved items. Close only slices whose objective gates are actually fulfilled. Keep `work-sequence.md` consistent with the continuing incoming-feature/phone/launch boundaries.

## Non-negotiable oracle preservation

- No current producer used to regenerate its own expected result. Preserve immutable 233-result corpus, historical fixtures, literal identities/hashes, independent summary values and invalid-consumer assertions.
- No reducing 27 properties/300 runs, weakening timeout/error checks, shrinking the critical matrix, accepting skipped contracts or converting failed initial runs into passes via retries.
- No production compatibility namespace to placate a test. Test-owned composition must import public native producers from the actual release graph and still exercise the integrated app for behavioral assertions.
- Protect lock-held checkpoint preflight/promotion, raw recovery export, journal coherence, credential persistence/redaction and real service privacy/lifetime checks.
- Keep historical release fixtures and decoders. Removing temporary execution architecture is distinct from deleting backwards-compatible data readers.
- Current work does not adopt #443/#383/#437/#442/#435 wholesale, mount Lab in production, change service deployment/credentials/network policy, or authorize merging any PR.

## Source and log references

- [Fast job](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814/job/117750976263)
- [Crash replay](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814/job/117750976371)
- [Critical UI](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814/job/117750976502)
- [Entry SW upgrade](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814/job/117750976414)
- [Redirect and DraftV2 storage](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814/job/117750976436)
- [DraftV2 SW upgrade](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814/job/117750976390)
- [Shell lifetime and SW errors](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814/job/117750976519)
- [Bodyweight](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814/job/117750976593)
- [Benchmark report](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112792/job/117757086639)
- [Test-owned native training composition](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/test/training-browser.mjs)
- [Native bootstrap](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/bootstrap.js), [release gate](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/release/gate.js), [Motion](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/platform/motion.js), [sheet gesture owner](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/ui/shell/sheet-gestures.js)

## Completion checklist

- [ ] All 11 failed contracts reproduced and repaired or independently explained with equivalent preserved coverage.
- [ ] Every repair has affected-owner acceptance and an independent negative control where relevant.
- [ ] Historical six-owner packet rerun on the repaired head.
- [ ] Full initial ordinary CI and complete critical UI matrix pass on the recorded final head.
- [ ] Benchmark both scopes pass before any new performance claim.
- [ ] Final release/offline/rollback and architecture/data review gates recorded.
- [ ] Acceptance ledger updated accurately; owner review precedes merge/deployment.
