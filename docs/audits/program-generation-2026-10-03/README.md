# Program generation engine audit — 3 October 2026

The audit generated **200 complete workout programs**: 100 likely scenarios
under an explicit assumed usage model, and 100 edge cases of supported user
choice. Every program has an individual evaluation and its complete compiler
output. The principal defect is that time reductions can produce one-set
compound prescriptions below the approved two-set minimum: **4 representative
programs and 14 stress programs**, affecting 94 slot occurrences.

This is an audit of the production deterministic compiler, not an LLM exercise
in inventing plausible workouts. No production engine code was changed.

## Inspect the deliverables

- [Interactive program explorer](explorer.html): filter the two sets, search
  programs, inspect exercises, findings, dimensions, exposure, and input.
  Download/open the HTML locally if your file viewer does not execute scripts.
- [All 200 individual evaluations and complete workouts](individual-evaluations.md).
- [One-row-per-program CSV](evaluations.csv) and [one-row-per-exercise CSV](exercises.csv).
- [Full inputs, outputs and evaluations](programs.json).
- [Set-level metrics, methodology and source hashes](summary.json).
- [All 308 user-choice generation probes](probes.json).
- [Acceptance contract](contract.md) and [explorer logic verification](explorer-verification.json).
- [Replay and focused-check evidence](verification.json) and
  [independent F01 reproduction](finding-F01-reproduction.json).

The IDs `R001`–`R100` identify representative programs; `S001`–`S100` identify
stress programs. Probe IDs refer to attempts, including choices returning
conflicts, and are not additional members of the 200-program set.

## Methodology and meaning of “probable”

There was no connected observed usage dataset. Likelihood is therefore a
**hypothetical prior over user configurations**, not a measured estimate of
what actual users choose. The factors are independent for this first audit:

| Factor | Assumed shares |
|---|---|
| Family | Growth 40%; Balanced 30%; Strength 15%; Home 15% |
| Days/week | 2: 15%; 3: 35%; 4: 30%; 5: 12%; 6: 8% |
| Minutes/session | 30: 5%; 45: 25%; 60: 40%; 75: 15%; 90: 15% |
| Profile | Standard 65%; Foundation 35% |
| Recent consistency | Consistent 75%; interrupted 15%; returning 10% |
| Gym equipment | Full gym 85%; machines only 15% |
| Home equipment | Bodyweight only 60%; dumbbells 25%; bands 15% |
| Muscle preference | None 80%; chest priority 20% |

This defines 2,700 configurations. We rank their joint probability and retain
the first 100 that actually compile. The first 102 attempts contain two
conflicts: machines-only Balanced at 3 and 4 days, both at 60 minutes. These
attempts remain in the probe file. The selected 100 configurations account for
43.91% of the **assumed** prior mass. We did not measure feasibility over the
remaining prior or aggregate the probabilities of every configuration that
produces an identical output.

Consequently, these are the top 100 **successful configurations** under the
model, not the top 100 distinct outputs under an empirically calibrated output
distribution. Repeated outputs remain in the set to make concentration visible.
Reported percentages count cases equally; they are not estimated population
failure rates or confidence intervals.

The representative set contains Growth 47, Balanced 31, Strength 14, Home 8;
39 three-day programs and 33 four-day programs. It covers 17/20 blueprints.

The stress set covers all 20 blueprints exactly five times. All inputs use
supported user choices, validated through `ProgramEntry.setAnswers` and replayed
through the production answer-to-compiler adapter:

| Stress track | Cases | User choices |
|---|---:|---|
| Minimum time with long rests | 20 | 180-second rest preference; first feasible choice among 30/45/60/75/90 minutes |
| Foundation under time pressure | 20 | First structured training experience; long rests; same time-budget search |
| Sparse equipment | 20 | Growth: machines only; Balanced/Strength: barbell + machines; Home: bands or dumbbells with safe pulling and no training support |
| Preferences and exclusions | 20 | Exclude two default exercises; request three exercises; preserve specific movement history; ignore direct biceps/triceps work |
| Returning with competing priorities | 20 | Chest + quads priorities; press + row priorities; de-emphasize calves/biceps; ignore direct triceps work; returning-lifter re-entry; long rests |

Sixty-six time-search attempts retain the choices that do not fit. Another 80
probes combine tight budgets, required-muscle exclusions and absent equipment.
Across all 308 attempts, 218 compile and 90 return typed conflicts. There are
no malformed-input generation tests. Six deliberately corrupted output
artifacts only test whether the **audit evaluator** can detect known faults;
they are not generation-engine stress cases.

## Results across the sets

