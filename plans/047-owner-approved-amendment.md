# Plan 047 owner-approved amendment — 2026-08-28

**Status:** APPROVED; implementation authority  
**Base plan:** `plans/047-taurifer-program-families-compiler.md`  
**Canonical design:** `docs/plan-047-owner-approved-design.md`  
**Progression amendment:** `docs/progression-effort-target-v1.md`

This amendment records the owner-approval gate completed after Plan 046 merged. The original Plan 047 remains useful for its repository audit, migration surface, module boundaries, persistence/export/import concerns, and general compiler architecture. Its older product-design clauses are superseded wherever they conflict with the canonical design above.

## Explicit supersessions

Implementation must not carry forward these stale assumptions from the older Plan 047 text:

1. **2/4/6-day schedules are not generated recipes.** All 2–6-day family/frequency structures are reviewed first-class authored siblings. There are twenty canonical structures.
2. **Home is not a public peer goal.** Public goals are Build Muscle, Muscle + Strength, and Strength Priority. Equipment/capability is orthogonal. Limited equipment routes internally through `home` and is presented as Train Anywhere / Treine em qualquer lugar.
3. **Home assumes bodyweight only unless equipment is declared.** Do not assume dumbbells, bands, bench, or pulling capability.
4. **The old allocation matrix is retired.** Initial work is blueprint-driven. Time is a ceiling. Maturity is primarily complexity/conservative initialization, not a crude volume multiplier. Frequency does not multiply weekly volume.
5. **Foundation has no universal 2-set/5-slot cap.** It simplifies exercise/progression complexity while preserving the selected family and required coverage.
6. **Re-entry changes sets/slot volume only.** It does not add a +1 RIR target or otherwise alter progression strategy/RIR targets.
7. **`range@1` remains the default, but not the only normal strategy.** `rep_goal@1`, `anchor_backoff@1`, `paired_exposure@1`, `manual@1`, and the graduated `effort_target@1` are used only where their approved contracts fit.
8. **Hypertrophy compounds are not universally 6–12.** The normal authored choice is 4–8 for some exercises/roles and 8–12 for others. Isolation/accessory work is 8–15 and never above 15 in the initial families.
9. **Low-volume/high-effort programming is deliberate.** Two sufficiently hard sets may be a first-class efficient prescription. Suitable low-volume hypertrophy work may use 0–2 RIR; normal hypertrophy work generally uses 1–3 RIR. Failure is never mandatory across the board.
10. **Constraint reduction order is explicit.** Remove optional/bonus work first, then use reviewed efficient two-set prescriptions where appropriate, then trim reducible assistance, then return a typed conflict. Do not silently change frequency, protected primary work, or rest below the authored floor.
11. **Slots describe training jobs, not named exercises.** Required and preferred characteristics are separate. Movement pattern and muscle intent both matter. Exercise selection is deterministic and respects preferences, dislikes, continuity/history, exact machine identity, and truthful loading capability.
12. **Substitution preserves slot intent, not stale prescriptions.** A compatible substitute may use a different valid rep prescription. Structural customization is allowed but changes provenance to `Customized from …`.
13. **Browse only shows capability-complete executable programs.** Recommend/Custom may expose typed limitations and compromises.
14. **Six weeks is a stable management horizon, not an automatic periodization wave.** No scheduled deload, silent variation ladder, or weekly structural mutation.
15. **Science does not justify pseudo-precision.** Constants must be described as evidence-supported, evidence-informed implementation choice, conservative product policy, or operational estimate.
16. **Adaptive weekly volume remains out of scope.** Performance-driven set changes belong to the later intervention layer.
17. **Target-changing block modifiers remain unapproved.** The only existing block profile remains identity/no-op infrastructure unless separately approved.
18. **`effort_target@1` is now approved as a Plan 046 strategy.** It must be implemented and fixture-locked before Plan 047 blueprints reference it.

## Implementation order

1. Reconstruct and verify `main` after Plan 046 merge.
2. Implement and test the `effort_target@1` Plan 046 amendment from `docs/progression-effort-target-v1.md` without changing existing locked strategy behavior.
3. Update the executable progression-strategy fixture and strategy contract so `effort_target@1` is locked and unsupported pairings remain typed incompatible.
4. Treat `docs/plan-047-owner-approved-design.md` as the source of truth for family design and all twenty blueprints.
5. Update `docs/program-family-design.md`, fixtures, blueprint schema, compiler rules, time model, capability model, migration/persistence/provenance, and tests accordingly.
6. Preserve the useful repository/audit/migration work from the original Plan 047 unless it conflicts with the canonical owner-approved design.
7. Do not begin Plan 048 until Plan 047 is complete and its gates pass.

## Owner gate

The owner explicitly confirmed shared understanding after the full design re-pitch and then approved graduating `effort_target@1`. No additional product-design approval is required for Plan 047 unless implementation exposes a genuine contradiction that these documents do not resolve.
