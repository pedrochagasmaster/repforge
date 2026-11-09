# Plan 078: the effort ladder, two stages

Status: **approved in substance by owner decisions D-3 and D-15 (2026-11-08)**; the technical defaults
marked *proposed* below are taken unless the owner objects in the PR; copy is reviewed in each PR (#315
process). Docs only.
Source: `docs/coach-layer-strategy-2026-11-08.md` §3.2 and §10 (D-3, D-15), amending Plan 077 OD-3, OD-4 and
OD-6 (its "Amendments (owner, 2026-11-08)" block). Step 2 of that note's §11.
Written against `main` 0fbae7b; check for drift before executing.

Out of scope: session zero and the declared priors (the next plan), the estimator (`ENGINE_VERSION` 078.x, its
own plan), the profile, the landing (D-14, its own change), any telemetry schema change, Pro.

## 1. Problem

Plan 077 PR 2 (#628) built the ladder: words (Easy / Hard / Max), reps left (0 · 1 · 2 · 3+) and RIR as a
number, switchable from the effort field's arrow menu and from Settings, with a tip that climbs a rung after
six qualifying workouts. Two things keep it from doing its job.

1. **A new install starts at the top.** `DEFAULTS.rirMode` is `"numeric"` (`app.js:1711`), a missing setting
   normalizes to numeric (`app.js:1731`), the Settings radio has RIR pre-checked (`index.html:465`) and
   onboarding never asks. Plan 077 OD-6 never suggests a stage down, so the tips never reach a newcomer: the
   lifter the ladder was built for never sees its first rung.
2. **Two stages for one quantity.** Reps left and RIR are the same number. The engine credits performed RIR
   only up to the cap of 5 (OD-23b, #624), and the mechanics doc already says nobody knows whether they had 6
   or 9 left. The numeric field's extra range is never used, so stages B and C differ only in a label and a
   bound that does nothing. The owner called this a design failure (2026-11-08).

A third, smaller thing follows from the second: the letters RIR sit on working surfaces (the column header,
"last 60 × 10 · RIR 2", "Target 8–12 reps · RIR 0–2") where a beginner meets them before any explanation.

## 2. Owner decisions (2026-11-08)

| # | Decision |
| --- | --- |
| D-3 | Words are the default stage for a new install, **and onboarding asks once**, so a lifter who already counts reps left starts on the numeric stage. Existing installs keep their setting. |
| D-15 | Reps left and RIR merge into **one numeric stage**, labelled *reps left*, chips 0 · 1 · 2 · 3 · 4 · 5+, with 5+ stored as 5 (the engine's credit cap). RIR becomes a glossary word used in explanations, never a mode or control label. |

Everything else in this plan is a technical default under those two decisions.

## 3. The two stages

| | Words | Reps left |
| --- | --- | --- |
| Control | chips Easy / Hard / Max (as today's stage A) | chips 0 · 1 · 2 · 3 · 4 · 5+ |
| Stored as | `rirMode:"effort"`, draft field `effort`, tokens `easy` / `hard` / `max` | `rirMode:"numeric"`, draft field `rir`, text `"0"`…`"5"` |
| Engine reads | 3 / 1 / 0 (unchanged) | the number; 5 is the cap |
| Provenance at completion | `effort` (unchanged) | `reps_left` for 0–4, **`reps_left_5plus`** for 5+ (new value); `prefilled` and `unsure` as today |
| Column header in Focus | Effort | Left |
| Field label | Effort | Reps left |
| Default | **yes**, for a new install | chosen at onboarding, in the menu or in Settings |
| Tip | after six qualifying workouts in words, "Try counting reps left?" (OD-6, unchanged rule) | none; there is no higher rung |

### 3.1 Storage: `rirMode` keeps its two values, `effortScale` retires. Proposed.

- `rirMode:"numeric"` now means the reps-left stage. The setup-link tuple (`shared-setup.js:29`, `886`, `916`),
  the transfer contract (`install-transfer-contract.js:856`), the draft (`workout-draft.js:617`) and the
  program-entry shared settings (`program-entry.js:912`, `1311`) all validate exactly these two values and
  **do not change**. A link from a sender on the old stage C reads as reps left on the recipient, which is
  the truthful mapping.
- `effortScale` is no longer written. `normalizeSettings` (`app.js:1731`) migrates once: a stored
  `rirMode:"effort"` with `effortScale:"reps"` becomes `rirMode:"numeric"`; then `effortScale` is deleted
  from the normalized object (`withUnknownKeys` would otherwise carry it). `stageSettings`, `effortStage`,
  `STAGE_PICK` and `stageForPick` (`app.js:1523`, `3347–3353`) collapse to two stages, `a` and `c`; the
  identifier `b` disappears from live code.
- `EFFORT_RIR` keeps the legacy tokens `r0`…`r3p` **readable** (`app.js:1517`, `workout-draft.js:14`): an open
  draft or a History row may still carry them, and `effortLabel` (`app.js:1542`) still renders them as the
  number. They are never offered again. `EFFORT_LEFT` stops being a stage's token list.

### 3.2 The reps-left control. Proposed.

- The shelf's effort field in numeric mode renders chips instead of the free text input (`app.js:9933`,
  `10983–11004`): the same `data-effchip` mechanism as the words stage, tokens `"0"`…`"5"`, the last one
  labelled `5+`. Arrow keys, Home and End step through them as `stepEffort` does for words.
- The prefill is the programmed target RIR as a chip; a target above 5 shows as 5+. The explainer pop
  (`toggleEffortPop`, words only) stays words-only: a number explains itself.
- The hidden `<input data-k="…_rir">` stays in the document for the draft handlers and validation, as it is
  today for every field; chips write to it. Voice input (`voiceInputEnabled`) that produces a number above 5
  writes `"5"`; the plan records this as the one place a typed number still enters the field.
- `setStageOf` (`app.js:9345`) returns `a` for a held or edited word token and `c` otherwise; the legacy-token
  branch returns `c` (its value is a number).
- History's RIR edit field (`history-ui.js:400–411`) stays a numeric input and keeps writing
  `effortSource:"rir"` with `rirMeasured:true`: an edit is a correction, not a logged report.

### 3.3 Provenance and the gauge

- At completion (`workout-draft.js:1453–1480`) the numeric field's source is decided by value: `"5"` →
  `reps_left_5plus`, otherwise `reps_left`. `rir` remains for History edits and legacy rows; nothing writes it
  from Focus any more. `EFFORT_TOKEN_SOURCE` is unchanged for words.
- The transfer contract's `EFFORT_SOURCES` (`install-transfer-contract.js:41`) gains `reps_left_5plus`
  (OD-24 strict validation). `isSafeLogRow` and the restore validator accept it as an enum value.
- `calibration-gauge.js` `rowQuality` (`:44–48`): `reps_left_5plus` weighs ½, like `reps_left_3plus` (a floor).
  The gauge is dissolved later (D-6); until then it must not break.
- `stageTipQualifyingWorkouts` (`app.js:6955`) counts `reps_left_5plus` with `reps_left`. Its `numbers` branch
  (rows with source `rir`) keeps excluding History-edited sessions.

### 3.4 Default and the onboarding question (D-3). Placement proposed.

- `DEFAULTS.rirMode` becomes `"effort"`; `effortScale` leaves `DEFAULTS`. A missing `rirMode` normalizes to
  `"effort"`. Existing installs are unaffected: activation writes settings in normalized shape
  (`app.js:22550`), so every install with a program has an explicit value.
- **The question is a sheet at the durable activation boundary** (`app.js:22540–22556`), the one code path
  every entry route passes through (recommend, custom, build, import, shared). It shows once per device, when
  the device has no log rows and `uiPrefs.effortChosen` is not set; it is not a program-entry step, so the
  closed `entryStep` enum and the onboarding funnel events (Plan 071) do not change. Title "How do you want to
  log effort?"; two options with one line each: *How the set felt* (Easy / Hard / Max; selected) and *Reps
  left* (0 to 5+); a Continue action. The shared route pre-selects the stage the link carries. The answer is
  written into `proposal.settings.rirMode` in the same activation commit, and `effortChosen` is set.
- Alternative the owner may prefer: the same sheet before the first **Start workout** on the device, where the
  chips are about to appear. It is more concrete and equally once-only; it is not "at onboarding". The plan
  takes the activation sheet unless the owner says otherwise in PR 2.

### 3.5 Settings, the menu and the tip

- Settings: two radios (`index.html:463–465`), `effort` and `numeric`; `settings.rir_numbers` becomes "Reps
  left (0 to 5+)"; the pull-down (`app.js:25350–25353`) lists two. `settings.effort_lede` keeps explaining the
  words in reps left and drops the "(RIR 3)" parentheticals. `SETTINGS_TELEMETRY` still reports `rir_mode`
  (`telemetry.js:200`), unchanged enum.
- The effort menu (`app.js:10611`): two stages and "Not sure for this set". `focus.effort_menu.sub_b` and
  `sub_c` collapse to one subtitle, "0 · 1 · 2 · 3 · 4 · 5+".
- The tip: `STAGE_TIP_COPY.c` and the B→C rule go. `stageTipTarget` returns `c` from `a` under the existing
  A→B rule (≥ 80 % lifter-chosen words over six workouts; snooze four weeks; the second dismissal ends it).
  `focus.stage_tip.c_*` keys are deleted; `b_body` says "0, 1, 2, 3, 4 or 5+".

### 3.6 RIR leaves working surfaces. Copy, reviewed in PR 3.

In scope (control labels, columns, prefill lines, targets): `focus.prev_line*` ("· RIR {rir}" → "· {rir}
left"; "no RIR" → "no effort"), `focus.exmeta.*` ("RIR {rmin}–{rmax}" → "{rmin}–{rmax} left"),
`focus.evidence.session|history|target|target_fatigue|what_rir`, `focus.shelf.pad_rir`, `today.target`,
`stats.table.rir`, `stats.outcome_short.missing_effort`, `validation.rir`, `exercise.understand` ("Understand
reps left"), `settings.rir_logging` lede text, `glossary.RIR` (stays, as the glossary entry that defines RIR as
reps left). PT follows the shipped term *reps sobrando* (`settings.rir_reps`).

Out of scope for this plan, listed so the sweep is not mistaken for complete: the Why reader's `why.*`
lines (explanations may say RIR), the program editor's authoring labels (`program.editor.*`, `entry.review.*`,
`review.preview.carry.rir`), the Settings progression dials (`settings.target_rir_ceiling`,
`settings.hard_rir_*`), and the import classifier's `entry.freeform.not_imported.rir_rpe`. Each is either an
explanation or an authoring surface, where RIR is the correct technical word; the owner can widen the sweep
later.

## 4. Draft safety and migration

1. **A saved row is never rewritten.** Rows with `effortSource` `reps_left`, `reps_left_3plus` or `rir` keep
   it. No migration touches `log`.
2. **The live draft keeps its vocabulary per set (OD-5).** A completed set, or a pending set the lifter edited,
   keeps its value and field. Only untouched pending sets take the new control.
3. **A device migrating from old stage B.** At boot the settings migration (§3.1) makes it `numeric`. If a
   live draft exists with `program.rirMode:"effort"` and its program was on the reps scale, boot applies
   `setRirMode:"numeric"` through the existing `draftRirModeEffect` path (`app.js:3356`) so the draft and the
   settings agree; its sets holding `r0`…`r3p` keep them and render as numbers. If the draft refuses (it is
   finishing), the settings migrate and the draft keeps its mode until the workout ends. This is the one
   migration rule that needs its own test.
4. **A device on old stage C** changes nothing in storage: `rirMode` is already `numeric`. Its open draft's
   pending sets render chips instead of the input on the next render; a typed value already in the field is a
   number and is kept.
5. **Version skew (transfer).** A row with `reps_left_5plus` sent to an app older than PR 1 fails that app's
   `isSafeLogRow` enum check, the same accepted risk Plan 077 §6.1 records for stage-B tokens: transfers run
   between installs of one origin that update together.
6. **`workout-draft.js` and the contract change in PR 1, so the Worker is redeployed from the exact merge head
   before merge** (`services/install-transfer/RUNBOOK.md`), as Plan 077 §6.1 requires.
   **Amendment (owner, 2026-11-08):** the coach-layer Worker deploys once, from the final green integration head, before PR #687 merges to main, with the owner's go-ahead. A packet merge into `integration/coach-layer` reaches no phone and needs no deploy. This is a stated exception to hard rule 18's per-PR wording.

## 5. Changes by owner module

| Owner | Change |
| --- | --- |
| `app.js` | `DEFAULTS`, `normalizeSettings` (migration, `effortScale` dropped), two-stage helpers (`effortStage`, `stageSettings`, `STAGE_*`, `stageForPick`, `stageTokens`, `tokenStage`, `setStageOf`), the numeric chips in the shelf, `stepEffort` over numbers, the menu, the tip, the Settings radios and pull-down, the activation sheet, the copy keys |
| `workout-draft.js` | Provenance by value for the numeric field (`reps_left`, `reps_left_5plus`); legacy tokens stay readable; `setRirMode` unchanged |
| `install-transfer-contract.js` | `EFFORT_SOURCES` gains `reps_left_5plus` |
| `calibration-gauge.js` | `rowQuality` weighs `reps_left_5plus` ½ |
| `index.html` | Two Settings radios; the activation sheet's markup; script revisions |
| `i18n-en.json`, `i18n-pt.json` | §3.5 and §3.6 keys; retired `focus.stage_tip.c_*`, `focus.effort_menu.sub_b`/`sub_c` merged; new sheet keys; regenerate `i18n.js` |
| `sw.js` | Cache revision and precache URLs for the touched scripts, allocated from live `main` at merge |
| `docs/progressive-overload-mechanics.md` §2 | Effort is recorded as *reps left*, in words or as a count 0–5+; RIR named once as the term's other name |
| `docs/ui-screens/README.md`, `manifest.json` | §7 frames |
| `CONTEXT.md` | Already carries *Reps left* (2026-11-08); no change unless copy review renames |

`shared-setup.js`, `program-entry.js`, `durable-state.js`, `progression-engine.js`, `effort-calibration.js`:
no change.

## 6. Tests (each red before its change)

- `test/effort-stages.mjs`: rewrite its phases for two stages. Words chips by default on a fresh device; the
  menu switches to reps left from the next set and the chips read 0 · 1 · 2 · 3 · 4 · 5+; 5+ saves `rir:5`
  with `effortSource:"reps_left_5plus"`, 2 saves `reps_left`; "Not sure" still saves `rir:null`/`unsure`;
  Settings shows two options and keeps the choice; the tip offers reps left after six words workouts and
  there is no tip on the numeric stage.
- `test/effort-provenance.mjs`: a prefilled numeric chip still records `prefilled`; the History edit still
  records `rir`.
- A new `test/effort-ladder-migration.mjs` (browser): a seeded device with `rirMode:"effort"`,
  `effortScale:"reps"` and an open draft holding `r2` boots to `numeric`, the draft takes the mode, the `r2`
  set still reads 2, `effortScale` is gone from stored settings; a device with `rirMode:"numeric"` and a typed
  `"3"` in an open draft keeps the 3 and shows chips; a fresh device with no settings has `rirMode:"effort"`.
- `test/calibration-gauge.mjs`: `reps_left_5plus` weighs ½ in A, H, W and R.
- `test/settings-groups.mjs`: the pull-down lists two values; the display reads "Reps left (0 to 5+)".
- A new browser test for the activation sheet: shown once on a device with no log, on two different entry
  routes; not shown when the device has log rows or `effortChosen`; the shared route pre-selects the link's
  stage; the chosen stage is in stored settings after activation.
- `test/i18n.mjs` parity; `test/exercise-library.mjs` revisions; the production syntax check.
- `test/landing-variants.mjs`: the proof's text comes from Focus keys, so its spots (`assets/brand/
  landing-proof-spots.json`, written by `tools/capture-landing-proof.mjs`) are regenerated in PR 3 and the
  landing frames recaptured; the page's layout does not change.

## 7. Catalog states

- `effort-stage-b` → re-scenario'd: "the field reads Reps left, the column Left, chips 0 · 1 · 2 · 3 · 4 · 5+
  with 2 chosen". `effort-menu` (workout and settings): two stages. `stage-tip`: unchanged scene, new body.
- New: `effort-choice` (onboarding flow): the activation sheet with *How the set felt* selected.
- Every frame whose text carried "RIR" on a working surface changes in PR 3 (Focus, Today, History, stats,
  the landing's proof). Frames come from CI (`tools/fetch-ci-captures.mjs`) and are committed with the PR.
- `calibration-mini`, `calibration-ring-bar`, `overview-calibration`: untouched here; they go with D-6.

## 8. PR split

| PR | Content | Worker redeploy |
| --- | --- | --- |
| 1 | The two-stage ladder: storage and migration, the reps-left chips, provenance by value, the contract and gauge enum, the menu, the Settings radios, the tip, the two tests that own them | **yes** |
| 2 | The words default and the onboarding sheet (D-3): `DEFAULTS`, the activation sheet, its test and frame | no |
| 3 | RIR leaves working surfaces (§3.6): copy in both languages, the mechanics doc §2, landing proof spots, the frame recapture | no |

PR 1 before PR 2: the sheet offers the two stages PR 1 defines. PR 3 is independent of PR 2 and can run in
parallel with it.
