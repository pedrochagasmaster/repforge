# Qualitative coaching audit — 3 October 2026

## Executive assessment

**The generator has useful coaching scaffolding, but it is not yet reliable enough to issue every supported program without review.** Several ordinary gym plans are coherent, and the strongest plans use stable exercises, sensible primary-lift order, manageable session structures, and purposeful compromises when time is limited. The principal weakness is selection without enough awareness of the completed session and week. A locally eligible exercise can erase another exercise's intended function, accumulate redundant work, and dominate a week for reasons unrelated to the client's goal.

The clearest failures occur in constrained Home programs: a sissy squat is repeatedly prescribed as posterior-chain work, and every audited five- or six-day Home plan has a final “Mixed coverage” session containing only one exercise repeated three times. Important gym weaknesses are repeated RDL selection instead of complementary hamstring work, and Foundation defaults that turn a nominally simpler entry program into heavy barbell lunges and decline bench presses. These are not arguments for random variety or universally higher volume. Most can improve through substitution, narrower exercise jobs, and preservation of intended stimulus at the same or lower dose.

**Overall judgment:** promising authored blueprints; uneven completion into actual training prescriptions. A competent coach could issue selected plans after checking client capability and the few relevant caveats. I would not endorse unrestricted automatic issuance across all supported choices today.

## Scope, evidence, and interpretation

Reviewed the exact **200 saved complete programs**: R001–R100, the assumed-probability cohort, and S001–S100, supported-choice edge cases. The latter are not malformed inputs. All sessions, their exercise order, sets, actual progression recipes, RIR/rest, equipment, exclusions, preferences, priorities, profile, and six-week set schedules were considered. The source revision is `c1d643206d1c472b34d3f0c0e4b7cb425f571329`.

The first cohort reflects an explicit assumed usage prior, **not observed user analytics**. Counts below describe these audited cases; they are not estimated production prevalence. Repeated configurations remain separate cases. Findings overlap and must not be added into a failure rate. For example, a duplicate-exercise marker is an observation, not an automatic coaching defect.

The coaching reference is the project's [owner-approved design](../../../plan-047-owner-approved-design.md), [science source ledger](../../../plan-047-science-source-ledger.md), and [amendment](../../../../plans/047-owner-approved-amendment.md). This is a prescription review against those principles, not a new systematic literature review. The ledger supports considering specificity, different muscle functions, distribution of volume, fatigue, order, and adequate rest; it does not justify universal caps on sets, mandatory exercise rotation, or equal push/pull ratios.

Set accounting distinguishes **movement function** from catalogue labels. A deep split squat can provide substantial glute work even when glutes are labelled secondary. Rows can provide meaningful rear-delt work. A labelled secondary quad contribution from a deadlift is not equivalent to a full set of knee-extension work. No arbitrary fractional-set conversion was used. Counts are prescribed work sets, not measured effective stimulus; unilateral sets are not doubled. Specific weekdays are absent, so exact recovery spacing cannot be certified.

Progression was read from the actual strategy: standard Strength effort-target prescriptions are **3 × 5**, not an interchangeable 3–6 range; Balanced anchors are **one 3–5-rep anchor plus backoffs**, not three equally heavy sets; a total-rep goal is not a fixed repetition count for each set. Foundation commonly uses ordinary ranges. “0–2 RIR” permits failure but does not require it.

**Correction to the earlier structural report:** R027's posterior slots actually contain **Sissy squat**, not Split squats. The judgments and evidence in this pass use the saved exercise IDs and names.

Files:

- [Complete evidence package and restore instructions](../EVIDENCE.md): all raw
  artifacts are preserved; large-file links below resolve after restoration.
- [Individual coaching reviews of all 200 programs](program-reviews.md): client context, complete ordered prescriptions, dose by function and muscle label, strengths, caveats, and linked findings.
- [Machine-readable descriptive evidence](coaching-evidence.json), [inventory CSV](coaching-inventory.csv), and [inventory script](coaching-inventory.py).
- [Controlled priority comparisons](priority-counterfactuals.json): 29 original contexts compiled again with only muscle priorities removed. Movement priorities, equipment, exclusions, history, and time were retained. These comparisons are diagnostic and do not replace or expand the 200-case cohort.
- [Original complete programs](../programs.json).

## Findings ranked by practical impact

### Q01 — A knee-dominant exercise is presented as posterior-chain training

**Classification: clear programming defect for the sissy-squat cases.** Seven additional split-squat cases are a narrower, context-dependent concern rather than the same defect.

