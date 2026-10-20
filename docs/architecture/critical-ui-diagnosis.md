# PR #448: six critical UI failures, source-and-artifact diagnosis

## Evidence boundary

Repository: `pedrochagasmaster/repforge`. Runtime and test source pinned to `959c037b33d2623ff7a218f2f817bdae813112b7`. Read `docs/architecture/ci-repair-plan.md` at documentation revision `00d35d3188c288535941684026fd79d8a7dfd1fb`. Prepared 18 October 2026 UTC.

- [Initial CI run](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814), [browser job 117750976502](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814/job/117750976502).
- [Artifact shard-3-1 / 12146286015](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814/artifacts/12146286015), downloaded and ZIP-inspected. SHA-256: `2c1e18eaf0606e3c2408ec6daf1e6f07900296dd47b97a5b5afc584a39699cff`, matching the upload log.
- Initial `workout/test-ui-system-mjs/initial/ui-critical-report.json` and `output.log` confirm 21 required cells: 15 passed, 6 failed. Diagnostic replay remains separately failed; it cannot replace the initial result.
- Diagnostic traces inspected at `diagnostic/browser-1/context-{5,12,15,16,17,18}/trace.zip`, respectively Focus, chart, custom recovery, recommendation, import, shared gate. Context numbering includes the preliminary browser context; it is not the cell ordinal.
- Source reads, archive parsing and document preparation only. No repository execution, browser session, implementation, workflow rerun, push, merge or deployment was performed. Every proposed fix and acceptance test below remains unexecuted.

## Bottom line

Five cells stop at obsolete test consumers, before their retained behavioral/layout assertions complete. Focus and chart share one broken fixture. The import cell exposes an actual production translation request defect, although its failing key is not visibly rendered in the inspected frame. There is no evidence here that chart rendering, Focus progression, shared-link decoding, or custom recovery itself caused those five early failures. Conversely, repairing their setup does not prove those behaviors pass.

The recommendation result is not absent: its state is already `step:result`, `route:recommend`, with a fingerprint. The fixture observes zero engines because it watches a global the native application never calls. Its diagnostic network trace contains two successful loads of `/src/platform/program-worker.js`; zero observed jobs is not proof that no generation work occurred.

## 1. Focus and exercise chart: same stale fixture, not two runtime timeouts

Cells:
- `workout/focus-per-side__phone-390-dark-en`
- `progress/exercise-chart__phone-390-light-pt-text200`

**Confidence: proven immediate cause; downstream behavior untested.** Both initial failures name `installPerSideHistory`, `screens-app.mjs:709`, with the same 15-second wait. Both diagnostic traces preserve this exact predicate:

```js
!!window.RepForgeExerciseCatalog?.snapshot?.() &&
typeof window.__repforgeFinalizeProgramSetup === 'function'
```