| Dimension | Representative (100) | Stress (100) | Combined (200) |
|---|---:|---:|---:|
| Programs with contract failures | 4 | 14 | 18 |
| Review flags without contract failures | 65 | 72 | 137 |
| No detected contract failures or review flags | 31 | 14 | 45 |
| Blueprints represented | 17 | 20 | 20 |
| Distinct complete plans, including weekly schedule | 62 | 100 | 160 |
| Distinct exercise sequences | 38 | 95 | 108 |
| Distinct selected exercises | 31 | 41 | 43 |
| Repeated exercise within at least one session | 57 | 72 | 129 |
| Major region without direct work | 7 | 12 | 19 |
| Foundation effort raised after time reduction | 5 | 15 | 20 |
| Direct exposure above 20 sets for a muscle | 6 | 1 | 7 |
| Session with under two minutes of modeled slack | 19 | 29 | 48 |
| Programs requiring time reductions | 18 | 37 | 55 |
| Weekly working sets: median | 45 | 40 | 43 |
| Weekly working sets: range | 21–74 | 12–74 | 12–74 |
| Share of exercise slots occupied by top ten exercises | 78.9% | 57.2% | 66.2% |

“Review” is a coaching/quality signal, not proof that a program is unsafe or
ineffective. A program can have both a contract finding and review flags.
Volume thresholds are declared audit heuristics, not approved physiological
ceilings. A multi-primary exercise contributes sets to each primary muscle;
do not sum muscle exposure to infer the number of working sets.

Across all 200 programs, the following checks found **no failures**:

- Requested family/frequency, independently approved day labels, identities,
  protected-slot presence and provenance.
- Identical-input determinism, reversed-catalogue determinism and non-mutation.
- Owned equipment, required capabilities, required exercise characteristics,
  formal movement/muscle slot compatibility, and loading semantics.
- Rest floors, validated progression envelopes and relation endpoints.
- Exclusion of disliked exercises and ignored **direct** muscle work.
- Compiler time ceilings, including applying the same model to exported sets.
- Direct/indirect exposure accounting and resolved-to-exported program consistency.
- Six-week identities, set-only re-entry, normal resumption and weekly projection.
- Foundation's range progression, omission of optional complexity and absence
  of paired relations.

There are 3,354 resolved exercise slots. The real progression consumer accepts
all 3,354 progression envelopes. These are schema/contract checks; they do not
prove long-term progression effectiveness in actual lifters.

## Findings and recommended actions

### F01 — Compound set reductions escape documented bounds

