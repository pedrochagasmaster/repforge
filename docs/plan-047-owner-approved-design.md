# Plan 047 owner-approved program design

**Status:** canonical owner-approved design for Plan 047 as of 2026-08-28  
**Authority:** this document supersedes conflicting Plan 047 wording that predates the August 28, 2026 owner grilling. If an older plan, decision note, backlog item, or design note conflicts with this document, this document wins for Plan 047 implementation.  
**Depends on:** Plan 046 progression engine plus the `effort_target@1` amendment described in `docs/progression-effort-target-v1.md`.  
**Blocks:** Plan 048 Recommend/Custom/Browse implementation.

## 1. Product boundary

Taurifer owns a small set of original, reviewed, versioned programs. Plan 047 does not generate arbitrary workouts from a loose collection of heuristics. The compiler resolves an authored blueprint against validated user context. It may resolve exercises, choose a reviewed prescription within authored bounds, apply capability alternatives, priority, Foundation, re-entry, and approved time-pressure reductions. It may not redesign the split, invent new progression formulas, add filler work, silently mutate an active program, or create family-specific progression logic.

Plan 046 owns progression mathematics. Plan 047 authors programs with those strategies. Plan 048 owns the questions and presentation that select and explain the result.

The initial product covers hypertrophy and general strength. It does not claim powerlifting, meet preparation, peaking, tapering, attempt selection, or competition-percentage programming.

Every programmed week has the same structural schedule. Six weeks is the default management horizon, not a physiological periodization cycle. There is no scheduled deload and no silent weekly exercise rotation.

## 2. Public goals and internal families

The three public training goals are:

- `growth` — **Build Muscle / Ganhar massa**. Hypertrophy is the priority. Broad muscle coverage, hypertrophy-oriented exercise choice, appropriate compound loading, and deliberate assistance work.
- `balanced` — **Muscle + Strength / Massa + força**. Meaningful heavy practice on selected patterns plus substantial hypertrophy work.
- `strength` — **Strength Priority / Prioridade em força**. More heavy-primary and practice roles while retaining a coherent hypertrophy base. This is general strength training, not powerlifting.

Limited equipment is not a fourth peer goal. Equipment/capability is a separate input. A full home gym may compile ordinary `growth`, `balanced`, or `strength` programs. Genuinely limited equipment routes through the internal `home` architecture. Publicly, the limited-equipment promise is **Train Anywhere / Treine em qualquer lugar**.

The selected training goal may influence Home resolution where the available resistance makes that meaningful, but Taurifer must not make a false strength promise when the equipment cannot support it.

## 3. Home capability model

Home assumes **no external equipment unless specified**. The base is bodyweight. Additional capabilities expand the candidate pool rather than making the baseline program possible.

Accessibility/ranking starts from:

1. bodyweight;
2. dumbbells;
3. bands;
4. other explicitly declared equipment.

Environmental capabilities are modelled separately from owned equipment. In particular, Taurifer may ask whether the user has a safe way to perform pulling work, such as a purpose-built pull-up bar, suspension trainer, or suitable training support. Taurifer must not instruct users to improvise pulling from unsafe furniture.

Zero-equipment Home is allowed to be push/lower dominant. If there is no credible pulling capability, Taurifer must represent that limitation truthfully. It must not invent floor movements and label them equivalent to loaded pulling. As soon as a credible pulling capability exists, pulling becomes protected coverage.

Dumbbells are preferred over bands as a default tie-breaker when both satisfy the same job similarly, because dumbbells generally provide clearer loading progression. This is a ranking preference, not an absolute rule.

An equipment change never silently restructures an activated program. Taurifer may offer an explicit update. Accepting it creates a deliberate updated instance/version.

## 4. Frequency architecture

The compiler supports **2, 3, 4, 5, and 6 days per week as first-class reviewed siblings** for all four internal families (`growth`, `balanced`, `strength`, `home`). There are twenty canonical family × frequency structures.

A 4-day program is not made by deleting Day 5. A 6-day program is not a 3-day program duplicated twice. Each frequency has its own authored structure.

Frequency is primarily a **distribution variable**, not a volume multiplier. A 6-day program may have similar weekly work to a 3-day sibling distributed across shorter sessions. More available time is a ceiling, not an instruction to fill every minute.

If a user explicitly requests a frequency, the compiler preserves it. It must not silently reduce the day count to make a program fit.