**Issue and examples.** R027, Home three days, no equipment or pulling/support capability: “Knee / push” contains Sissy squat 3 × 8–12, Push-up 3 × 8–12, Split squats 3 × 8–12, **Sissy squat 3 × 8–12 in the posterior job**, and Crunch floor. “Unilateral / alternate push” and “Mixed” also prescribe Sissy squat in the posterior job. Across the week this produces **21 knee-dominant sets, no hinge and no knee-flexion movement**. S091's entire “Hip + available pull” session is three sets of Sissy squat; its “Posterior + available pull + trunk” session is Sissy squat plus crunches.

An ordinary sissy squat is a quad-focused knee-extension movement; it cannot substantiate an intended hip/hamstring prescription merely because a catalogue field permits a glute match. Equipment scarcity explains missing pulling work. It does not make this a sensible posterior substitution. R068 instead uses Split squats in the posterior positions: deep split squats can train glutes well, so “no posterior muscle stimulus” would be an inaccurate objection. Its **21 weekly sets of the same split squat** still leave no distinct hamstring function and make the session jobs repetitive.

**Prevalence:** Sissy squat in `home_posterior`: **12/200**, 5 R and 7 S, or **12/33 Home plans**. IDs: R027, R036, R055, R069, R095, S076, S081, S083, S086, S091, S093, S096. Split squat in that job: **7/200**, 2 R and 5 S.

**Likely cause:** broad Home posterior patterns and primary-or-secondary muscle matching admit squat patterns through a secondary label. There is no final functional check that the selected exercise provides the posterior job being advertised.

**Smallest principled improvement:** make this particular job require a genuinely posterior function, with explicit allowance for a glute-focused squat only when that is the authored job. Correct sissy-squat suitability. For unsupported bodyweight-only contexts, author an honest reduced-coverage variant or add a vetted, actually available posterior exercise. Do not invent a support arrangement or pretend a quad exercise covers the gap. This should not globally prohibit glute work from squats.

### Q02 — Independent selection collapses distinct jobs and concentrates redundant work

**Classification: clear defect where “Mixed coverage” becomes accidental single-exercise specialization; likely suboptimal programming for repeated, interchangeable assistance work. Mere repetition is often benign.**

**Issue and examples.** R002, Growth four days: “Lower A” has RDL machine 3 × 4–8 and 3 × 8–12. “Lower B” has RDL machine **3 × 4–8, then two separate 3 × 8–12 entries**, separated initially by Leg press. That is **nine RDL sets in Lower B and 15 over the two lower sessions**, with no leg curl. Fifteen sets is not a universal excessive-volume threshold; the objection is spending several different lower-body jobs on the same hip-extension stimulus without an explicit specialization goal.

S095, Home five days, returning, chest and quads priorities: final “Mixed coverage” is **Chest dip 3 × 8–12 three times**, nine dip sets. It has 15 chest sets versus six knee-dominant sets over the normal week. S096's final session is **Bodyweight standing calf raise 2 × 8–12 three times**; calf work reaches 12 sets over four days while push-ups total four sets over two days. S098 substitutes the same collapse with chin-ups: 16 weekly sets on four days, four knee-dominant and four pushing sets. S100 uses dips on **all six training days**, 16 chest sets, and four quad sets despite both being priorities.

The interactions matter: repetition erases intended job distinctions, redistributes volume and frequency, and adds local fatigue without establishing a reason for the resulting specialization. Separately listed copies also make a client-facing prescription harder to understand. Changing only the displayed name or merging entries would not repair the week.

**Prevalence:** within-session repeated exercise in **129/200** (57 R, 72 S); at least two repeated entries with matching set/rep/RIR/rest fields in **100/200** (47 R, 53 S; progression strategies can still differ). Three entries of the same exercise in **68/200**. Three hinge entries in **53/200** (33 R, 20 S). Every audited Growth four-, five-, or six-day case has a three-hinge-entry day: **38/38**. All Home five-/six-day cases have a single-exercise, three-entry “Mixed coverage” day: **10/10**. These broad counts do not mean 129 defective plans.

**Likely cause:** `candidateOrder` chooses each candidate without accounting for already selected exercises or unmet functions. Repeated broad `home_coverage` contracts necessarily choose the same winner. Generic high suitability/stability repeatedly favours the RDL machine for posterior assistance.

**Smallest principled improvement:** first author distinct functions for the three Home coverage positions. Add a modest same-session reuse penalty for unpaired assistance when an equally suitable, functionally complementary candidate exists. Explicitly exempt intended heavy/volume relations and useful practice repetition. Prefer a knee-flexion exercise in the hamstring-assistance job after hinge work. A universal no-duplicates rule would introduce regressions and is not recommended.

