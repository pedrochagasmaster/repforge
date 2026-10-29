# Plan 076: variable block length for generated programs (#564)

Status: **approved by the owner on 2026-10-29** (decisions recorded in §2). Implementation: `feat/variable-block-length`.
Source issue: #564 (split from #323; the owner asked for variable block length on 2026-10-29).
Written against `main` b0394b21; check for drift before executing.

## 1. Problem

Generate always builds 7 regular weeks, plus an optional lighter week first or last. The owner wants the
lifter to choose the length. The limit isn't in validation (definitions accept 1–12 cycles, and
`answers.block.cycles` accepts 4–12). It's in the recovered generation domain:

| Where | Rule today |
| --- | --- |
| `generation-layout.js` `supportsRequest` | `cycles === 7` with no deload, or `cycles === 8` with deload `[1]` or `[8]` |
| `program-compiler.js` `generateRecovered` | refuses outside that domain: `unsupported_generation_domain` |
| `program-compiler.js` `recoveredDoseCenters` | static path `Array(7)`; periodized path reads a 7-entry index table |
| `engine-policy.js` `periodization.indices` | linear `[6,6,4,3,2,0,0]`, reverse linear `[0,0,2,3,4,6,6]`, undulating `[6,3,0,6,2,4,0]`; the policy field bounds bound each entry to 0–6 |
| `program-entry-adapter.js` `programRequestFromAnswers` | `block_cycles_unsupported` when `answers.block.cycles ≠ 7`; maps `cycles: 7 + deload` |
| `program-review.js` block sheet | `fixedCycles: recoveredBlock(definition)` shows "Seven regular weeks…" instead of the existing 4–12 stepper |

Downstream already follows `definition.cycles`: `mesocycleLengthWeeks` is set from it at activation, and the
week line, block review, transition and recovery previews read `mesocycleLengthWeeks` and `definition.cycles`.
So the change is in generation and in one onboarding control. It doesn't reach the logging or History model.

## 2. Owner decisions (2026-10-29)

- **OD-1, range: 4–10 regular weeks, default 7.** *Approved.* Under 4 leaves too little room for a rep pattern to mean
  anything. Above 10 runs past the usual review cadence and multiplies the stored definition (≈27 KB per
  regular week for a 4-day/60 program; see #314). The draft schema keeps accepting 4–12, so the range can widen
  later without a schema change.
- **OD-2, the rep pattern at other lengths: sample the existing 7-week curve.** For week `w` of `N` regular
  weeks (1-based), use table position `round((w − 1) × 6 / (N − 1))`. At N = 7 this is the identity, so every
  7-week program stays **byte-identical**. Shorter blocks keep the curve's endpoints and drop middle steps;
  longer blocks repeat steps. *Approved* for linear and reverse linear. Undulating is a sequence rather than a
  curve, so it **repeats its 7-step pattern** (`index = (w − 1) mod 7`). *Approved.*
- **OD-3, the lighter week: unchanged rules, always at most one week.** *Approved.* It stays optional, first or last. The deload policy
  (`setRetention 0.8`, `repRetention 0.8`, `rirBonus 3`) is per-week and doesn't scale with length. Total cycles =
  N + (deload ? 1 : 0), so 4–11. Whether a long block (9–10) should get a second lighter week is left out of
  scope.
- **OD-4, where the choice lives: the result's block sheet** (*approved*), the existing "Program length and rep pattern"
  sheet. Its length stepper already exists for non-generated programs. Generated programs would show it with
  bounds 4–10 instead of the fixed line. There's no new onboarding screen, consistent with ADR 0020, which puts
  block length on the result's block row. Changing the length rebuilds with the same seed. The existing *Refazer
  o treino?* confirmation runs first when there are edits.
- **OD-5, generator version: bump `073.4` → `073.5`.** *Owner decision; this replaces the no-bump proposal.*
  The bump marks programs at the new lengths explicitly. Its consequence is user-facing:
  - **Every recipe setup link made before the release stops opening.** Decoding regenerates with the
    generator version stamped in the link. A 073.4 link on a 073.5 app (or the reverse) is refused as
    `unsupported-version`. The recipient sees the existing `setup.shared.outdated` message: "This link was
    made by a different version of Taurifer and can't be opened here. Ask the sender to share their program
    again." (PT: same key.) The sender re-shares from their installed program, which produces a 073.5 link.
  - Full-form links (Build, imported or edited programs), backups and installed programs are **not**
    affected. They carry the full definition and never regenerate.
  - **Release note** (EN/PT, owner copy review): "Program links shared before this update need to be shared
    again. Your own program, history and backups are unchanged."

## 3. Changes, by owner module

1. **`engine-policy.js`:** keep the three 7-entry tables (the default policy stays the recovered source). Add a
   pure `periodizationIndex(pattern, week, regularWeeks)` implementing OD-2. The 0–6 field bounds are unchanged.
2. **`program-compiler.js`:**
   - `recoveredDoseCenters(request, …)` returns `N = cycles − deloadCycles.length` centres through
     `periodizationIndex`. The static path uses `Array(N)`.
   - `recoveredPrescriptions` already walks `request.cycles` and consumes a normal entry per non-deload week,
     so no change is needed beyond the centre count.
   - `generateRecovered`'s domain message names the new range.
   - `GENERATOR_VERSION` `073.4` → `073.5` (OD-5). Selection doesn't change (Plan 068: identical exercise IDs
     across 3/7/12 cycles), and with OD-2's identity at N = 7, 7-week output is structurally unchanged. Two things
     do change with the version: the stamps (`generatorVersion`, `provenance.policyVersion`), and every generated
     day/slot/set ID, because `generationIdentity` hashes the generator version into the ID namespace. Installed
     programs keep their stored IDs.
   - `estimateDaySeconds` recognises `lifter_review` sets only at the current `GENERATOR_VERSION`. It must accept
     both `073.4` and `073.5`, so programs reviewed before the release keep their recovered duration estimate.