If a requested family/frequency/time/equipment combination cannot preserve the authored family promise, the compiler returns a typed conflict. Plan 048 may then offer explicit compromises.

## 5. Canonical progression-strategy hierarchy

Plan 047 may author only supported Plan 046 strategies. The global policy is:

- `range@1` — default progression strategy.
- `rep_goal@1` — selective use where total-rep progression genuinely suits the slot.
- `effort_target@1` — selective use for suitable heavy-primary/general-strength work where a fixed rep target with authored RIR-based autoregulation better expresses the programming intent.
- `anchor_backoff@1` — deliberately authored heavy-primary work where anchor plus back-off organization is useful.
- `paired_exposure@1` — only for explicitly compatible heavy/volume relationships and only under the existing approved temper-only Plan 046 relation contract.
- `manual@1` — unsupported/custom progression semantics. Never silently replace an unsupported strategy with `range@1` or the “closest” supported strategy.

No family ID, public name, provenance, source, or entitlement may branch progression-engine arithmetic.

`range@1` remains the default even after `effort_target@1` graduates. `effort_target@1` is selective, not a replacement for ordinary double/range progression.

`rep_goal@1` is an implementation convention, not a claim of scientifically superior hypertrophy progression.

`paired_exposure@1` is a Taurifer heuristic relation. The heavy + volume programming structure is evidence-compatible; the specific cross-tempering algorithm is not to be marketed or documented as scientifically validated physiology.

## 6. Prescription roles

Prescriptions are role-based and exercise-constrained, not family-ID-based.

Core roles include:

- heavy primary;
- volume counterpart / practice exposure;
- hypertrophy compound;
- isolation/accessory;
- stable machine/accessory where useful.

The same exercise may occupy different roles in different blueprints. Exercise identity does not permanently encode program intent.

### Rep ranges

- Heavy-primary work: normally **3–6 reps**.
- Hypertrophy compounds: the exercise/role determines whether the normal prescription is **4–8** or **8–12**. Do not force one universal compound range.
- Isolation/accessory work: **8–15 reps**, never above 15 in the initial families.

The exercise catalogue constrains valid ranges. A role default is intersected with the exercise's sensible loading/repetition characteristics.

### Effort targets

- Heavy-primary work: normally **2–3 RIR** unless an authored `effort_target@1` prescription states a reviewed target/range.
- Normal hypertrophy work: generally **1–3 RIR**.
- Deliberately low-volume/high-effort hypertrophy work may use **0–2 RIR**.
- 0 RIR is allowed where appropriate but is not equivalent to mandatory failure.
- Taurifer does not require the final set of every exercise to failure. Later sets may encourage lower RIR where appropriate.

### Working sets

Normal authored bounds:

- heavy primary: 2–3 working sets;
- volume counterpart: 2–3;
- hypertrophy compound: 2–3;
- isolation/accessory: 1–3.

Three working sets is the normal alpha ceiling unless a specific slot is explicitly authored and reviewed otherwise. It is not claimed to be a physiological maximum.

Two working sets are a legitimate high-efficiency prescription, not merely a degraded three-set plan. In time/frequency constrained programs, two sufficiently hard sets can be an intentional design.

Sets and RIR are therefore a coherent prescription pair. The compiler must not treat them as unrelated knobs.

### Rest

- heavy primary: normally **2–4 minutes**, never below a 2-minute authored floor for the intended work;
- hypertrophy compound: normally **90–180 seconds**;
- isolation/accessory: normally **60–120 seconds**.

User rest preference informs the time model but cannot override the evidence-informed minimum for the authored work. If the preferred rest causes a time conflict, use normal constraint resolution.

## 7. Volume and time policy

The old maturity × session length × frequency `allocation@1` set-cap matrix is retired for this design.

Taurifer does not start from a set quota and fill it. The order is:

1. the reviewed blueprint defines useful work;
2. role bounds constrain sets per slot;
3. direct and indirect muscle exposure are tracked separately;
4. muscle/movement coverage validation detects under- or over-concentration;
5. the time model checks whether the authored program fits;
6. maturity affects complexity and conservative initialization within authored bounds, not an automatic volume multiplier;
7. priority redistributes optional capacity and may add work only inside explicit reviewed bounds;
8. spare time is not filled automatically.

There is no universal magic maximum sets per muscle per week in v1. Fixtures must expose direct and indirect weekly exposure so unusually high concentrations are visible during review.

