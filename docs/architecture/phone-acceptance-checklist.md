# Taurifer phone acceptance checklist

> Updated owner direction, 18 October 2026 at 20:20 UTC: **“Test both and choose the best one.”** The assistant is authorized to compare full-background dimming with a bright but inert explained control and select using evidence. Earlier requests below for a new preference decision are superseded; the historical provenance conflict remains recorded. Follow [the comparison protocol](guide-variant-comparison.md). Execution is still blocked, neither variant has been comparatively tested, and no winner is selected. Feature-intake scope, final acceptance, merge and deployment remain separate.

Prepared from repository evidence on **18 October 2026 UTC**. Owner execution worksheet for [#425](https://github.com/pedrochagasmaster/repforge/issues/425).

**No tests were executed in preparing this document. All candidate-run results start as NOT RUN. This document approves no merge, deployment, launch, infrastructure change, or start of Plan 059.**

## 1. Pick the build before testing

Use this checklist on an explicitly selected, already available candidate. Do not deploy an unfinished branch to obtain a phone test.

- Current `main` observed: `147e4afa07fea3243efd42b5b7d167c196c6a7ca`. This is repository identity, not proof of what a phone or production is serving.
- [Architecture PR #448](https://github.com/pedrochagasmaster/repforge/pull/448) is paused after usage exhaustion. Last code checkpoint: `959c037b33d2623ff7a218f2f817bdae813112b7`; uncommitted interrupted state is unverified. Acceptance is **5/20**, not complete. CI [39153112814](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112814) and paired benchmark [39153112792](https://github.com/pedrochagasmaster/repforge/actions/runs/39153112792) failed. Earlier focused passes are not final-head acceptance.
- #427, #436 and #440 are merged behavior baselines. #443 keyboard work, the entire #435 guide redesign, #437/#442 editor features and #383 clipboard work are separate incoming scope. Do not assume a candidate includes them because their PRs exist.
- Follow the pinned [work sequence](https://github.com/pedrochagasmaster/repforge/blob/959c037b33d2623ff7a218f2f817bdae813112b7/docs/architecture/work-sequence.md). Complete migration and selected intake evidence before final candidate certification. Earlier phone runs may diagnose problems, but must be labeled diagnostic.

### Run identity — fill once per device/build/mode

Copy this block for each combination. Every test result must reference its run ID. If any identity changes, create another run; do not overwrite prior evidence.

```text
Run ID:
Purpose: diagnostic / final-candidate acceptance
Tester; date/time and timezone:
Phone manufacturer and exact model:
OS and exact version:
Browser and exact version; keyboard app/version:
Mode: Safari/Chrome tab / installed Home Screen PWA / Android WebAPK
Install history: fresh / existing; previous build if known:
Language: EN / PT-BR; theme; text size/display zoom:
Orientation; viewport if available:
Network: online / airplane mode with Wi-Fi also off:
App origin/URL (no setup tokens or personal parameters):
Candidate full 40-character Git commit SHA:
Deployment/build evidence URL mapping this origin to that SHA:
Observed loaded app asset revision and active SW/cache revision:
How those loaded revisions were observed (e.g. attached diagnostics/inspector):
Included incoming PRs and exact heads, or explicitly excluded:
Transfer service release SHA/deployment identity, if applicable:
Test fixture: synthetic program/session marker and expected values:
Backup verified: date, location, and restore verification reference:
```

If exact loaded build identity cannot be established, record observations as **BUILD UNVERIFIED**; do not mark current-candidate acceptance PASS. A version query, a branch name, or refresh alone does not establish a full commit. Ask the build owner for the mapping rather than guessing.

### Safety and result rules

- Use synthetic data and a spare/test install where possible. Before deleting an installed app, verify an independent backup of any valuable local data. Deletion can erase that install's data. Do not use the sole copy of real workout history for destructive setup tests.
- Complete separate iPhone and Android runs. A desktop viewport, screenshot catalog, CI pass or simulator does not substitute for real keyboard, Safari handoff, safe-area or WebAPK evidence.
- Run primary flows in EN and PT-BR. Repeat layout checks in light/dark; include a compact phone and larger text where available. Record unsupported/unavailable device combinations as BLOCKED, not PASS.
- Capture a short screen recording for transitions and before/after screenshots for layout/data. Keep setup URLs, cookies, credentials, personal history and raw exports out of public evidence.
- For each case record: **test ID; run ID; PASS / FAIL / BLOCKED / NOT RUN; observed result; evidence link; bug link if failed; tester/time**. Never replace a failed result with a retry; append the retry and its build.
- Stop a flow on unexpected data loss, duplicated data, wrong load/RIR, unusable input or failed boot; preserve evidence and use the verified backup/recovery route. Do not repeatedly reinstall or clear storage to hide the failure.

Priority meanings: **P0** = boot, data integrity or primary workout blocker; **P1** = required behavior/layout evidence before acceptance; **DECISION** = owner or provider evidence gate, not a phone pass. These priorities organize execution, not authority to waive gates.

## 2. Physical phone tests

### P01 — Installed Android launch and recovery [P0; #304]

Device: real Android with Chrome/WebAPK. Keep fresh-install and existing-install runs separate.

1. On an existing test install, note a recognizable program/history marker. While online, let the candidate update normally and record the active build. Do not uninstall to simulate recovery.
2. Close it, then open Taurifer from its Android icon. Repeat a cold icon launch.
3. In Chrome, visit the production root and `/index.html`; record the resolved shell behavior without changing manifest identity.
4. After a successful online load/cache, close the app, enable airplane mode with Wi-Fi off, and launch from the icon again. Restore connectivity afterward.
5. Repeat online and cached-offline icon launch on a fresh test install. If there is no preserved old install, mark existing-install recovery BLOCKED.
6. If a supported existing notification/deep link is available, open it and verify its intended destination. Do not grant new notification permissions just to manufacture this evidence; mark the case unavailable if needed.

Expected: no Chrome `ERR_FAILED`; app shell and existing data load; root and manifest launch route are usable; eligible cached offline boot works; supported deep-link destination is preserved. Evidence: video, data marker before/after, loaded revision and install age. The [#304 status comment](https://github.com/pedrochagasmaster/repforge/issues/304#issuecomment-6167172803) says code is fixed; physical verification remains open.

### P02 — Focus keyboard visibility [P0; #300]

Devices: real iPhone and Android; installed mode, plus browser mode if used. EN and PT-BR.

1. Start a test workout and enter Focus with an open set, preferably Leg press to match the original report.
2. Tap Load. Pause **before typing** and capture the keyboard/field boundary.
3. Type a valid load. Move to Reps, then RIR, edit each, and move among the three several times.
4. Dismiss the keyboard, reopen it and dismiss again. Check the shelf and page position after each cycle.
5. Log the set and move to another exercise; repeat on the compact device configuration.

Expected: the complete active field is above the keyboard before the first character, remains visible while typing, and switches without cumulative/erratic scrolling. Dismissal restores normal layout without a residual scroll offset. Record keyboard type and actual video, not CSS-variable simulation. [#300](https://github.com/pedrochagasmaster/repforge/issues/300) remains physical verification despite its code fix. If testing #443, name its exact adopted revision; green #443 CI alone does not prove it is in #448.

### P03 — iPhone install-transfer handoff [P0; #424/#425]

Device: real iPhone, Safari 17.2+ to installed Home Screen app. Use backed-up synthetic data.

1. Record the Safari source's program and history marker, and its build. Confirm the destination is a disposable test install before deleting it.
2. Remove that test Home Screen app. In Safari open the selected origin and confirm the candidate is loaded.
3. Choose “Install and transfer my data,” review/accept the actual disclosure, then Share → Add to Home Screen → Add within the one-hour transfer window.
4. Open the new Home Screen app and observe claiming/import completion.
5. Compare the installed program and history to the source marker; close/reopen and verify persistence. Return to Safari and record its recovery-snapshot state.
6. For final architecture acceptance, verify the installed destination's loaded build and repeat its eligible offline reopen after successful online caching. Record source and destination separately if revisions differ.

Expected: one successful handoff, correct program/history, no empty “No program yet” destination, no duplicate or partial import, and source recovery state. Never publish the handoff token. This checks the ordinary physical handoff; interrupted-import, divergence and restored-storage gates still need their own documented evidence. Steps derive from [#424](https://github.com/pedrochagasmaster/repforge/pull/424).

### P04 — Setup link through private Safari [P0; #425/#424 step 6]

Device: real iPhone, a private Safari tab and a fresh/disposable Home Screen destination.

1. Prepare a non-sensitive known setup program and record its expected name/days/exercises separately from its full link.
2. Safely remove the test Home Screen app. In private Safari open the setup link.
3. Use Add to Home Screen, then open the installed app from its icon.
4. Verify the displayed program against the fixture before starting anything.

Expected: installed app opens on **“Start this program”** with the intended program, not the empty hub or unrelated existing program. Record iOS/private-tab behavior exactly; inability to complete the install path is BLOCKED/FAIL, not permission to substitute a normal-tab pass. This remains unchecked in #425.

### P05 — Focus shelf, field order and RIR persistence [P0 data / P1 layout; #427]

Devices: iPhone and Android; EN/PT-BR; include a per-side exercise.

1. Open Focus with keyboard hidden. Inspect the bottom edge and space below Log set.
2. Check fields in order: Load → Reps → RIR/effort. Check ordinary and per-side labels; units must appear once.
3. Note the RIR shown on a new metric-backed set. Log without touching RIR, then finish/save the test session.
4. Open its History and summary; reload and recheck saved RIR.
5. Log another set and skip/finish rest. Inspect headings/cues beneath the progress segments.

Expected: shelf surface reaches the bottom with no grey strip or unused block, while respecting usable safe-area padding. No partial heading/cue cut under segments. Logged RIR equals what was shown; no false “No RIR” for that new set. Old pre-fix rows with missing RIR are **not** automatically repaired and must not be used to fail this new-write test. See [#427](https://github.com/pedrochagasmaster/repforge/pull/427).

### P06 — Short and long session summaries [P1; #423/#427]

1. Save a test session with only one logged set. Inspect the short summary without scrolling.
2. Save another session with enough entries to overflow the summary. Inspect its top, middle and bottom.
3. Repeat in light/dark, including the iPhone home-indicator edge.

Expected: “Session saved” bar meets the bottom on the short report; it remains pinned/useful on the long report and ends at the bottom. It is edge-to-edge, with no unintended white bottom band. Keep the October 17 screenshot evidence separate from these fresh results.

### P07 — Layout D and logged-set correction [P1; #436]

1. Open Focus. Tap the exercise name in the top bar and verify its stats/history; return.
2. Log set 1 of an exercise with at least three sets. Check the collapsed table, then tap “1 set logged ›”.
3. Correct set 1 and save. Reopen, edit and cancel. Navigate to another exercise and back.
4. Check the last open set and a finished exercise. If assistive technology is available, check “Exercise N of M” is announced.

Expected: exercise name is in the header; long names use at most two lines without growing the header. Compact shelf remains usable. Collapsed table shows current + next set; last set has just the open row; finished exercise retains full ledger. Disclosure shows logged sets; correction persists on Save, Cancel does not change it, and it collapses after Save/Cancel or navigation. See [#436](https://github.com/pedrochagasmaster/repforge/pull/436).

### P08 — Rest visibility inside/outside Focus [P1; #436/#440]

1. Start rest, with “hidden today” showing where the fixture supports it. On a compact phone inspect the entire clock line and open row.
2. While rest runs, visit Today, Progress, History, Program and the Program editor. Scroll each to its last control.
3. On Today inspect Start/Continue at multiple scroll positions. Repeat with larger text and after rest ends.

Expected: the Focus clock remains visible despite the hidden-today bar; outside Focus no final control sits beneath the floating rest pill; Today's Start/Continue stays above it. Larger text remains reachable. Reducing the hidden-today bar's size is a separate optional decision, not this test's requirement.

### P09 — iPhone status bar and Today copy [P1; #440]

1. In the installed iPhone app, scroll Today, Progress, History, Program and its editor from top to bottom in light/dark.
2. On Today use a long exercise name, preferably “Plate-loaded machine hip thrust (starting from the bottom)” and its PT equivalent.
3. Check manual-target rows and one/multiple manual-exercise tallies.

Expected: content never shows through the clock/status-bar band; names wrap at normal word boundaries and remain readable; manual target reads sets × range; tally reads “1 exercise with your own targets” / “N exercises with your own targets,” or the approved Portuguese equivalent. Onboarding's own full-screen scroller was explicitly unverified in #440: inspect it as an additional observation and do not infer it passed from the tab checks. See [#440](https://github.com/pedrochagasmaster/repforge/pull/440).

### P10 — Manual load carry without unintended writes [P0; #440]

1. On a manual exercise with no programmed load, verify the first Load is blank. Log set 1 at 30 kg.
2. Inspect set 2: it should show 30 in the shelf and open ledger row, in the untouched style. Reload before logging; inspect again.
3. Log set 2 and verify History saves 30. In another run edit the carried value to 42.5 before logging and verify 42.5 is saved.
4. In another open set clear Load; try Log set. Then check a different exercise and a new session.
5. Repeat on a per-side movement at 12.5 per side. Check that warm-ups do not supply/take carry and a pre-existing programmed/edited load is not overridden.

Expected: carry comes only from the nearest preceding logged eligible set in the same exercise/session; visible carry survives reload by derivation, and is saved only on logging. Clearing stays blank and saving refuses the missing required load. New exercise/session has no carry; per-side value is unchanged. Adaptive/Suggest-loads behavior is unchanged. Proving **no durable write before Log set** additionally needs the owning exact-build automated/storage evidence; phone appearance alone cannot establish that claim.

### P11 — New engine phone sanity check [P0; #422]

1. Record a valid input recipe: split/frequency, goal, experience, equipment, duration, period, priorities/exclusions and deload choice. Use synthetic inputs.
2. Generate through the phone questionnaire and inspect Review before activation: days, exercises/equipment, sets, rep ranges, RIR and duration should fit the requested inputs.
3. Activate deliberately, enter Focus, log a valid test set, save the session and reload. Verify the program and saved metrics remain intact.
4. Repeat a compact-budget supported recipe and EN/PT-BR labels. If exercising an incompatible saved recipe, verify it refuses safely and asks for explicit Rebuild rather than silently regenerating.

Expected: no hang, impossible empty program, lost review or silent overwrite; Review alone does not activate; workout/save/reload works. A phone smoke pass does not certify all 17 frequency variants or source parity. [#422](https://github.com/pedrochagasmaster/repforge/pull/422) records historical generator 073.4 evidence on `7c4e00ec0ed7c2a1279da0671b45cf453f1525be` and successful CI [38892924926](https://github.com/pedrochagasmaster/repforge/actions/runs/38892924926); adapted native code requires its own exact-head proof.

### P12 — Modal guides, only if explicitly included [P1; conditional #435]

**BLOCKED ON SCOPE/DESIGN until L03 is resolved.** If not included, mark NOT APPLICABLE with the candidate scope reference; do not fail an unchanged candidate for lacking a separate feature.

1. On a clean guide state, enter Focus: no first-set dialog should open on arrival.
2. Tap a shelf field: first-set guide opens with one “Got it”. Dismiss it and verify the original field action happens once. Repeat separately using a pad; its step applies once after dismissal.
3. Check background controls are inert, focus starts at the title and returns correctly. With a hardware keyboard, Tab stays inside; Escape dismisses.
4. Reload to verify dismissal persists; Settings → Replay reopens it. Verify no second guide interrupts the same Focus visit.
5. Replay each of entry, first-set, focus-utilities, progress, block-transition, backup, install and privacy. On compact phones verify panel stays inside the visible viewport and text remains readable.
6. Test the **recorded controlling highlight decision** in light/dark, including the no-room/off-screen fallback if cut-out design is selected. Do not judge it against both incompatible designs.

Expected: correct single-action replay, accessibility/focus and persistent eligibility; design matches the explicit L03 decision. [#435](https://github.com/pedrochagasmaster/repforge/pull/435) proof and final native adaptation evidence remain distinct.

## 3. Launch evidence and owner decisions — separate from phone results

### L01 — Exact final architecture/candidate acceptance [DECISION / BLOCKER]

- [ ] Implementation owner supplies exact candidate SHA, complete migration ledger and independent final architecture/data review.
- [ ] Full redesigned risk suite, assembled build, offline upgrade and rollback proofs pass on that exact final candidate; final-head CI links recorded.
- [ ] Incoming-feature scope and dependencies are explicit. #437 → #442 stays ordered; #432 Lab remains isolated from the production app and its storage/precache.
- [ ] Relevant P01–P11 tests completed on the final candidate; P12 only if included. No build-unverified or missing required device run is counted as accepted.
- [ ] Owner reviews the result. Merge/deploy permission, if wanted, is a separate explicit action; this worksheet grants none.

Evidence/owner/date: ____________________

### L02 — Production install-transfer gates [DECISION / PUBLIC-LAUNCH BLOCKER]

The service went live on **14 October under an owner override**. Do not equate live availability, a scheduled watcher, static “healthy” labels or a phone handoff with independent provider evidence. Before public launch, record the evidence below or obtain an explicit owner decision accepting the unresolved gates for that launch, with scope and risks documented.

- [ ] Authenticated EU placement and SQLite processing for all four Durable Object namespaces.
- [ ] Provider-backed disposal/missed-alarm/manual-purge rehearsal; restored-SQLite review showing no full token, token-derived key or decryptable clone persisted.
- [ ] Actual billing observation; independent watchdog detection/create-kill within an agreed lag; static-host/edge/Worker log redaction; deletion-health evidence.
- [ ] Cloudflare measurements show ciphertext deleted by server minute 60 under normal and delayed-alarm cases, tombstones by minute 75, and purge backstop behavior.
- [ ] Physical Safari 17.2+ handoff evidence covers cookie handoff, storage separation, atomic import, recovery snapshot and divergence warning. Attach P03 plus any additional relevant case evidence; the historical ordinary handoff does not prove every subgate.
- [ ] Each missing gate is either supplied or explicitly named in the owner's launch override. An override does **not** turn missing evidence into PASS.

For each gate record: service/deployment identity; environment; observer/date; method; measured result; redacted artifact link; reviewer; remaining limits. Do not paste secrets or raw payloads. This is an evidence request, not an instruction to provision credentials or change production.

Sources: [ADR 0013](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/docs/adr/0013-temporary-install-transfer.md), [RUNBOOK](https://github.com/pedrochagasmaster/repforge/blob/147e4afa07fea3243efd42b5b7d167c196c6a7ca/services/install-transfer/RUNBOOK.md). Its production override supersedes the earlier create-disabled instruction operationally; it closes none of the evidence gates. The watcher remains scheduled owner self-attestation, not independent monitoring.

### L03 — Resolve guide highlight decision [DECISION / CONDITIONAL BLOCKER]

Evidence conflicts: #425 records the October 17 choice as “only Got it; first tip waits for first tap; **no highlight**.” #435's body describes Q1 as later revised by owner/coordinator to an **undimmed anchor cut-out**. Its issue comments, PR reviews and review comments were empty when read. The work sequence explicitly requires the underlying dated decision evidence before changing behavior.

- [ ] Locate the original dated owner/coordinator decision establishing the revision, with an exact source reference and scope; if unavailable, ask the owner which design controls.
- [ ] Record controlling choice: no highlight / anchor cut-out; decision date; source; included candidate SHA.
- [ ] Reconcile #441's measured contrast exception with its owner rather than accepting a permanent exception implicitly.
- [ ] Only then execute P12 against that one contract.

**Current disposition: unresolved from the inspected repository evidence.** The later PR claim is not independently verified owner authorization. No design choice is made here.

### L04 — Portuguese exercise names [DECISION / FINISH]

- [ ] Resume the owner's equipment-family review of [#315](https://github.com/pedrochagasmaster/repforge/issues/315); accept, edit or explicitly defer each remaining draft.
- [ ] Preserve prior progress on `backup/2026-10-15/pt-name-review-progress`; do not replace it with a new empty review.
- [ ] Produce/review the approvals PR, regenerate the catalog and check no entry remains simultaneously drafted and reviewed.
- [ ] Record actual current reviewed/remaining counts, approved PR and candidate SHA. The issue's original 1,278 drafts/67 reviewed is a starting snapshot, not a verified current count.

Owner/date/evidence: ____________________

### L05 — Plan 059 stays held [DECISION]

- [ ] Refresh [Plan 059](https://github.com/pedrochagasmaster/repforge/blob/main/plans/059-public-launch-ui-validation.md) against the final app, open decisions, current tooling and evidence above.
- [ ] Obtain the owner's explicit authorization to start. Its existing hold is not lifted by completing this checklist.

Owner decision/date/source: ____________________

## 4. Preserve historical completed evidence

Do not uncheck these historical completions or silently relabel them as current-candidate passes. The source is #425; exact historical phone build identity is not supplied there.

- **2026-10-17:** owner confirmed install transfer works on a physical iPhone. Preserve as historical ordinary-handoff evidence; final changed transfer/offline boundaries require a new candidate run.
- **2026-10-17:** owner screenshot review confirmed #423's edge-to-edge “Session saved” bar and no white summary bottom. Newly found faults went to #427.
- **2026-10-17:** workout layout “combine all” option D chosen. The guide highlight portion requires L03 reconciliation.
- **2026-10-18:** Program editor design A with recommendations and all 25 wording phrases approved. This is design approval, not certification that #437/#442 shipped or passed on #448.
- Historical #422 exact-head generator/CI evidence is retained under P11. It cannot certify later adaptations.

## 5. Optional timing choices and postlaunch work

These must not silently become acceptance requirements or unapproved features.

- Optional copy: “tempo com treinos” / “time on programs” → “tempo treinando” / “time lifting.” Record keep/change and candidate if changed.
- Optional [#438](https://github.com/pedrochagasmaster/repforge/issues/438): update landing workout screenshots to the new layout.
- Optional hidden-today bar: decide whether to shrink its roughly 74 px band. P08 still requires the clock to remain visible without this redesign.
- [#314](https://github.com/pedrochagasmaster/repforge/issues/314) storage compaction: decide before/after launch. If before, require a separate compatibility plan and new validation before Plan 059 refresh; it is not an implicit architecture prerequisite.
- Parked after launch: #296 illustration style; #282 social strategy; legacy Custom route removal one release after onboarding B.

Decision/owner/date/source for any selected change: ____________________

## 6. Two independent follow-up records

### F01 — 22 October private-document cache expiry

Due **2026-10-22**, from #425: verify that the two Pages-cached private documents have expired. Identify the two exact documents through the existing private incident record; do not invent URLs or reproduce private content in this public-ready worksheet. Record redacted check method, response/cache evidence, time and outcome separately for each. Due-time verification is NOT RUN here; no automated check has been scheduled by this document.

### F02 — #338 reliability evidence, not an expiry task

[#338](https://github.com/pedrochagasmaster/repforge/issues/338) is **closed in GitHub**, but its [latest investigation comment](https://github.com/pedrochagasmaster/repforge/issues/338#issuecomment-6105309234) says “Not fixed; leaving this open.” Preserve that status/evidence mismatch: a loaded reproduction captured a renderer crash; its cause and applicability to phones remain unproven. #339 was risk reduction, not a demonstrated root-cause fix; diagnostics were the next evidence step. Do not report “fixed” from closure alone, and do not automatically reopen it.

If a phone/CI recurrence appears, record exact build/device/state and failure-time diagnostics, then route to the reliability owner. F01's October 22 deadline belongs only to private-document expiry; it is unrelated to this renderer investigation.

## 7. Final owner review record

```text
Candidate SHA and deployment identity:
Required device runs and evidence:
P01–P12 results (N/A requires explicit scope reason):
Unresolved failures/blockers and responsible owner:
Launch evidence L01–L05 and explicit overrides, if any:
Optional changes included/excluded:
Historical evidence retained separately: yes/no
Owner review outcome and source/date:
Plan 059 start authorization: pending / explicit source
Merge/deploy/public-launch authorization: not granted by this checklist
```

Successful phone checks establish the recorded behaviors on those phones/builds only. They do not replace exact-head CI, independent migration review, provider retention evidence, or the owner's release decisions.
