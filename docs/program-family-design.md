# Taurifer program-family compiler

This document describes the implemented Plan 047 contract. Product behavior is
authoritative in [the owner-approved design](plan-047-owner-approved-design.md),
the [Plan 047 amendment](../plans/047-owner-approved-amendment.md), and the
[effort-target progression contract](progression-effort-target-v1.md). The
[science ledger](plan-047-science-source-ledger.md) classifies evidence and
product-policy claims.

## Runtime modules

- `program-compiler.js` owns the pure deterministic compiler, twenty authored
  blueprints, slot contracts, catalogue normalization, time feasibility,
  capability resolution, substitution, Foundation, and re-entry schedules.
- `progression-engine.js` owns progression mathematics. Family IDs never enter
  progression evaluation.
- `app.js` preserves explicit day and slot identity plus compiler provenance in
  durable state, archives, backups, program imports, and setup proposals.
- `shared-setup.js` preserves those fields in canonical v1 and compact v3
  envelopes. Released v2 tuples remain immutable.

The compiler is an authored-blueprint resolver. It does not generate a split,
invent exercises or progression formulas, fill spare time, schedule deloads,
or mutate an activated program.

## Public and internal taxonomy

The public goals are Build Muscle, Muscle + Strength, and Strength Priority.
They map to the internal `growth`, `balanced`, and `strength` architectures.
Limited equipment is the orthogonal Train Anywhere promise and selects the
internal `home` architecture only when capability is genuinely limited. A full
home gym uses the ordinary goal architecture.

Each architecture has separately authored 2-, 3-, 4-, 5-, and 6-day siblings.
Their exact slots live in `BLUEPRINTS`; the generated fixture and test pin all
twenty structures. Frequency distributes reviewed work and is never silently
changed or used as a volume multiplier.

## Slot and catalogue boundary

A slot is a training job with a stable ID, role, movement patterns, primary and
secondary muscle intent, required and preferred exercise characteristics,
compatible prescription classes and strategies, protection/reduction status,
priority behavior, and time classes. Required properties are validated before
preferred properties are ranked.

The normalized catalogue exposes coarse, reviewable characteristics: equipment
and environment requirements, movement and muscle contribution, stability,
fatigue-demand class, loading semantics, practical rep range, primary
suitability, and setup rank. It carries no numeric fatigue score.

Candidate order is deterministic: user preference, exact movement history,
slot preferences, Foundation suitability, Home equipment clarity, primary
suitability, stability, catalogue rank, then stable exercise ID. Dislikes are
removed before ranking. Distinct machine IDs never share history.

## Prescription and progression

The prescription classes encode the approved bounds:

- Heavy primary: 3–6 reps, 2–3 RIR, 2–3 sets, at least 120 seconds rest.
- Hypertrophy compound: exercise-compatible 4–8 or 8–12 reps, normally 1–3
  RIR, 2–3 sets, and 90–180 seconds rest. Reviewed efficient two-set paths may
  use 0–2 RIR.
- Isolation/accessory: 8–15 reps, 1–3 sets, and 60–120 seconds rest.

`range@1` remains the default. `rep_goal@1`, `effort_target@1`,
`anchor_backoff@1`, and `paired_exposure@1` are selected only by authored slot
contracts. Unsupported custom semantics use `manual@1`; there is no silent
range fallback. Foundation simplifies supported work to range progression and
does not attach paired relations.

## Constraint handling

Time is a ceiling, not a target. For each session the compiler removes optional
or priority-bonus work, applies reviewed efficient two-set prescriptions where
allowed, trims reducible assistance, then returns a typed conflict. It never
shortens rest below the authored minimum, deletes protected work, redesigns the
split, reduces requested frequency, or fills unused time.

Priority first preserves required coverage and protected work. It uses only
authored priority slots and compatible capacity. Direct and indirect weekly
exposure are included in every compiled result and review fixture; they are
audit output rather than a universal maximum.

Home starts with bodyweight only. Owned equipment and environmental capability
are separate. Pulling is conditional until a safe pulling environment exists,
then it becomes protected coverage. Dumbbells rank above bands only as a final
loading-clarity preference. The compiler never invents furniture setups,
external kilograms for bodyweight, band kilograms, or exercise-variation
ladders.

## Lifecycle

Foundation preserves family, frequency, required coverage, and protected
primary intent. It removes optional complexity, prefers stable exercises and
range progression, and initializes sets conservatively within the slot bounds.
It has no universal two-set or five-slot cap and no automatic graduation.
Foundation may also lean to the conservative (higher-RIR) end of an authored
RIR range — authored `1–3` may start `2–3`, authored `2–3` stays `2–3` — but it
never invents a target, widens a range, or leaves the authored bounds
(authored `0–2` never becomes `2–3`). No Foundation-specific RIR formula.

`recent_consistency@1` supports `consistent`, `interrupted`, and `returning`.
Re-entry is optional and changes only authored set counts for the first one or
two weeks. It does not change exercise, strategy, RIR, frequency, or structure,
and it never exits early or schedules a deload.

Substitution re-resolves the slot's prescription for the replacement exercise.
An exact compatible heavy/volume relation survives; an incompatible relation
becomes structural-only. Structural user edits remain allowed but gain
`customizedFrom` provenance and `manual@1` semantics.

## Superseded assumptions audit

The pre-amendment design contained the following now-retired assumptions. None
governs the implementation or generated fixture.

| Retired assumption | Implemented contract |
| --- | --- |
| Maturity × minutes × frequency allocation matrix | Authored slot bounds, exposure review, time feasibility, then explicit reductions |
| 2/4/6-day recipes derived from 3/5-day programs | Twenty reviewed first-class siblings |
| Home as a fourth public goal with assumed dumbbells, bands, or bench | Three public goals; Train Anywhere is capability-based and bodyweight-first |
| Family-specific progression identities or silent range fallback | One global strategy registry; typed incompatibility or `manual@1` |
| Foundation capped at two sets and five slots | Conservative values within authored bounds; no universal caps |
| Re-entry adds one RIR | Set-only temporary schedules; RIR is unchanged |
| Frequency or established maturity increases weekly volume | Frequency distributes work; maturity primarily controls simplicity |
| Time budget should be filled | Time is only a ceiling |
| Priority owns a new volume budget | Priority redistributes explicitly optional/reducible capacity |
| Equipment upgrades rewrite active programs | Updates and substitutions are explicit |

The remaining old Plan 047 document is retained for history and carries a
supersession notice. Plan 048 owns user-facing Browse, Recommend, and Custom UI.

## Executable evidence

Regenerate and verify the canonical artifact with:

```bash
node tools/build-program-family-fixtures.mjs
node tools/build-program-family-fixtures.mjs --check
node test/program-family-fixtures.mjs
node test/program-compiler-persistence.mjs
node test/generative/run.mjs --profile ci --filter "program compiler"
node test/program-compiler-runtime.mjs
```

The fixture records the twenty exact structures, resolved review compilations,
direct/indirect exposure, conflicts and limitations, version pins, and the
global strategy contract. It is generated from executable source, so drift is
a failing gate rather than a documentation judgment.