Capacity is evidence, not a universal prescription calculator. Plan 047 must not convert Capacity into a hidden volume/intensity optimizer.

Performance-driven volume adaptation belongs to a later intervention layer, not the Plan 047 compiler.

## 8. Priority policy

Priority follows this order:

1. preserve required whole-program coverage;
2. redistribute optional/reducible work toward the selected priority;
3. optionally add work only where explicitly reviewed and still inside time/prescription bounds;
4. never add filler simply because time is available.

Priority cannot alter protected primary work or destroy the family structural promise.

## 9. Foundation / simple-start profile

Foundation is an internal profile, not a fifth family and not a euphemism for beginner.

It may be selected for genuinely new structured-program users or by an experienced athlete who explicitly wants a simpler program.

`simple_start@1`:

- preserves the selected family, frequency, six-week structure, required coverage, and protected primary intent;
- prefers simpler/stabler compatible exercises;
- prefers simpler progression when multiple valid strategies exist;
- removes optional/redundant cognitive complexity where appropriate;
- starts conservatively within authored prescription bounds;
- predominantly prefers `range@1`;
- may retain `rep_goal@1` when there is a strong authored reason;
- normally replaces `anchor_backoff@1` with an appropriate simpler `range@1` primary prescription;
- does not attach `paired_exposure@1` in v1;
- does not use an independent universal “2 sets per slot / 5 slots per session” cap;
- does not schedule a deload.

Foundation never silently ends after a timer. The user may explicitly choose a richer profile later. Taurifer may eventually recommend that transition, but acceptance is required.

## 10. Recent consistency and re-entry

Internal canonical states are:

- `consistent`;
- `interrupted`;
- `returning`.

The UI should ask concrete training-history questions rather than expose those labels. Initial `recent_consistency@1` product-policy bands are:

- currently/recently training → `consistent`;
- roughly 2–4 weeks substantially disrupted → `interrupted`;
- roughly 4+ weeks away → `returning`.

These are versioned product thresholds, not physiological boundaries.

Use Taurifer history when it is clearly sufficient. If history is insufficient, ask the user. If the user's explicit answer conflicts with incomplete local history (for example because they trained elsewhere), the user's answer wins.

Re-entry is optional; the athlete may choose to start normally.

### Interrupted treatment

One reduced week, then normal in Week 2.

Week 1:

1. preserve protected primary work;
2. preserve required muscle/movement coverage;
3. reduce optional/reducible work first;
4. remove one set from reducible slots that have at least two working sets where needed;
5. never reduce a retained slot below one working set;
6. do not change exercise, strategy, RIR target, family, or schedule.

### Returning treatment

Two reduced weeks, then normal in Week 3.

Week 1:

1. remove optional priority additions;
2. remove one set from reducible slots with at least two sets;
3. permit reducible primary/compound slots to lose one set where needed;
4. retain required slots and coverage;
5. keep at least one set in each retained slot;
6. do not change exercise, strategy, RIR target, family, or schedule.

Week 2:

1. restore all primary prescriptions and required compound work;
2. retain a one-set reduction on reducible assistance where appropriate;
3. Week 3 returns to the normal authored program.

Do not end re-entry early based on performance in v1. Plan 046 still progresses exercise targets normally. Later intervention logic may become adaptive.

## 11. Slot and exercise-resolution model

A blueprint slot describes a **training job**, not a named exercise.

Each slot may declare:

- movement pattern(s);
- intended primary and secondary muscles;
- role;
- required capabilities;
- required exercise characteristics;
- preferred exercise characteristics;
- compatible prescription class/range;
- progression strategy/version or allowed strategy set;
- priority behavior;
- optional/reducible/protected status;
- time/rest/warm-up/transition class.

Required and preferred characteristics must remain separate. Failure to meet a preference is allowed. Failure to meet a requirement causes another candidate to be tried or a typed incompatibility/conflict.

Movement pattern and muscular target both matter. Do not resolve purely by muscle or purely by movement pattern.

The catalogue should expose coarse programming characteristics rather than fake precision. Appropriate fields include:

- stability: high / moderate / free-unconstrained;
- fatigue demand: higher systemic / moderate / low-localized;
- loading granularity/capability;
- practical rep range;
- equipment/environment requirements;
- primary suitability;
- movement and muscle contribution.

Do not introduce fake numerical scores such as `fatigueScore: 7.4` without a separately reviewed evidence model.