**Confirmed contract defect; highest repair priority.** The approved design's
[working-set bounds](../../plan-047-owner-approved-design.md#working-sets)
specify 2–3 sets for hypertrophy compounds and volume counterparts. The runtime
class rules agree. `fitTime` trims any reducible non-heavy slot with more than
one set, so a two-set compound becomes one set and is still returned as a
compiled program.

Example **R008**: Balanced, three days, 45 minutes, ordinary gym, standard
profile. `balanced_3_d1_s4` is a Romanian deadlift machine compound prescribed
for one set. Its exported row still advertises `minSets: 2`. This is ordinary
user choice, not re-entry's explicitly authorized temporary one-set reduction.

The affected representative IDs are **R008, R029, R083, R091**. The affected
stress IDs are **S001, S002, S006, S007, S021, S022, S026, S027, S031, S032,
S046, S047, S071, S072**. The affected blueprints are Growth 2/3/6, Balanced
2/3/6 and Strength 6.

Recommended fix: respect class/slot minimums during normal time reduction;
return the existing typed time conflict if the reviewed program cannot fit.
If one-set normal compounds are intended policy, they need an explicitly
reviewed prescription and consistent exported bounds rather than accidental
clamping in the reducer. Re-entry's set-only exceptions should remain separate.

### F02 — Multiple training jobs collapse onto the same exercise

**Programming-quality review; high prevalence.** There is repeated exercise
selection within at least one day in 129/200 programs. In **R002**, Growth four
days, Lower B separately assigns the Romanian deadlift machine to
`hinge_growth`, `hip_extension`, and `hamstring_assistance`: three entries of
three sets each. The machine also appears twice on Lower A. Its week contains
15 direct sets of that one exercise.

This follows the current independent ranking of each slot; formal compatibility
still passes. Whether separate entries are intentional needs review of the
training jobs. A leg curl and a hinge could express distinct hamstring work
more clearly than repeating one hinge in every compatible job.

The same problem becomes especially visible with broad Home coverage slots:
**S095** resolves all three exercises on its “Mixed coverage” day to Chest dip.
The user requested both chest and quads priority, but ties repeatedly favor the
same exercise. Do not add a blanket deduplication rule without checking whether
it destroys protected work or legitimate repeated exposures across days.

### F03 — Home posterior work can become secondary-only squat exposure

**Capability/quality review.** Nineteen programs have a slot whose intended
primary region is not primary for the selected exercise, and no direct
posterior-chain work. The bodyweight Home examples also lack direct pulling
when safe pulling is unavailable, which is an explicitly supported limitation.

For **R027**, posterior slots resolve to **Sissy squat** (corrected during the
[qualitative coaching audit](coaching/README.md)); other cases use Split squats. The catalogue primarily
attributes them to quads, with hamstrings/glutes as secondary muscles. Secondary
exposure is recorded correctly, but it should not be read as equivalent to a
dedicated posterior-chain exercise. In this audit these cases are accepted by
the authored fallback rules; they are not mislabeled formal compatibility bugs.

Recommended action: review the posterior fallback's promise and limitation
copy; prefer genuinely compatible primary posterior work where available, and
make any secondary-only compromise visible. The set-level exposure table makes
the gap explicit instead of combining direct and indirect sets into one score.

### F04 — Time pressure raises Foundation effort

**Policy/consistency review, not an out-of-range RIR defect.** Twenty Foundation
programs start with conservative RIR initialization but time reductions reset
efficient compound work to 0–2 RIR. **S002**, Growth two days at 30 minutes with
long rests, shows this on protected and assistance compounds. The final RIR
remains within the approved efficient-work band; the question is whether
removing Foundation's conservative starting preference is intended.

Recommended action: apply the same Foundation initialization to the resolved
efficient prescription, or explicitly document and review this tradeoff. Do not
invent a new universal Foundation RIR target outside authored ranges.

### F05 — Priorities often change selection without increasing exposure

**Expectation/coverage review.** The paired chest-priority comparison changes
direct chest sets in 6/20 siblings: Growth 5/6 (+2), Balanced 6 (+2), Home 4
(+6), Home 5 (+9), Home 6 (+12). The other 14 have no direct chest-set increase.
This can be correct: priorities rank compatible exercises and use only authored
capacity. It does mean “priority” cannot uniformly promise extra work. Home's
large increases coincide with repeated broad coverage slots and deserve review
alongside F02.

### F06 — Defaults concentrate heavily on a small catalogue subset

**Diversity/robustness observation.** The representative set selects only
31/271 exercises. Ten exercises occupy 78.9% of its slots. The Romanian
deadlift machine alone occupies 19.3% of representative slots. Across both
sets, only 43/271 exercises are used. This is partly the intended deterministic
ranking and is not evidence that the other 228 exercises are broken.

The exercise library does not have to be sampled uniformly. The practical
questions are whether these winners are commonly available, whether their
anatomical jobs remain distinct, and whether substitutions make the remaining
compatible exercises reachable. This audit stresses equipment categories, not
the real inventory of every individual commercial machine.

## Set-level behavior under controlled changes

For each of the 20 siblings, a separate comparison changes one choice at a time:

- Longer rest preferences never shorten selected rests: **20/20**.
- Moving from 75 to 90 minutes does not add filler to these feasible defaults:
  **20/20** have identical resolved days.
- Enabling returning-lifter re-entry preserves base exercises, prescriptions
  and relations while changing the weekly set schedule: **20/20**.
- Foundation simplifies progression and removes paired relations: **20/20**.
- Adding safe pulling to bodyweight Home exposes direct pulling in all five
  frequencies; the original no-pulling limitation is capability-dependent.

The median of each program's three warm compiler timings is about 2.3 ms in
the representative set and 2.0 ms in the stress set. These are descriptive
in-process results on this machine; they exclude onboarding UI, persistence,
browser rendering and real training duration. Timing noise should not be
treated as a performance regression.

## Verification, reproduction and limits

Source commit: `c1d643206d1c472b34d3f0c0e4b7cb425f571329`. Exact source-file
SHA-256 hashes, runtime version and compiler version pins are in `summary.json`.

Run from the repository root:

```sh
node tools/audit-program-generation.mjs
# Optional separate replay location:
node tools/audit-program-generation.mjs /tmp/program-generation-audit-replay
```

The complete program/input semantic digest is:
`92f9e0bece87b4aba07c379f86208b66175f1b2417273d4f8ee8d3c21bae41e0`.
Timestamps and latency samples vary; compare the semantic digest for replay.
An independent rerun into `/tmp/program-generation-audit-replay` matched this
digest exactly; CSV cardinality, source hashes and all 200 answer round trips
also passed verification.

Existing focused proofs passed directly:

```sh
node test/program-family-fixtures.mjs
node test/program-compiler-plan048-preferences.mjs
node tools/build-program-family-fixtures.mjs --check
```

The evaluator also detected six injected output faults: unowned equipment,
duplicate identity, excess time, invalid progression version, false exposure,
and missing protected work. The unmodified control passed. Existing suites
being green does not invalidate F01: their broad set check allows 1–3 sets
and does not enforce each compound class's two-set minimum under pressure.

The standard browser runner was blocked by this environment's `spawnSync git
EPERM`. A direct attempt found the pinned Playwright browser absent; installed
system Chromium then failed on a sandbox-denied `setsockopt`. Explorer startup,
filters, search, findings and dialog logic were checked with a DOM stub instead;
there is no claim of verified browser layout or an end-to-end activation run.

Numeric prescription bounds and owner-approved labels provide independent
checks; some slot/time/schedule checks share compiler metadata and are weaker
than independent observations. Real calendar placement, soreness, individual
recovery, actual gym queues, training outcomes, substitutions after activation,
and durable application state are outside this pure generation audit. A clean
contract result means “no defect detected by these checks,” not individualized
coaching approval.

Recommended sequence: repair F01 first; review F02/F03 as programming quality;
decide F04's intended Foundation tradeoff; then improve priority expectations
and calibrate the assumed likelihood model with observed entry-choice data.