[Fixture, lines 708–801](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/tools/ui-screens/screens-app.mjs#L708-L801) then consumes `RepForgeProgramEntryAdapter`, `RepForgeProgramCompiler`, and, on validation failure, `RepForgeExerciseMetrics`, `RepForgeExerciseCatalog`, `RepForgeWorkoutDraft`. Changing only the wait would expose the next undefined access.

[Production composition, app.js:110–122](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/app.js#L110-L122) owns these as native lexical values, created from generation/catalog/workout/authoring modules. The narrow activation and state-validation hooks used by the fixture still exist (`app.js:3544`, `3739`). Preserve their real activation and validation paths.

**Minimal repair:** import and await existing [installBrowserTraining](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/test/training-browser.mjs#L1-L24), which composes public owners in the document's release-relative graph. Replace the fixture's global reads throughout:

```js
await installBrowserTraining(page);
await page.waitForFunction(() =>
  typeof window.__repforgeFinalizeProgramSetup === 'function');
// Inside the existing page.evaluate:
const {catalog, compiler, entryAdapter, metrics, workout} = window.__repforgeTrainingTest;
// entryAdapter.programRequestFromAnswers(..., catalog)
// compiler.generateProgram(..., catalog)
// metrics.validateDefinitions / validateMetricValues / validateExerciseSourceBinding
// workout.validateLoadingContext
```

Do not generate fixture history from the progression output being asserted. Retain the independently authored rows: unilateral 20 kg / 8 reps-per-side, bilateral 25 then 27.5 kg-per-side / 8 reps-per-side; seven-days-ago and one-day-ago sessions; bodyweight 80 only for the Focus variant; multiplier 2 and captured loading context there. Preserve fixed source IDs `1a55c6f170d88031b658c6e278a82a88`, `1a05c6f170d8803ba48ec1443eab5978`, and load metric `25a5c6f170d880e2990fc88146f7de56`.

**Failing-first acceptance:** keep existing checks in [Focus lines 1423–1464](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/tools/ui-screens/screens-app.mjs#L1423-L1464), including actual target prefill, per-side label and loading assumptions. Keep chart navigation, e1RM selection, font-size-aware route framing and settled geometry in [lines 1893–1935](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/tools/ui-screens/screens-app.mjs#L1893-L1935). First demonstrate the old helper fails, then both cells pass with globals still absent. Mutate a fixture metric/source binding or captured loading context and require validation/semantic failure. Do not remove Portuguese or 200% text or substitute an easier bilateral fixture.

## 2. Custom exercise recovery: fault injection never reaches the real storage boundary

Cell: `program/custom-exercise-recovery__phone-390-dark-en`.

**Confidence: proven immediate cause; proposed fault-seam equivalence needs execution.** [screens-app.mjs:2279–2302](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/tools/ui-screens/screens-app.mjs#L2279-L2302) creates an in-use custom exercise, then reads `window.RepForgeDurableState.storageIO`. The access throws before clicking Delete/Archive. The intended fixture rejects the first two `writeIdb` calls, then delegates normally.

Production creates its durable owner privately with `platform:window`, then assigns lexical `storageIO` in [app.js:7886–7892](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/app.js#L7886-L7892). [durable.js:734–740 and 1037–1043](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/persistence/durable.js#L734-L740) maps that write to a real `repforge` / `kv` / `repforge_v1` IndexedDB put and converts failure to `false`. The UI [delete and recovery flow](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/ui/library/controller.js#L514-L538) performs one automatic recovery attempt, then exposes unresolved recovery and Retry. It is essential to exercise those real commands rather than paint a recovery state.

**Minimal repair:** a test-owned, explicitly armed browser-platform fault helper, installed after creating the exercise and flushing outstanding writes, can intercept only that main-snapshot put. Retain real local writes, journals, reads and all unrelated stores/keys. Example shape, not an applied patch:

```js
const original = IDBObjectStore.prototype.put;
let failures = 0;
IDBObjectStore.prototype.put = function(value, key) {
  if (this.transaction.db.name === 'repforge' && this.name === 'kv' &&
      key === 'repforge_v1' && failures < 2) {
    failures++;
    throw new DOMException('Fixture snapshot write failure', 'UnknownError');
  }
  return Reflect.apply(original, this, [value, key]);
};
```

The implemented helper should preserve all argument signatures with `...args`, expose its counters/restorer only under a test-owned name, and restore in `finally`. Assert exactly two matching faults and inspect receipts/replicas to prove this reaches the original intended partial-write state. Synchronous put failure is converted to `false` by the production catch; the browser run must verify there is no additional lifecycle difference. Do not globally fail IndexedDB open, which would also prevent prerequisite reads and change the scenario. Do not add a production DurableState global or construct a second unrelated durable store and call that instead of the app's commands.

**Failing-first acceptance:** preserve real in-use exercise, Archive click, visible recovery status and Retry; after capture, retry successfully with fault exhausted and prove one archive, preserved program references/history, no duplicate mutation and settled replicas/journal. A negative control removing both faults must fail the recovery-state assertion; a permanently failing write must never falsely report success. Adjacent saving/deleting/archiving capture states use the same obsolete seam and should migrate through the same helper without dropping their pending-state expectations.

## 3. Recommendation: observe the native worker transport, preserve offer verification

Cell: `onboarding-recommend/result__phone-390-light-pt-text200`.

**Confidence: proven obsolete observer; not proof that all offers are correct.** Initial evidence reports a real result and fingerprint, with `engineCount:0`, `jobs:[]`. [screens-onboarding.mjs:141–395](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/tools/ui-screens/screens-onboarding.mjs#L141-L395) intercepts `window.RepForgeProgramEngine.create`; the application instead imports native `create` from `src/platform/program-executor.js` and calls it at [app.js:852–856](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/app.js#L852-L856). Foreground generation and post-result verification use separate instances; [app.js:5119–5140](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/app.js#L5119-L5140) creates/disposes the verifier. The old observer also uses retired `RepForgeGenerationIdentity.digestCanonical` twice, another latent failure after fixing engine interception.

**Minimal test-owned repair:** observe the actual `window.Worker` capability supplied to the native executor. Install before route selection/first generation (or before navigation), retain native behavior with a subclass/wrapper, scope to the verified release-relative `src/platform/program-worker.js`, assign a stable worker identity, record outgoing `generate` requests, and pair incoming replies by `(worker identity, message.id)`. Use an independent `addEventListener('message', ...)`; do not replace the executor's `onmessage`. Preserve request forwarding, init, errors and terminate; never synthesize or modify replies.

The protocol is explicit in [program-executor.js:86–114](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/platform/program-executor.js#L86-L114) and [program-worker.js](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/platform/program-worker.js): outbound `{type:'generate', request, generationOptions?, id}`, inbound `{id, ok:true, value}` or `{id, ok:false, message}`. Transport `ok:true` is not generation success: inspect `message.value.ok`. Import the actual public generation identity through `installBrowserTraining` for the request digest; do not duplicate canonicalization.

Carry over the existing independent proof: current draft identity, foreground request/result, separately paired verifier requests for each offered prerequisite confirmation, accepted exercise at the same slot, live eligibility after review edits, visible slot subset, duplicate-exercise exclusion, confirmed-row exclusion, and rendered pairs equal verified eligible pairs. A populated result alone is insufficient. Require the foreground result definition to match the current preview/fingerprint identity so a stale successful worker response cannot certify a newer result.

**Important limit:** Worker observation does not observe main-thread fallback. This browser fixture should explicitly require actual worker success and fail closed if transport is unavailable; do not reinterpret zero jobs as an empty valid offer set. Keep/add separate public executor fallback contract coverage using injected compiler/catalog/WorkerConstructor. A universal observer would require a deliberately reviewed native composition seam; it is not solved by importing and monkeypatching an immutable ESM namespace or creating a spare executor.

**Failing-first acceptance:** old observer fails while actual result exists; repaired observer sees the real foreground and any required verifier jobs under Portuguese/200% text, with expected/rendered pair equality. Hold, reject or mismatch one verifier reply and require settlement/equality failure; an old-draft response must not make the current frame ready. Preserve the actual runtime worker and fallback tests, no services override that disables post-result verification.

## 4. Import: eager resume-label construction requests nonexistent entry.entry.title

Cell: `onboarding-import/review__phone-390-dark-en`.

**Confidence: proven production request defect; no visible untranslated heading established.** Fresh setup is `step:'entry'` ([authoring/internal/entry.js:1798–1804](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/training/authoring/internal/entry.js#L1798-L1804)). `startOnboarding` renders the hub; [app.js:4785–4789](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/app.js#L4785-L4789) eagerly constructs `resume.stepLabel` as `t('entry.' + candidate.step + '.title')`, even when `notice !== 'resume'`. That asks for `entry.entry.title`. The real keys are `entry.hub.title` and `entry.import_source.title`; neither English nor Portuguese dictionary defines `entry.entry.title`.

The hub view only uses `model.resume` when resuming ([view.js:185–188](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/ui/entry/view.js#L185-L188)). Meanwhile [createI18n.t](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/platform/i18n.js#L34-L46) correctly records missing keys. The collector consumes those requests later, at the import-review frame, making this appear to originate in import rendering. Diagnostic context 17 confirms `requestedI18nKeys` contains `{locator:'language.t()',key:'entry.entry.title'}`, while visible text contains no such raw key and `overflow` is empty. The visible review says “Review the exercises,” with three imported lifts and actual linked/custom review controls. Do not claim the import heading itself is broken.

**Minimal production repair:** compute resume labels only for an actual resume notice and map the hub sentinel explicitly if it is a legitimate resumable state. For example:

```js
const resuming = notice === 'resume';
const stepKey = candidate?.step === 'entry' ? 'entry.hub.title'
  : candidate?.step ? `entry.${candidate.step}.title` : null;
// In the existing view model:
stepLabel: resuming && stepKey ? t(stepKey) : ''
```

Likewise avoid needless route-label computation outside resume if convenient, but do not suppress missing-key recording or add a meaningless duplicate key solely to satisfy this request. Audit resumable step labels, including editor/other non-question states, against existing translations rather than assuming every state has `entry.<step>.title`. The main `renderOnboarding` title already handles the hub via `entry.hub.title` (`app.js:6698–6710`); reuse that semantic distinction.

**Failing-first acceptance:** clear the missing-request recorder once before starting a fresh hub flow, drive first-run → Import → actual review, then assert no missing requests in both languages. Also open/cancel/reopen hub and resume a genuine saved draft; assert its meaningful route/step label and no missing keys. Keep the independent import source, duplicate bench rows, unknown “Zerbulator 9000,” folded linked rows and open unresolved row. Mutating the title mapping back to `entry.entry.title` must fail even if the erroneous request is never visibly painted. This hub defect may also become visible to the recommendation capture contract once its earlier observer timeout is repaired.

## 5. Shared gate: codec composition succeeds, stale training wait blocks encoding

Cell: `onboarding-shared/gate__phone-390-light-pt`.

**Confidence: proven immediate cause; shared route not reached.** [setup-link-v4.mjs:14–17](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/test/fixtures/setup-link-v4.mjs#L14-L17) first awaits the already-native `ensureBrowserInterchange(page)`, then requires removed `RepForgeExerciseCatalog` and `RepForgeProgramCompiler`. The diagnostic trace stops on this exact predicate before `sharedTo` navigates to `index.html#setup=...`. This is not a gate-readiness or decoding timeout.

**Minimal repair:** await `installBrowserTraining(page)` alongside the interchange helper, then use its `catalog`, `compiler`, `entryAdapter` everywhere in this shared fixture: `waitForCodec`, `encodeSetupLink`, `encodeSetupPayload`, `decodeSetupLink`. Keep `window.__repforgeInterchangeTest.setup`, its real native codec, v4 kind/version, settings, builtin-ID set, catalog snapshot, generator version, validator and generator options. Keep full-definition/custom payload behavior intact. Each helper is document-owned and must be installed again after navigation if called in the new page; do not cache JS handles across documents.

**Failing-first acceptance:** same generated Portuguese coach payload produces v4 bytes, actual hash navigation occurs, real `#firstRunSharedStart` appears, requested language survives and no active program is committed before acceptance. Retain gate-to-preview and explicit activation tests in the owning setup-link suites; negative control with invalid bytes must take the real shared-invalid path. Do not replace the codec with a hard-coded success payload or take a screenshot of an ordinary first-run page.

## Implementation sequence and final acceptance

1. One fixture-consumer commit: complete training-helper migrations in per-side history and all setup-link-v4 entry points. Keep source fixtures and expected observations independent.
2. One test-instrumentation commit: scoped platform storage fault helper and native Worker observation. Include discriminating controls and explicit worker/fallback limits; migrate sibling captures sharing those exact seams.
3. Separate production presentation fix: lazy/valid hub resume title projection, with missing-key regression coverage. No policy or translation-validator relaxation.
4. Run each affected scenario and owning retained contracts first, then `node tools/run-tests.mjs workout --suite-id test-ui-system-mjs` at one recorded implementation SHA. Require all 21 existing cells in one initial execution, followed by the plan's full final-head gates. No removed cells, changed locales/themes/viewports/text200, widened tolerance, blanket baseline refresh or replay promotion.

No finding here changes the architecture ledger's 5/20 acceptance, proves full UI correctness, or authorizes merge/deploy. All six initial failures remain open until the repairs run successfully against the final implementation head.
