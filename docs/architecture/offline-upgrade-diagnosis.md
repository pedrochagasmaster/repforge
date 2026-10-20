# PR #448: offline upgrade and redirected-launch diagnosis

## Result and evidence boundary

Both reported stalls are explained by retained tests expecting the retired immediate-takeover lifecycle. The current source and assembled workers deliberately do not call `skipWaiting()` or `clients.claim()`. The draft test keeps the historical controlled page alive while waiting for its successor to activate; the redirect test waits for control on the initial uncontrolled document without navigating again after installation. These are concrete test/protocol mismatches, not evidence that release safety should be relaxed.

This is a source-and-existing-log diagnosis, prepared 18 October 2026 UTC. Runtime source is pinned to `959c037b33d2623ff7a218f2f817bdae813112b7`; the starting repair plan was read at documentation commit `b63a4c09716b566ff13f3c24deeb6ae869d8034c`. No repository checkout, test, browser, build, workflow rerun, runtime edit, push or deployment was performed. Proposed corrections below are unexecuted. They explain the observed early failures; they do not establish that the previously unreachable migration, offline save or transfer assertions pass.

Existing exact-head CI failures provide the observed failing evidence. Execution of the proposed corrections is deferred; the implementation owner must reproduce and validate them before acceptance.

## 1. Existing failure evidence

Run: [ordinary CI 39153112814](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814), source SHA above.

### Draft upgrade

[Job 117750976390, browser (11/14)](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814/job/117750976390) reports:

- Historical app opens, seeds its program, reloads under its historical controller, and writes the flat draft successfully.
- At +1666 ms: update to current worker. At +1676 ms: begin waiting for current control and old-cache removal.
- At +31679 ms: 30-second stage timeout. Document is complete and historical app is booted. Controller and active worker are activated `/sw.js`; successor is installed and waiting; no installing worker remains.
- Caches are `repforge-v186` and `repforge-v480`. Web Locks show no held or pending locks. Targets contain two service workers and the still-open page at `/`.
- Diagnostic replay also fails; it does not change the original verdict.

Artifact correction to the starting plan: this failure belongs to `shard-10-1`, artifact **12145508417**, not `shard-6-1`. [Artifact link](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814/artifacts/12145508417). `shard-6-1` contains the redirect and draft-storage failures. These are artifact inventory/log references; ZIP contents were not inspected here.

### Redirected launch

[Job 117750976436, browser (7/14)](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814/job/117750976436) reports a 15-second timeout at `test/sw-launch-redirect.mjs:101`, the first controller predicate. `navigator.serviceWorker.ready` on the preceding line necessarily resolved for this failure to be reached. Initial execution took 17.18 seconds; replay failed too. No later redirected-navigation assertion was reached.

## 2. Actual startup and worker lifecycle

Sources, all at the pinned runtime SHA:

- [bootstrap](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/bootstrap.js)
- [release gate](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/release/gate.js)
- [raw source worker](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/sw.js)
- [assembled worker generator](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/scripts/release-worker.mjs)
- [release assembler](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/scripts/release-assembly.mjs)
- [governing release activation policy](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/docs/architecture/agent-first-spec.md)

1. HTML identifies its release and marks the application entry with `link[rel="taurifer-entry"]`. Bootstrap imports the gate and optional-script loader, not the application writer graph.
2. Bootstrap starts registration at `new URL('./sw.js', document.baseURI)`. Registration rejection is caught and becomes `null`; registration success is not awaited before the release gate.
3. `startRelease` samples the existing controller. No controller means a permitted network-only first visit. A controller must answer `taurifer-release-query` through a transferred MessagePort with the matching release ID. A nonreply within 1500 ms, wrong ID or throwing controller refuses the writer graph.
4. Only an accepted gate invokes `load()`: optional vendor/config loads, then creation of the application module script from the entry href. Rejected control presents update recovery and preserves data. The retry updates registration and reloads; it does not force activation. Recovery explicitly tells the person to close all app tabs and reopen.
5. Raw worker `source-480` installs the source asset inventory in `repforge-v480`, requiring successful responses and valid code MIME. Required failure removes that partial cache. Its activation removes old RepForge release caches, preserving unrelated caches. Neither install nor activate takes control away from an existing client.
6. Assembled output mirrors native paths under `releases/<id>/`, rewrites HTML resource attributes and its release meta, leaves the web manifest at scope root, fingerprints required/optional bytes, and generates a distinct release worker. Registration still resolves from the document base, not from the nested bootstrap module URL.
7. The assembled worker verifies required hashes/MIME, allows only its constrained index-to-directory redirect, waits naturally, and retires prior release caches on activation. Installed fetches serve its exact cached graph and fail closed rather than fetching a different version. This is stronger than the raw development worker's network-first source behavior; do not claim the raw fixture alone proves immutable assembled release coherence.

Natural activation and document control are separate milestones. An initial install can become active while its already-loaded page remains uncontrolled. An update can finish installation and remain waiting as long as an old controlled client lives. A subsequent eligible navigation obtains the active controller; installing alone does not do so without claim.

