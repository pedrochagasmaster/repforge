# PR intake reconciliation for the agent-first integration

Snapshot: 18 October 2026, 19:34 UTC. Repository: `pedrochagasmaster/repforge`.

This is a read-only review and proposed disposition, not implementation acceptance, feature inclusion approval, or permission to merge, close, deploy or change infrastructure. Evidence gathering executed no application code and made no runtime or test changes; this document is a documentation-only integration commit. The target is a reviewable native adaptation, never a cherry-pick of an obsolete host over its new owners.

## Baselines and conclusions

- Current `main`: [`147e4afa07fea3243efd42b5b7d167c196c6a7ca`](https://github.com/pedrochagasmaster/repforge/commit/147e4afa07fea3243efd42b5b7d167c196c6a7ca), including #440.
- Inspected #448 head: [`959c037b33d2623ff7a218f2f817bdae813112b7`](https://github.com/pedrochagasmaster/repforge/commit/959c037b33d2623ff7a218f2f817bdae813112b7). Its native editor/session ownership is implemented; that does **not** establish candidate-A UI parity. This report compares actual rendered controls and command behavior, not just renamed symbols.
- Governing sequence: [work-sequence.md](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/docs/architecture/work-sequence.md). The sequence already separates incoming features from the twenty migration slices. This supplement supplies concrete semantic destinations, CI blockers and acceptance/approval gates.
- All nineteen PRs below remain open and unmerged. #389 is separately verified closed/merged.
- Recommend accepting the native architecture separately, then focused follow-ups: #443 and repaired #383 first; #437 then #442; #435 after its design record and failing evidence are resolved. A test-only salvage from #384 can be prepared independently. Folding any of these into #448 needs an explicit scope decision and affected gates repeated.
- Exact-head CI distinguishes readiness: #443 and #384 are green; #383 has a failing assertion for its own new syntax classification; #437/#442 fail the UI-inventory aggregate; #435 has a failing highlight assertion and catalog verification. A diagnostic replay is never a replacement pass.

## Nineteen-PR disposition matrix

Run results are the PR-triggered runs returned for the exact heads, not certification of an adapted successor. The connector returns the first page of runs. “Non-draft” describes metadata only.

| PR | State | Head | Exact-head reported run | Proposed disposition |
| --- | --- | --- | --- | --- |
| [#448](https://github.com/pedrochagasmaster/repforge/pull/448) | draft, open/unmerged | `959c037b33d2` | [CI: failure](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814); [Paired test benchmark: failure](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112792) | Sole authorized architecture integration; finish twenty-slice acceptance, then owner review. |
| [#447](https://github.com/pedrochagasmaster/repforge/pull/447) | draft, open/unmerged | `a99c35dbae91` | [CI: success](https://github.com/pedrochagasmaster/repforge/actions/runs/39138937471) | Specification/reference already imported; no parallel implementation. |
| [#446](https://github.com/pedrochagasmaster/repforge/pull/446) | draft, open/unmerged | `5754a0482871` | [CI: success](https://github.com/pedrochagasmaster/repforge/actions/runs/39136557642); [Paired test benchmark: success](https://github.com/pedrochagasmaster/repforge/actions/runs/39136557619) | Frozen accepted suite input; preserve later #448 audit corrections; no duplicate port. |
| [#445](https://github.com/pedrochagasmaster/repforge/pull/445) | draft, open/unmerged | `39581e85ca98` | [CI: success](https://github.com/pedrochagasmaster/repforge/actions/runs/39123332208) | Focused-name Back fix adopted; preserve in native editor, do not reapply. |
| [#444](https://github.com/pedrochagasmaster/repforge/pull/444) | draft, open/unmerged | `306f4dbb70b7` | [CI: success](https://github.com/pedrochagasmaster/repforge/actions/runs/39128405211); [Paired test benchmark: success](https://github.com/pedrochagasmaster/repforge/actions/runs/39128405250) | Superseded by #446; retain provenance; closure requires owner instruction. |
| [#443](https://github.com/pedrochagasmaster/repforge/pull/443) | draft, open/unmerged | `2767d3464e5e` | [CI: success](https://github.com/pedrochagasmaster/repforge/actions/runs/39099988545) | First bug-intake candidate; adapt geometry/viewport semantics, pending explicit scope approval. |
| [#442](https://github.com/pedrochagasmaster/repforge/pull/442) | draft, open/unmerged | `6087b4dd2196` | [CI: failure](https://github.com/pedrochagasmaster/repforge/actions/runs/39098522437) | S2 after S1; isolate day-order semantics from diverged stack; pending intake approval. |
| [#437](https://github.com/pedrochagasmaster/repforge/pull/437) | draft, open/unmerged | `1b3de1b8ea8b` | [CI: failure](https://github.com/pedrochagasmaster/repforge/actions/runs/39099257350) | S1 feature follow-up after native editor boundaries; approved design is not #448 intake approval. |
| [#435](https://github.com/pedrochagasmaster/repforge/pull/435) | draft, open/unmerged | `7c0c438c8f65` | [CI: failure](https://github.com/pedrochagasmaster/repforge/actions/runs/39098232613) | Defer behavioral intake until Q1 evidence and CI are resolved; sampler already adopted once. |
| [#432](https://github.com/pedrochagasmaster/repforge/pull/432) | draft, open/unmerged | `ce0b4403341e` | [CI: success](https://github.com/pedrochagasmaster/repforge/actions/runs/39088737854) | Combined isolated Lab delivery; slice18 comparison/proofs, separate merge/deploy decision. |
| [#431](https://github.com/pedrochagasmaster/repforge/pull/431) | draft, open/unmerged | `48b72f91eb50` | [CI: success](https://github.com/pedrochagasmaster/repforge/actions/runs/39079929214) | Policy source already combined in #432; reconcile shared native policy once. |
| [#430](https://github.com/pedrochagasmaster/repforge/pull/430) | draft, open/unmerged | `8700480ec1de` | [CI: failure](https://github.com/pedrochagasmaster/repforge/actions/runs/39079591579) | Domain/store/archive input combined in #432; use combined evidence, not standalone branch merge. |
| [#429](https://github.com/pedrochagasmaster/repforge/pull/429) | draft, open/unmerged | `e22844ae7ddb` | [CI: failure](https://github.com/pedrochagasmaster/repforge/actions/runs/39083019703) | UI/package input combined in #432; retain separate Lab ownership. |
| [#428](https://github.com/pedrochagasmaster/repforge/pull/428) | draft, open/unmerged | `32512c352896` | [CI: success](https://github.com/pedrochagasmaster/repforge/actions/runs/39079372192) | Design reference; A/copy decisions recorded, no extra runtime stream. |
| [#426](https://github.com/pedrochagasmaster/repforge/pull/426) | non-draft, open/unmerged | `5494f91ecb17` | [CI: success](https://github.com/pedrochagasmaster/repforge/actions/runs/38995106433) | Lab specification; 073.4 adaptation delivered through #432. |
| [#384](https://github.com/pedrochagasmaster/repforge/pull/384) | non-draft, open/unmerged | `b9697d4bb006` | [CI: success](https://github.com/pedrochagasmaster/repforge/actions/runs/38492071426) | Do not reapply central fix; salvage distinct GodMode composite test, closure later. |
| [#383](https://github.com/pedrochagasmaster/repforge/pull/383) | non-draft, open/unmerged | `0800b40b201c` | [CI: failure](https://github.com/pedrochagasmaster/repforge/actions/runs/38463339366) | First bug-intake candidate after repairing its failing syntax regression; no parser loosening. |
| [#296](https://github.com/pedrochagasmaster/repforge/pull/296) | draft, open/unmerged | `6ed1da480bde` | [CI: success](https://github.com/pedrochagasmaster/repforge/actions/runs/36847240681) | Park postlaunch; no illustration production or replacement approval. |
| [#282](https://github.com/pedrochagasmaster/repforge/pull/282) | draft, open/unmerged | `5f57e2de2ff2` | [Simulation: success](https://github.com/pedrochagasmaster/repforge/actions/runs/36677617956) | Park postlaunch; no publication/campaign approval. |

### Base and stack qualifications

#448/#447/#446/#445/#444 use main base `147e4afa07fe`. #443/#437/#435 are based on earlier main `15685a438ea2`, so adaptations must preserve #440 rather than restoring those branches' shell/Today behavior. #383/#384 were based on `e68e45232d19` and carry old cache revisions. Do not reuse their release inventories.

#442 names `feat/program-editor-a-s1` as its base, currently `1b3de1b8ea8b`, but the [exact-head comparison](https://github.com/pedrochagasmaster/repforge/compare/1b3de1b8ea8bdfb7bd8d4c85736b9fefa5f149e8...6087b4dd219676e30b488b25b1dc934e3368948e) reports **diverged, four commits ahead/eight behind**, merge base `fab4458dc3f3`. Its displayed diff includes S1 changes. “Stacked on S1” is a functional dependency, not proof that the current heads form a clean chain. First reconcile S1; then extract the S2-only behavior and revalidate against that exact adapted S1.

## Concrete intake packets

“Native owner” below means module responsibility, not a newly assigned person. Coordinate with each existing PR owner; this document does not reassign their implementation.

### #443: Focus keyboard band and scroll restoration

**Unique behavior.** While an edited Focus field has the keyboard up, pin main to the measured visual-viewport top and height; reserve the full shelf plus context padding as the deck floor; let the skip bar shrink/scroll; relinquish browser-induced document scroll both during and after keyboard display. This is not a fixed handset offset.

**Actual target comparison.** At the inspected #448 head:
- [Focus CSS](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/styles/source/workout/focus.css) changes only main's height under `data-keyboard="up"`; it does not pin it at the viewport's top.
- [geometry.js](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/ui/focus/geometry.js) publishes form/shell floors and still budgets inline guide space; it does not publish #443's independent deck floor.
- [trackSheetViewport in app.js](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/app.js#L2775) still calls field `scrollIntoView` and resets scroll only when leaving keyboard-up state. This remains a composition-host extraction boundary, not code already moved into Shell.

**Proposed owners.** Deck/shelf measurement belongs to `src/ui/focus/geometry.js`; CSS to `styles/source/workout/focus.css`; viewport listeners and rAF cleanup should become a bounded Shell/Focus presentation lifetime owned through `src/ui/shell.js` or a focused viewport module. Keep business state out of geometry. Integration owner performs the final composition wiring.

**Carry/discard.** Carry measured geometry and red-first assertions. Discard old `app.js?v=473`/service-worker inventory edits; use native release assembly. Preserve pinch-zoom discrimination and keyboard-down layout. Do not remove inline-guide floor accounting unless #435 is separately adopted; the two patches overlap there.

**Proof packet.** Native real runtime, 390×844 and 375×667 safe areas; plain Focus and rest/skip-bar state; focus before typing; visual-viewport pan plus scroll attempt; field switch; dismissal restoration; Android layout resize. Shelf bottom equals band bottom within 1px; input and Log set fully inside; document scroll zero; header band-relative position unchanged. Repeat lifetime/disposal and 200% text checks. Physical iPhone/Android remains [#425/#300](https://github.com/pedrochagasmaster/repforge/issues/425), because Chromium models the keyboard rather than displaying one.

**Disposition / owner approval.** First bug follow-up after Focus/Shell boundaries settle. Required scope choice: “Include #443's measured keyboard-band/deck-floor/scroll-restoration behavior in #448 and repeat affected gates,” or “Implement it as a separate native follow-up after #448.” Neither choice authorizes merge or a phone-check waiver.

### #383: copyable JSON and truthful diagnosis

**Unique behavior.** EN/PT assistant prompts request one fenced JSON block; repair prompts preserve prescriptions and ask for a clean copy. Distinguish syntax-malformed/truncated JSON (`invalid_json`) from syntactically valid but invalid rows (`invalid_rows`) and absent JSON. Do not strip backslashes, normalize away malformed punctuation, invent missing values, widen schema validation or log clipboard content.

**Actual target comparison.** [Native freeform parser](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/interchange/freeform.js#L209) still ends with `candidates.length ? "invalid_rows" : "no_json"`. [Entry view](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/ui/entry/view.js) still shows the common unreadable body. Native extraction preserves the old candidate-mining/gap workflow; it has not acquired the distinct syntax failure result. This is a semantic addition to existing owners, not a new import pipeline.

**Proposed owners.** Pure classification in `src/interchange/freeform.js`, bounded JSON parsing in `src/interchange/json.js`; session/result propagation and repair selection in `src/app/entry.js`; explanation in `src/ui/entry/view.js`; EN/PT source catalogs plus generated native i18n output. Preserve the existing review/activation command boundary and public freeform parser.

**Known blocker, not speculation.** [CI browser job](https://github.com/pedrochagasmaster/repforge/actions/runs/38463339366/job/115524017730) reports `program-freeform-import` 149 passed/one failed: “escaped bracket and truncated clipboard JSON are syntax errors, never missing exercises.” The valid-JSON/invalid-row assertion and 17-exercise fenced reply passed in that run. Catalog verification also failed in shards3/6 and5/6. Do not blindly adopt the current implementation as a proven fix or attribute its red CI solely to unrelated work.

**Proof packet.** Repair the classification against literal escaped-bracket and truncated-object/array/fence inputs without relaxing the oracle. Preserve valid escapes inside strings. Keep no-JSON, valid-invalid-row, gap, bare JSON, prose-wrapped JSON and complete 17-exercise fenced cases; EN/PT original and repair prompt contracts; one user-triggered clipboard read; review before activation; no mutation on rejected input. Reconcile catalog baselines only after behavior review; no blanket snapshot refresh.

**Disposition / owner approval.** Parallel bug follow-up, independent of S1. Required scope choice: “Adopt #383's fenced-output prompt and syntax-versus-row diagnostics, with the failing regression repaired, in [#448 or a separate native follow-up].” This is not permission to autocorrect source data. Exact adapted-head browser/parser/i18n evidence is required.

### #437: candidate-A installed editor S1

**Existing functionality to preserve.** #448 already has a private editor document, staged native intents, lock-held Apply/rebase, draft-impact handling, name-field Back handling, suggest-load validation, alternates and per-cycle metric/prescription controls. [Application session](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/app/installed-editor.js) and [installed view](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/ui/program/installed-editor.js) own those boundaries. Do not classify these as missing because the old host functions moved.

**Unique remaining presentation/interaction delta.**
- [Current native renderer](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/ui/editors/program.js#L730) exposes cycle controls as nested details; [exercise/day rendering](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/ui/editors/program.js#L1077) uses expandable exercise/day cards and inline name fields. S1 instead uses review-language day tabs and per-set rows, an exercise sheet, a dedicated Weeks exception table and matching action.
- S1 provides a changes bar/Undo over staged edits, header Cancel and dock-replacing pinned Apply. Current native installed view binds the existing Edit/Done and leave-dialog Apply/Discard/Keep controls; adopting S1 means wiring these new entry points to that same owner, not creating another commit owner.
- S1 presents ranked swap choices (configured alternates, then same-job suggestions, then search), a move-to-day sheet, day estimates, and its Loads block/ink switch. Existing substitution, alternate, prescription and load rules remain the authority.
- Catalog movement names cease being editable text in this approved design; custom movements keep name/metric details. This changes a user interaction and test routes even though the domain capabilities already exist.

**Proposed owners.** `src/ui/editors/program.js` and its contracts for the shared renderer; `src/ui/program/installed-editor.js` and `src/ui/program/controller.js` for installed-only chrome/lifetime; `src/app/installed-editor.js` for staged Undo/session semantics; `src/training/authoring/internal/installed.js` for canonical edit/rebase. Keep Build's existing layout selected separately. Styles go to program/editor fragments; locale sources retain the approved wording.

**Carry/discard.** Carry candidate-A UX and independent assertions, adapting selectors via an installed-editor fixture. Preserve #434 canonical contiguous-order repair already adopted through #446 and #445 focused-name Back. Do not replace native sessions with old host state. Do not automatically import all thirty changed legacy test files: map every assertion to retained owning suites, explicitly recording any approved retirement rather than calling it equivalence.

**Known blocker.** All selected jobs passed, but [aggregate CI](https://github.com/pedrochagasmaster/repforge/actions/runs/39099257350/job/117600011827) failed for three inventory selectors never rendered: `.program-editor__add-day:not([id])`, `.program-editor__alternate-move:not([id])`, `.program-editor__alternate-remove:not([id])`. Repair the catalog/role-inventory coverage against actual moved controls; do not simply exempt unvisited capabilities.

**Proof packet.** S1 edit → Apply → both durable replicas → reload → actual next workout, including every-week edits/current-week-last, week7 exception, alternate swap, rest/RIR/targets. Undo and Cancel leave storage unchanged; empty-day refusal; custom-only typed name; genuine cross-tab conflict; draft-impact choices; focused-name Back; disposal during pending Apply; keyboard/pointer reorder. Keep Build/classic keystroke coverage where that layout remains. Record screenshot/catalog parity separately from domain acceptance.

**Disposition / owner approval.** Separate native feature follow-up recommended. [#425](https://github.com/pedrochagasmaster/repforge/issues/425) records A/all recommendations and25 phrases approved on18 October; this is sufficient design context, not automatic inclusion in the architecture port. Required decision: “Have the existing S1 owner adapt candidate A onto the native editor boundaries [after #448, or explicitly inside #448], preserving its approved behavior/copy and native Apply/Back/draft ownership.” Any new copy or changed design needs a separate decision.

### #442: S2 day ordering

**Unique behavior.** A training-days sheet with drag handles and accessible arrows, rename round trip and add-day entry; `day_move` carries before/after order. Reorder training days only within their existing training positions, leaving rest positions intact; renumber the definition contiguously; keep all day/slot identities and fields. Stale before-order must refuse instead of replaying over another tab's order; Undo restores order; handle press must not begin sheet dismissal. Today's tabs/next-day follow the saved structure, while the existing draft retains its day label.

**Actual target comparison.** [Native InstalledIntent contract](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/training/authoring/internal/editor-contracts.js) and [native intent/rebase implementation](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/training/authoring/internal/installed.js#L90) cover name/add/remove and exercise movement but do not implement training-day order before/after handling. Existing day operations and native persistence are reusable. S2 adds a real authoring operation rather than merely changing its presentation.

**Proposed owners.** New typed intent in shared authoring/editor contracts; pure order validation/canonical sync and stale-order rebase in native installed rules; application session commits through the existing owner; UI in shared editor and Shell sheet-gesture boundary; Today derives order from the same saved structure. No second scheduling authority.

**Dependency and proof packet.** Resolve the diverged S1/S2 stack first. S2 depends on adapted S1 controls, not on merging the old branches. Preserve S2's exact reorder/reload/Today, drag-keeps-sheet-open, Undo, tab conflict and shape/setup-link tests. Add malformed before/after permutations, duplicate/unknown/omitted days and rename-versus-reorder conflict checks at the pure boundary. Assert rest positions, identity/field equality and contiguous order, then validate/canonicalize/round-trip. No new schema fields are proposed; recheck compatibility instead of assuming Worker redeployment.

**Known blocker.** [Aggregate CI](https://github.com/pedrochagasmaster/repforge/actions/runs/39098522437/job/117597287460) fails on the same three unrendered S1 inventory selectors, despite selected-job success. Its full diff includes S1; do not double-apply S1 or #434.

**Disposition / owner approval.** After S1. Required scope decision: “Adapt #442's training-day reorder as S2 after the native S1 contract, preserving rest positions, stable identities, stale-order refusal and draft semantics, in [a separate follow-up or explicitly expanded #448].” Design-A approval is not approval to land S2 independently or bypass its failing aggregate.

### #435: modal guides, first-tap replay and anchor cut-out

**Unique behavior.** Replace inline cues with modal dialogs for eight guides; inert page, title focus/trap, Got it/Escape/cancel persist dismissal and return focus. Arm first-set on Focus arrival, intercept first shelf field/pad tap, then replay exactly once after dismissal; direct Log set marks completed. One guide per Focus visit. Q1 adds an undimmed but inert anchor cut-out with viewport-aware panel placement and centered fallback.

**Actual target comparison.** [Native guides](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/ui/settings/guides.js#L60) still construct an `aside.guide-cue`, and [Focus geometry](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/ui/focus/geometry.js) still budgets it. Native Shell already provides modal focus/inertness/lifetime. Extraction and render-free guide-effect work do not by themselves adopt modal behavior.

**Proposed owners.** `src/ui/settings/guides.js` owns guide presentation/arming/held replay and placement disposal; `guide-registry.js` plus preferences retain eligibility/version authority; Shell owns modal focus/inertness; Focus bindings supply a public action seam, not cross-feature writes. CSS in shell/panels plus removal of obsolete cue accounting in Focus. Catalog/test harness must deliberately distinguish read-guides default fixtures from live/fresh-transfer devices.

**Already adopted / exclude.** #439 DPR sampling was imported through #446; do not duplicate it. #441's rendered contrast exception is a separate held finding, not blanket acceptance of a contrast change or perpetual exemption. Reconcile its exact state/measurement and remove an exception once its finding disappears. Do not automatically import the old six→seven shard setting into the redesigned suite.

**Design evidence conflict.** [#425](https://github.com/pedrochagasmaster/repforge/issues/425), updated18 October05:19UTC, still records the17 October decision as “no highlight.” [#435](https://github.com/pedrochagasmaster/repforge/pull/435) says Q1 was revised by owner/coordinator, but provides no original dated approval link in its body; its returned timeline and #425 comments are empty. This read-only pass cannot determine the controlling original decision. Preserve the conflict as unresolved rather than treating either summary as a fresh authorization.

**Known blockers.** [Guide-modal job](https://github.com/pedrochagasmaster/repforge/actions/runs/39098232613/job/117589041141) failed the dark Progress375×667 anchor-undimmed assertion (anchor luminance55.71 with dialog versus58.90 bare). Diagnostic replay passed and the runner explicitly retained a red gate. [Catalog job](https://github.com/pedrochagasmaster/repforge/actions/runs/39098232613/job/117589041077) also failed shard3/6 verification. Diagnose stable rendering/measurement before changing thresholds.

**Proof packet.** Every reachable guide, versions/eligibility/replay and persisted dismissal, first-tap exactly once, no opening on arrival, direct-Log completion, next-guide held until new Focus visit; title focus/trap/return target after DOM rebuilding; existing-modal refusal; placement cleanup on removal/disposal. If Q1 is approved, retain undimmed-anchor pixel oracle in light/dark narrow/large text/viewport conditions and centered fallback. Keep live guides on pristine transfer destinations; do not seed “dismissed” preferences into a supposedly fresh device.

**Disposition / exact approval.** Defer behavioral intake. First request original dated Q1 evidence; if unavailable, owner must choose “anchor stays visible/undimmed but inert with cut-out” or “plain centered modal, no highlight.” Then choose feature destination (#448 scope extension or focused follow-up) and explicitly resolve the scoped #441 hold with its owner. Approval of the sampler, or this documentation task, approves none of those feature decisions.

### #384: central fix redundant; GodMode coverage is distinct

**Already covered runtime semantics.** [Merged #389](https://github.com/pedrochagasmaster/repforge/pull/389) fixed canonical installed-editor rows and fingerprint tolerance for historical row-level `prescriptionsByCycle`. At #448, [editorSnapshotFromDocument](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/training/authoring/internal/installed.js#L46) uses the model's canonical `toJSON()`; [draftProgramFingerprint](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/src/persistence/snapshot.js#L106) strips the shadow. [Snapshot contract](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/test/persistence-snapshot-contract.mjs) asserts fingerprint invariance. Do **not** reintroduce #384's older conditional tolerance or old cache/runtime patches.

**Distinct test sequence to preserve.** #384 adds, in `test/program-import-review.mjs`: actual installed-editor +set → committed canonical rows → reinsert historical redundant row through durable writer → reload persisted legacy bytes → import/review/confirm GodMode → archive predecessor with edited set count → canonical successor → reload GodMode. #389's documented browser proofs use Reduce volume/Fewer days/Recovery week, not this import activation path.

**Retained-suite comparison and limit.** Inspected #448's current program-import-review, progress-lifecycle, progress-recovery, transition-crash-replay and transition-backup owners. The distinct GodMode composite sequence is not established by these inspected sources. The retirement ledger explicitly marks `program-transition-review-browser.mjs` reduced and says its additional permutations are retired; it does **not** promise assertion equivalence. That file is absent at the inspected head. Thus central-fix redundancy is insufficient evidence to discard the new import path or claim full coverage parity.

**Proposed test owners.**
1. Keep real editor interaction and GodMode review/activation/reload/archive composite in retained `test/program-import-review.mjs`, adapted to the current native editor public producer (and later S1 fixture).
2. Keep narrow historical fingerprint/control assertions in `test/persistence-snapshot-contract.mjs`; genuine changes to other fields/revision/block identity must still conflict.
3. Keep transition crash/archive atomicity in retained transition/recovery owners. Do not resurrect the whole retired suite just to obtain one sequence.

**Oracle safeguards.** Distinguish raw durable bytes from normalized application projection when checking the legacy fixture; assert both replicas where relevant. Require actual +set persistence and archived edited definition, not just a “GodMode” title. Preserve true concurrent-change refusal. Before closing #384, show exact adapted test/head evidence or an explicit owner decision to decline this additional coverage.

**Disposition / exact approval.** Recommend a **test-only salvage**, independent of #383 and S1's implementation, with its UI helper adapted if S1 lands later. Required implementation scope: “Carry #384's real GodMode historical-row import/reload/archive regression into the retained native test owner; no runtime fix reapplication.” PR closure is a separate action only after owner review. Green old-head CI does not certify the native adaptation.

## Lab boundary and deduplication

[#432](https://github.com/pedrochagasmaster/repforge/pull/432) is the combined delivery of #429 UI/package, #430 domain/store/archive and #431 shared policy. Their original branches are provenance inputs, not four competing ports. #426 supplies specification context; current delivery adapts it to073.4.

The migration's [pinned intake](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/docs/architecture/programlab-intake/README.md) and source inputs target combined head `ce0b4403341ee9dbdd34dc6994a1244172189fb8`. Refresh that pin before actual slice18 verification. Keep a single shared native compiler/policy authority and prove default-preserving full-result and real-worker parity. Separately prove Lab build/package, store/archive/import/replay and cancellation against the adapted imports.

Lab keeps its own composition, worker/package, database and historical read-only artifacts. It must not mount in the production application, reuse production preferences/history, enter the app's precache or introduce a second compiler authority. Combined Lab green CI does not approve its merge/deployment or replace native integration proof. Preserve its existing UI/domain owner's work.

## Ordered decision and acceptance queue

1. Finish/review the authorized native boundaries and current migration evidence; #448's latest run is red, not an acceptance checkpoint.
2. In parallel, prepare #443 semantic adaptation; repair #383's literal failing regression; prepare #384 test-only salvage. Obtain explicit destination/scope approvals before implementation.
3. Reconcile #437 onto native editor owners, preserving approved design/copy and current data ownership. Fix its inventory proof. Only then adapt S2-only #442 and refresh its diverged base.
4. Research #435's original Q1 decision in the owner's approved records; if unresolved, ask the precise design question above. Diagnose its red initial-run evidence, then adapt only the chosen behavior. Review #443/#435's shared Focus floor boundary together.
5. Reconcile #432 at migration slice18 without production/Lab coupling.
6. For every accepted packet: record predecessor and successor SHAs, adopted/omitted semantics, literal negative controls, active browser producer, saved identity/archive/draft/offline effects, exact-head proofs and owner acceptance. Preserve frozen fixtures; do not rebuild oracles from the new implementation.
7. Refresh final assembled/offline/rollback and [#425 phone evidence](https://github.com/pedrochagasmaster/repforge/issues/425) on the actual candidate. Keep Plan059 on hold until its separate owner authorization. PR closure, merge, deployment and launch overrides remain separate decisions.

## Evidence limits

This review used GitHub metadata, exact source files/diffs, workflow jobs/logs and the existing work sequence. It did not run the application, test a phone, change a branch, repair a CI failure or prove all twenty slices accepted. Incoming PR bodies are design/provenance descriptions, not instructions to act. The module mappings are proposed reconciliation destinations; they are not claims that each feature has been implemented. Recheck moving heads and approval evidence immediately before any actual intake.

