# Architecture migration integration ledger

Owner-authorized implementation of [specification #447](https://github.com/pedrochagasmaster/repforge/pull/447). One integration owner, one branch (`refactor/agent-first-integration`), one draft integration PR. Worker branches are local staging only; all reviewed output integrates here. No merge/deployment/network/credential changes authorized.

Implementation base: `147e4afa07fea3243efd42b5b7d167c196c6a7ca`. Specification imported from `46c1996901841868ba133e860cc5662b053effa6` without merging #447 to main. Runtime is unchanged at initialization. A checkbox closes only with its objective evidence and review recorded below.

## Current acceptance: 5 of 20

Accepted: slices1,3,4,6,7. Fifteen remain open. Independent implementation review supports the four new acceptances: native pure model/training consumption and strict closure; verified catalog plus one app/worker generation authority; browser-free snapshot policy; one durable/preferences owner with qualified outcomes and lock-held checkpoint preflight. The missed pending-checkpoint promotion was corrected in `4e08ce9f` before slice7 acceptance. Physical bridge/classic deletion, public type-edge enforcement and full final-head/offline CI remain explicit slices19–20 gates, not claims attached to intermediate pushes.

Independent evidence: `/tmp/core-independent-native-proof.json`, `/tmp/core-native-worker-independent.json` (actual worker50/0), `/tmp/core-training-model-final-independent.json`, source-produced snapshot/fixed-point/refusal contracts, immutable233 result corpus, actual DraftV2 storage81 and integrated persistence107.42s. Reviewer independently reproduced the pending-promotion failure and verified the common lock-held guard; new proof has4 positive and16 competing-head refusals preserving canonical/checkpoint bytes. Motion's actual vendor follow-up is reviewed separately and does not prematurely close slice11.

The sections below record earlier checkpoints; their smaller acceptance totals describe those earlier revisions. Latest acceptance is the checklist here.

## Implementation checklist

- [x] 1. Baseline and reconciliation contract
- [ ] 2. ESM/checkJs and release protocol
- [x] 3. Pure values/model/log/progression extraction
- [x] 4. Generator/catalog/executor ESM
- [ ] 5. Authoring/entry/edit/replay pure seams
- [x] 6. Pure snapshot policy
- [x] 7. Durable instance and preferences ownership
- [ ] 8. App session/workout commands
- [ ] 9. Program/custom/history command policy
- [ ] 10. Interchange and transfer local orchestration
- [ ] 11. Browser capabilities and shell lifecycles
- [ ] 12. Today/workout/summary presentation
- [ ] 13. Focus/shelf/rest/Why presentation
- [ ] 14. History and Progress presentation
- [ ] 15. Entry/landing/Build/import/recommendation UI
- [ ] 16. Installed program/library/custom UI
- [ ] 17. Settings/profile/privacy/install/guides UI
- [ ] 18. Lab consumer/package reconciliation
- [ ] 19. Coordinated composition/ESM release cutover
- [ ] 20. Remove temporary architecture and prove agent navigation

## Moving inputs at implementation intake

All remain open drafts, none assumed merged:

| Owner | Exact head | Integration disposition |
| --- | --- | --- |
| Program Lab #432 | `ce0b4403341ee9dbdd34dc6994a1244172189fb8` | Shared engine contract compatibility required; Lab stays separate. Integration decision and parity evidence pending. |
| Test redesign #446 | `5754a0482871f8f00456ff922ca2df2fd7702024` | Accepted/frozen input. Adopted `9448989d` as `79ef3d51`, final artifact-aggregation fix as `dcdc62e2`. Exact-head ordinary CI 39136557642 and paired benchmark 39136557619 both completed successfully (18/18 jobs reported). Baseline `147e4afa`: 208→97 commands, 195→97 scheduled files; one paired complete-execution wall measurement 1259.546s→264.860s (4.76×), summed command time 13800.711s→1627.448s; excludes queue/setup/artifact time. Exhaustive visual permutations, cosmetic choreography and yearlong simulation explicitly retired; integrity/privacy/recovery owners retained. Architecture additions require separate full validation and are counted in the live inventory. |
| Focused-name Back #445 | `39581e85ca9850c9dd2baf28742a9215b3063227` | Included exact owned guard and production proof in `792fc25f`; cache/editor URLs advanced to 477 above the test-redesign release. |
| Guides #435 | `7c0c438c8f654c7bb12c25db0e9b95c3932c0bbc` | Preserve native dialog/held tap/replay/focus/placement; owner's draft remains independent. |
| Editor #437 / issue #434 / Plan 074 | `1b3de1b8ea8bdfb7bd8d4c85736b9fefa5f149e8` | Preserve candidate A and canonical all-days renumbering; reconcile duplication with #446 exactly once. |

## Included fixes / provenance checklist

- [x] #445 focused unblurred program/day name Back guard and Apply/Discard/Keep-editing regression: exact source/proof diff `147e4afa..39581e85`, adopted `792fc25f`.
- [x] #434 canonical non-final removal and all-days cross-day renumbering: carried by #446 `9448989d` (originating Plan074 commits `37ddc408` / `a99f2238`), adopted once in `79ef3d51`.
- [x] #439 DPR2 screenshot sampling correction: carried by #446 from approved guide-owner `65ac8a7e`, adopted once in `79ef3d51`.
- [x] Existing current-main #440 iOS/layout/manual-load-carry fixes remain in integration base `147e4afa`.
- [ ] Later fixes from moving inputs reconciled before final acceptance.

## Evidence

Step 1: immutable generator/DraftV2/metric-history/profile/parser fixture captured from reconciled runtime `792fc25f`, rooted in audited main `147e4afa`; independent literals and deliberate corruption oracles pass. The retained browser risk owner matrix is in [baseline contract](baseline-contract.md). These source-produced values must not be regenerated to hide migration drift.

Input integration: runner self-tests 32/32 passed; redesigned inventory 97 commands before adding migration proof. QA focused-name Back suite passed 11.18s with system Chromium; this is local behavior evidence, not pinned-browser pixel certification. Exercise release inventory and transfer-specific fast telemetry proofs passed. Full runtime/architecture/data-review/final-CI completion is not claimed yet. Required acceptance and rollback contract: [specification sections 6–8](agent-first-spec.md).

## Implementation checkpoint (18 October)

Slices 2–11 have native implementations and partial live consumption, but remain open until converted scopes are strictly typed and duplicate owners removed. Native persistence/preferences/motion and application commands are consumed by app at `cbfb21d4`; actual session publication is still transitional. Today/summary native read models and presentation are consumed at `283c0c10`; remainder of workout UI is still open. Focus extraction is underway. Steps14–20 remain open.

Local evidence: updated runner self-tests32/32; native snapshot contract including malformed recovery quarantine; fixture public-runtime isolation/real replica roundtrip; live native pipeline race24.87s. Isolated owner evidence: draft storage81 and custom mutation128 checks, corrected History delete/replay after explicit canonicalization dependency. These are focused proofs, not full integration acceptance. Earlier full fast diagnostic63/66 passed; governance fixture corrections require rerun.

## Native integration milestone

Completed acceptance: slice 1. Active: slices 2–11; Today/summary in12 and substantial Focus13/History14 are consumed, with remaining feature work open. Program/library16, Settings/guides17 and Lab18 have independent owners. Entry15 and final composition/cleanup19–20 remain open. Code presence alone does not close a slice.

- Actual immutable session publication: `c00383b8`; Workout/Focus commands and catalog-ready construction: `31d3927b` / `5a2f6b67` (corrects early null-catalog capture). No second editable snapshot.
- Native model consumption `040b97ba` removes44 duplicate bodies. Live local calendar/language/custom aliases are explicit inputs (`d1128131`). Native catalog/compiler/module-worker consumption `ddd43b9d`, one shared authority `80088d96`.
- Native History/Progress wiring `c5f9739b`; retired History/interchange roots deleted `52c85a14` (4,412 lines). Native transfer HTTP consumer omission corrected `0d36b5b0`; remote service was not changed.
- Concrete corrections: recovery digest shadow `f08df64a`; null Finish adapter `551a84ef`; lock-held History cancellation `629ce90a` (independently reviewed); native browser readiness/helpers `e19cbf51`. Earlier failed runs remain failed.
- Configured strict graph covers release, metrics/identity, preferences, platform files/notifications/install/catalog/executor/telemetry/motion and all Focus modules. Persistence/model/entry owners have zero own diagnostics; their full imported training graph remains open and is not claimed type-complete.

Clean-head local command provenance: native generation/actual worker/fallback27.58s at `5a2f6b67` (`/tmp/integrated-native-generation-v2.json`); History delete/replay4.73s; model-backed summary5.16s; native transfer client after root deletion3.47s. Isolated owner proof: Focus39/39, draft-storage81/81 and Finish12.93s after actual native command wiring. System Chromium is behavior evidence, not pinned pixel acceptance.

Broad fast diagnostic72/75 exposed stale syntax ownership and gesture-source checks plus genuine lost setup identity-cache lifetime. Native source inventory/deletion and gesture checks now pass focused owners. Explicit prepared setup identity composition (`da8f7141`) fixes the exact unchanged300-run failing property from120s budget exhaustion to2.1s; no property count or timeout was relaxed. Broad rerun is pending. Evidence-path refusal was also moved before preview startup; manual negative proves existing file and source remain unchanged, with no preview process started.

Remaining acceptance gates: remaining training/interchange/UI strict closure; feature15–17 extraction and leftover12–14 event/view ownership; Lab default-policy intake; final all-native composition; removal of temporary forwarding bindings, globals and broad durable facade; independent final architecture/data review, full exact-head CI and assembled/offline upgrade proofs. #446 acceptance is no longer a blocker.

## Integrated UI and strict ownership checkpoint

Slice1 remains complete; the remaining19 acceptance boxes stay open pending final ownership and proof gates. Implementation continues on PR448; #447 is the approved specification, not the implementation deliverable.

- Consumed native Progress/Review presentation `53b5301d`, Settings/profile/install/privacy/guides `be144016`, private Entry handoff commands/parser/UI `1f442a11`, corrected command factory import `ef11b144`, hub selection/read-only rendering and pure session summary projection (this checkpoint). These remove real root responsibilities; Entry's main question flow, shared mounted editor and remaining Workout/Focus/controller responsibilities are still active.
- Enforced strict scope `e3f2e387` now includes every training, persistence, platform and interchange JS file, plus closed app/session/workout/read-model/settings/profile/interchange and Entry/Focus/Settings UI owners. Whole training closure includes generation/compiler/layout/transition, model, authoring/review/installed, progression/evidence and DraftV2. No suppression/any escape was added. Unconverted UI/compat/root scopes remain open.
- Strict typing revealed installed-editor metric import and default-cycle TDZ defects; retained real document tests cover the fixes. Entry independent review found mutable gap aliases and a stale clipboard completion; clone/freeze and exact-source/epoch checks have failing-first regressions.
- Clean integrated proofs: Progress summary5.10s; Settings22checks6.58s; complete Entry handoff147checks138.02s (`/tmp/integrated-entry-handoff-v2.json`); actual DraftV2 storage81checks139.35s after strict closure (`/tmp/integrated-durable-strict-draft-v1.json`). Entry v1 boot failure remains recorded; missing composition import corrected before v2.
- New broad fast diagnostic80/81 passed. The sole failure was the telemetry producer inventory still scanning only the root and History after Settings producers moved; it now scans native app/UI owners and checks injected report calls against the closed event vocabulary. Focused corrected gate passes42/42 declared events. This checkpoint is not final-head full CI or pixel/offline acceptance.
- Lab shared policy/strict worker intake and pinned owner patch/verifier adopted `78a7b913`/`a4268a92`; #432 stays independent. Owner proof covers233 complete results, native worker policy/diagnostics and actual patched Lab store/archive round trips. Full production composition and moving-owner reconciliation remain required.

## Native editor deletion and independent-oracle checkpoint

The mounted editor now uses native `src/ui/editors.js` and shared authoring document rules; the obsolete1933-line `program-editor.js` is deleted, not kept as a test adapter. Source-contract consumers read the actual editor/Motion/Shell owners; actual integrated name/Back browser proof passed13.62s. Editor UI strict closure is still being completed in its isolated owner and is not claimed from these source checks. Focus handoff after native Shell passed59.12s; integrated Session metadata/reorder/abandon/Finish proof passed15.39s, Program/library journey7.50s.

Anti-tautology acceptance is mandatory. The external97-suite/21-service-file auditor owns retained tests/helpers exclusively from exact base `227ccc559bafc54d27b34f7baa4dad37f3bfabf2`; migration owners freeze further retained-file changes and continue production/new-proof work. Nine reported oracle weaknesses require correction commits, targeted failing controls and focused reruns through PR448. The PR records the coordination lease. No universal absence claim is made. New session/block proofs now have fixed pre-extraction hash/fingerprint fixtures and a complete hand-calculated summary oracle (`ce86b2fa`), plus four demonstrated source mutations. Custom/library command proofs now use actual native producers and independent literal/invalid-consumer expectations (`b2e723c7`). The source-formatting self-comparison in vendor-runtimes is retired transparently in the retirement ledger.

## Live integration checkpoint: native owner cutovers

Formal acceptance remains **1/20**; the remaining nineteen slices stay open. Five feature workstreams continue on this single integration branch: Entry activation/landing/import, Focus/Workout rendering and navigation, Progress projections, deep transfer orchestration, and Program Review/installed editor/text sharing. Composition, legacy deletion, independent final reviews and full exact-head CI follow these cutovers. Intermediate remote commits may be untested; a push is not an acceptance claim.

Consumed source since the previous checkpoint includes canonical Workout queries (`728a94a5`), complete strict native editor and stale-command refusal (`c953aec2`, `35e28954`), native Entry answer/question/review/setup-draft owners and immutable publication (`9a44280d`), native Progress session-outcome policy (`a872dea2`), Entry start/resume/save/cancel (`c3fb1f15`), native Program Review (`75c13b41`), canonical DraftV2 suggestion source (`65d21cf6`, actual UI call sites `bdcc1075`), one public Focus presentation composition (`c2a88340`), native guide preferences (`f72866a3`) and separate recovery actions/presentation (`84ff64ae`). Physical obsolete roots still needed by historical test fixtures await coordinated deletion; they are not production owners.

Concrete independent review fixes: executor terminal paths detach actual AbortSignal listeners (`981012ed`, failing-before listener-count proof); snapshot contract uses the actual static-library adapter shape and asserts fixed identities/aliases (`a2405133`, old miswire fails). The native Program Review rejects queued Undo after disposal and forged invalid edits. Native guide preference checks use literal prior-tour/version/replay expectations. Recovery action checks refuse partial deletion and preserve journals.

Exact clean-head focused evidence:

- Entry S4 after combined Entry owners: `9a44280d`, 45.68s, `/tmp/integrated-entry-owners-s4-v1.json`.
- Editor disposal: `9a44280d`, 1.19s, `/tmp/integrated-native-editor-disposal-v1.json`.
- Native Review disposal: `bdcc1075`, 3.41s, `/tmp/integrated-native-review-disposal-v1.json`.
- Whole configured native strict graph and AST boundaries pass after the `c2a88340` composition; this excludes the remaining legacy root and is not a claim that slice19 is complete.
- Full persistence browser run at isolated `84ff64ae` passes actual legacy healing, malformed/divergent recovery, raw exports, overwrite, retry and partial Start Fresh checks, then **fails** at retained test's obsolete `window.resolveBootReplicas` access. `/tmp/integrated-native-recovery-v1.json` remains failed; native fixture consumer correction is required before a new proof.
- Integrated Focus run at `485e1058` **fails** with the intermittent Playwright context-destruction error during a later boot after the input/effort/correction/retry checks pass. `/tmp/integrated-focus-native-values-v1.json` remains failed. Isolated source-owner green runs do not resolve its cause; low-overhead protocol diagnosis continues.

Audit edit allocation is refined to its requested ten test files plus one new fixture, all at exact base `227ccc559bafc54d27b34f7baa4dad37f3bfabf2`: `test/generative/properties/canonicalization.mjs`, `test/program-compiler-search.mjs`, `test/program-entry-inputs.mjs`, `test/install-transfer-client-browser.mjs`, `services/install-transfer/test/{program-entry-drafts,operations,client-http,routing,rate-limit,lifetime}.test.js`, and `test/fixtures/program-entry-draft-plan070.json`. Read-only audit scope remains all97 owners/21 service files. Root reserves other retained paths solely for native-runtime fixture/obsolete-global consumer reconciliation; feature workers remain frozen on retained tests. All nine audit corrections and their independent mutation evidence must integrate before final acceptance.

Work outside the migration follows [the repository work sequence](work-sequence.md); it distinguishes incoming feature ownership, adopted fixes, phone evidence and launch authorization.