## 3. Draft upgrade: causal chain and correction

[Retained test](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/test/workout-draft-sw-upgrade.mjs) serves the complete historical release from commit `3fbae92fcee58c0d72539b9f4e2c270a9d60dbd4`, including that release's seed fixture and matching HTML. Its [historical v186 worker](https://github.com/pedrochagasmaster/repforge/blob/3fbae92fcee58c0d72539b9f4e2c270a9d60dbd4/sw.js) calls skipWaiting after precache and claims on activation. This explains why the early historical takeover succeeds.

The test then switches the server to current source, calls registration.update(), and immediately calls `waitForWorkerTakeover` while the same historical workout page remains open. [The helper](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/test/browser.mjs) requires activated registration, no waiting/installing worker, controller equal to active, current cache present and predecessor cache absent. Its predicate is appropriate after reopening, but impossible at this point under the intended policy. The observed waiting successor and both caches are the expected safe intermediate state.

The missing transition is already represented elsewhere: [activateReplacementAfterClientLeaves](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/test/fixtures/v120-assets.mjs) waits for an installed successor, asserts old control/cache retention, navigates the old client to about:blank, and observes natural activation from the replacement worker. `test/sw-upgrade.mjs` and `test/program-transition-sw-upgrade.mjs` already call it. The latter passed in this same CI job before the draft failure. That supports reuse of the protocol, not a claim that the draft scenario itself has passed.

### Minimal proposed algorithm

Change only the test lifecycle first; no production change is justified by this failure.

1. Preserve `OLD_SHA`, old full shell, actual historical UI writes, raw draft/state capture, and every post-upgrade data/offline assertion.
2. Before triggering update, arm observation for the successor worker. Trigger update once, wait for `registration.waiting.state === 'installed'`, and retain that specific successor handle. Do not identify generations by script URL: both are `/sw.js`.
3. Assert the old page is still controlled by the old active worker, both cache names exist, and captured legacy draft/durable bytes remain exact. Record scope, script URLs, state transitions and release replies.
4. Release every old controlled app client. For the single-page fixture, close that page and keep the browser context alive, or use the established about:blank transition. Never close/recreate the storage context or unregister/delete caches. If using close, assign the new page to the diagnostic `page` variable before resuming.
5. From the retained successor Worker handle, wait with the existing bounded async helper until its registration is active/activated, no waiting/installing successor remains, the current cache exists and old cache is absent. Preserve the identity check against the captured replacement. Do not repeatedly navigate inside scope to try to release the old worker.
6. Open/navigate the page to `base`, then run the existing strict `waitForWorkerTakeover` and app-boot checks. Continue migration and offline journey unchanged.

The shared helper should live in a lifecycle-neutral test module if extracted for reuse. Directly importing `v120-assets.mjs` also executes its unrelated v120 fixture reads/hash assertions; avoid coupling the v186 draft test to those assets merely to reuse one function. Alternatively implement the short lifecycle locally first. Preserve bounded stage names and diagnostic output. An event-only waiter must handle an already-discovered successor; arm before update and inspect registration rather than accepting the first same-URL worker blindly.

## 4. Redirect launch: causal chain and minimal diff

[Test](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/test/sw-launch-redirect.mjs) starts a new browser context, visits the root, awaits serviceWorker.ready, then waits for controller on that same document. The worker no longer claims. The test has never made the installed-client navigation whose redirect behavior it intends to measure.

[Redirect host](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/test/redirect-host.mjs) redirects only `/index.html` to `/` with 308 and preserves the query. The first visit is already `/`; there is no first-document redirect to explain a registration-base mismatch. Bootstrap therefore resolves registration to origin `/sw.js`, default scope `/`. `ready` resolving further contradicts install rejection as the cause of this exact timeout. Logs do not contain a complete registration snapshot, so preserve that distinction from direct recorded runtime proof.

Minimal candidate change immediately after `await page.evaluate(() => navigator.serviceWorker.ready);`:

```js
await page.reload({ waitUntil: 'domcontentloaded' });
// Keep the existing controller assertion and all later cache/launch checks.
```

Strengthen the surrounding test with app boot, registration scope/script and release-handshake assertions after reload; do not replace the controller predicate with only `ready`. Keep the first visit/network-only behavior as its own observation. The fresh context gives this reload a first-install case, not an update-with-old-tabs case.

Keep all subsequent checks: no redirected/opaqueredirect responses stored in precache; manifest launch, legacy index and query navigation online; offline launch/root; scope membership; manifest identity policy; transfer cookie privacy and actual setup receipt. For controlled launch responses, retain or add `response.fromServiceWorker()` so a network bypass cannot masquerade as successful installed navigation.

The raw worker still normalizes followed redirect responses before cache insertion and returns an opaque navigation redirect to the browser to follow; offline fallback normalizes a cached response again. The generated worker uses integrity-checked cached HTML and strips the redirect flag only after checking its exact allowed target. Nothing in this early timeout establishes a defect in either redirect-response implementation, and neither should be changed speculatively.

