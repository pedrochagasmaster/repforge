# Priority bug intake: source-only patch proposals

Prepared 18 October 2026 UTC for `pedrochagasmaster/repforge`. **No application/tests executed, patches applied, remote state changed, merge or deployment performed.** These are preparation packets, not approval to include all three in #448.

## Exact bases and execution gate

- Runtime/test base: `959c037b33d2623ff7a218f2f817bdae813112b7`.
- Integration documentation read: `docs/architecture/pr-intake-reconciliation.md` at `b6fabb77cb07aad0dbf389d6be18094e98016c80`, branch `refactor/agent-first-integration`. Re-read the eventual implementation head before applying any proposal.
- Inputs, freshly verified open/unmerged: #443 `2767d3464e5eedac82ba2f74cf59f241fe793e75`; #383 `0800b40b201cd16e62dd7dc860887071ceb76a34`; #384 `b9697d4bb006fdd65bb0f75aad082756e9dd7307`.
- Implement only after destination is settled: explicit addition to #448 with affected gates repeated, or separate native follow-ups. Execution capacity remains blocked; this document establishes neither a passing repair nor completed architectural cutover.

## 1. #383: fix the early partial acceptance, then add truthful diagnostics

### Actual failure mechanism

[Original job log](https://github.com/pedrochagasmaster/repforge/actions/runs/38463339366/job/115524017730) confirms **149 passed, 1 failed**, specifically the combined escaped-bracket/truncated-clipboard assertion. The escaped-bracket UI assertion and full 17-row fenced clipboard assertion pass. The combined assertion prints no individual result, so attribution below is a source trace, not a separately observed runtime result.

The literal `completeEnvelope.slice(0, -9)` truncates the last `notImported` string and outer object, **after the exercises array is complete**. In `freeformJsonCandidates`, the outer `{` never finds its close; the outer scan then advances inside that same failed root. It emits the intact `meta` object and intact exercises array. `parseProgramImport` in `src/interchange/program-file.js` accepts an array as program rows, so the complete-result loop returns those exercises before #383's new final `invalid_json` classifier executes. Metadata and unsupported-content disclosure can be lost. The internal `"exercises": \[` mutation instead retains balanced outer braces; that whole candidate fails JSON parsing and reaches the final diagnostic.

### Smallest required source changes

In `src/interchange/freeform.js`, prevent retrying nested roots inside an unfinished root. This is the core regression repair; a change only at the function's final return is insufficient:

```diff
@@ freeformJsonCandidates: immediately after finding an opening delimiter
-    let depth=0,inString=false,escaped=false;
+    let depth=0,inString=false,escaped=false,closed=false;
@@ matching close
-      else if(ch===close&&--depth===0){out.push(text.slice(i,j+1));i=j;break}}}
+      else if(ch===close&&--depth===0){
+        out.push(text.slice(i,j+1));i=j;closed=true;break}}
+    // Keep the failed outer document, never salvage its nested exercises.
+    if(!closed){out.push(text.slice(i));break}}
```

Keep the current string/escape state machine unchanged. Do not strip backslashes, balance brackets automatically, fill prescriptions, or loosen `validRaw`/gap bounds. Two small boundary safeguards belong with this fix:

1. Fence bodies are atomic candidates. Collect their source spans and exclude those spans from the subsequent balanced-root scan; an invalid fenced envelope must not get a second chance as its nested array. Include an unterminated JSON fence's remaining body as one candidate. A complete JSON body with a missing Markdown closing fence can remain compatible; incomplete JSON inside it must return `invalid_json`.
2. If an opener is immediately preceded by a backslash outside a candidate, include that backslash in its candidate slice. Otherwise a bare `\[` array could silently lose the illegal escape during extraction. Preserve valid escaped backslashes/brackets *inside JSON strings* byte-for-byte.

After existing complete/gap validation, classify **the preserved outer/fenced candidates**, not a fresh nested search:

```js
// Diagnostic only: raw input has already passed the 1 MiB admission bound.
// JSON.parse success here never authorizes import; boundedImportJson and the
// existing source/gap validators remain the only acceptance paths.
const syntaxBroken = value => {
  try { JSON.parse(value); return false; } catch { return true; }
};
const reason = candidates.some(syntaxBroken) ? 'invalid_json'
  : candidates.length ? 'invalid_rows'
  : /^\s*```(?:json)?(?:\s|$)/i.test(raw) ? 'invalid_json' : 'no_json';
return {status:'unreadable', reason};
```

Use a separate syntax result because `boundedImportJson(...) === null` conflates malformed JSON with node/depth-limit refusal. Do not mislabel a syntactically valid over-depth document as a syntax error; retain refusal (under the existing structural category unless a separately reviewed limits category is introduced). The complete/gap loops still select the first independently valid candidate. No malformed enclosing candidate may contribute an inner candidate. Bound fence collection as well as balanced extraction to the existing eight-candidate ceiling. None of these diagnostics may feed parsed values back into acceptance.

Native wiring is small:
- `src/ui/entry/controller.js`: add `invalid_json:'entry.freeform.repair_invalid_json'` to **its** `repairKeys`; the old host `FREEFORM_REPAIR_KEYS` is not the native destination.
- `src/ui/entry/view.js`: choose `entry.freeform.unreadable_invalid_json_body` only when `model.failReason === 'invalid_json'`.
- `src/app/entry.js`: existing `session.fail(parsed?.reason)` and read model already propagate the string; no second session or activation path is needed.
- Carry reviewed EN/PT prompt/repair copy from #383 into `i18n-en.json` and `i18n-pt.json`; regenerate `i18n.js` through the native build. Preserve all prescription-preservation rules. Do not carry old cache/script revisions or blanket-refresh catalog expectations.

### Failing-first proofs and negative controls

Split the original combined assertion into separate literal cases, with result status/reason in failure details. Every rejected case must be `{status:'unreadable',reason:'invalid_json'}`, never `complete`/`gaps`, and must leave both durable replicas and activation state unchanged:
- Exact original `completeEnvelope.replace('"exercises":[', '"exercises": ' + String.fromCharCode(92) + '[')`.
- Exact original `completeEnvelope.slice(0,-9)`; also truncate within an exercise and truncate an outer array after an intact inner row.
- Those incomplete JSON documents inside closed and unclosed `json` fences, and after prose. Add a sentinel `meta`/`notImported` value so accidental array salvage is observable.
- Bare externally escaped opening array; mismatched closing delimiter; incomplete quoted string containing `{` or `[`.

Controls: complete bare/prose-wrapped/fenced 17-row JSON retains all rows and disclosure; legitimate quoted `\\`, `\"`, Unicode and literal brackets retain decoded values; valid JSON with empty exercise name is `invalid_rows`; absent JSON is `no_json`; gap sidecars and row-position collision tests remain unchanged; syntax-valid depth/node excess remains rejected without `invalid_json`. An independently complete second candidate remains eligible, but nested pieces of a broken candidate do not. Remove the unfinished-root change as a mutation control: the exact original truncation assertion must fail again.

Run the retained `test/program-freeform-import.mjs`, relevant interchange/parser contracts, native entry lifetime/clipboard tests and i18n/catalog checks on the exact adapted head. Verify one gesture-triggered clipboard read, stale-read refusal, review before activation and no clipboard content in telemetry. Old CI also has catalog failures; a parser-only green result cannot erase them.

## 2. #443: three measured presentation changes, preserve inline guides

### Minimal geometry/CSS delta

In `src/ui/focus/geometry.js`, immediately after `least` is read in `syncFocusFloor`:

```js
const deck=tall(shelf)+(least
  ? (parseFloat(least.paddingTop)||0)+(parseFloat(least.paddingBottom)||0) : 0);
shell.style.setProperty('--focus-deck-floor', `${Math.ceil(deck)}px`);
```

Leave `guideLeast`, card guide contribution, shell guide contribution, existing form/shell floors and ResizeObserver ownership intact. This packet does not adopt #435 or remove inline-guide space.

In `styles/source/workout/focus.css`, replace the current keyboard-up main-height rule and add the two adjacent rules:

```css
:root[data-keyboard="up"] body.is-workout.is-focus-wo main{
  position:fixed;top:var(--vv-top,0px);left:0;right:0;height:var(--vvh,100dvh)
}
:root[data-keyboard="up"] body.is-workout.is-focus-wo #workout > .deck{
  min-height:var(--focus-deck-floor,0px)
}
:root[data-keyboard="up"] body.is-workout.is-focus-wo #workout > .skipbar{
  flex:0 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain
}
```

Keep existing keyboard-up shell/form/context min-height relaxation, keyboard-down layout and #440's Today behavior. Generated styles/release inventory must be produced natively, not copied from #443's `styles.css`/`v473` edits.

### Viewport owner and remaining cutover

`trackSheetViewport` is **still in app.js:2775 at the runtime base**. Thus “native keyboard ownership complete” would be false. Extract it into a bounded Shell-owned presentation lifetime (a focused `src/ui/viewport.js` is a proposed new file), retaining `--kb`, `--vvh`, `--vv-top`, scale normalization and editable-field detection. Wire exactly one instance through the existing composition root; remove the old listeners when cutting over. Geometry remains Focus-owned, never a durable-state owner.

Replace only the current shelf `scrollIntoView` / dismissal-only reset branch with:

```js
const focusWo=document.body.classList.contains('is-focus-wo');
if(!zoomed && focusWo && (up || was) && (window.scrollY || window.scrollX))
  settle=requestAnimationFrame(()=>{
    if(!disposed && document.body.classList.contains('is-focus-wo')) window.scrollTo(0,0);
  });
```

The bounded owner must cancel the prior rAF at each apply and on dispose, name/remove resize/scroll/focusin/focusout listeners, retain/cancel the focusout timer, prevent callbacks after disposal, and clear only its owned viewport styles/flag on final teardown. Revalidate scale and lifetime if they change before a queued reset executes. Adding a bounded window-scroll listener is justified only if a standalone scroll-attempt regression shows the current visualViewport events insufficient; do not add a perpetual scroll loop speculatively.

### Required proof

Port #443 section 10 into retained `test/focus-space-summary.mjs`: 390×844 safe 44/34 and 375×667 safe 20/0; Focus and rest+skip bar; before typing, band reduction, pan 49 plus scroll attempt, field switch, dismissal, Android layout resize. Keep literal ≤1px shelf/band equality and header-relative-position oracles, field/Log set full containment, `scrollTop===0` and `scrollY===0`, and full pre/post box restoration. Numbers model test conditions, never runtime offsets.

Also run live inline guides, 200% text, pinch zoom/panning, no editable focus, non-Focus routes, repeated mount/dispose, dispose during pending focusout/rAF, and keyboard-down controls. Mutation controls removing top pinning or the deck floor must reproduce pan-gap and short-band/skip overflow. Physical iPhone/Android evidence remains outstanding under #425/#300; Chromium's modeled keyboard cannot close it.

## 3. #384: test-only GodMode salvage in the retained import owner

No runtime changes. Keep native canonical `editorSnapshotFromDocument` and unconditional historical-shadow stripping in `draftProgramFingerprint`; do not reapply #384's old conditional fix or revive retired `program-transition-review-browser.mjs`.

Add one scenario to retained `test/program-import-review.mjs` immediately before its final program-only import case. Reuse `resetWithProgram`, `openEditor`, `importFile`, `acceptFirstProposals`, and **`reviewAndActivateImport`**. That retained helper stages through `#importCommit` → `#entryActivate` → visible `#entryReplaceConfirm`; do not call a commit hook to activate GodMode or replace it with a title-only test.

1. Reset/install seed; record predecessor id, first row id, its slot id and original set count. Open real editor, expand its owning day/exercise if needed, click `adjust/sets/delta=1` for cycle 1, then actual Done/Apply. Flush. In **both** localStorage and IndexedDB `repforge/kv/repforge_v1`, require row `sets === before + 1`, definition slot `prescriptionsByCycle[0].sets.length === before + 1`, and no active row owns `prescriptionsByCycle`. Require the same definition and row edit after reload.
2. Reinsert only the historical shadow through the retained application seam:

```js
const proposal=window.__repforgeWorkoutDraft.state(); // cloned native state
const row=proposal.program.find(r=>r.id===editedId);
const slot=proposal.programMeta.programDefinition.days.flatMap(d=>d.slots)
  .find(s=>s.id===(row.slotId||row.id));
row.prescriptionsByCycle=structuredClone(slot.prescriptionsByCycle);
const result=await window.__repforgeCommitProposedState(proposal);
await window.__repforgeStorage.flush();
// require result.committed===true && result.settled===true
```

Read each **raw replica** before and after reload; require the targeted row's own shadow and exact equality to the recorded definition prescription. Read IndexedDB using a readonly transaction and close its connection. Do not assert the normalized `__repforgeWorkoutDraft.state()` preserves that shadow: normalization deliberately removes it. If the writer/boot no longer preserves the historical bytes, report fixture refusal; do not weaken the assertion or mutate live app state to pretend the historical path ran.

3. Through the actual installed import UI, import literal `godmode.json`:

```json
{"version":3,"meta":{"name":"GodMode"},"exercises":[{"day":"Upper","order":1,"name":"Barbell bench press","sets":3,"min":4,"max":6}],"missing":[],"notImported":[]}
```

Accept proposals, but first assert the review contains exactly one row with bench catalog id `19f5c6f170d8808bb424e98de4472a7e`, day Upper and 3×4–6. Record raw replicas; staging review must not replace the predecessor. Use the retained review/activate helper; flush both stores.
4. In both replicas require name `GodMode`, exactly one active row, bench id, day `Upper`, `sets===3`, `min===4`, `max===6`, canonical active rows with no shadow, and successor program id different from predecessor. Require exactly one predecessor archive by recorded id, archived edited row count `before + 1`, and archived `meta.programDefinition` slot prescription count `before + 1`. Compare archive definition to the recorded edited definition, not to a newly normalized expected value. Preserve unrelated logs/settings/custom definitions. Reload; repeat successor identity, exact prescription, canonical-row and single-archive assertions in both replicas.
5. Separate negative control: stage the same import, commit a genuine predecessor program edit from a second page, then attempt activation on the stale first page. Require refusal, no GodMode successor and no new predecessor archive, while retaining the second page's edit in both replicas. Keep narrow snapshot tests that only the historical shadow is fingerprint-invariant; changed sets, row id, program id or block id must change the fingerprint. Storage revision equality is a **separate CAS condition**, not a field to add to `draftProgramFingerprint`.

Run the retained import-review suite plus persistence-snapshot, native installed-editor session/lifetime and transition/recovery owners. Require an exact adapted-head pass and a negative-control failure when historical shadow tolerance is locally disabled in a disposable test run. #384's old-head green CI does not certify this native composite; closing #384 remains a separate decision.

## Remaining decisions / stopping condition

Choose the implementation destination and viewport lifetime wiring after the remaining architecture cutover. Preserve independent-candidate compatibility and explicitly review any broader parser-mining behavior change; do not quietly replace it with “entire reply must be JSON.” Missing Markdown closing fence with otherwise complete JSON is not itself a JSON syntax failure. Execute red-first and adapted-head suites, inspect EN/PT catalog changes, then report actual results and physical-phone limitations. No claim of repaired CI, implementation acceptance, merge readiness or deployment follows from this source-only packet.