### Q03 — Foundation ranking selects cumbersome low-rep defaults

**Classification: likely suboptimal programming, not a claim that the exercises are inherently unsafe or unsuitable for every beginner.**

**Issue and examples.** R016, Foundation Balanced four days: “Lower primary” starts **Barbell lunge 3 × 3–6 at 2–3 RIR**, then RDL machine, then **Barbell lunge again, 3 × 4–8**. “Upper primary” starts **Barbell decline bench press 3 × 3–6 at 2–3 RIR**. S052 Foundation Strength two days repeats those primary choices and adds Trap bar deadlift 3 × 3–6 on “Press + hinge.”

A coach may use lunges or decline presses successfully. As generic entry defaults, low-rep barbell lunges require balance, setup, coordination, side management, and load estimation that are difficult to justify over simpler vetted alternatives. Decline bench introduces setup/unracking complexity without a client-specific reason. The objection concerns the combination of novice profile, loading range, and deterministic default. It does not establish that machines must always replace barbells, nor that Foundation should always use two sets.

**Prevalence:** heavy barbell lunge and decline bench each occur in the same **25/200** cases (15 R, 10 S), **25/53 Foundation programs** and **all 25 audited Foundation Balanced/Strength cases**.

**Likely cause:** generic barbell practical ranges allow 3–6; generic machine ranges exclude that full range. Most catalogue exercises default to `beginnerFriendly: true`, while some familiar lifts are explicitly false. Suitability, stability, and lexical ranking are not a sufficient description of skill/setup demands.

**Smallest principled improvement:** review the exercise-specific Foundation suitability and practical ranges of the small heavy-primary candidate pool. Supply an authored, simple Foundation knee/press choice compatible with the primary role. Where necessary, approve a Foundation-specific rep class rather than pretending every machine or barbell shares an equipment-wide practical range. Preserve a client's deliberate preference when capability is established.

### Q04 — Time compression can undermine the conservative profile and retain too many setups

**Classification: likely suboptimal for Foundation; acceptable but debatable for trained users. A one-set prescription alone is not a qualitative defect.**

**Issue and examples.** S002, Foundation Growth two days, 30 minutes and requested 180-second compound rest: each session retains five exercises but totals six work sets. “Knee / horizontal” is Leg press 2 sets; Chest press machine, Seated row machine, RDL machine, and Cable lateral raise **one set each**. The compounds allow **0–2 RIR**, despite the normal Foundation 2–3 RIR. S007 repeats this across three days and includes Barbell lunge 2 × 4–8 at 0–2 RIR. S057's primary lunge/decline remain at 2–3 RIR, but all two-set assistance allows 0–2.

A low-dose program can be effective, and a capable trainee may choose two RIR throughout. The coaching concern is asking an inexperienced user to manage many setups and accurately approach failure in order to fit time, especially when the selection already includes complex movements. Warmups, learning and transitions can become a large share of the visit. This is a quality/feasibility judgment, not a new claim that an estimated 30-minute budget fails.

**Prevalence:** Foundation programs permitting zero RIR in at least one prescription: **20/53**, 5 R and 15 S. Thirty-minute programs containing a one-set compound: **11/200**, 1 R and 10 S. The marker identifies fragmentation for review, not proof every such plan needs changing.

**Likely cause:** time fitting removes optional work, converts eligible entries to efficient 0–2 RIR, then trims assistance sets; it does not reapply the Foundation conservatism or compare the coaching value of fewer stations.

**Smallest principled improvement:** provide an approved Foundation efficient recipe that stays at the conservative end of the existing range, for example **2 RIR**, and retain heavy-role rules. Resolve redundant work before trimming every job toward one set. Author a short-session version with fewer assistance setups when necessary; keep the essential coverage and requested rest rather than silently shortening rest or deleting protected jobs.

### Q05 — Priorities and preferences do not reliably improve the intended prescription

**Classification: clear customization defect for unchanged muscle-priority prescriptions; likely suboptimal when preferences erase useful distinctions; several label-only comparisons are benign or debatable.**

**Issue and examples.** R061 (Growth three days, 45 minutes, chest priority) and R073 (Foundation Growth three days, 60 minutes, chest priority) are **exactly unchanged** when that priority alone is removed. Their ordinary chest work may be adequate; the finding is that the selection provides no additional prioritization. S080/S085/S090/S095/S100 are also unchanged under the same controlled comparison. In these Home contexts the press/row movement priorities remain, and have already driven the choice; adding chest/quads has no incremental effect.