### Selection ranking

Within the valid candidate set:

1. explicit user preference outranks compiler preference;
2. explicit dislikes/exclusions are respected;
3. compatible exercise history/continuity is a valuable tie-breaker;
4. compiler preferences such as stability, loading clarity, setup friction, and fatigue distribution resolve remaining ties;
5. variety is not an objective by itself.

Repetition is allowed and sometimes desirable:

- Strength may deliberately repeat important primary movements for specificity/practice.
- Balanced may repeat selected heavy/volume movements where the blueprint benefits.
- Growth may repeat good exercises, while interchangeable hypertrophy slots may use alternatives for coverage/fatigue/preference.
- Home may repeat good movements freely when capability is scarce.

Primary exercises in Strength should remain stable through the six-week block unless the user deliberately substitutes/updates them.

Compilation is deterministic. Equal blueprint/compiler/catalogue versions plus equal constraints/preferences/equipment/history produce equal output.

## 12. Loading truthfulness and bodyweight work

Plan 046 must receive truthful loading semantics.

Examples:

- barbell/plate-loaded: known actionable increments;
- selectorized machine: actual stack increment when known;
- dumbbells: available pair increments;
- bodyweight: no invented external load unless a real loading mechanism exists;
- bands: ordinal/coarse resistance unless the equipment provides meaningful known increments.

Bodyweight progression does not justify a new hidden Plan 047 progression formula. Use supported rep/effort progression when valid. Harder exercise variations may be part of a future reviewed variation ladder, but the compiler must not silently change exercise variation during an active six-week block.

If the current bodyweight exercise stops being appropriate, Taurifer may offer an explicit substitution/update.

## 13. Substitution and customization

A substitution resolves another valid candidate for the **slot**, not something merely visually similar to the original exercise.

The slot intent stays stable, but the new exercise may carry a different compatible prescription. For example, substituting an exercise naturally suited to 8–12 for a 4–8 movement does not force the new exercise into 4–8.

Machine identities remain exact. Different machines/brands may be alternate candidates but do not share load history merely because they train similar muscles.

Paired heavy/volume relations survive substitutions only when the new exercise identities remain compatible under the Plan 046 relation contract.

A compatible substitution preserves program semantics and provenance.

A structural customization that no longer satisfies the original slot is allowed because the activated program belongs to the athlete. Taurifer then marks the instance **Customized from …** and stops pretending that the edited slot satisfies the original blueprint.

Unsupported custom progression semantics resolve to `manual@1` rather than the closest automated strategy.

## 14. Browse, Recommend, and Custom behavior boundary

Browse shows only complete, executable, tested programs for the user's capability context. Do not show a ready-made program that immediately contains unresolved required slots.

Recommend/Custom may reason about limitations and typed compromises.

When two recommendations are similarly good, prefer continuity with the user's existing compatible exercises/history over a microscopic theoretical ranking improvement.

## 15. Constraint-reduction order

When a reviewed blueprint does not fit the time ceiling, use this order:

1. remove explicitly optional / priority-bonus work;
2. convert suitable remaining slots to the reviewed efficient two-set/high-effort prescription;
3. trim reducible assistance while preserving protected primary work and required coverage;
4. return a typed compiler conflict if the family promise still cannot fit.

Do not silently delete protected primary work, change the requested frequency, invent shorter rests below the authored floor, or redesign the split.

A deliberately minimalist future program may become a separate reviewed profile, but the compiler must not silently weaken the normal family to satisfy impossible constraints.

## 16. Family identities

### Growth

Canonical identity:

- broad muscle coverage;
- hypertrophy-oriented exercise selection;
- mostly `range@1`;
- selective `rep_goal@1`;
- 4–8 and 8–12 compound slots according to exercise/role;
- 8–15 isolation/accessory work;
- meaningful effort;
- more of the authored program devoted to hypertrophy work rather than heavy practice;
- priority redistribution mainly through assistance/coverage slots;
- no requirement for a heavy-primary role on every Growth day.

Growth does not become “Strength with higher reps,” and Strength does not become “Growth with lower reps.”

### Balanced

Canonical identity:

- meaningful heavy performance practice;
- substantial hypertrophy work;
- selected heavy-primary and volume-counterpart structures;
- assistance resembles Growth more than Strength;
- knee and horizontal press are the canonical heavy-primary anchors in the 3-/5-day designs;
- hip/hinge remains substantial but is not required to be a third heavy anchor in Balanced;
- the structural heavy/volume relationship may exist even when `paired_exposure@1` cannot be attached after a substitution.

