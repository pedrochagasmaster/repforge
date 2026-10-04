# ADR 0017: Function-aware program generation

- **Status:** Accepted
- **Date:** 2026-10-03
- **Decision owner:** Plan 065

## Context

The quantitative [program-generation audit](../audits/program-generation-2026-10-03/README.md) and [coaching-quality audit](../audits/program-generation-2026-10-03/coaching/README.md) ran on 3 October 2026. Their findings and the resulting implementation are recorded in [Plan 065](../../plans/065-program-generation-engine-overhaul.md).

## Decision

1. **D1 — Home 4/5/6 “Mixed coverage” slots:** Three distinct jobs: `home_coverage_lower`, `home_coverage_upper`, `home_coverage_trunk_calf`. Each picks the function the week has trained least. Day labels unchanged.
2. **D2 — Session over budget with a repeated accessory:** First swap it for a complementary exercise (`reselect_redundant`); if none exists, remove it (`omit_redundant`). Both are disclosed reductions.
3. **D3 — Returning lifters:** Returning week 1 removes one set from protected compound and volume-counterpart slots, never below the class minimum (2), never from heavy primaries. Weeks 2+ unchanged.
4. **D4 — Muscle priority behaviour:** Rank priority-primary exercises higher and add +1 set to one eligible slot per session per priority muscle, never above the class maximum of 3. Always disclose when nothing could be added.
5. **D5 — Unassisted chin-ups, dips, glute-ham raises, inverse leg curls, hanging leg raises:** Default only when the lifter logged or requested the exercise; otherwise only as last resort, and then with the `capability.demanding_exercise_selected` limitation.
6. **D6 — Bands:** Add eight anchor-free band exercises. They progress with `range@1` (reps within range; no kilograms).
7. **D7 — Machines as heavy anchors:** Leg press, hack squat machine, Smith squat, Smith bench and chest press machine are heavy anchors with an authored 3–12 practical range. D19 adds two hinge anchors.
8. **D8 — Bodyweight-only posterior work:** Add bodyweight glute bridge and single-leg glute bridge. If nothing genuine fits, leave the slot empty with `home.posterior_capability_unavailable`. Never a quad exercise.
9. **D9 — Foundation heavy anchors with a full gym:** Barbell back squat and barbell bench press remain Foundation's heavy knee and press anchors. Trap bar deadlift is the Foundation hinge anchor. Lunges and decline presses are never Foundation defaults.
10. **D10 — Balanced 4 “Lower volume” ordering (Q09):** Keep hinge first. Q09 is closed as intentional.
11. **D11 — Who authors the coaching data:** This plan authors all of it (`tools/exercise-compiler-data.json`, reviewed through `plans/065/exercise-compiler-data.md`). Executors copy it; they never edit values.
12. **D12 — Time pressure:** One-set work is acceptable under time pressure; proximity to failure compensates for lost volume. Order: trim to class floor → remove whole accessories → reduce reducible compounds to one set at the efficient RIR. Every step is disclosed; exported bounds stay consistent.
13. **D13 — Set ceiling for priorities:** Stays at 3. When every eligible slot is already at 3 sets, report `priority.at_set_ceiling`.
14. **D14 — Execution shape:** One implementation PR from a verified patch, then one documentation/closure PR. No intermediate slices, because test literals are only valid for the final engine.
15. **D15 — Bonus set on an efficient (2-set, 0–2 RIR) slot:** Becomes the normal prescription: 3 sets at the normal RIR (1–3, Foundation 2–3). Removing the bonus restores the efficient RIR. Sets and RIR stay a reviewed pair (design §6).
16. **D16 — Any slot reduced to one set:** Takes the class's efficient RIR range (0–2; Foundation 2–2).
17. **D17 — Inverse leg curl:** Classified `demanding` (same treatment as the glute-ham raise).
18. **D18 — Sequencing:** All of this lands before Plan 059, in parallel with Plan 064.
19. **D19 — Machines-only Strength hinge anchor:** Machine deadlift (`dld_mc`) and Smith machine deadlift (`hg_sm`) are hinge anchors with a 3–12 range, so machines-only Strength compiles.
20. **D20 — Relation alignment on Balanced 6:** Keep compiler-2 behaviour: a volume slot aligned to its heavy partner takes the non-efficient prescription even when authored efficient. Fixing it changes transition relation semantics; deferred as X09.
21. **D21 — Rule B recovery allowlist:** Re-pin the two existing allowlisted misses to compiler-3 totals: `growth_2_v1` 31/12 (38.7 %) and `growth_3_v1` 47/17 (36.2 %). The same two blueprints remain the only misses and every other blueprint stays in band.
22. **D22 — Blueprint version:** `VERSIONS.blueprint` becomes 2 for all 20 structures; blueprint ids keep their `_v1` suffix because the id names the canonical structure.
## Consequences

- **Priorities often hit the ceiling.** In standard plans most priority muscles are already at 3 sets per compound, so 20/29 priority programs end with `priority.at_set_ceiling` or `priority.no_room`. Allowing more requires raising the owner-approved three-set ceiling (D13 kept it).
- **Bodyweight-only Home 5 without pulling** has a “Hip + available pull” day with one exercise (glute bridge) because its pull slot is honestly empty. Fixing it needs an authored blueprint variant.
- **X09** relation alignment drops the authored `efficient` flag on Balanced 6 volume slots (D20).
- **`beginnerFriendly`** in the picker still uses the build regex (X04).
- **Activated programs** keep compiler 2 provenance and are never rewritten. Version-pinned transitions and recovery treat them as “rules changed”, the designed path for any compiler bump.