S100 makes this especially conspicuous: Chest dips appear every day, while Sissy squat and Split squats provide only four normal-week quad sets. Neither the six-day chest emphasis nor the lack of additional quad emphasis can be justified as balanced treatment of the two stated muscle priorities. R030's priority substitution of curls for close-grip Smith bench is different: it can provide real additional chest exposure even though the primary label is triceps. Smith/trap-bar deadlift substitutions in the stress priority cases can also increase quad contribution without changing the primary quad-set count. Those are not automatic failures.

Preference interactions also remove distinctions. In S009 “Mixed,” the unilateral-knee job becomes **Smith machine squat 3 × 8–12** after history/preferences influence ranking. In S005 “Hip / mixed,” the incline job becomes **Chest press machine 3 × 4–8**, already used on the other day. These can be reasonable accommodations, but they should not be represented as preserving the original unilateral or incline stimulus.

**Prevalence:** 29 cases have muscle priorities. **7/29** have exactly unchanged prescriptions: R061, R073, S080, S085, S090, S095, S100. **26/29** show no increase in primary-labelled sets for any selected priority muscle; that broader count is **not** a count of ineffective prioritization. Unilateral jobs become bilateral in **12/200**, all S; incline jobs become flat presses in **4/200**, S005/S010/S015/S020.

**Likely cause:** preferences and movement priorities rank ahead of several intent characteristics; muscle priorities can act through secondary labels; selection lacks an explicit measure of whether the completed program has meaningfully honoured each priority. Additional priority work can also disappear during legitimate time fitting or profile simplification.

**Smallest principled improvement:** define a modest, authored criterion for prioritization: a more appropriate existing exercise, better ordering, protected useful work, or a complementary priority slot. Check it per selected muscle after all fitting, allowing an explicit “already satisfied / no room under this constraint” outcome. Preserve core job distinctions within preferred choices when available. Avoid adding sets universally or treating all secondary labels as equivalent priority credit.

### Q06 — Posterior and shoulder coverage is narrower than the number of jobs suggests

**Classification: likely suboptimal for comprehensive hypertrophy plans; acceptable but debatable omission in minimal or general-strength plans.**

**Issue and examples.** No gym program selects a knee-flexion exercise despite available leg-curl variants. R002 spends 15 weekly sets on the RDL machine and zero on knee flexion. A coach seeking broad hamstring development would normally consider complementary knee-flexion work instead of some repeated hinges: hip extension is productive, but does not make all hamstring functions/regions interchangeable. The same omission in R033's compact general-strength plan is easier to defend.

For shoulders, R002 has Cable lateral raise on both upper days and shoulder press on Upper B, but no specifically rear-delt-focused exercise. This does not prove its rows fail to train rear delts. S005 “Knee / horizontal” repeats Cable lateral raise twice; its “Hip / mixed” at least has Cable rear delt row with rope. This demonstrates that complementary selection is possible without adding total work. Direct curls, triceps, calves, or core are not universally required; their omission can be a good time/profile compromise or follow user exclusions.

**Prevalence:** **167/167 gym programs**, 92 R and 75 S, have no knee-flexion exercise. **186/200** lack a specifically rear-delt-focused movement; this is a review marker, not 186 failures. Horizontal rows are absent in **26/200**; constrained pulling availability and vertical pulling need contextual judgment rather than a universal pattern quota.

**Likely cause:** broad `hamstring_assistance` eligibility and primary-suitability ranking favour another hinge over an isolation; broad delt choices do not consider lateral work already present. Catalogue muscle totals can look comprehensive while the selected functions remain narrow.

**Smallest principled improvement:** prefer knee flexion in a hamstring-assistance job when a hinge is already present and equipment permits it. Prefer rear-delt work in a mixed-delt job when the week already has enough authored lateral work. Substitute existing work, do not automatically add isolation exercises to every Foundation, Strength, or two-day plan.

### Q07 — Returning-lifter relief does not necessarily reach the most consequential work

**Classification: likely suboptimal for the demanding six-day combinations; acceptable but debatable for moderate plans and a short interruption.**

**Issue and examples.** R075 sensibly moves from **30 → 41 → 49** total sets in weeks one through three. R094 moves **42 → 51 → 60**, but still uses the repeated posterior architecture described in Q02. In S100 the progression is **26 → 33 → 36**, while **16 protected sets remain unchanged**. The returning client still sees efficient prescriptions allowing 0–2 RIR, dips, glute-ham raises and six training days. In S075 the protected work remains 15 sets, including three sets each of the primary squat, bench and trap-bar deadlift; assistance is reduced, but those primary doses are unchanged.