## 5. Facts, remaining hypotheses and discriminating evidence

- **Proven from source and logs:** both retained predicates demand a state their current preceding steps do not establish; deliberate no-skip/no-claim policy explains both stalls. Draft successor installation completed; its old controlled client is still live. Redirect test advanced past ready before failing at first control.
- **Strong causal prediction, not yet executed:** releasing the last old draft client enables natural activation and subsequent controlled reopen; adding post-ready navigation enables control in the redirect test. Run these separately before broad edits.
- **Unproved downstream behavior:** legacy draft migration, exact durable byte preservation, selected non-first Focus state, offline completion and tombstone; full cookie/setup journeys after redirect. They may reveal independent failures once reachable.
- **Secondary hypothesis if draft remains waiting after the correction:** another old client or auxiliary target survives. Capture all window/worker targets and controlled client identities, then release the genuine last old client. Do not force activation.
- **Secondary hypothesis if redirect remains uncontrolled after activated registration and navigation:** scope/base/URL mismatch or unexpected worker failure. Capture requested and final document URL, document.baseURI, registration.scope, worker script/state, response source, page errors and failed requests. At root source these currently have a straightforward expected mapping. Nested assembled routing must be exercised independently.
- **Secondary hypothesis if activation succeeds but boot refuses:** HTML release meta and controller reply differ, missing required modules, or gate timeout. Capture query/reply and entry/module requests before changing the gate; refusal must remain safe.

## 6. Failing-first validation and acceptance

Execution remains required. Use the pinned browser/toolchain and repository runner, retain source SHA, initial result and diagnostics. Refresh integration head before implementation; reconcile changed source without relabeling this report's provenance.

### Focused sequence

1. Reproduce the two existing failures unchanged with:
   - `node tools/run-tests.mjs state --suite-id test-workout-draft-sw-upgrade-mjs`
   - `node tools/run-tests.mjs state --suite-id test-sw-launch-redirect-mjs`
2. Add only bounded state diagnostics and explicit expected intermediate assertions. Confirm the draft successor waits with original cache/bytes intact and the first installed redirect page is uncontrolled before the new navigation.
3. Apply the two test lifecycle changes separately. Run the same focused commands, following every retained assertion to terminal completion. A successful lifecycle stage is not whole-test success.
4. Negative controls: omit the leave step and require the draft test to fail at the named activation stage; omit the post-ready navigation and require redirect control to fail. More importantly, temporarily introduce early takeover/claim or early cache deletion in an isolated test mutation and require the strengthened old-client retention invariant to fail. Do not retain those mutations in production.
5. For redirect poisoning, use a fixture mutation that preserves the redirected cache response and prove the original installed navigation/no-redirect-cache assertions reject it. The lifecycle correction must not weaken the original #304 oracle.

### Release safety matrix

- One and multiple old tabs: replacement waits until the last old controlled client leaves; leaving only one does not retire old cache or change the surviving controller. Old workout remains usable and its actual committed draft is preserved.
- Historical old controller receiving new gated HTML: writer graph stays unloaded and raw state remains unchanged, including offline restart while required installation is blocked.
- Failed required asset/hash/MIME: successor cannot activate; partial new cache is removed without deleting an active release. Optional-resource failure still permits complete core boot and documented fallback.
- First install: uncontrolled network boot succeeds; readiness is distinguished from control; later navigation is controlled and offline boot works. Also cover absent SW/rejected registration without disabling network-only training.
- Root and non-root scope, source and assembled deployment, index-to-directory host redirect, manifest launch and legacy notification query. Use actual bootstrap for the end-to-end cases.
- Compatible complete-release rollback uses the same waiting/close/reopen safety; it never authorizes a pre-DraftV2 writer or storage reset.
- Preserve independent raw localStorage/IDB observations, draft checkpoint and tombstone assertions. Prove the original v186-produced input migrates exactly once and offline edit/save yields the literal expected 73.5/10/1 History values.

Existing [architecture-release-browser.mjs](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/test/architecture-release-browser.mjs) covers a small assembled graph at root/scoped paths, historical refusal, blocked install, offline refusal and natural activation. It uses a synthetic `src/main.js` that calls the real gate; it does **not** execute production `src/bootstrap.js` or the full app. Retain it, but do not cite it as complete production bootstrap/assembled-app validation. [architecture-release.mjs](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/test/architecture-release.mjs) separately protects gate and generated-worker integrity/fail-closed behavior.

After focused green, run the owning SW/release/DraftV2 packet and independent review, then require exact-final-head full ordinary CI and the repair plan's remaining gates. No larger timeouts, unconditional skipWaiting/claim, manual cache clearing, handshake bypass, regenerated historical inputs, dropped old-cache checks or promotion of replay results are acceptable fixes. This documentation does not close migration slices 19–20 or authorize merge/deployment.