### Strength

Canonical identity:

- highest proportion of heavy-primary and movement-practice roles;
- heavy work early in sessions;
- repeated exposure to selected important patterns;
- selective `effort_target@1`, `anchor_backoff@1`, and `range@1` according to the authored slot;
- enough hypertrophy assistance to maintain/build the muscular base;
- three canonical primary patterns: knee-dominant, horizontal press, hip/hinge;
- vertical press is meaningful compound work but not a mandatory fourth heavy primary;
- normally one primary focus per session, with deliberate exceptions in compressed frequencies.

### Home

Canonical identity:

- limited-equipment programming that starts from bodyweight only;
- no assumption of dumbbells, bands, bench, rack, or pulling capability;
- capability-aware structural alternatives are allowed internally where genuinely required;
- range progression is the overwhelming default, with selective `rep_goal@1` where appropriate;
- do not manufacture `anchor_backoff@1` merely because the engine supports it;
- frequent Home programs distribute sensible work into shorter, low-friction sessions rather than increasing volume automatically.

## 17. Canonical 20 family × frequency blueprints

The following are authored slot structures. Exact exercise resolution happens later from the catalogue. Optional slots are explicitly reducible. Day labels are descriptive, not public marketing promises.

### Growth 2d

**Day A — knee / horizontal**

1. knee hypertrophy compound;
2. horizontal press;
3. horizontal pull;
4. hamstring/hip;
5. lateral delt;
6. optional direct arm.

**Day B — hip / mixed**

1. hip/hinge hypertrophy compound;
2. vertical pull;
3. horizontal/incline press;
4. quad/unilateral knee;
5. rear/lateral delt;
6. optional direct arm or calf.

Both days are full-body. Efficient two-set prescriptions are particularly useful where the session ceiling requires them.

### Growth 3d

Each day is full-body with a different emphasis. Default structure is **5 core + 1 optional/reducible** rather than six equally protected slots.

**Day A — knee / horizontal**

1. knee hypertrophy compound;
2. horizontal press;
3. horizontal pull;
4. hamstring;
5. lateral delt;
6. optional direct arm.

**Day B — hip / vertical**

1. hip/hinge hypertrophy compound;
2. vertical pull;
3. vertical press;
4. quad;
5. chest;
6. optional calf.

**Day C — mixed**

1. unilateral/knee;
2. incline/horizontal press;
3. supported horizontal pull;
4. hip extension;
5. rear/lateral delt;
6. optional direct arm.

Direct biceps and triceps intent is tracked explicitly across the week rather than hidden behind a vague generic `arms` job. Pressing already supplies anterior-delt exposure; do not manufacture unnecessary direct anterior-delt isolation. Lateral delt is explicit; rear-delt direct work is used where pulling does not sufficiently satisfy the intended role.

### Growth 4d

**Upper A**: horizontal press; horizontal pull; vertical pull; secondary chest; lateral delt; triceps.  
**Lower A**: knee compound; hip/hamstring compound; unilateral knee; knee-flexion hamstring; calf.  
**Upper B**: horizontal/incline press; horizontal pull; vertical press; vertical pull; rear/lateral delt; biceps.  
**Lower B**: hip/hinge compound; knee compound; hip extension; knee-flexion hamstring; calf.

### Growth 5d

**Day 1 — Upper A**: horizontal press emphasis; vertical pull; secondary press; horizontal pull; lateral delt; triceps.  
**Day 2 — Lower A**: knee compound; hip/hamstring compound; unilateral knee; knee-flexion hamstring; calf.  
**Day 3 — Upper B**: horizontal pull emphasis; vertical press; vertical pull; chest; rear/lateral delt; biceps.  
**Day 4 — Lower B**: hip/hinge compound; knee compound; hip extension; knee-flexion hamstring; calf.  
**Day 5 — Mixed / Priority**: chest; back; quad; hamstring/hip; priority-eligible slot; optional arms/delts.

### Growth 6d

Shorter sessions, normally about four major slots/day.