Maintaining exercise identity and practice is a strength. Maintaining the full most demanding dose is a separate choice. A coach would ask how long the layoff lasted, previous skill and current capacity before confidently issuing these combinations. “Returning” alone does not establish that they are excessive, nor that all returning users need a deload or different RIR.

**Prevalence:** **22 returning programs**, 2 R and 20 S; all retain the same total protected-set count in weeks one and three. **4/22**, S025/S050/S075/S100, permit zero RIR on protected work in their six-day efficient prescriptions.

**Likely cause:** the set-only reentry rules reduce reducible/optional work and restore compound categories rapidly; protected work is not eligible for that reduction. The same efficient effort recipes remain in effect.

**Smallest principled improvement:** author a returning dose option that can reduce the quantity of demanding protected work while preserving its identity, frequency, rest and progression method. Calibrate it to the supported consistency information, with an explicit capability check for challenging bodyweight movements. This changes authored dose policy; it should be reviewed rather than implemented as a generic RIR modifier or wholesale removal of primary exercises.

### Q08 — Home equipment permission is treated as exercise capability

**Classification: acceptable exercise choices for capable clients, but likely suboptimal defaults without confirming capability; not a declaration that dips, chin-ups or glute-ham raises are bad.**

**Issue and examples.** S098 owns dumbbells and has `safe_pull`. The engine prescribes **Chin-up 2 × 8–12 at 0–2 RIR**, repeated across four days, rather than using a dumbbell row. `safe_pull` establishes a suitable environment, not an ability to perform that repetition prescription. S095/S100 have `training_support` and receive Chest dips and Glute-ham raises. Generic support does not identify a glute-ham device, suitable dip bars, assistance options, or present strength. Useful dumbbell alternatives exist in the same contexts.

No band exercise exists in the audited catalogue. S083/S093's bands therefore do not produce any band work, and their posterior job still becomes Sissy squat. Not using every owned piece of equipment is normally benign; lacking a selectable band option becomes consequential when bands are the user's only external resistance and a needed function cannot otherwise be met.

**Prevalence:** Glute-ham raise in **10/200**, unassisted Chin-up in **5/200**, unassisted Chest dip in **5/200**; the union is **15/33 Home cases**. All **12 contexts containing bands** select none. The band count alone is not a defect count.

**Likely cause:** Home ranks bodyweight ahead of dumbbells ahead of bands; coarse environment requirements and generic 8–12 bodyweight ranges do not encode achievable loading/skill or exact apparatus. Bands have no candidates.

**Smallest principled improvement:** narrow apparatus requirements for these few demanding movements and require a basic exercise/repetition capability indication before making them defaults. When unavailable, choose already vetted dumbbell alternatives. Add a small authored band candidate set only where it fills real missing functions. Avoid an unreviewed catalogue of improvised bodyweight regressions.

### Q09 — Default ordering can fatigue the movement the session is meant to practise

**Classification: likely suboptimal default for squat practice; acceptable and defensible with an explicit posterior-first intention.**

**Issue and examples.** R004 “Lower volume” starts RDL machine 3 × 4–8, then **Barbell back squat** with a three-set total-rep goal of 18, followed by two more RDL entries. Fatigue from hinging may reduce bracing and squat performance before a paired squat-practice exposure. R016 uses the same ordering but Leg press replaces the squat; that has less skill-specific concern, though the repeated posterior bias remains. This is not an argument that every knee-dominant movement must precede every hinge: a heavy hinge first with a later leg press is often sensible.

**Prevalence:** hinge before the knee-volume position in **all 15 Balanced four-day programs**, 10 R and 5 S. **Nine** contain Barbell back squat in that position; five contain Leg press and one Barbell lunge. The narrower squat-practice concern applies to those nine squat cases. The broader **74** hinge-before-knee-volume marker across families is not evidence of 74 bad orders.

**Likely cause:** authored Balanced four-day ordering privileges the hinge before the knee-volume/paired-practice job, independent of the selected exercise and its purpose.

**Smallest principled improvement:** put a paired squat-practice exposure before nonpriority hinge assistance, while retaining posterior-first ordering when that is explicit. This can be a small blueprint ordering change, not a universal compound-first or squat-first algorithm.

### Generation behavior traced to source

In [program-compiler.js](../../../../program-compiler.js), `normalizeCatalogue` at line 338 infers practical ranges, skill/suitability and apparatus requirements; `candidateFits` at line 492 permits primary-or-secondary matching; `candidateOrder` at line 509 ranks choices independently; `fitTime` at line 643 converts effort and trims sets; and `weekSchedule` at line 724 applies returning set reductions. The repeated Home coverage positions are authored at lines 230–245. These behaviors explain the patterns above; the recommendations distinguish changes to selection from changes requiring authored programming-policy review.

