# Plan 069: Adaptive suggestions for Build programs and per-side loads

- **Status:** PLANNED — OWNER DECISIONS PENDING. Planning only; no application
  change is authorized by this file.
- **Issue:** [#318](https://github.com/pedrochagasmaster/repforge/issues/318).
- **Base:** `439a2c23` (main on 10 October 2026). File/line anchors below
  describe that commit.
- **Queue:** Not yet a backlog row. It extends Plan 067's adaptive-execution
  slice to programs and metric compositions that 067 left manual. Final
  launch and device gates stay with Plan 059.
- **Related:** Plan 068 (#323, Generate inputs, being planned in parallel),
  #317 (slot alternates), #319 (carry edits across block regeneration), and
  the backlog's Later item "Manual-slot authored load".

## 1. What is true today

Both claims in #318 are confirmed, and the per-side gap is wider than the
issue states.

**Build, import and edited slots never adapt.** Build writes every set with
`status: "manual"` and `rir: null` (`app.js:1808-1811`, `editorNewPrescription`
at `app.js:10684`). The engine treats an authored `manual` status as final
(`progression-engine.js:89-91`). It needs a finite target RIR
(`progression-engine.js:79-81`) and a rep range (`:69-78`). Build always
writes a range: it is the lifter's, or a silent 6–10 default when the row had
none (`app.js:1799-1800`, `app.js:10708-10709`). In the program editor, any
edit to a target or to the metric composition sets that set to `manual`
(`program-editor.js:313-314`, `:337-338`). Editing a generated program's rep
range therefore turns its suggestions off without telling the lifter.

**Per-side loads never adapt, on any program.** The convention reaches the
engine correctly: `metricLoading` derives `per_side` from the slot's metric
semantics (`app.js:2303-2314`). But `slotLoadingContext` always sends
`externalLoadMultiplier: null` for per-side slots, on purpose
(`app.js:5682-5689`: "Per-side loads stay manual: their multiplier is never
assumed"). The engine then answers `configuration_required` /
`per_side_convention_required` (`progression-engine.js:131-135`). No code
anywhere writes that multiplier, and no UI field asks for it.

**Many per-side compositions are not supported at all.** The engine accepts
five metric compositions (`progression-engine.js:11-17`). The catalog uses
more, and every movement in the three compositions below returns
`no_supported_capacity`, which is manual, even when generated:

| Composition in catalog | Movements | Example | Engine today |
|---|---:|---|---|
| Weight + Reps | 534 | Barbell bench press | supported (`external`) |
| **Weight + Reps per side** | **299** | Barbell lunge, single-arm DB press | unsupported |
| Reps per side + Weight per side | 179 | 45° incline dumbbell press | `per_side`, blocked by null multiplier |
| Reps | 136 | Push-up | supported (`bodyweight`) |
| **Reps per side** | **65** | Assisted pistol squat | unsupported |
| Weight per side persistent + Reps per side | 25 | B-stance DB RDL | `persistent_per_side`, blocked |
| Reps + Assistance weight | 21 | Assisted pull-up | supported |
| **Reps + Weight per side** | **16** | Dual kettlebell RDL | unsupported |

(Counts are from `assets/exercise-catalog.json` `exerciseMetrics`. Duration
and distance compositions remain out of scope, as Plan 067 states.)

**Per-side work is also missing from History, Progress and CSV.** For any
composition without both `loadKg` and `reps`, `toHistoryRows` writes
`row.load`/`row.reps` as `null` and keeps the values only in `metricValues`
(`workout-draft.js:1575-1576`). Every downstream reader uses the flat
fields:

- `historyHasLoadAndReps` drops these rows from session volume
  (`history-ui.js:101-104`, `:602-604`).
- PR and e1RM indices filter on `+r.load>0 && +r.reps>0`
  (`history-ui.js:165,181`; `app.js:9127-9138`).
- Progress's `isWorkingRow` excludes them from working-set counts, strength
  evidence and PRs (`progress-model.js:187-188`).
- CSV export writes empty load, reps, e1RM and tonnage
  (`app.js:12018-12036`).

No test under `test/history*`, `test/progress-*` or the CSV tests covers a
per-side row. JSON backup and install transfer keep the full metric values,
so no data is lost. The data is only invisible.

**Surfaces describe manual slots inaccurately.**

- Focus shows "Manual · aim for 6–10 reps" (`app.js:7520-7521`) even when
  6–10 is Build's silent default.
- The Why sheet's manual block says "The program sets this load. Taurifer does
  not change it." (`why.manual`, `app.js:18592`). No Build slot has an authored
  load (see the backlog's "Manual-slot authored load"). A generated per-side
  slot does not have one either; it is blocked only by configuration. The
  sentence is false in both cases.
- `recommendation()` folds `configuration_required` into `manual`
  (`app.js:5713-5724`). The reason codes are attached to the result but never
  shown.
- Needs-attention filters to up/down moves (`app.js:9686-9705`), so these
  slots never appear there. Since they have no suggestion, that is correct.

**What already protects the lifter's values.** In a session, the DraftV2
`touched` map fills only fields the lifter has not touched
(`workout-draft.js:1266-1354`, `app.js:5961-5986`). At the program level, a
Build program is never regenerated (`program-transition.js:235-236`), and an
edited generated set becomes `manual`. This plan keeps the in-session rule
unchanged and refines the program-level rule (decision D3).

**What needs no schema change.** The compiler already accepts `status:
"ready"` with a finite `rir` on a Build (`role: "manual"`) slot whose metrics
come from the source catalog. It forces `manual` only for user-defined
metrics (`program-compiler.js:1378`). `slot.executionMode` (`bilateral |
unilateral | null`) is already part of the slot schema (`:1309`). Setup links
carry `status`, `rir` and `executionMode` (`shared-setup.js:32-41`). Backups
store state raw. Install transfer accepts any valid per-side multiplier
(`install-transfer-contract.js:1046-1063`, `workout-draft.js:246-257`).

## 2. Model

### 2.1 Which prescriptions can drive a suggestion

A set can receive a suggestion only when all of the following hold. The
editor and the Why sheet name the first one that fails.

| # | Requirement | Where it comes from | If it is missing, the lifter sees |
|---|---|---|---|
| R1 | A catalog movement (source-catalog metrics) | Slot | "Custom exercises use the targets you set." Manual. |
| R2 | A supported composition (§1 table plus the three added in S3) | Catalog | "Taurifer doesn't suggest loads for timed or distance work." Manual. |
| R3 | A rep target (a range, or a single number) | Slot, per cycle and set | The opt-in control is unavailable until a range is set. |
| R4 | A target RIR (0–4) on every set | Slot, per cycle and set | The opt-in control requires it. No default is invented. |
| R5 | A loading convention, and for per-side loads a known execution mode | Catalog laterality, else the lifter's answer | "Tell Taurifer how you do this: both sides together, or one side at a time." Configuration required. |
| R6 | A bodyweight, when the movement counts bodyweight | Session or latest logged bodyweight | Existing `bodyweight_required` copy. Configuration required. |
| R7 | A load step | Per-exercise load step, else the global minimum jump | Always present. The editor shows the value it will use. |
| R8 | Comparable history | Logged sets | "New lift: pick a load for 6–10 reps." The existing `new` state; no starting load is invented (Plan 067). |
| R9 | The slot is adaptive (`status: "ready"`) | Generated by default; Build only by opt-in | "You set this exercise's targets. Taurifer doesn't suggest a load." |

R1–R7 are fixed in the program. R8 resolves itself after the first logged
session. The engine's existing `no_candidate_*` result (a range that the load
steps cannot reach) keeps its manual result and its equipment/range
explanation.

### 2.2 Opting in (Build, import, and generated slots made manual by an edit)

- **Granularity:** per slot. The switch applies to every set in every cycle
  of the slot. There is no program-wide switch in 069 (D1).
- **Control:** in the editor's per-exercise details, a switch labelled
  "Suggest loads". Turning it on shows the exercise's rep range and its RIR
  field together and requires both. The rep range is prefilled with the stored
  value and labelled as the current target. That includes Build's 6–10
  default, so the lifter confirms the default rather than inheriting it
  unseen. RIR starts empty (D2). The switch also shows the load step it will
  use (R7). For an asymmetrical per-side movement it asks for the execution
  mode (R5).
- **Effect:** every set in the slot gets `status: "ready"` and the chosen
  `rir`. `provenance` keeps `source: "manual"` and gains `policyVersion:
  "manual-adaptive@1"`, so the fact that the lifter turned suggestions on
  survives a round-trip. Turning the switch off restores `status: "manual"`.
  It never deletes a value the lifter typed.
- **Default:** off for new Build slots, imports and every existing program.
  Nothing changes under a program until the lifter acts.
- **Protection:** in a session, the touched-field rule is unchanged. A
  suggestion never overwrites a value the lifter typed or a completed set. In
  the program, editing the rep range or RIR of an adaptive slot keeps it
  adaptive, because those are the engine's inputs. Changing the movement or
  its metric composition turns it back to manual and says so (D3).
- **Custom exercises** stay manual (R1, D4). Their metrics have no catalog
  loading model, and the compiler forbids `ready` for them.

### 2.3 Per-side load model

One derived fact, the **load multiplier** `m`, fixes what a per-side number
means. The engine, History, Progress and CSV all use it.

- `m = 2` for a persistent per-side load, such as a dumbbell held in each hand
  through a split squat.
- `m = 2` for a per-side load done with bilateral execution, such as one
  dumbbell per hand pressed together.
- `m = 1` for a per-side load done one side at a time, such as a single-arm
  row.
- Compositions with a total `Weight` and per-side reps use `m = 1`: the
  logged weight is already the total.

The execution mode comes from catalog laterality when it is unambiguous
(Unilateral or Bilateral). Asymmetrical, mixed or unclassified movements (150 with per-side
loads or reps) use `slot.executionMode`. The generator writes it when it knows
it. In Build, the lifter answers once per slot. Until there is an answer the
slot is configuration-required, never guessed.

How each surface uses it (D5, D8):

- **Logging.** Values are stored as entered: per side, in kg. New rows capture
  `loadingContext.externalLoadMultiplier = m` explicitly.
- **Engine.** Effective load is `perSideLoad × m` plus any bodyweight
  contribution, as Plan 067 specifies. Candidates come from the per-side load
  grid. Displayed and prefilled values stay per side. Where no bodyweight
  contributes, `m` cancels out of the predicted RIR, so the suggestion does
  not depend on the multiplier choice. Where bodyweight contributes (502 of
  the 608 per-side movements have a nonzero coefficient), it does, and the
  Why sheet's loading assumptions name the rule as an approximation.
  Plan 067's unknowns ledger does not recover the meaning of the source
  coefficient.
- **History and Progress.** Tonnage is `perSideLoad × m × repetitions
  performed`, where a per-side rep count doubles under one-side-at-a-time
  execution. This gives the physically consistent figure for each of the
  examples above. PRs and e1RM compare per-side values only with history in
  the same convention, and are shown with a "per side" label in the logged
  unit. The two conventions are never converted into each other.
- **CSV.** Add `load_per_side` and `reps_per_side` columns and fill `tonnage`
  and `e1rm` from the same derivation. Existing columns keep their meaning
  (D9).
- **Existing logs.** Nothing is rewritten; workout history is immutable
  (the rule CONTEXT.md states under "AI proposal"). All of the above is derived when the data is
  read. A stored per-side row whose captured multiplier is `null` (every row
  logged before S3) uses the slot's current rule. A row with an explicit
  multiplier keeps it. A later change of execution mode makes the older
  explicit rows non-comparable, which matches Plan 067's comparability rule.
  There is no migration and no schema bump (D7).

### 2.4 Engine changes (bounded)

The three unsupported compositions become supported with the same formula and
the same Plan 067 policy:

- `Weight + Reps per side`: external load, rep semantic `repsPerSide`.
- `Reps per side`: bodyweight, `repsPerSide`.
- `Reps + Weight per side`: per side, `reps`.

`FORMULA_VERSION` stays `rir-adjusted-epley@067.1`. `ENGINE_VERSION` moves to
`069.1`, so explanations name the release that widened support. Nothing else
in candidate ranking, fatigue or range expansion changes.

## 3. Surface consistency

The engine status is the only source for every surface. That status is one of
recommended, new, manual, or configuration-required, and configuration-required
always carries a reason. `recommendation()` stops folding
configuration-required into manual (S1).

| Status | Focus cue | Today row | Why sheet | Needs-attention |
|---|---|---|---|---|
| recommended | Unchanged (load + reps) | Unchanged | Unchanged engine explanation | Up/down moves, as today |
| new (no history) | Unchanged "Pick a load for {min}–{max} reps" | Unchanged | Unchanged | Not listed |
| manual (not opted in) | "Your targets · {min}–{max} reps" | Sets × range · "your targets" | Says the lifter set the targets and Taurifer suggests no load, and links to the editor switch when R1–R2 allow it | Not listed |
| configuration-required | "Needs setup · {min}–{max} reps" | Sets × range · "needs setup" | Names the missing input (R4/R5/R6) and how to give it | Not listed in 069 (D10) |

No surface shows a load the engine did not produce, and none calls a target
the lifter's when Build defaulted it without being confirmed.

## 4. Sharing, backup and transfer

- **Setup links.** The opt-in travels as the existing `status`, `rir` and
  `executionMode` fields. A Build program already travels as a full
  definition. Adding RIR values makes it slightly larger. S4 measures a
  representative Build program before and after against the 3,072-character
  limit. A link that no longer fits falls back to **Share as file**, as today.
  Refusal, consent, first-run eligibility and the no-truncation rule are
  unchanged. A receiver regenerating a generated program is unaffected,
  because the generated slots were already `ready`.
- **Backups.** Raw state. A restored adaptive Build slot stays adaptive. A
  backup from before 069 restores as manual.
- **Install transfer.** Clone fidelity is unchanged. Rows with an explicit
  per-side multiplier already pass `validateLoadingContext` and the transfer
  contract. S3 adds one round-trip assertion.
- **Older cached app.** An older worker reading an opted-in program sees
  `ready` sets, which it already accepts, and per-side rows with a numeric
  multiplier, which it already accepts. No `?v=` script or `CACHE`
  compatibility problem beyond the normal bump rules.

## 5. Catalog, roles and telemetry

- **Catalog states** (`tools/ui-screens/`, `docs/ui-screens/manifest.json`,
  `tools/ui-role-inventory.json`). None goes in Plan 064's fixed list in
  `tools/check-rules-only.mjs`.
  - Update `workout/why-manual`: new scenario text matching the new copy.
  - Add `workout/why-setup`: configuration-required, execution mode missing.
  - Add `workout/focus-per-side`: a per-side target, with the "per side" label.
  - Add `program/editor-suggest-loads`: the switch on, with range, RIR,
    load step and execution mode.
  - Add `history/per-side-session`: per-side tonnage and PR.
  - Each new state gets EN/PT and `demandingText` or `localized` variants,
    like its neighbours.
- **Telemetry.** No schema change. The existing
  `set_saved.vs_suggestion = "no_suggestion"` share is the adoption measure:
  it should fall on Build and per-side work after S3/S4 (D11). No event
  carries the convention, the opt-in or the reason codes.

## 6. Slices, PRs and acceptance proofs

Every slice is its own PR, opened as a draft and stopped at owner review. Each
proof is written to fail first, at the highest realistic boundary, through
`tools/run-tests.mjs`. Browser runs on the shared devbox use
`flock /tmp/taurifer-browser.lock`.

| Slice | PR outcome | Depends on | Proofs (fail first) |
|---|---|---|---|
| **S1 Accurate non-adaptive explanations** | Manual and configuration-required are separate statuses with the §3 copy in EN/PT. Removes the false "The program sets this load". | D6 copy only | **P069-S1-WHY:** a Build slot and a generated per-side slot open Why. Neither says the program sets a load; the per-side slot names the missing execution mode. **P069-S1-CUE:** Focus and Today show "Your targets" / "Needs setup" for the same two slots. The `why-manual` and `why-setup` catalog states are recaptured. |
| **S2 Per-side reading** | History volume, PRs, e1RM, Progress working sets and evidence, and CSV include per-side rows through the §2.3 derivation, without writing to storage. | D5, D7, D8, D9 | **P069-S2-HISTORY:** log a unilateral single-arm row and a bilateral DB press, save and reload. History tonnage equals the hand-computed values, and a heavier second session shows a per-side PR. **P069-S2-LEGACY:** a fixture with rows captured with a `null` multiplier before 069 renders the same figures, and its stored bytes are unchanged. **P069-S2-CSV:** the exported columns. |
| **S3 Per-side engine** | `slotLoadingContext` sends `m`. New rows capture it. Older null rows resolve when read. The three added compositions are supported. Generated per-side slots adapt with no opt-in. | D5, D7, D12 | Engine-owned algorithm proofs first (multiplier, composition table, null resolution, mismatched mode, bodyweight on/off) in `test/progression-engine-plan067.mjs`'s successor. **P069-S3-JOURNEY:** a generated program with a DB press slot. Log session 1, and session 2 shows a per-side target, prefilled per side, with Why naming the multiplier assumption. **P069-S3-TRANSFER:** install-transfer and backup round-trip of explicit-multiplier rows. |
| **S4 Build opt-in** | The editor's "Suggest loads" switch with R3–R7, the execution-mode question, and status/RIR writes. Adaptive slots keep adapting after range/RIR edits. | S1, S3, D1–D4, D10 | **P069-S4-OPTIN:** Build → opt in on a slot (the RIR is required, the default range is shown) → log → the next session shows a target. The touched-field proof: a typed load is not overwritten after a refresh. **P069-S4-SHARE:** setup-link and backup round-trip keep the opt-in. The size of a representative Build link is recorded, and a link over the limit is refused whole. **P069-S4-OFF:** switching off restores manual and keeps the typed targets. The `editor-suggest-loads` catalog state. |

Order: S1 → S2 → S3 → S4. S2 and S3 are independent in logic but both edit
`app.js` around `slotLoadingContext`/history, so they are serialized. S1 needs
only the copy decision and can start immediately after approval. Each PR
bumps `?v=`/`CACHE` relative to the main it rebases onto, following
`AGENTS.md`.

## 7. Dependencies and coordination

- **Plan 068 (#323).** Its remaining phases change what Generate feeds the
  compiler: equipment inventory, periodization, block length and movement
  confirmations. None of them changes the prescription fields 069 consumes, so
  S1–S3 do not depend on 068. There are two seams:
  1. If 068's Equipment step records a ceiling such as "dumbbells up to X",
     that ceiling should cap the per-side candidate load grid. Whichever plan
     lands second wires it into `loadGridKg`.
  2. Generate never asks the execution mode either, so asymmetrical
     `repsPerSide` movements are never generated (`program-compiler.js:461`,
     `execution_context_required`). The question belongs in 068's Generate
     flow. S4 asks the same question in Build, with the same
     `bilateral | unilateral` values (D13).

  S4 lands after 068's Equipment slice if that slice touches `loadGridKg`.
  Otherwise S4 can land in either order.
- **#319** (carry edits across regeneration): carried RIR/range edits must
  keep `status`. With D3, an adaptive generated slot stays adaptive after its
  edits are carried. The two PRs must agree on that rule; whichever merges
  second asserts it.
- **#317** (alternates): no shared field. 069 adds none. Both touch the
  editor's slot projections (`editorSlotForRow`); rebase serially.

## 8. Risks

- **The multiplier is an approximation where bodyweight contributes.** The
  source coefficient's meaning is unrecovered. Mitigation: the Why sheet
  names the assumption, and the formula version is recorded on every
  explanation.
- **History reinterpretation.** Before S3, rows resolve with the current
  rule. If the lifter changes an asymmetrical movement's execution mode, old
  rows with a `null` multiplier are read under the new mode. Accepted,
  because the alternative is rewriting history. Rows with an explicit
  multiplier are unaffected.
- **Silent default range.** Build's 6–10 could become an engine input. The
  opt-in shows and confirms it (R3), and S1's copy stops calling it the
  lifter's own target.
- **Link size.** S4 measures it, and Share as file absorbs any overflow.
- **app.js contention** with the four parallel tracks: serialize the merges,
  and rebase and re-bump revisions at merge time.
- **Test gap.** No current test covers per-side reading; S2 adds the first.

## 9. Owner decisions

Each decision has a recommendation. Implementation waits for answers to the
decisions that gate the slice (see §6).

1. **D1 — Opt-in granularity.** *Recommend:* per slot, off by default for
   Build, import and existing programs. No program-wide switch in 069.
2. **D2 — RIR when opting in.** *Recommend:* required, starting empty. No
   default RIR is invented. The range is prefilled from the stored value and
   shown for confirmation.
3. **D3 — Editing an adaptive slot.** *Recommend:* range and RIR edits keep the
   slot adaptive, for generated and Build slots alike. A movement or metric
   change makes it manual, and the editor says so. This changes today's
   generated-program behavior.
4. **D4 — Custom exercises.** *Recommend:* stay manual in 069.
5. **D5 — Per-side multiplier rule.** *Recommend:* §2.3 (`m = 2` for
   persistent loads or bilateral execution, `1` for one side at a time).
   Name it as an assumption where bodyweight contributes.
6. **D6 — Copy for non-adaptive states.** *Recommend:* the §3 wording ("Your
   targets", "Needs setup", a Why sheet that names the missing input). EN/PT
   are reviewed in S1's PR.
7. **D7 — Existing per-side logs.** *Recommend:* no migration. Derive figures
   when reading, resolve `null` multipliers by the current slot rule, and
   capture an explicit multiplier from S3 on.
8. **D8 — History/Progress per-side figures.** *Recommend:* tonnage = per-side
   load × m × repetitions performed. PRs/e1RM per side, labelled, compared only
   within the same convention.
9. **D9 — CSV.** *Recommend:* add `load_per_side` and `reps_per_side`, fill
   `tonnage`/`e1rm` by the same derivation, and leave existing columns as they
   are.
10. **D10 — Needs-attention.** *Recommend:* no new attention kind in 069. Setup
    problems appear in Why, Focus/Today and the editor.
11. **D11 — Telemetry.** *Recommend:* no schema change. Measure through
    `set_saved.vs_suggestion`.
12. **D12 — Generated per-side slots.** *Recommend:* they adapt automatically
    after S3, with no opt-in, because they are already `ready`. This changes
    behavior for current generated programs from the next session on.
13. **D13 — Execution-mode question in Generate.** *Recommend:* Plan 068 owns
    it in Generate; 069 S4 owns it in Build, with shared values and copy.
14. **D14 — Slice order and PR count.** *Recommend:* four PRs, S1 → S2 → S3 →
    S4, each stopping at owner review.
15. **D15 — Backlog placement.** *Recommend:* add one Now row after "Truthful
    session outcomes" that links this plan. Mark S1 as a data-accuracy fix,
    and keep S2–S4 behind D1–D13.

## 10. Completion of this planning PR

This PR changes only this file. It verifies through the prose-only CI path.
No application test is claimed. The owner's answers to §9 are recorded on #318
or in this PR before S1 starts.
