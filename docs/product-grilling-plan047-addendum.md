# Product-grilling decision addendum — Plan 047

**Date:** 2026-08-28  
**Status:** owner-approved; grilling frontier closed  
**Canonical implementation specification:** `docs/plan-047-owner-approved-design.md`

This addendum records the owner decisions made after the earlier product-grilling register and after Plan 046 merged. It exists as an audit trail. The canonical design document contains the implementation-ready consolidation.

## Family and schedule decisions

- Initial internal architectures remain `growth`, `balanced`, `strength`, and `home`.
- Public goals are Build Muscle / Ganhar massa, Muscle + Strength / Massa + força, and Strength Priority / Prioridade em força.
- Limited equipment is orthogonal to goal, not a fourth peer goal. Public limited-equipment framing is Train Anywhere / Treine em qualquer lugar.
- Home means genuinely limited equipment, not “training at home.” A full home gym uses ordinary goal families.
- Home starts from bodyweight only unless equipment is declared; dumbbells are the next accessibility level, then bands. Environmental pulling capability is separate.
- Every family supports genuine authored 2-, 3-, 4-, 5-, and 6-day sibling structures. Frequency changes distribution/structure and does not automatically increase weekly volume.
- Six weeks is a stable management horizon. Weekly structure remains the same. No scheduled deload.

## Progression decisions

- `range@1` is the default progression strategy.
- `rep_goal@1` is used selectively where appropriate.
- `anchor_backoff@1` is used selectively for deliberately authored heavy-primary work.
- `paired_exposure@1` remains under the existing approved temper-only relation contract and only for explicit compatible heavy/volume relations.
- `manual@1` preserves unsupported/custom progression semantics; no silent `range@1` fallback.
- `effort_target@1` is graduated into the supported Plan 046 strategy set before Plan 047 consumes it. It is selective, especially for suitable strength-primary roles, and does not replace `range@1` globally.
- APRE/DAPRE, velocity-based loading, automatic performance-driven volume adaptation, target-changing block profiles, and scheduled deloads remain deferred.

## Prescription decisions

- Heavy-primary work normally uses 3–6 reps.
- Hypertrophy compounds use either 4–8 or 8–12 depending on the exercise and slot role.
- Isolation/accessory work uses 8–15 reps and never more than 15 in the initial families.
- Heavy-primary work normally targets about 2–3 RIR.
- Normal hypertrophy work generally uses 1–3 RIR.
- Deliberately low-volume programs may use 0–2 RIR. 0 RIR may be permitted without making failure mandatory.
- Later sets may be encouraged toward lower RIR where appropriate, but there is no universal final-set-to-failure rule.
- Two sufficiently hard working sets are a legitimate high-efficiency prescription, especially under time/frequency constraints.
- Normal slot bounds are generally 2–3 primary/compound sets and 1–3 isolation/accessory sets. Three is a normal alpha ceiling, not a physiological law.
- Heavy-primary rest is normally 2–4 minutes with a 2-minute floor; hypertrophy compounds 90–180 seconds; isolation/accessory work 60–120 seconds.

## Volume/time decisions

- The old maturity × time × frequency allocation matrix is rejected for the owner-approved design.
- Volume is a ceiling/constraint outcome, not a target to fill.
- Blueprint defines useful work; role bounds, coverage, and time feasibility constrain it.
- Direct and indirect muscle exposure are tracked separately.
- Maturity mainly affects complexity and conservative initialization, not automatic set inflation.
- More available time does not require more work.
- There is no universal max sets/muscle/week in v1.
- Priority preserves coverage, redistributes optional capacity, and may add work only inside reviewed bounds. It cannot destroy protected primary/family structure.

## Foundation and re-entry decisions

- Foundation is a simple-start/simple-programming profile, not a fifth family or permanent beginner label.
- Foundation prefers simpler/stabler candidates, simpler progression, conservative authored values, and reduced unnecessary complexity.
- Foundation predominantly prefers `range@1`; it does not use `paired_exposure@1` in v1 and normally simplifies `anchor_backoff@1` to range progression.
- Foundation does not have an independent universal 2-set/5-slot cap and does not auto-graduate after six weeks.
- Recent consistency uses canonical states consistent/interrupted/returning, but UI should ask concrete history rather than expose those labels.
- Initial policy bands are recently/currently training = consistent; roughly 2–4 disrupted weeks = interrupted; roughly 4+ weeks away = returning. These are product-policy thresholds, not physiology.
- Interrupted re-entry is one reduced week; returning re-entry is two reduced weeks. Changes are structural set reductions by slot importance. Do not change RIR, strategy, exercise, family, or schedule.
- Re-entry is optional and does not end early based on performance in v1.

## Slot/exercise-resolution decisions

- Slots describe training jobs rather than hard-coded exercise names.
- Required and preferred exercise characteristics are separate.
- Both movement pattern and muscle intent matter.
- Catalogue characteristics are coarse and meaningful (stability, systemic/local fatigue demand, loading granularity, practical rep range, equipment/capability), not fake numerical precision.
- Variety is not an objective by itself. Repeated exercises are allowed and sometimes desirable.
- User preferences win within a valid candidate set; dislikes/exclusions are respected; compatible history/continuity is a tie-breaker.
- Machine identity remains exact; load histories are not merged across different machine identities.
- Bodyweight does not receive invented external load. Exercise-variation ladders are not silently automated in the active block.
- Substitution preserves slot intent, not stale original-exercise semantics. A substitute may use a different valid rep prescription.
- Structural user edits remain allowed; incompatible edits become Customized from … and no longer count as satisfying the original blueprint slot.
- Compilation is deterministic.

## Constraint and product-surface decisions

- Time-pressure order: remove optional/bonus work, then use reviewed efficient two-set prescriptions where suitable, then trim reducible assistance, then return a typed conflict.
- Requested frequency is preserved; the compiler does not silently reduce days/week.
- Impossible constraints are represented as typed conflicts rather than silent truncation.
- Browse shows only complete executable programs for the current capability context.
- Recommend/Custom may surface limitations and compromises.
- Activated programs are version-pinned. Equipment changes and blueprint updates are offered, never silently applied.

## Science/trust decision

The owner approved this repository-wide programming principle:

> Evidence constrains Taurifer's choices; it does not justify precision the evidence does not contain.

Important constants and rules should be labelled as evidence-supported, evidence-informed implementation choice, conservative product policy, or operational estimate. Product heuristics must not gradually be described as proven physiology.

## Final owner gate

After the full design re-pitch, the owner confirmed shared understanding and then explicitly approved graduating `effort_target@1` and proceeding. The Plan 047 product-decision frontier is closed.