## Whole-week dose and distribution examples

These are comparisons of prescriptions, not universal dose targets. Normal-week movement functions can overlap; muscle labels are not summed into physiological “effective sets.”

| Program and context | Knee-dominant sets / days | Hinge sets / days | Knee-flexion sets / days | Chest-focused press sets / days | Most revealing interaction |
|---|---:|---:|---:|---:|---|
| R034, Foundation Growth 2 | 6 / 2 | 6 / 2 | 0 / 0 | 6 / 2 | Two coherent full-body days; lack of arm/calves isolation is a reasonable compromise. |
| R002, Growth 4 | 9 / 2 | 15 / 2 | 0 / 0 | 9 / 2 | Nine RDL sets in Lower B occupy three intended jobs. |
| R027, bodyweight Home 3 | 21 / 3 | 0 / 0 | 0 / 0 | 9 / 3 | False posterior substitution accumulates quad work. |
| S096, bodyweight Home 6, 30 min | 10 / 5 | 0 / 0 | 0 / 0 | 4 / 2 | Calves get 12 sets on four days; added days distort coverage. |
| S098, dumbbell Home 6 | 4 / 2 | 6 / 3 | 0 / 0 | 4 / 2 | Chin-ups get 16 sets on four days without a lat-priority request. |
| S100, returning Home 6, chest + quads | 4 / 2 | 0 / 0 | 6 / 3 | 16 / 6 | Dip frequency, unchanged protected dose and ineffective incremental priorities compound each other. |

The set has substantial machine use, which is often a strength for hypertrophy, stability and load tracking. Its weakness is not that machines are selected: it is that the same highest-ranked machine can repeatedly consume jobs intended to be complementary. Direct chest, knee-dominant work and pulling are generally retained in ordinary gym plans. Arms and trunk appropriately become secondary considerations in several compact programs. Comprehensive posterior function and constrained Home distribution are much less reliable.

## What the engine already does well

- **Purposeful continuity:** R003 uses the same squat and bench for the Balanced primary and volume exposures. Primary day has one 3–5 anchor plus two 6–8 backoffs at 80% anchor load; Volume day uses a total-rep goal. This is useful repeated practice with different prescriptions. Changing exercise names for variety would weaken it.
- **Coherent simple entry training:** R034 and R066, Foundation Growth two days, have five exercises and 14 work sets per session, stable choices, ordinary ranges and 2–3 RIR. Knee/hip, push and the two pulling directions are distributed clearly. Three sets of a simple lift are not automatically incompatible with Foundation.
- **Meaningful time compromises:** R033 removes optional curls to retain four exercises per session and the Strength primary work. S056 retains three 3 × 5 primaries at 2–3 RIR while using two-set assistance and the requested 180-second rest. For an experienced lifter this is an intelligent tradeoff, even though individual rest and effort tolerance still need adjustment.
- **Coherence with little equipment:** R097, Home three days with dumbbells and no pulling/support capability, uses Dumbbell deadlift and Dumbbell bent-over row for real hip/pull work alongside push-ups and knee work. It does not need a pull-up bar to train the back. Sissy squat selection still merits a client suitability check.
- **Respect for specific user choices:** S004 removes direct biceps/triceps work as requested while retaining useful compounds; disliked leg press/chest press become Smith squat and an assisted chest dip, and preferred dumbbell incline/row choices remain useful. Compound secondary arm involvement is a sensible interpretation of a direct-work exclusion.
- **Dose ramp without unnecessary novelty:** R075's 30 → 41 → 49 set ramp retains the same exercises. This is more coherent than replacing the program during each returning week, although Q07 identifies where the protection policy needs refinement.
- **No need to fill every available minute:** R058/R059 retain the same Growth two-day work at larger budgets. More available time does not force extra work. Most default gym prescriptions use plausible set counts, loading ranges and nonfailure effort instead of arbitrary exhaustion.

## Choices that deserve qualification, not defect labels

Standard heavy sets commonly have 120-second rest, other compounds 90 seconds, accessories 60 seconds; long-rest stress contexts preserve requested rest. Two minutes may be insufficient for some users' heavy squat/bench performance, but there is no universal evidence-based rest minimum that makes all these prescriptions wrong. Adjust for recovered performance and the actual lift. Likewise, 4–8 on a stable machine can be useful; 8–12 is not mandatory for hypertrophy.