**D1 — Upper horizontal**: press; row; secondary chest; lateral delt.  
**D2 — Lower knee**: knee; hamstring; unilateral knee; calf.  
**D3 — Upper vertical**: vertical pull; vertical press; supported pull; arms.  
**D4 — Lower hip**: hinge; knee assistance; hip extension; hamstring.  
**D5 — Upper mixed/priority**: chest; back; lateral-or-rear delt; priority-or-arms.  
**D6 — Lower mixed/priority**: quad; hamstring-or-hip; unilateral lower; calf-or-priority.

### Balanced 2d

Family identity is preserved without forcing every paired-exposure feature into a two-day schedule.

**Day A**: knee primary; horizontal press; horizontal pull; hamstring/hip; lateral delt or arms.  
**Day B**: horizontal-press primary; hip/hinge compound; vertical pull; knee volume/assistance; chest/back assistance.

### Balanced 3d

**D1**: knee heavy primary; horizontal-press heavy primary; horizontal pull; hamstring; lateral delt.  
**D2**: substantial hip/hinge compound; vertical pull; vertical press; unilateral knee; arms.  
**D3**: knee volume counterpart; horizontal-press volume counterpart; horizontal pull; hip extension; chest/back assistance.

The two-primary Day 1 exception is deliberate for the three-day sibling. If one primary is more important to the athlete, order it first.

### Balanced 4d

**Lower primary**: knee primary; hip/hamstring compound; unilateral knee; calf.  
**Upper primary**: horizontal-press primary; vertical pull; horizontal pull; triceps/lateral delt.  
**Lower volume**: hinge compound; knee volume counterpart; knee-flexion hamstring; hip extension/calf.  
**Upper volume**: horizontal-press volume counterpart; horizontal pull; vertical press/pull; biceps/rear-lateral delt.

### Balanced 5d

**D1 — Lower primary**: knee primary; hip/hamstring compound; unilateral knee; calf.  
**D2 — Upper primary**: horizontal-press primary; vertical pull; supported horizontal pull; triceps.  
**D3 — Hypertrophy**: hip extension; chest; horizontal/vertical pull; lateral delt; rear delt/biceps.  
**D4 — Lower volume**: hinge compound; knee volume counterpart; knee-flexion hamstring; calf.  
**D5 — Upper volume**: horizontal-press volume counterpart; vertical pull; vertical press; supported pull; arms.

### Balanced 6d

**D1 — Knee primary**: knee primary; hip assistance; unilateral knee; calf.  
**D2 — Upper primary**: press primary; vertical pull; supported pull; triceps.  
**D3 — Hypertrophy A**: hip extension; chest; back; lateral delt.  
**D4 — Lower volume**: hinge compound; knee volume; hamstring; calf.  
**D5 — Upper volume**: press volume; vertical press-or-pull; horizontal pull; biceps.  
**D6 — Hypertrophy B / priority**: quad-or-hamstring; chest; back; priority muscle.

Day 6 redistributes assistance/priority work and does not exist to inflate weekly sets.

### Strength 2d

**Day A — Knee focus**: knee primary; horizontal-press volume/practice; horizontal/vertical pull; hip assistance; optional assistance.  
**Day B — Press + hinge**: horizontal-press primary; hinge primary; knee volume/practice; pull; optional assistance.

The two-primary Day B is a deliberate compressed-frequency exception. If the requested time ceiling cannot preserve this identity, return a conflict.

### Strength 3d

**D1 — Knee**: knee heavy primary; horizontal-press volume/practice; horizontal pull; hamstring/hip assistance; optional isolation.  
**D2 — Press**: horizontal-press heavy primary; hinge volume/practice; vertical pull; unilateral knee; optional arms/delts.  
**D3 — Hinge**: hinge heavy primary; knee volume/practice; vertical press; horizontal pull; optional arms/delts.

### Strength 4d

**Lower heavy**: knee primary; hinge assistance; unilateral knee; hamstring/trunk.  
**Upper heavy**: press primary; vertical pull; horizontal pull; triceps.  
**Lower practice**: hinge primary; knee volume/practice; hamstring; calf/trunk.  
**Upper practice**: press volume/practice; vertical press; horizontal/vertical pull; biceps/rear delt.

### Strength 5d

**D1 — Knee primary**: knee heavy primary; hinge assistance; unilateral knee; hamstring/trunk.  
**D2 — Press primary**: horizontal-press heavy primary; vertical pull; horizontal pull; triceps.  
**D3 — Hinge primary**: hinge heavy primary; knee volume/practice; hamstring; calf/trunk.  
**D4 — Upper practice**: horizontal-press volume/practice; vertical press; horizontal pull; biceps/rear delt.  
**D5 — Hypertrophy base**: knee/unilateral; hip extension; chest; back; lateral delt; optional arms.