3. **`generation-layout.js` `supportsRequest`:** accept `4 ≤ cycles − deload ≤ 10`, with deload `[]`, `[1]` or
   `[cycles]`.
4. **`program-entry-adapter.js`:** drop `block_cycles_unsupported` for 4–10, map `cycles = block.cycles + (deload ?
   1 : 0)`, and keep refusing 11–12 (draft-valid, generation-invalid) with the same conflict code.
   **`program-entry.js`:** no schema change (4–12 already valid).
5. **`program-review.js`:** `fixedCycles` becomes false for generated programs. Stepper bounds come from the
   adapter (4–10 generated, 4–12 otherwise). The copy `entry.review.block.sheet.fixed_length_hint` is retired.
   `length_hint` says "4 to 10 weeks…" for generated programs, which needs EN and PT copy review (#315
   process).
6. **Catalog:** the result block sheet states change (stepper instead of the fixed line). Add a catalog state for
   a non-default length, e.g. `onboarding-recommend/result-block-5`, with role-inventory rows for the stepper.

## 4. Install transfer and setup links: owner gates

- **Worker redeploy: required.** `install-transfer-contract.js` loads `program-compiler.js` (definition
  validation) and `program-entry.js` at runtime. This plan changes `program-compiler.js`. No new request key is
  introduced (`cycles` already exists and is already validated 1–12), but the bundled code changes, so the
  Worker must be redeployed from the exact merge head **before** merging (`services/install-transfer/RUNBOOK.md`).
  Production transfers are latched off, but the gate still applies.
- **Setup links:** a recipe link (`g` form) decodes only on the generator version that made it. With the OD-5
  bump, every recipe link made before the release refuses as `unsupported-version` → `setup.shared.outdated`
  ("Ask the sender to share their program again"), the behaviour #317's 067.1 fixture already records. That's
  the release-note item in OD-5. Programs at other lengths travel as recipes like any generated program.
  Full-form links are unaffected.
- **Backups and stored programs:** unaffected. They store the full definition, and `validateProgramDefinition`
  already accepts 1–12 cycles.

## 5. Tests (each red before its change)

- `test/generation-periodization.mjs` (unit):
  - `periodizationIndex` is the identity at N = 7 for linear and reverse linear, with the OD-2 rule for undulating.
  - Endpoints are kept at N = 4 and 10.
  - A **byte-identical corpus guard** checks that every 7-week request produces the same definition as before
    (reuse the generator corpus fixtures). It compares definitions with the version stamps (`generatorVersion`,
    `provenance.policyVersion`) and the generation-derived IDs normalized, and requires them to be identical.
  - A program reviewed under 073.4 (`lifter_review` at policyVersion `073.4`) keeps the same `estimateDaySeconds`
    after the bump.
- `test/program-entry-inputs.mjs`:
  - `block.cycles` 4–10 map to `cycles = N + deload`.
  - 11–12 refuse with `block_cycles_unsupported`.
  - A stored draft at 7 still maps to the same request.
- `test/generate-program-browser.mjs`: through the real entry flow, the block sheet steps to 5 weeks, the
  rebuild keeps the seed, the result shows "5 weeks", activation stores `cycles: 5` (6 with deload), and Today
  and the block week line read "Week 1 of 5".
- `test/shared-setup-unit.mjs`:
  - A 5-week generated program encodes as a recipe and decodes to the identical definition.
  - A recipe from 073.4 refuses as `unsupported-version`, and the app shows `setup.shared.outdated` (the
    "Ask the sender to share their program again" copy). A browser assertion covers the first-run shared
    card.
- `services/install-transfer/test/worker-canonical-runtime.test.js`: a 5-week compiled definition passes the
  Worker's validation (201).
- The catalog state from §3.6, with CI-rendered frames.

## 6. Out of scope

A second deload for long blocks, lengths over 10 for generated programs, changing deload policy values, and
any change to Build/manual length (it keeps its 4–12 stepper).