Balanced's fixed **80% of anchor load** backoffs deserve calibration against actual completed reps and effort. Because the anchor itself is a low-rep set at 2–3 RIR, six to eight repetitions at that reduced load may be quite easy for some clients. This is **acceptable but debatable**, not a demonstrated stimulus failure: no actual loads or achieved RIR were observed. There are **40 programs using anchor/backoff** in this set. A narrow improvement would be monitoring achieved backoff effort rather than assuming the fixed percentage fits everyone; it requires authored progression review.

R033 has no isolation exercise and only one heavy exposure per specific barbell lift. It is a defensible **general strength** program under the project's intent, not a powerlifting competition plan. A client targeting a particular tested 1RM may need more specific practice. Missing direct arm or calf work in such a program is not automatically deficient. Missing a vertical pull in a dumbbell Home program with effective rows is also defensible.

Identical exercises on different days are frequently beneficial for skill and measurable progression. Even same-session heavy and lighter work can be deliberate. The relevant questions are whether the prescriptions/functions differ, whether the week's dose is intended, and what complementary work was displaced.

## Stronger and weaker blueprints

| Archetype | Qualitative assessment |
|---|---|
| Growth 2–3, ordinary gym equipment | Among the stronger defaults: recognizable full-body prescriptions and useful coverage at moderate complexity. Improve complementary hamstring selection; the 30-minute Foundation version is materially weaker. |
| Balanced 3, standard | Strong primary/volume continuity with coherent full-body distribution. Its relative strength is specificity with useful assistance, not maximum variety. |
| Strength 2–3, standard | Coherent general-strength work, especially the concise three-day version. Foundation ranking changes this assessment substantially. |
| Growth 4–6 | Systematically weaker posterior composition: all 38 audited cases contain three hinge entries in a session. More days do not resolve the job-selection issue. |
| Balanced 4 | All 15 cases show the posterior-heavy lower-volume ordering and three hinge entries. This blueprint is weaker than Balanced 3; Foundation also inherits Q03. |
| Balanced 5–6 / Strength 4–6 | Useful split/distribution scaffolding, but repeated assistance and efficient effort need contextual review. Six days are not inherently excessive; returning combinations are less reassuring. |
| Home 2–3 with dumbbells | Can be coherent; R097 is a good example. Capability-aware selections remain necessary. |
| Home without an available posterior candidate | Systematically vulnerable to fake posterior coverage or repeated split-squat substitution. A missing pull capability is an honest limitation; a false posterior prescription is not. |
| Home 4 | Broad mixed jobs begin to repeat calves or pulling rather than establish purposeful coverage. |
| Home 5–6 | Weakest completion behavior: all ten audited cases collapse the final three jobs into one exercise, with substantial unintended dose/frequency consequences. |

## Shortlist most in need of revision

This is a practical review shortlist, not a validated numeric ranking or a claim of inevitable harm.

| Program | Why a coach should revise it |
|---|---|
| **S100** | Returning, six days, dips all six days; 16 chest sets vs four quad sets despite both priorities; unchanged muscle-priority counterfactual; demanding bodyweight defaults; protected dose unchanged. Most consequential interaction of findings. |
| **S096** | Six-day no-equipment plan replaces posterior work with sissy squats and repeatedly uses calves for coverage; only four push-up sets, 12 calf sets, no genuine posterior function. |
| **S091** | “Hip” session is only sissy squats; “Mixed coverage” is seven calf sets in three entries. The session purposes cannot be defended as described. |
| **S095** | Returning five-day plan ends with nine same-exercise dip sets, despite a second quad priority and no incremental muscle-priority effect. |
| **R027** | Ordinary three-day bodyweight choice produces false posterior work and 21 knee-dominant sets. This is not confined to unusual high-frequency stress inputs. |
| **R068** | Foundation plan repeats the same split squat 21 sets/week, including nine sets in three entries on day one; glute work is real but the distinct jobs disappear. |
| **R016** | Foundation heavy barbell lunge/decline defaults plus repeated lunges and triple-RDL Lower volume day; several small selection weaknesses combine in one entry plan. |
| **R002** | Otherwise respectable Growth four-day plan spends 15 sets on one RDL machine, including nine in Lower B, with no knee-flexion work. A narrow substitution could improve it substantially. |
| **S098** | Six-day dumbbell plan becomes 16 chin-up sets across four days, only four knee/push sets, and no row; actual chin-up capacity is unknown. Review selection and distribution before issuing. |

## Especially coherent examples

