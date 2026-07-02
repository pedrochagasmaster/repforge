# Plan 029: Phased roadmap — PR breakdown & dependency structure

> **Meta-plan (roadmap), not a single executable plan.** It slices the
> four-phase RepForge implementation plan (Phase 1.1 session deltas, Phase 2
> onboarding + mesocycle lifecycle, Phase 3 analytics upgrade, Phase 4 command
> parser + voice) into 19 mutually-exclusive, independently-reviewable PRs and
> orders them as a dependency DAG. Each PR listed here should get its own
> executable plan (`plans/030+`) before it is built.
>
> **Drift check (run first)**: `git diff --stat HEAD -- app.js index.html`
> Reconcile the "touches" notes below against live code before writing any
> child plan.

## Status

- **Priority**: P2 (roadmap sequencing)
- **Effort**: XL in aggregate (19 PRs; individual sizes noted per PR)
- **Risk**: MED (Phase 2 is a data-model touch; Phase 3 restructures Stats)
- **Depends on**: none (planning artifact)
- **Category**: direction (roadmap)
- **Planned at**: 2026-07-02
- **Source**: user-provided "RepForge Implementation Plan" (Phases 1.1–4)

## Decomposition principles

- **Mutually exclusive**: each PR owns a distinct code region (a set of
  functions in `app.js` and/or DOM regions in `index.html`). Two PRs at the
  same DAG level never edit the same function.
- **Engine before surface**: pure/computational helpers land first as a
  foundation PR; each UI surface that consumes them is its own PR. This keeps
  the hot path (`renderWorkout`, `saveWorkout`) low-risk and lets surfaces
  parallelize.
- **Verification gate per PR** (repo convention, see `plans/README.md`):
  `node --check app.js` (exit 0) + `cd test && node simulation.mjs`
  (`FAILED: 0`), each PR adding its own checks to `test/simulation.mjs`, plus a
  manual smoke on the affected tab.
- **Guardrails inherited**: local-first, no backend/deps, no sixth nav tab,
  protect Log-tab speed. Phase 3 stays inside the `#stats` view; Phase 2
  onboarding is a first-run / Settings-triggered view, not a nav tab.

## Reconciliation with existing docs

Phase 2 overlaps in name only with `plans/024-mesocycle-blocks.md` (DRAFT) and
`docs/design/mesocycle-blocks.md`: those cover per-row **block tagging** (a
`block` string on log rows), a narrower feature than this
onboarding + `mesocycleStatus`/`programHistory` lifecycle. Treat 024 as either
superseded by P4–P9 or kept as a separate optional PR — do **not**
double-implement a block concept.

## Dependency graph

```
Phase 1.1
  P1 (delta engine) ──┬─▶ P2 (write surfaces: finish toast + history card)
                      └─▶ P3 (browse surfaces: log preview + stats table)

Phase 2
  P4 (schema + migration) ──┬─▶ P5 (program-gen engine) ─▶ P6 (onboarding UI)
                            └─▶ P7 (mesocycle lifecycle) ─▶ P8 (block review) ─▶ P9 (next-block + history)
  P1 ─────────────────────────────────────────────────────▶ P8

Phase 3
  P10 (analytics shell) ──┬─▶ P11 (This Week)      ◀── P1
                          ├─▶ P12 (strength dash)
                          ├─▶ P13 (volume dash)
                          ├─▶ P14 (PR timeline)
                          ├─▶ P15 (attention board) ◀── P1
                          └─▶ P16 (Review tab)      ◀── P8

Phase 4  (independent of Phases 1–3)
  P17 (parser core) ─▶ P18 (apply + command bar) ─▶ P19 (voice wrapper)
```

Key cross-phase edges: Phase 3's `This Week` / `attention` / `Review` and
Phase 2's `block review` all reuse the Phase 1.1 delta engine
(improved/flat/regressed/stalled counts). The Phase 3 `Review` tab reuses Phase
2's `buildBlockReview`. Phase 4 shares no functions with Phases 1–3.

## Phase 1.1 — Session Deltas

- **P1 — Delta engine (foundation)** · S/M
  - Adds pure helpers near `sessionsFor`/`summaries`: `workingRows`,
    `exerciseSessionMetrics`, `previousSessionForExercise`, `buildSessionDelta`,
    `compareExerciseSession`, `formatDelta`, and `DELTA_THRESHOLDS`.
  - Reuses `matchLift`, `isWork`, `e1rm`, `median`, `avg`. No UI, no schema
    change. Exposes `window.__repforgeTestDeltas()` + simulation fixtures
    (new-lift, same-load-more-reps, higher-load-fewer-reps, warmup-ignored).
  - Depends on: `main`.
- **P2 — Delta write surfaces** · S
  - Extends the finish toast in `saveWorkout` (`"… 4 improved, 1 flat."`,
    PR-aware) and the History session-card summary in `renderHistory`
    (`"3 improved · 2 flat · 1 new"`).
  - Depends on: P1.
- **P3 — Delta browse surfaces** · M
  - Adds the compact `vs last: +2 reps · e1RM +3kg` preview in `renderWorkout`
    (draft-driven) and the "Recent session deltas" table in `renderStats`
    (inside `#statsDeep`).
  - Depends on: P1. Mutually exclusive with P2 (different functions).

## Phase 2 — Guided Onboarding & Mesocycle Lifecycle

