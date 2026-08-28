# Plan 047 scientific source ledger

**Status:** supporting evidence ledger for the owner-approved Plan 047 design, 2026-08-28.  
**Purpose:** keep evidence, Taurifer implementation choices, and product policy visibly separate. This file does not override the progression contracts or the owner-approved design.

## Evidence policy

Taurifer follows this rule:

> Evidence constrains Taurifer's choices; it does not justify precision the evidence does not contain.

For implementation and review, classify programming claims as:

- **evidence-supported** — the broad direction is directly supported by the literature;
- **evidence-informed implementation choice** — literature supports the general method, but Taurifer's exact thresholds/branching are product design;
- **conservative product policy** — chosen for safety, simplicity, reproducibility, or user trust rather than because a study proves that exact rule;
- **operational estimate** — time/setup/transition assumptions used for product mechanics.

## Sources and consequences

### Resistance-training prescription overview

**Source:** 2026 ACSM Position Stand / overview of 137 systematic reviews and more than 30,000 participants; evidence through October 2024. PubMed PMID **41843416**.

**Useful conclusions:** resistance training works across a broad range of prescriptions. Strength is generally favored by heavier loading, sufficient sets, complete ROM, prioritizing important exercises earlier, and repeated weekly exposure. Hypertrophy benefits from sufficient weekly volume, but the evidence does not justify one universal exact prescription for all people/exercises.

**Plan 047 consequence:** use broad reviewed role/exercise prescription ranges; avoid pseudo-precise family constants and avoid presenting one progression method as uniquely scientific.

### Volume and frequency dose response

**Source:** Pelland et al. dose-response meta-regressions, 67 studies / 2,058 participants. PubMed PMID **41343037**.

**Useful conclusions:** volume has a positive relationship with hypertrophy and strength with diminishing returns; strength diminishing returns are more pronounced. Frequency has little clear independent hypertrophy effect when volume is accounted for, but can benefit strength and distribution/practice. Fractional direct/indirect set accounting fit the data better than crude binary counting, but does not establish a universal physiological coefficient.

**Plan 047 consequence:** frequency is primarily distribution, not a multiplier; do not fill a weekly set quota; track direct and indirect exposure separately; do not encode a universal magic weekly set maximum.

### Loading range and hypertrophy/strength specificity

**Sources:** PubMed PMIDs **33874848**, **35015560**, **33433148**.

**Useful conclusions:** hypertrophy can be achieved across a broad loading range when training is sufficiently effortful; heavier loads are more specific/superior for 1RM strength outcomes.

**Plan 047 consequence:** hypertrophy compounds may use 4–8 or 8–12 depending on exercise/role; Strength gets deliberate heavier primary/practice roles; do not reduce family identity to one rep range.

### Proximity to failure

**Sources:** 2024 meta-regression PMID **38970765**; 2026 failure vs non-failure meta-analysis PMID **42410632**.

**Useful conclusions:** closer proximity to failure can support hypertrophy, while strength shows little clear benefit from routinely reaching failure; mandatory failure is not required. Non-failure training can perform as well or better for dynamic strength while hypertrophy differences are small/absent in aggregate.

**Plan 047 consequence:** normal hypertrophy generally 1–3 RIR; low-volume/high-effort work may use 0–2 RIR; 0 RIR is allowed but not mandatory; later sets may be encouraged harder without a product-wide last-set-to-failure rule.

### Rest intervals

**Source:** 2024 Bayesian meta-analysis PMID **39205815**.

**Useful conclusions:** hypertrophy may benefit modestly from rest longer than about 60 seconds, with comparatively little additional appreciable difference beyond moderate rest in many contexts; heavy strength work often needs longer rest to preserve performance.

**Plan 047 consequence:** heavy primary normally 2–4 minutes with a 2-minute floor; hypertrophy compound 90–180 seconds; isolation/accessory 60–120 seconds. User preference may inform time estimates but cannot force rest below the authored useful floor.

### Exercise order

**Source:** systematic review/meta-analysis PMID **32077380**.

**Useful conclusions:** strength gains are greatest for exercises prioritized earlier in the session; hypertrophy is less sensitive to order.

**Plan 047 consequence:** Strength heavy-primary work is early/protected; priority may affect ordering where appropriate but does not destroy coverage.

### Machines vs free weights

**Source:** systematic review/meta-analysis PMID **37582807**.

**Useful conclusions:** both machines and free weights can support hypertrophy; strength gains are specific to the trained modality.