| Program | What makes it comparatively strong | Remaining qualification |
|---|---|---|
| **R034 / R066** | Simple two-day Foundation Growth, stable exercise choices, ordinary 2–3 RIR, balanced session sizes and purposeful main functions. | A knee-flexion substitution could broaden hamstrings; individual starting volume remains a coaching choice. |
| **R003** | Same squat/bench across intentionally different primary and volume exposures; useful pulling and hip work; no accidental within-session duplicate. | Calibrate backoff effort and consider one complementary hamstring movement. |
| **R033** | Four exercises per day, Strength primaries first, 3 × 5 at 2–3 RIR; removes optional arm work sensibly at 45 minutes. | General-strength intent; rest and individual lift skill matter. |
| **S056** | Preserves requested 180-second rest and heavy roles while reducing assistance to two sets. | Efficient 0–2 RIR assistance is appropriate only with capable effort management. |
| **R097** | Dumbbells supply genuine hip and back work without requiring unavailable pulling apparatus; no within-session duplicate. | Sissy-squat appropriateness and manageable dumbbell loading need checking. |
| **S004** | Preferences, dislikes and direct-arm exclusions produce sensible alternative movements rather than a broken weekly structure. | Unsupported bent-over rows followed by hinging can share fatigue; client technique/capacity matters. |
| **R010 / R026** | Recognizable two-day full-body Growth; R026 trims optional curls rather than essential movement functions to fit 45 minutes. | The same complementary hamstring caveat, without a need to add total work. |

These are relative strengths, not certifications that every individual client should begin them unchanged.

## Recommended changes by improvement versus regression risk

| Order | Change | Expected benefit | Regression risk / containment |
|---|---|---|---|
| **1** | Correct sissy-squat posterior suitability and narrow the Home posterior function. | Removes a clear stimulus mismatch in ordinary and stressed inputs. | Low for correctness; some bodyweight contexts will need an explicitly authored reduced-coverage alternative. Do not silently fabricate exercise availability. |
| **2** | Author three distinct Home coverage functions; discourage unintentional same-session assistance reuse. | Repairs all audited Home 5–6 mixed days and much downstream volume/frequency distortion. | Low–moderate if scoped; preserve deliberate heavy/volume pairing and client preferences. |
| **3** | Prefer knee flexion in an existing hamstring-assistance job after hinge work. | High improvement in comprehensive gym lower-body design without extra volume. | Low when equipment and job permit it; retain minimalist Strength/Foundation compromises. |
| **4** | Curate Foundation heavy-primary suitability and give it a conservative efficient recipe. | Removes systematic awkward defaults and preserves simpler effort management. | Low–moderate; review concrete exercises/rep classes rather than applying equipment-wide rules. |
| **5** | Put paired squat practice before nonpriority hinge assistance in Balanced 4. | Improves specificity/fatigue sequencing in a weak authored day. | Low and narrowly scoped; keep explicit hinge-priority exceptions. |
| **6** | Add basic capability/apparatus checks for unaided chin-ups, dips and glute-ham raises. | Makes Home defaults more defensible; uses existing alternatives. | Moderate because it introduces client capability handling; keep the scope small and explicit. |
| **7** | Evaluate meaningful priority satisfaction after selection and time fitting. | Prevents no-op personalization and unbalanced treatment of multiple priorities. | Moderate; avoid mandatory extra volume or overriding hard exclusions/time constraints. |
| **8** | Author short Foundation sessions around fewer useful setups after redundancy is resolved. | Better learning/time value than many one-set stations near failure. | Moderate; changing station count can remove valuable functions. Use reviewed short blueprints. |
| **9** | Author a returning set-only dose option for demanding protected work. | Better reentry calibration while keeping program identity. | Moderate–higher because protected-dose policy changes; avoid arbitrary universal reductions. |
| **10** | Review mixed-delt selection and monitor anchor-backoff effort. | Useful smaller coverage/calibration improvements. | Low for existing-job substitutions, moderate for progression changes; actual performance should guide calibration. |

Validation should reuse these exact contexts and compare complete weeks. Check whether function, volume distribution, progression relations, time compromises, exclusions and priorities remain coherent, rather than celebrating fewer duplicate IDs. No engine change was made in this audit.

## Final judgment

**No: a highly competent coach could not confidently hand every currently generated program directly to users without manual review.** The objection is not that every plan is poor, or that all need more sets or variety. Several defaults are readily defensible. However, clear function mismatches and predictable whole-week distortions occur in supported, ordinary choices, and Foundation/returning capability assumptions remain uneven. Correcting the few highest-impact selection and authored-job behaviors should improve quality substantially without redesigning the entire engine.