- **P4 — Schema + migration (foundation)** · M
  - Extends `defaultProgramMeta`/`normalizeProgramMeta` with `goal`,
    `experience`, `daysPerWeek`, `splitType`, `equipment`, `priorityMuscles`,
    `sessionLength`, `mesocycleLengthWeeks`, `mesocycleStatus`, `completedAt`,
    `onboarded`; adds optional `Exercise` fields (`libraryId`,
    `progressionType`, `targetRirStart/End`, `minSets`, `maxSets`, `priority`)
    with defaults so old backups still load; adds `programHistory: []` default
    and its backup round-trip in `normalizeLoaded`/`applyState`/`importJson`.
  - Ships `CONTEXT.md` domain terms (Mesocycle, Block review, Generated
    program).
  - Depends on: `main`.
- **P5 — Program generation engine** · M
  - Adds `EXERCISE_CATALOG`, `DAY_TYPES`, `generateProgramFromOnboarding` +
    `resolveSplit`/`exerciseSlotsForDay`/`chooseExercise`/`applyPriorityMuscles`/
    `applySessionLength`. Pure, produces a `Program`-compatible list. Simulation
    fixtures per split/day count.
  - Depends on: P4.
- **P6 — Onboarding UI** · L
  - New `#onboarding` view in `index.html` + 8-step flow, first-run detection
    (`!programMeta.onboarded && log.length===0`), Settings → "Create new
    program" entry; Review step wired to P5 output and to the existing
    program-persist path.
  - Depends on: P5.
- **P7 — Mesocycle lifecycle** · M
  - Adds `mesocycleWeek()` (`{current,total,isFinalWeek,isComplete}`) alongside
    `programWeek`; updates Log/Program headers to "Week X of Y"; end-of-block
    trigger + "End block" action.
  - Depends on: P4. Mutually exclusive with P5/P6.
- **P8 — Block review** · L
  - Adds `buildBlockReview(programMeta, program, log)` + deterministic
    recommendation rules and the review UI/prompt. Consumes P1's delta engine
    for improved/flat/regressed/stalled counts and existing `completedHardSets`
    for volume compliance.
  - Depends on: P7, P1.
- **P9 — Next-block flow + history** · M
  - Adds `completeCurrentProgram(review)` and `startNextMesocycle(strategy)`;
    pushes to `programHistory`, mints a new `programMeta.id`; the 5 strategy
    actions.
  - Depends on: P8.

## Phase 3 — Analytics Upgrade

- **P10 — Analytics shell (foundation)** · M
  - Adds time helpers `weekStart`/`weekRange`/`sessionsInRange` and the
    segmented control inside `#stats` (Overview / Strength / Volume / PRs /
    Review) that gates existing content and the new sections. Structural
    refactor of `renderStats` into per-segment renderers. No sixth nav tab.
  - Depends on: `main` (best landed after P1 to avoid re-touching Stats twice).
- **P11 — This Week** · M — `weeklySnapshot` + status labels + This Week card in
  the Overview segment. Depends on: P10, P1.
- **P12 — Strength dashboard** · M — `strengthDashboard` table (best/latest
  e1RM, block delta, PRs, signal). Depends on: P10.
- **P13 — Volume dashboard** · M — `volumeDashboard(windowDays)`
  planned-vs-completed 7d/28d table extending `completedHardSets`. Depends on:
  P10.
- **P14 — PR timeline** · M — global timeline + filters built on existing
  `detectPRs` (upgrade from per-lift `renderPRs`). Depends on: P10.
- **P15 — Attention board** · M — extend `renderAttention` groups (add /
  stalled / untested / not-recent / volume-low / fatigue) with "why" copy.
  Depends on: P10, P1.
- **P16 — Review tab** · M — live `blockSnapshot` + `buildPlainSummary` reusing
  P8's `buildBlockReview`. Depends on: P10, P8.

P11–P16 are mutually exclusive (each owns one segment renderer) and
parallelizable once P10 lands.

## Phase 4 — Text Command Parser & Progressive Voice

- **P17 — Parser core (foundation)** · M — `normalizeCommandText`,
  `parseSetCommand` (regex layers + numeric fallback), structured ok/error
  output. Pure; heavy simulation coverage from the plan's testing matrix.
  Depends on: `main`.
- **P18 — Apply + command bar** · M — `resolveExerciseFromCommand`,
  `applyParsedCommand` (writes draft, respects filled sets), `#commandForm` on
  the Log tab, Focus-mode targeting. Depends on: P17.
- **P19 — Voice wrapper** · S — `SpeechRecognition` feature-detected mic button
  (hidden when unsupported), `settings.voiceInputEnabled`/`commandParserHints`,
  privacy copy. Depends on: P18.

## Recommended sequencing

Critical path is Phase 2. A sequence that respects the DAG while allowing
parallel work at each level:

```
P1 → P4 → P17
   → (P2, P3, P5, P7, P10 in parallel)
   → (P6, P8, P11–P15, P18 in parallel)
   → (P9, P16, P19)
```

- Phase 4 (P17 → P18 → P19) can proceed on its own track anytime; it shares no
  functions with Phases 1–3 (only Log-tab real estate with P3's preview — a
  layout note, not a code dependency).
- Minimum viable first slice: **P1 + P2** delivers visible session deltas with
  no schema change and minimal risk.

## Next step

Write per-PR executable plans (`plans/030+`) in DAG order using an existing
plan (e.g. `plans/024-mesocycle-blocks.md`) as the template: status header,
current-state excerpts with `file:line`, scope in/out, steps with per-step
verification, simulation checks, done criteria, STOP conditions.