**Plan 047 consequence:** do not treat free weights as universally superior for hypertrophy; preserve exact machine identity/history rather than transferring strength/load evidence across different machines.

### Autoregulation and RIR/RPE

**Sources:** autoregulation/systematic reviews and meta-analyses PubMed PMIDs **33776802**, **35038063**, **40791980**.

**Useful conclusions:** autoregulated loading using RPE/RIR/APRE/VBT-style methods can outperform or usefully complement fixed loading for strength in some contexts; the literature supports the method family more strongly than any single exact Taurifer branch rule.

**Plan 047/046 consequence:** graduate `effort_target@1` as a selective strength-primary strategy. Exact one-grid-step transition logic is an evidence-informed Taurifer implementation choice.

### RIR estimation accuracy

**Sources:** PubMed PMIDs **34542869**, **37967832**.

**Useful conclusions:** RIR estimation is imperfect and heterogeneous but tends to improve near failure and in lower-repetition/trained contexts.

**Plan 047/046 consequence:** use RIR ranges and conservative load changes; missing RIR must not be fabricated for `effort_target@1`; do not claim exact RIR thresholds are physiological truths.

### Periodization

**Source:** systematic review/meta-analysis PMID **35044672**.

**Useful conclusions:** periodized/undulating approaches may modestly improve 1RM strength versus non-periodized/linear approaches in some populations, while hypertrophy differences are not consistently meaningful.

**Plan 047 consequence:** the six-week block is a stable product-management horizon, not evidence for automatic weekly structural variation. Target-changing block profiles remain deferred.

### Detraining and retraining

**Source:** controlled retraining study PMID **39364857**.

**Useful conclusions:** strength/size lost during detraining can return relatively quickly during retraining, but the study does not validate Taurifer's exact interrupted/returning time bands or exact one-/two-week treatments.

**Plan 047 consequence:** re-entry is conservative and structural, uses versioned product-policy bands, and changes sets rather than inventing an RIR modifier.

### Advanced resistance-training methods

**Source:** 2026 review/meta-analysis PMID **41718208**.

**Useful conclusions:** some advanced methods can benefit strength/performance, but aggregate evidence does not support treating advanced techniques as automatically superior for hypertrophy.

**Plan 047 consequence:** do not add complex strategies just to appear advanced; keep `range@1` default and graduate/select other strategies only for a clear programming job.

## Strategy-specific evidence classification

### `range@1`

- Broad double/range progression concept: **evidence-compatible**.
- Exact Taurifer thresholds, capacity branches, stall/recovery logic: **evidence-informed/product heuristic**.

### `rep_goal@1`

- Total-rep progression: **plausible evidence-compatible implementation convention**.
- Superiority over range progression: **not established**.

### `anchor_backoff@1`

- Heavy top/anchor work plus back-off volume: **evidence-compatible structure** when the prescription is authored appropriately.
- Exact percentages/back-off arithmetic: **product contract**, not automatically a scientific truth.

### `paired_exposure@1`

- Heavy + volume exposure structure: **evidence-compatible**.
- Taurifer cross-tempering relation: **product heuristic / speculative adaptive logic**, not established as a validated physiological algorithm.

### `effort_target@1`

- RIR/RPE autoregulated loading method: **evidence-supported at the broad method level**.
- Taurifer fixed-rep, RIR-range, one-grid-step transition contract: **evidence-informed implementation choice**.

### Foundation

- Simpler/stabler exercises and conservative starts: **conservative product policy informed by usability/training principles**.
- Any exact duration or set cap: **not scientifically established**; hence no universal Foundation set/slot cap and no automatic graduation timer.

### Re-entry

- Conservative reduction after interruption: **evidence-informed**.
- `recent_consistency@1` exact time bands and one-/two-week reduction schedule: **versioned product policy**, not physiological boundaries.

## Explicitly deferred research tracks

Do not implement these in Plan 047:

- APRE/DAPRE-style autoregulation;
- velocity-based training/loading, until Taurifer can collect trustworthy velocity evidence;
- performance-driven adaptive weekly volume/intervention logic;
- automatic exercise-variation ladders;
- target-changing block modifiers;
- scheduled deloads.

## Review rule

When an implementation or PR description says a Taurifer programming rule is “science-backed,” reviewers should require the claim to identify whether it is actually evidence-supported at the method level or merely an evidence-informed Taurifer implementation choice. If the source does not support the exact threshold/formula, the documentation must say so.