### Strength 6d

**D1 — Knee primary**: knee primary; hip assistance; unilateral; trunk.  
**D2 — Press primary**: press primary; vertical pull; supported pull; triceps.  
**D3 — Hinge primary**: hinge primary; knee assistance; hamstring; calf.  
**D4 — Lower practice**: knee volume; hinge volume-or-assistance; unilateral; trunk.  
**D5 — Upper practice**: press volume; vertical press; horizontal pull; biceps.  
**D6 — Hypertrophy base**: quad-or-hip; chest; back; lateral delt; optional arms.

The sixth day is not another maximal/heavy day.

### Home 2d — bodyweight baseline

Both sessions are full-body.

**Day A**: squat/knee; push; unilateral lower; posterior chain; trunk; pull when capability exists.  
**Day B**: unilateral/knee; alternate push; hip/hamstring; calf; trunk; pull when capability exists.

With no pulling capability, the pull slot is explicitly limited/unresolved according to the blueprint capability rule rather than replaced with a bogus substitute.

### Home 3d — bodyweight baseline

**D1**: squat/knee; push; unilateral lower; hip extension; trunk.  
**D2**: unilateral knee; alternate push; hamstring/hip; pull if available otherwise honest limitation; lateral-delt-compatible work only if capability exists.  
**D3**: knee variation; push variation; posterior chain; pull if available; calf/trunk.

### Home 4d — bodyweight baseline

Mixed sessions are preferred to a strict upper/lower split at zero equipment because upper-only days magnify the pulling limitation.

**D1 — Knee + push**: knee; push; unilateral lower; trunk.  
**D2 — Hip + pull-capable**: posterior chain; pull if available; alternate lower; calf.  
**D3 — Unilateral + push**: unilateral knee; alternate push; hip extension; trunk.  
**D4 — Mixed**: knee-or-hip; pull if available; posterior-chain-or-calf; coverage.

### Home 5d — bodyweight baseline

Shorter sessions:

1. knee + push + trunk;
2. hip + available pull;
3. unilateral lower + push;
4. posterior chain + available pull + trunk;
5. mixed coverage.

Dumbbells/bands may enrich the same public family and may select a reviewed capability-aware structural alternative where required.

### Home 6d — bodyweight baseline

Intentionally short, normally 3–4 slots/session and often two hard working sets:

1. knee + push + trunk;
2. hip + pull-capability;
3. unilateral lower + push;
4. posterior chain + pull-capability;
5. knee/hip + trunk;
6. mixed coverage.

Six Home days serve “little time, often,” not “maximum exercise.”

## 18. Capability-aware Home alternatives

The public model remains one Home/Train Anywhere experience per frequency. Internally a blueprint may contain versioned capability-aware structural alternatives when the bodyweight-only structure and a more loadable setup genuinely need different slot resolution.

Do not multiply the UI into dozens of public Home variants.

## 19. Browse and activation/versioning

Activated instances are pinned to their family/blueprint/compiler/catalogue/rule versions. Updates are offered, never silently applied.

Once activated, the program belongs to the athlete. They may rename it, edit it, substitute exercises, or choose another supported progression strategy. Provenance remains. Structural edits become `Customized from …`.

Browse shows only complete executable tested programs for the current capability context. No disabled “coming soon” or “unvalidated” cards.

## 20. Science and evidence policy

Repository-wide programming principle:

> Evidence constrains Taurifer's choices; it does not justify precision the evidence does not contain.

Important programming constants and claims should be classified as one of:

- **evidence-supported**;
- **evidence-informed implementation choice**;
- **conservative product policy**;
- **operational estimate**.

Key evidence conclusions informing this design:

- resistance training is broadly effective across many prescriptions; few individual variables justify extreme precision;
- heavier loads are more specific/useful for maximal-strength outcomes, while hypertrophy can occur across a broad loading range when effort is adequate;
- hypertrophy tends to benefit from sufficient volume with diminishing returns; frequency is primarily useful for distribution while strength can benefit from repeated practice;
- training closer to failure can support hypertrophy, but mandatory failure is not required and may not improve strength;
- longer rest is important for preserving performance in heavy work; hypertrophy differences above moderate rest intervals are comparatively small;
- exercise order matters more for strength outcomes on exercises prioritized earlier;
- free weights and machines can both support hypertrophy; strength outcomes remain modality-specific;
- RIR/RPE/autoregulation are useful but individual RIR estimates are imperfect, so exact thresholds are implementation policy rather than physiological truth;
- periodization may modestly aid strength but does not justify automatic week-to-week structural variation here;
- detraining/retraining evidence supports conservative re-entry but does not validate exact one-/two-week Taurifer rules as physiological laws;
- advanced methods do not justify a blanket hypertrophy-superiority claim;
- autoregulation evidence supports graduating `effort_target@1` as a selective strategy, especially for general-strength primary work.

Do not claim that `rep_goal@1`, `paired_exposure@1`, Foundation durations, re-entry cutoffs, or exact RIR bands are uniquely validated by science.

Future research/backlog, not Plan 047 implementation:

- APRE/DAPRE-style strategies;
- velocity-based loading/autoregulation, gated on trustworthy velocity measurement;
- performance-driven adaptive weekly volume/intervention logic;
- automatic exercise-variation progression ladders;
- target-changing block modifiers;
- scheduled deload logic.

## 21. Implementation invariants

The implementation is unacceptable if any of the following occurs:

- family-specific progression arithmetic enters the compiler;
- `range@1` becomes a silent fallback for unknown/custom progression semantics;
- the compiler adds work to fill spare time;
- maturity automatically inflates sets;
- frequency automatically multiplies weekly volume;
- the compiler silently changes requested days/week;
- the compiler silently changes exercise variation or restructures an active program;
- Home assumes external equipment that the user did not declare;
- zero-equipment Home invents credible pulling where none exists;
- machine histories are merged across distinct machine identities;
- substitutions preserve a stale prescription that is incompatible with the new exercise;
- optional work is protected while core work is compressed unnecessarily;
- re-entry manipulates RIR targets or progression strategies;
- Foundation gets an independent universal set/slot cap;
- any scheduled deload is introduced;
- a target-changing block modifier is introduced;
- a new progression formula is invented inside Plan 047;
- deterministic inputs produce nondeterministic output;
- public copy presents product heuristics as proven physiological laws.

## 22. Required test coverage

The compiler/blueprint implementation must include:

- schema validation for all 20 canonical blueprints;
- deterministic repeatability tests;
- hostile/synthetic catalogue tests;
- capability-complete and capability-conflict Home tests including bodyweight-only/no-pull cases;
- time-pressure reduction-order tests;
- explicit-frequency preservation tests;
- Growth/Balanced/Strength family-identity invariants;
- `range@1`, `rep_goal@1`, `effort_target@1`, `anchor_backoff@1`, `paired_exposure@1`, and `manual@1` authoring/compatibility tests;
- substitution tests including prescription changes and paired-relation invalidation;
- exact machine-identity/history tests;
- Foundation tests;
- interrupted/returning re-entry tests across the affected weeks;
- priority redistribution tests with no filler volume;
- direct/indirect muscle-exposure review fixtures;
- migration/persistence/export/import/share/archive tests for explicit day structure and provenance;
- generative/model-based tests across valid and invalid contexts;
- browser/simulation regression coverage;
- long-horizon synthetic runs that confirm no silent structural drift or scheduled deload.

## 23. Source/copyright boundary

Taurifer's programs must remain original. Named programs, books, PDFs, forums, coaches, or competing apps may be broad research context only. Do not copy or closely paraphrase their names, explanations, tables, exercise order, exact prescriptions, percentage progressions, week alternation, or schedules.

The implementation authority is Taurifer's own owner-approved design, progression contracts, reviewed fixtures, catalogue, and tests.

## 24. Owner approval

The owner approved the complete design tree on 2026-08-28, including:

- four internal architectures with three public training goals plus orthogonal equipment/capability selection;
- all twenty 2–6-day family/frequency structures;
- bodyweight-first Home;
- the prescription/effort/rest/set rules above;
- retirement of the old allocation matrix;
- deterministic slot resolution and substitution/customization semantics;
- Foundation and re-entry behavior;
- public goal names and Train Anywhere framing;
- the evidence/pseudo-precision policy;
- graduation of `effort_target@1` into the supported progression contract before Plan 047 consumes it.

No further owner product decision is required before implementation unless the implementer discovers a genuine contradiction not resolved by this document and the progression contracts.
