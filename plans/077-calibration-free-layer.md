# Plan 077: effort calibration, Free layer

Status: **approved (owner, 2026-11-05)**. Product ODs are decided; the remaining technical ODs (storage keys, estimator, resets, validation) take their proposed defaults; copy (OD-22) is reviewed in each PR; OD-21 stays open (§3). Docs only.
The RIR credit cap (OD-23b) shipped first as its own engine PR, #624.
Source: the owner on 2026-11-05 ("Let's build this before the alpha release") and the strategy synthesis
`calibration-strategy-2026-11-05.md` (§3, §3.1, §4, §5, §9.1, §12). Owner corrections from 2026-11-05 are
folded in: the calibration observation is a pre-set guess followed by a max-reps set, and there is one
user-level calibration gauge.
Written against `main` f40d84f2e and updated against 98b80ee5; check for drift before executing.

Out of scope: Pro, trials, paywalls, billing, clusters, any telemetry change (frozen; synthesis §12.6), and a
Training Profile dashboard.

## 1. Problem

Taurifer turns every logged set into capacity, `effectiveLoad × (1 + (reps + RIR)/30)`
(`progression-engine.js:325`). RIR is therefore half of every suggestion, but Taurifer:

- stores a typed RIR, an Easy/Hard/Max label (mapped to 3/1/0) and an untouched prefilled target in the same
  `rir` number, so nothing downstream can tell them apart (§2, A5);
- never checks whether a lifter's RIR reports are right. Someone who logs "2 left" when 5 were left gets
  suggestions that are too light for as long as they train. Someone who logs "3 left" when 1 was left gets
  suggestions that are too heavy;
- offers two effort vocabularies (numeric, Easy/Hard/Max) with nothing in between, and locks the switch
  while a workout is in progress (`app.js:3228-3235`, `toast.rir_locked_draft`).

The Free layer fixes those three things:

1. **Effort provenance.** Each logged row records how its effort was entered.
2. **A three-stage effort vocabulary.** The user chooses the stage, and switching is lossless.
3. **An optional max set on every exercise except the big barbell lifts.** The lifter guesses their reps, then
   goes to failure. The guess errors feed a bounded, versioned, per-exercise bias correction into the existing
   engine, and one honest user-level calibration-evidence gauge.

The audit in §2 comes first: several documented RIR rules are no longer what the code does.

## 2. Engine RIR audit

Scope: `progression-engine.js` (engine `069.1`, formula `rir-adjusted-epley@067.1`) and the `app.js` paths
that feed and explain it, compared with:
- ADR 0003, `docs/adr/0003-capacity-as-progression-currency.md`;
- the strategy contract, `docs/progression-strategy-contract.md`;
- the user-facing mechanics doc, `docs/progressive-overload-mechanics.md`;
- Plan 067, `plans/067-engine-replacement.md`, which governs the current engine.

Nothing here is fixed by this PR. OD-23 holds the decisions these items need.

### 2.1 What the live engine does

| Topic | Live behaviour | Evidence |
| --- | --- | --- |
| Live path | `recommendation()` always calls `engine.recommendSets(...)` and always returns a `targetSets` array. Every suggestion, prefill and Why reader takes the engine branch first. | `app.js:6284-6285`; guards at `app.js:6421`, `6475`, `6526`, `23265` |
| Missing RIR | The set is **dropped**: `parsePerformedSet` returns `null` (not `{ok:false, reason}`), so no reason code reaches the caller. If no anchor remains, the result is `manual` with `no_comparable_history`. | `progression-engine.js:294-295`, `539-545`; the app sends `rir:null` at `app.js:6193` |
| Missing RIR on set 1 | The history anchor is the median of **set index 0** of the last three sessions. A session whose first set has no RIR adds nothing to the anchor, even if its later sets do. | `progression-engine.js:351-353`, `391-408` |
| Coarse effort | `EFFORT_RIR = {easy:3, hard:1, max:0}`; the reverse bucket is `effortForRir` (≥2.5 easy, ≤0.5 max). The mapped value is stored in `rir` like a typed one. | `app.js:1463`, `1467`; `workout-draft.js:14`, `1543-1545`, `1586-1590` |
| Trust ceiling | **None.** The engine credits any finite RIR ≥ 0, uncapped. A logged RIR 10 adds 10 reps of capacity. Target RIR is bounded 0–6 (`progression-engine.js:93`); performed RIR is not. `hardRir` is never passed to the engine. | `progression-engine.js:295`, `325`; `app.js:6284-6285` |
| `hardRir` today | Repurposed as the **hard-set volume threshold** (sets at or below it count as hard). Settings already labels it that way. | `progress-model.js:191-193`, `229-230`; `app.js:3960-3990`; `index.html:454`; `i18n-en.json:633` |
| Fatigue | The median adjacent-set capacity drop over the last three sessions, clamped to [0, 0.15], compounded from the anchor to the target set. RIR enters only through each set's own capacity. | `progression-engine.js:355-389` |
| Per-set RIR | Each set's own RIR sets its capacity. The live anchor is the latest completed set before the target, and the history anchor is set index 0 only. The engine's `predictedRir` never reaches the UI; the shown target is the authored `prescription.rir`. | `progression-engine.js:325`, `410-437`, `475`, `610`; `app.js:23206` |
| Live vs committed effort | In effort mode, the live session reads only `edited.effort`, so a completed set whose effort the lifter never touched has no RIR and is **dropped from the live anchor**. At commit, `effectiveText` falls back to the prefilled `suggestedEffort`, so the same set is **saved with the mapped prefill**. `completeSet` marks `touched.effort = true` without materialising the value, so after completion "entered" can't be told from "accepted the prefill". | `app.js:6225-6227`; `workout-draft.js:1018`, `1543-1545`, `1351-1359` |

### 2.2 Discrepancies

**Headline (the five that matter for this plan):**

- **A1 — high. Missing RIR is documented as "assume 1" but the engine drops the set.**
  - The docs: ADR 0003 (`:29-31`, via `capRir`), contract `:88` ("blank or missing RIR = 1"), and the
    user-facing mechanics doc `:94` ("If you leave effort blank, the app assumes 1 rep in reserve").
  - The code: the engine drops the set (`progression-engine.js:294-295`), as Plan 067 `:191-193` specifies.
    The user-facing doc is wrong today.
- **A2 — high. The `hardRir` trust ceiling no longer exists on the live path.**
  - ADR 0003 `:14-16`, `:29-31` and contract `:88`, `:94`, `:132` cap RIR credit at `hardRir` (default 4).
  - The cap survives only in `capRir`/`capReps`/`capE1rm` (`app.js:1401-1411`), which nothing on the live
    path reaches (see the next item). The engine credits uncapped RIR.
  - Plan 067 dropped the cap without a recorded decision. This matters directly for calibration: an
    over-reported RIR inflates capacity without limit.
  - **Resolved:** the owner restored the cap at 5 (OD-23b), shipped in #624.
- **A3 — high. The ADR 0003 capacity layer in `app.js` is unreachable.** These all sit behind the
  `Array.isArray(rec.targetSets)` early returns and never run:
  - `baseSuggestion` (`app.js:6419-6430`);
  - the legacy branch of `setSuggestion` (`app.js:6473-6495`);
  - `typicalRir` (`app.js:5755-5757`);
  - `expectedSetDrop`/`historicalSetDrop` (`app.js:6355-6377`);
  - `sessionFreshness` (`app.js:6392-6415`);
  - the legacy Why rows (`app.js:6529-6555`).
  - `recoverSignal` (`app.js:5839-5844`) has no production caller, only a test export at `app.js:11647`.
  - ADR 0003 still reads as current.
- **A4 — high. The strategy contract has no runtime implementation.** The contract's strategies (`range@1`,
  `rep_goal@1`, `effort_target@1`, `anchor_backoff@1`, `paired_exposure@1`) and `evaluateProgression` appear
  in no production `.js` file. Plan 067 `:26-27`, `:238` removed "selectable strategy engines". The contract
  is still marked owner-approved and is cited by the synthesis (§5) as current.
- **A5 — medium. Effort source is lost, and the live and committed paths disagree on untouched effort.**
  - A label-mapped 3/1/0 and an untouched prefill are stored exactly like a typed RIR. ADR 0003 `:31` says
    effort words "sit inside the cap", but there is no cap (A2).
  - The live anchor drops an untouched effort-mode set; the saved row keeps its prefill (§2.1, last row).

**Lower:**

- **A6 — medium. Four different readings of missing RIR.**
  - The engine drops the set (A1).
  - Progress withholds a verdict with `missing-effort` (`progress-model.js:395`, `424-425`; `app.js:11724`,
    `11753`).
  - The dead `capRir` assumes 1 (`app.js:1408-1409`).
  - `sessionsFor`'s `avgRir` coerces it to **0** through `avg()`'s `Number(x||0)` (`app.js:1384`, `5746`,
    `5751`). `avgRir` feeds only the orphaned `recoverSignal`, so this is latent.
- **A7 — medium. Legacy migration.** A pre-metric `range` row with missing RIR is coerced to `posNum("")`
  (0) for arithmetic and flagged `rirMeasured:false` (`app.js:3381-3390`). Progress reads it as missing
  (`app.js:11724`). Pre-metric rows can't reach the engine (`app.js:6190`), so this is consistent today. It
  is still a second, older provenance flag that OD-1 must not collide with.
- **A8 — low. `hardRir` bounds.** The contract says 1–10 (`:132`); `normSetting` enforces only ≥ 0
  (`app.js:1649`).
- **A9 — low. ADR 0003's tail is out of date.** "Stall/recover gates survive" (`:43`) no longer holds:
  `isStalled` is live in the block summary (`app.js:3986`), but `recoverSignal` is orphaned.

**Not a discrepancy:** fatigue. The engine's fatigue model is the one Plan 067 specifies, and it never used
RIR separately.

## 3. Owner decisions

The owner was interviewed on 2026-11-05. The decisions are recorded in the brief, `calibration-077.md`, under
"Owner decisions (interview, 2026-11-05)". Each OD is marked:
- **Decided:** the owner settled it; the text records the decision and any numbers this plan adds to it.
- **Proposed:** a default the owner hasn't ruled on yet.
- **Open:** a question the owner has asked to keep open.

| OD | Topic | State |
| --- | --- | --- |
| OD-1 | `effortSource` row key | Proposed |
| OD-2 | "Not sure" is unknown effort | **Decided** |
| OD-3 | "3+" stored as 3 | Proposed |
| OD-4 | One app-wide stage choice | **Decided** |
| OD-5 | Switch applies from the next set | **Decided** |
| OD-6 | Stage tip between sets | **Decided** |
| OD-7 | Guess, then max-rep set | **Decided** |
| OD-8 | Technical failure definition | Proposed |
| OD-9 | Prefill `reps + RIR − 1` | **Decided** |
| OD-10 | The guess error is the bias signal | **Decided** |
| OD-11 | Eligibility: everything but the big barbell lifts | **Decided** (custom exercises: proposed) |
| OD-12 | Frequency limits | **Decided** |
| OD-13 | Prompts on by default | **Decided** |
| OD-14 | Estimator | Proposed (minimum of 3 checks decided) |
| OD-15 | Four internal states | Proposed |
| OD-16 | Confidence resets for the engine | Proposed |
| OD-17 | `calibration` row key | Proposed |
| OD-18 | Engine shift and load bound | **Decided** |
| OD-19 | The max set counts for progression | **Decided** (fatigue exclusion proposed) |
| OD-20 | User-level gauge: six signals | **Decided** (weights approved 2026-11-05; real counts in the breakdown; small gauge on Today from the first workout) |
| OD-21 | The gauge and Pro | **Open** |
| OD-22 | Why and result copy | Proposed (copy review) |
| OD-23 | Audit follow-ups | (b) **Decided and shipped in #624**; (a) partly shipped; the rest proposed |
| OD-24 | Strict transfer validation | Proposed |
| OD-25 | "Was the last rep slow?" | **Decided**: asked on the last set of each exercise only; storage as proposed |

### Effort provenance and stages

- **OD-1, provenance field: one optional row key, `effortSource`. Proposed.**
  - It's a string enum recorded at commit:

    | Value | Meaning | `rir` holds |
    | --- | --- | --- |
    | `rir` | a typed numeric RIR | the number |
    | `effort` | an Easy/Hard/Max label | 3/1/0 |
    | `reps_left` | a stage-B chip 0, 1 or 2 | the chip |
    | `reps_left_3plus` | the stage-B chip 3+ | 3, as a floor |
    | `unsure` | "Not sure" from the effort menu (OD-2) | `null` |
    | `prefilled` | the lifter never touched effort; the value is the prefill | the prefill |
    | `failure` | a max set (OD-7) | 0 |

  - Absent means unknown. Old rows are **never backfilled**.
  - The legacy `rirMeasured:false` flag stays as it is.
  - History edits of RIR set `effortSource:"rir"`, alongside the existing `rirMeasured:true`.
- **OD-2, "Not sure" is unknown effort. Decided.**
  - It lives in the arrow menu on the effort label, in every stage. It is saved as `rir:null` with
    `effortSource:"unsure"`.
  - The engine drops the set as it does any missing RIR (A1), and Progress shows `missing-effort`.
    Taurifer never invents a value.
- **OD-3, "3+" is stored as 3 with `reps_left_3plus`. Proposed.** The engine credits 3, a floor that
  understates capacity when more were left. That's the safe direction.
- **OD-4, the stage is one app-wide choice. Decided.**
  - The lifter changes it from the arrow on the effort label or in Settings.
  - **Stage A:** the lifter taps the word directly (Easy / Hard / Max chips).
  - **Stage B:** chips 0 · 1 · 2 · 3+.
  - **Stage C:** the numeric field.
  - **Storage (proposed):** `rirMode` keeps its two values. Stage C is `rirMode:"numeric"`; stages A and B are
    `rirMode:"effort"`. A new device-local setting, `effortScale: "feel" | "reps"`, tells A from B.
    - A third `rirMode` would break the setup-link settings tuple (`shared-setup.js:35`, `886`, `901`) and
      the transfer draft validator (`install-transfer-contract.js:839`).
    - `effortScale` isn't shared in setup links. A recipient of a stage-B sender gets stage A.
- **OD-5, a switch applies from the next set on. Decided.** Today `changeRirMode` refuses while a workout is
  in progress; the lock goes.
  - Completed sets keep their value and source.
  - A pending set the lifter already edited keeps that edit.
  - The rest of the workout's pending sets get the new control and prefill.
  - This needs three draft rules (§6.2): completion materialises the value, a vocabulary edit clears the
    sibling field, and the source is decided per set.
- **OD-6, the stage tip sits between sets. Decided.**
  - It's a dismissible tip **during rest only**. It never blocks logging and never appears while a set is
    being entered.
  - **When it shows (proposed numbers):**
    - **A→B:** after 6 completed workouts in stage A where ≥ 80 % of working sets have a lifter-chosen
      label (not `prefilled`).
    - **B→C:** after 6 workouts in stage B where ≤ 10 % of working sets are "Not sure".
  - **Snooze (decided):** dismissing keeps it quiet for **4 weeks**; after a second dismissal it never shows
    again.
  - Taurifer never suggests a stage down. Settings and the arrow menu always offer all three stages.

### The max set (calibration observation)

- **OD-7, protocol: a guess, then a max-reps set. Decided.**
  1. **Before the exercise's last working set**, a dismissible prompt offers the check. The lifter chooses
     each time.
  2. If they accept, the rest screen asks how many reps they can do at the same load: "How many reps can
     you do at 60 kg?" The guess `P` is prefilled (OD-9), and the lifter can change it with a stepper (1–30).
  3. The last set is done **to technical failure** at the same load. The lifter logs the actual reps `A`.
  4. **It's a normal set at 0 reps left.** It counts for progression and records, and the guess is stored
     beside it (OD-17). The row has `rir:0` and `effortSource:"failure"`.

  The max set **replaces** the last working set; it never adds one (synthesis §3.1).
- **OD-8, technical failure. Proposed definition, for the copy shown on the set.**
  - **The rule:** stop at the last rep that you complete with the same range of motion and control as your
    first rep. The next rep you couldn't finish that way doesn't count.
  - **Also not counted:** partial reps, bounced or swung reps, or a pause longer than about 2 s to rest
    mid-set.
  - **Safety:** stop at once on pain.
  - **Presses (decided):** the safety line on every press reads "Only to failure on presses if you can
    safely drop or rack the weights." PT (pending copy review): "Só vá até a falha em exercícios de empurrar
    se puder largar ou apoiar o peso com segurança."
  - EN copy: "Go until you can't do another full, clean rep. Stop if anything hurts." PT: "Vá até não
    conseguir mais uma repetição completa e limpa. Pare se algo doer." (Pending owner copy review.)
- **OD-9, prefill: `P = n + r − 1`. Decided.**
  - `n` and `r` are the previous working set's reps and RIR, at the same load in the same session.
  - The 1 is the fatigue allowance for one more rest and one more set.
    - Rep loss between consecutive near-failure sets at the same load with normal rests is commonly 1–2
      reps.
    - An allowance that is slightly too small makes untouched guesses read as small over-estimates, which
      only lowers loads (OD-18).
  - **Previous RIR:**
    - An effort label uses its mapped value.
    - "3+" uses 3.
    - "Not sure" or missing prefills `P = n`, marked `prefillBasis:"reps"`.
- **OD-10, the guess error is the bias signal. Decided.**
  - **Main signal, feeds the bias estimate:** `e = P − A`, in reps.
    - Positive means the lifter expected more reps than they did: they over-estimate their reserve.
    - Negative means they under-estimate it.
  - **The previous set's implied error, `(n + r − 1) − A`, is not used.** With an untouched prefill it is
    identical to `P − A`, so counting both would double-count one set. The projection computes it only as a
    test-visible diagnostic (`impliedError`), never stored and never shown.
  - **Untouched prefills count fully.** `predictionEdited` is stored, so a later version can weight them
    differently without a migration.
- **OD-11, eligibility: everything except the big barbell lifts. Decided.**
  - **Excluded:** barbell squat, bench and deadlift and their barbell variants.
  - **Rule:** an exercise is excluded when both of these hold:
    - its movement pattern is Squat, Hip Hinge or Horizontal Push;
    - it is loaded with a free barbell: barbell, axle, buffalo, cambered, safety-squat, Swiss or trap bar
      (not Smith, EZ, fixed-weight or landmine).
  - **Equipment:** when the performed equipment is known (the row's `equipmentId`), the rule reads that.
    Otherwise it reads the catalog's equipment options, and any free-barbell option excludes the exercise.
  - **Count:** on today's catalog this excludes **111 of 1,345** exercises, leaving **1,234** eligible.
    - Examples: back, front, pause and tempo squats; bench, incline, decline, floor and board presses;
      conventional, sumo, Romanian, straight-leg, trap-bar and block-pull deadlifts; and barbell good mornings.
    - Dumbbell presses and rows, machines, cables and bodyweight moves stay eligible.
  - **The press safety line (OD-8)** shows on the 160 eligible presses (Horizontal and Vertical Push).
  - **Custom exercises (proposed):** eligible unless their name matches squat, bench or deadlift (EN) or
    agachamento, supino or levantamento terra (PT). A custom exercise has no catalog fields to read, so this
    is the best available check. Open alternative: exclude all custom exercises.
  - **Each check also requires:** at least 2 working sets on that exercise today (so there is a previous set
    at the same load), a prescribed rep target ≤ 20, and `P` between 1 and 30.
  - **Versioning:** the rule is versioned (`eligibility@077.1`) and pinned by a fixture listing the 111
    excluded IDs.
- **OD-12, frequency. Decided.** The prompt appears only when all of these hold:
  - the prompts are on (OD-13);
  - the exercise is eligible;
  - it's the exercise's last working set;
  - at most **one** check per workout;
  - at most **one** per exercise key every **14 days**;
  - at most **two** per calendar week;
  - not in a lighter (deload) week;
  - **not right after a Max / 0-RIR set**;
  - not after the lifter reported pain or discomfort for that exercise today.
  - **At a gauge of 100 % (OD-20):** checks are offered **at most once a month**, but they keep being
    offered.
- **OD-13, prompts on by default. Decided.**
  - The prompt is dismissible, and the lifter chooses each time.
  - Settings › Effort has a switch, "Max-set prompts", on by default, that turns the prompts off.
  - Dismissing a prompt doesn't count against anything and doesn't change future prompts.

### Calibration projection and the engine

- **OD-14, estimator: a shrunken mean per comparable key. Proposed; the minimum of 3 checks is decided.**
  - **The key** is the engine's comparability key: `exerciseId`, `equipmentId`, `loadingConvention`,
    `metricIds` (`progression-engine.js:295-297`).
  - **Observations:** a key's last **6** valid checks, after its last reset (OD-16) and no older than
    **180 days**.
  - **Error clipping:** each `e` is winsorised to [−5, +5].
  - **Bias:** `b̂ = Σe / (n + k)`, with prior weight **`k = 2`** pseudo-observations at 0.
    - With few checks, `b̂` stays near 0; with many, it approaches the plain mean.
    - One check of −3 gives `b̂ = −1.0`, not −3.
  - **Spread:** `s` is the sample standard deviation of the winsorised errors (n ≥ 2).
- **OD-15, the four internal states. Proposed.** They are never shown as labels.

  | State | Rule |
  | --- | --- |
  | uncalibrated | n < 3; or the rows below don't apply |
  | tends to under-estimate reserve | n ≥ 3, `b̂ ≤ −0.75`, `s ≤ 1.5` |
  | tends to over-estimate reserve | n ≥ 3, `b̂ ≥ +0.75` (no spread condition: its effect only lowers loads) |
  | consistently calibrated | n ≥ 3, `|b̂| < 0.75`, `s ≤ 1.25` |

  A lifter with small bias but a large spread stays uncalibrated, reason `inconsistent`.
- **OD-16, confidence resets for the engine. Proposed.** These reset the engine's bias, not the gauge. The
  gauge only fades (OD-20).
  - **A new machine or loading setup** is a different key, so it starts uncalibrated.
  - **A long break:** a gap of **≥ 42 days** between two completed sessions of the same key discards that
    key's checks from before the gap.
  - **Changed loading:** checks whose loading context no longer matches the current configuration (the
    engine's `loading_convention_mismatch`) are excluded.
  - **Age:** checks older than 180 days drop out.
- **OD-17, row storage. Proposed.** The max-set row adds one optional key:
  `calibration: {v: 1, predictedReps: P, predictionEdited: bool, prefillBasis: "reps_rir" | "reps"}`.
  Everything else is derived and versioned by the projection; nothing derived is stored:
  - `A` is the row's own `reps`;
  - the previous set is `setIndex − 1`;
  - the errors are computed from those.

  History edits:
  - Editing `reps` keeps the block; the lifter is correcting `A`.
  - Editing `load` removes the block; the check's same-load premise no longer holds.
  - Editing RIR to anything other than 0 removes it too.
- **OD-18, how the bias enters the engine. Decided.**
  - **From 3 checks**, on a key in a "tends to" state, the engine reads each comparable row's RIR as
    `max(0, rir − Δ)`:
    - over-estimate: `Δ = min(b̂, 2.0)`;
    - under-estimate: `Δ = max(b̂, −1.0)`;
    - uncalibrated or consistently calibrated: `Δ = 0`, today's behaviour exactly. That is the conservative
      fallback.
  - **Rows that aren't shifted:** `failure` rows (their RIR 0 is measured) and rows with `rir: null`.
  - **The load bound:** the engine computes the uncalibrated selection too. The calibrated target load may
    differ from it by at most **one available-load step up** or **two steps down**.
  - **What that means in capacity:** a shift of Δ reps changes capacity by `Δ/(30 + reps + min(RIR, 5))`,
    about ±2.4 % per rep for a 10-rep set at 2 RIR. So capacity moves at most about **+2.4 % or −4.8 %**,
    then the step bound applies.
  - **Versioning:** `ENGINE_VERSION` `077.1` (set by the cap in #624) → `077.2`, and a new
    `CALIBRATION_VERSION = "calibration@077.1"`. `FORMULA_VERSION` is unchanged.
  - **Assumption, stated plainly:** this applies a pre-set guess bias to ordinary in-set RIR reports. The two
    are related but not the same skill (synthesis §1). The bounds and the asymmetry exist because of that.
- **OD-19, the max set counts for progression. Decided.** It's a genuine RIR-0 set,
  `capacity = L × (1 + A/30)`, measured rather than reported.
  - The engine treats it as an ordinary performed set; it already parses `rir: 0`. It counts for records
    and Progress as a measured hard set.
  - It is never RIR-shifted.
  - As the last set, it never becomes an anchor (anchors are set index 0 or the live previous set).
  - **Proposed:** exclude it from the fatigue estimate, because the drop into it mixes reporting error with
    fatigue.

### The calibration gauge

- **OD-20, one user-level 0–100 % gauge with six signals. The shape is decided; the weights and rules below
  are proposed.**
  - **What it is:** calibration evidence, never "accuracy". A lifter who consistently misjudges reserve can
    reach 100 %; the per-key bias handles them inside the engine.
  - **Placement (decided):** Progress › Overview, with the recent guess-vs-result rows, plus a small version
    on Today.
  - **Decay (decided):** each piece of evidence weighs `w = 0.5^(age / 90 days)`. A 90-day-old set or check
    counts half. The gauge has **no reset**; breaks and new machines just let it fade. The engine's resets
    (OD-16) are separate.
  - **Formula:** `G = floor(100 × (0.55·T + 0.15·A + 0.12·H + 0.08·W + 0.05·S + 0.05·R))`.
    - Each component is in [0, 1].
    - The max-set component `T` carries 55 %, so **without any max set the gauge can't exceed 45 %**, and
      100 % needs `T = 1`.
    - If the lifter has no slow-tap answers in the last 90 days, or has the tap off, `S`'s weight is shared
      among `A`, `H`, `W` and `R` in proportion. Not using the optional tap never costs anything.
  - **Which rows count:**
    - Weight 1: rows whose `effortSource` is `rir` or `reps_left`.
    - Weight ½: coarse rows (`effort`, `reps_left_3plus`) and old rows with no source.
    - Weight 0: `prefilled` and `unsure` rows.
    - `failure` rows feed only `T`.
    - Warm-ups never count.
  - **Each supporting component (A, H, W, S)** is an agreement rate times a sufficiency factor,
    `rate × min(1, Σw / target)`: it needs both quality and enough recent evidence.

    | Signal | Exact rule | Sufficiency target |
    | --- | --- | --- |
    | **T, max sets** (guess vs result) | `T = min(1, Σ_k min(2, Σ_{i∈k} wᵢ) / (2·K))`, with `K = min(4, max(1, eligible keys in the active program))`. At most 2 weighted checks count per exercise, so **100 % = 8 recent checks across 4 exercises**, or 2 per exercise when the program has fewer eligible ones. | built in |
    | **A, sets that agree within a workout** | For consecutive working sets of one key in one workout, both with countable effort, compare capacities, each with RIR credited up to 5. The pair agrees when `c₂ / c₁ ∈ [0.85, 1.03]`: a plausible fatigue drop, or a small rise. | 20 weighted pairs |
    | **H, hitting the suggestion** | For a working set that had an engine suggestion (load, reps `r*`, RIR `q*`) and was done at the suggested load, the set agrees when `|(reps + RIR) − (r* + q*)| ≤ 1`: its implied reps-to-failure matched the prediction. The suggestion is **recomputed** by replaying the current engine on the history before that workout, so nothing new is stored. The replay is bounded to the last 30 sets per key. | 20 weighted sets |
    | **W, week-to-week consistency** | Per key and ISO week, the capacity estimate is the median first-set capacity of that week's sessions. Consecutive estimates no more than 2 weeks apart agree when they change by at most ±5 %. | 8 weighted week pairs |
    | **S, "Was the last rep slow?"** (OD-25) | A tapped set agrees when "yes" goes with logged RIR ≤ 1, or "no" with RIR ≥ 2. | 12 weighted taps |
    | **R, history** | For each key in the active program, `min(1, Σw / 24)` over its countable working sets (about 8 sessions × 3 sets); `R` is the mean over those keys. | built in |

  - **Copy (proposed):**
    - EN: "Calibration evidence 53 %"; caption "From your max sets, how your sets agree, and your recent
      history. It fades slowly without new evidence."
    - PT: "Evidência de calibração 53 %"; caption "Dos seus testes de repetições máximas, da coerência entre
      as séries e do seu histórico recente. Ela diminui aos poucos sem novas evidências."
    - Never "synchronized", "accuracy" or "complete".
- **OD-21, the gauge and Pro. Open.**
  - The owner intends to use the gauge later for Pro conversion. This plan designs no paywall and no
    entitlement check.
  - **Constitutional conflict to resolve first.** Any rule that turned calibrated suggestions (OD-18) off, or
    made them worse, for non-paying users would contradict:
    - the business thesis §8.1–8.2 (no clawbacks; "progression recommendations already part of the free
      product" and "load/reps/RIR or effort logging" are in the Free floor);
    - ADR 0010 ("Free remains complete for the current program… normal progression"; "Free set progression
      continues" after a lapse);
    - synthesis §6.1 ("Do not intentionally make Free predictions less reliable").
  - That rule would need an **explicit amendment** of the thesis and ADR 0010 before implementation.

### Copy, the slow tap and the audit follow-ups

- **OD-22, Why and result copy. Proposed, pending copy review (#315 process).**
  - **Result line after a max set (decided in substance):** the difference, plus "nothing changes yet" until
    3 checks.
    - EN: "You guessed 11 and did 14: 3 more than you expected. Nothing changes yet."
    - PT: "Você estimou 11 e fez 14: 3 a mais do que esperava. Nada muda ainda."
    - From the third check on a key, the line ends with the Why line below instead.
  - **Why lines, per exercise, never with a number:**

    | State | EN | PT |
    | --- | --- | --- |
    | uncalibrated | "Your effort estimate on this exercise is still being calibrated." | "Sua estimativa de esforço neste exercício ainda está sendo calibrada." |
    | tends to under-estimate | "Your max sets show you usually have more reps left than you log, so this allows a little more." | "Seus testes de repetições máximas mostram que costuma sobrar mais repetições do que você registra, então isto permite um pouco mais." |
    | tends to over-estimate | "Your max sets show you usually have fewer reps left than you log, so this is a little more conservative." | "Seus testes de repetições máximas mostram que costuma sobrar menos repetições do que você registra, então isto é um pouco mais conservador." |
    | consistently calibrated | "Your effort estimates on this exercise have matched your max sets." | "Suas estimativas de esforço neste exercício têm batido com seus testes de repetições máximas." |

  - The "tends to" lines appear only when OD-18 actually moved the suggestion.
- **OD-25, "Was the last rep slow?" Proposed storage.**
  - **The prompt:** an optional yes/no tap in the rest after a working set. It shows after the first working
    set of each exercise in a workout, is dismissible, and never blocks logging. Settings › Effort can turn it
    off.
  - **Storage:** one optional row key, `lastRepSlow: true | false`. Absent means not asked, skipped, or
    dismissed. It's never backfilled, never shown in History, and not editable there.
  - **In the draft:** the tap lands after the set is completed, so it's stored as `completion.lastRepSlow`.
    That is additive: `completion` already allows extra keys in `workout-draft.js` `validateSet` and in the
    contract's `validateDraftSet` (`install-transfer-contract.js:728-740`).
  - **Validators:**
    - `isSafeLogRow` checks the value is a boolean.
    - `validateCanonicalLogRow` checks the same under OD-24, and the draft completion check refuses a
      non-boolean.
    - That changes both `install-transfer-contract.js` and `workout-draft.js`, so the PR that adds the tap
      needs a **Worker redeploy before merge**.
    - Old Workers would pass the key through unvalidated, and old apps ignore it, so there's no skew failure.
  - **Use:** only gauge signal `S`. The engine never reads it.
- **OD-23, audit follow-ups.**
  - **(a) Documentation, partly shipped.** #624 corrected the mechanics doc's missing-RIR sentence and the
    trust-ceiling text. *Proposed:* mark ADR 0003 and the strategy contract **superseded by Plan 067** for
    engine arithmetic (A3, A4), in PR 1.
  - **(b) RIR credit cap of 5. Decided; shipped first as its own engine PR, #624.** `RIR_CREDIT_CAP = 5`,
    `ENGINE_VERSION 077.1`.
  - **(c) Dead code.** *Proposed:* delete the unreachable ADR 0003 layer and `recoverSignal` (A3, A9) in a
    separate cleanup PR.
  - **(d) Live vs committed effort.** *Proposed:* fix A5 in PR 1, through the completion materialisation
    in §6.2.
  - **(e) `hardRir` bounds.** *Proposed:* enforce 1–10 in `normSetting` (A8), in PR 1.

## 4. Worked examples

W1–W6 use the engine numbers; W7 the gauge. All numbers assume no fatigue between the anchor and target sets unless stated, and show the shift and the
load bound in isolation. The final candidate is chosen by the engine's existing ranking
(`progression-engine.js:447-480`).

**W1, one noisy check (the synthesis example).**
- **Inputs:** set 2 is 60 kg × 10 at RIR 2. The prefill is `P = 10 + 2 − 1 = 11`, untouched. The check set is
  60 kg × **14**.
- **Errors:** the guess error is `e = 11 − 14 = −3`. The diagnostic implied error is the same −3.
- **Estimate:** `n = 1`, so `b̂ = −3/(1 + 2) = −1.0`. The state is **uncalibrated** (n < 3), so `Δ = 0` and
  suggestions are unchanged.
- **Check-set capacity:** `60 × (1 + 14/30) = 88.0`, against 84.0 from set 2.
- **Result line:** "You guessed 11 and did 14: 3 more than you expected. Nothing changes yet."
- **Gauge** (K = 3, one check today): `T = 1/(2·3) = 0.167`, which adds 9 points.

**W2, an under-estimator on a machine chest press (2.5 kg steps).**
- **Checks:** `e = −3, −2, −2.5`. Then `b̂ = −7.5/5 = −1.5` and `s = 0.5`, so the state is **tends to
  under-estimate**. The shift is `Δ = max(−1.5, −1) = −1`.
- **Anchor:** 60 × 10 at RIR 2 gives capacity 84.0. Read at RIR 3, it gives `60 × (1 + 13/30) = 86.0`
  (+2.4 %).
- **At 60 kg and RIR 2:** the predicted reps go from **10 to 11**.
- **At 62.5 kg:** the reps reachable at RIR 2–3 go from 8 to 9.
- **Bound:** at most one step up (62.5 kg), which the shift alone doesn't exceed.
- **Why line:** "…usually have more reps left than you log, so this allows a little more."

**W3, an over-estimator on a pin-loaded lat pulldown (5 kg stack).**
- **Checks:** `e = +2, +1, +3, +2`. Then `b̂ = 8/6 = 1.33` and `s = 0.82`, so the state is **tends to
  over-estimate**. The shift is `Δ = 1.33`.
- **Anchor:** 70 × 10 at RIR 3 gives 100.3. Read at RIR 1.67, it gives 97.2 (−3.1 %).
- **Target 8–12 at RIR 2, at 70 kg:** baseline 11 reps (RIR 2.0); calibrated **9 reps** (RIR 2.67). At most two
  steps down, so the floor is 60 kg.
- **Why line:** "…usually have fewer reps left than you log, so this is a little more conservative."

**W4, consistent.**
- **Checks:** `e = 0, −1, +0.5, 0, +0.5`. Then `b̂ = 0` and `s = 0.61`, so the state is **consistently
  calibrated** and `Δ = 0`.
- **Why line:** "…have matched your max-rep checks."

**W5, noisy, so no state.**
- **Checks:** `e = −2, +1, −3`. Then `b̂ = −0.8` but `s = 2.08 > 1.5`, so the state is **uncalibrated
  (inconsistent)** and `Δ = 0`.
- **Contrast:** the mirror case `+2, −1, +3` gives `b̂ = +0.8`, which is **over-estimate**. Its effect only
  lowers loads, so no spread condition applies.

**W6, resets.**
- **New machine:** the lifter changes gym. The same exercise on a new `equipmentId` is a new key:
  uncalibrated, `E = 0`. The old key's three checks keep aging.
- **Long break:** the key's sessions are on 2026-06-01, then 2026-07-20, a 49-day gap. The checks before
  2026-07-20 are discarded for that key's engine bias. The gauge doesn't reset; those checks just keep fading.

**W7, the gauge (OD-20).** In every row, the active program has 4 eligible exercises, so K = 4. "Supporting"
is the weighted sum of A, H, W, S and R.

| Case | Inputs | T | Supporting | Gauge |
| --- | --- | --- | --- | --- |
| G1: 4 weeks of logging, no max sets, no taps | A 0.80, H 0.60, W 0.25, R 0.70; S's weight shared out | 0 | 0.278 | **27 %** |
| G2: G1 plus 4 max sets, two each on 2 exercises (2, 9 and 5, 12 days ago) | as G1 | 0.474 | 0.278 | **53 %** |
| G3: 8 max sets, two each on 4 exercises (2–24 days ago), taps in use | A 0.85, H 0.70, W 0.60, S 0.80, R 0.90 | 0.906 | 0.345 | **84 %** |
| G3′: the ceiling, 8 checks today, every rate perfect and saturated | all 1 | 1 | 0.450 | **100 %** |
| G4: G3, then 60 days without training | each weight × 0.63 | 0.571 | 0.217 | **53 %** |
| G5: a program with 2 eligible exercises (K = 2), two checks each, 3–20 days ago | A 0.80, H 0.65, W 0.50, R 0.80; S's weight shared out | 0.917 | 0.313 | **81 %** |

- Eight checks on **one** exercise give only `T = 0.25`, because at most 2 count per exercise.
- In G4, the supporting sufficiency factors were assumed to sit exactly at their targets, so they fall with
  the weights.
- The gauge never resets. It only fades, so it can't read as "complete": 100 % needs recent max sets on
  four exercises, and once there, checks continue at most once a month (OD-12).

## 5. Changes by owner module

1. **`workout-draft.js`** (DraftV2 schema stays 2; every change is additive):
   - **Effort vocabulary:** `EFFORT_RIR` becomes an input map: `easy 3`, `hard 1`, `max 0`, `r0 0`, `r1 1`,
     `r2 2`, `r3p 3`, `unsure null`. "Not sure" is the only token that saves with `rir:null`; save validation
     accepts it.
   - **`completeSet`:**
     - materialises the effective effort value into the set's `edited` field when the lifter didn't enter
       one;
     - records `completion.effortSource` from whether `touched.effort` was false *before* completion
       (`prefilled`), and from which field and token holds the value.
   - **Editing:** a `rir` edit clears a pending set's `edited.effort` and vice versa (OD-5).
   - **New command:** `setRirMode`, which updates `program.rirMode` for the prefills of pending sets only.
   - **New command:** `setLastRepSlow`, which sets `completion.lastRepSlow` on a completed set (OD-25).
   - **Value reads:** `numericSetValues` and `toHistoryRows` read per set: `edited.effort` token, else
     `edited.rir`, else the program mode's prefill. They emit `effortSource`, `lastRepSlow` and `calibration`.
   - **Max set:** the draft carries `calibration` while it's pending.
2. **`app.js`:**
   - **Validation and settings:**
     - `isSafeLogRow` validates `effortSource` (enum), `calibration` (shape, ints, bools) and `lastRepSlow`
       (boolean);
     - `normalizeSettings` adds `effortScale`, the max-set prompt switch (default on) and the slow-tap switch
       (default on), and bounds `hardRir` to 1–10 (OD-23e);
     - `changeRirMode` drops the lock and dispatches `setRirMode`.
   - **Focus UI:**
     - Easy / Hard / Max chips;
     - stage-B chips;
     - the arrow menu on the effort label (stage switch, "Not sure");
     - the stage tip in rest (OD-6);
     - the max-set prompt before the last set;
     - the guess in rest;
     - the failure set with the stop rule and the press safety line;
     - the result line;
     - the slow tap in rest.
   - **Engine feed:** `enginePerformedRow`/`progressionCurrentSession` pass `effortSource`. The live session
     reads the materialised value (fixing A5).
   - **Progress › Overview:** the gauge and the recent guess-vs-result rows (date, exercise, guess, result,
     difference). **Today:** the small gauge. **Why:** the Why line (OD-22).
   - **History editor:** `history-ui.js` sets `effortSource:"rir"` on RIR edits and applies the OD-17 edit
     rules.
3. **`effort-calibration.js` (new, pure).** It provides:
   - the eligibility rule;
   - check extraction from rows (errors, the implied-error diagnostic);
   - resets, the estimator and states;
   - `Δ` per key;
   - the six gauge components and `G`. The `H` component calls `progression-engine.js` through an injected
     function, so the module stays pure.

   It's versioned `calibration@077.1`, has no DOM and no storage, and is loaded before `app.js`. The new
   script needs an `index.html` tag, a `sw.js` `ASSETS` entry, a `transitionAssets` entry and a `CACHE` bump.
4. **`progression-engine.js`:**
   - **New settings fields:** `calibration: {version, shiftByKey}`, validated: `Δ ∈ [−1, 2]`, a finite number,
     and an unknown version means `Δ = 0`.
   - **Applying the shift:** in `parsePerformedSet`, except for `failure` rows.
   - **Fatigue:** exclude `failure` rows from `fatigueFrom` (OD-19, proposed).
   - **Load bound:** compute the baseline selection and apply the step bound (OD-18).
   - **Explanation:** expose `calibration: {state, delta, baselineTargets}` on the recommendation for the Why
     line.
   - **Version:** bump `ENGINE_VERSION` to `077.2`.
   - The RIR credit cap already shipped in #624.
5. **`progress-model.js`:** count `failure` rows as measured hard sets. Otherwise unchanged; `unsure` already
   reads as missing.
6. **`install-transfer-contract.js`:** `validateCanonicalLogRow` validates `effortSource`, `calibration` and
   `lastRepSlow` when present (strict, OD-24). The draft completion check refuses a non-boolean
   `completion.lastRepSlow` or an unknown `completion.effortSource`.
7. **`i18n-en.json` and `i18n-pt.json`:** stage, tip, max-set, safety-line, result, gauge, slow-tap and Why
   strings, then regenerate `i18n.js`.
8. **Docs:**
   - OD-23a: supersede notes on ADR 0003 and the strategy contract;
   - a new ADR, "Effort calibration (Free)", recording the decided ODs;
   - `CONTEXT.md` terms: *max set*, *calibration evidence*, *effort source*.

## 6. Setup-link, transfer, Worker, migration and draft safety

### 6.1 Setup links, transfer and the Worker

- **Setup links: no change.**
  - `effortScale` and the new switches aren't in the closed settings tuple (`shared-setup.js:28-30`).
  - `rirMode` keeps its two values.
  - Setup links never carry logs.
- **Install transfer and the Worker.** The Worker bundles `install-transfer-contract.js` with
  `workout-draft.js`, `program-compiler.js`, `program-entry.js`, `exercise-metrics.js` and the catalog. Every
  PR that changes `workout-draft.js` or the contract must be redeployed from its exact merge head **before**
  merge (`services/install-transfer/RUNBOOK.md`). Production transfers are latched off, but the gate applies.

  | PR | `workout-draft.js` | Contract | Worker redeploy |
  | --- | --- | --- | --- |
  | 1 | yes | yes (`effortSource`) | **yes** |
  | 2 | yes (tokens, `setRirMode`) | no | **yes** |
  | 3 | yes (pending `calibration`) | yes (`calibration`) | **yes** |
  | 4 | yes (`setLastRepSlow`) | yes (`lastRepSlow`) | **yes** |
  | 5 | no | no | no |

- **OD-24, transfer strictness: validate the new keys in the contract. Proposed.**
  - Today `validateCanonicalLogRow` ignores unknown keys, so the new keys would pass through the Worker
    unvalidated.
  - Strict validation refuses a malformed key at the Worker instead of at the receiving app.
  - New keys add well under 200 characters per row, against the 8,000-character cap
    (`install-transfer-contract.js:28`).
- **Version skew.**
  - A draft with stage-B tokens transferred to an app *older* than PR 2 fails that app's save validation
    (`invalid-effort`).
  - Transfers run between installs of the same origin, which update together through the service worker. The
    risk is accepted and stated in the PR.
  - Rows and drafts with the new keys are otherwise accepted by older apps: `isSafeLogRow` and
    `validateSet` ignore unknown keys.

### 6.2 Migration and draft-safety rules

1. **No fabrication.**
   - Rows written before PR 1 have no `effortSource`, and no migration adds one.
   - `rirMeasured:false` keeps its meaning (A7).
   - The projection treats an absent source as unknown, at weight ½ in the gauge (OD-20). It is never
     `prefilled`, never `rir`.
   - `lastRepSlow` and `calibration` exist only where the lifter answered.
2. **Completed history is immutable to mode changes.** Changing stage or `rirMode` never rewrites a saved row.
   Only explicit History edits do, under the OD-17 rules.
3. **Draft safety.**
   - A completed set's effort value and source are frozen at completion (materialised). An open draft from
     before PR 1 still finishes; its completed sets lack `completion.effortSource` and save without the key.
   - A pending set keeps any value the lifter already entered.
   - A stage switch changes only the control and the prefill of untouched pending sets (OD-5).
   - The recovery and replica paths (`durable-state.js`) carry the draft unchanged, because the new fields are
     ordinary draft JSON.
4. **Max-set cancellation.**
   - If the lifter changes the load of the max set, or logs it with RIR other than 0, the set saves as a
     normal set without `calibration`.
   - If they abandon the workout, nothing is stored.
5. **Backups and restore.** New keys round-trip as ordinary row fields, and the restore validator accepts them
   (§5.2).

## 7. Tests (each red before its change)

**Shipped in #624:** the RIR credit cap. The engine suite failed with a logged RIR 9 credited as 9, and passes
with the cap. The Plan 067 assertion that pinned uncapped RIR 6 now expects 5.

**PR 1, provenance and audit fixes:**
- `test/workout-draft*.mjs`:
  - completing an untouched effort-mode set materialises `edited.effort` and records
    `completion.effortSource:"prefilled"`;
  - a typed RIR records `rir`;
  - `toHistoryRows` emits `effortSource`;
  - a pre-PR draft (no `completion.effortSource`) still finishes and its rows lack the key.
- **The live anchor (A5):** an untouched, completed effort-mode set now feeds `progressionCurrentSession` with
  its prefill. The owning progression suite asserts it is no longer dropped.
- **History edit:** a RIR edit sets `effortSource:"rir"` and `rirMeasured:true` in both replicas.
- **Validation:** `isSafeLogRow` and `validateCanonicalLogRow` accept each enum value and refuse an unknown
  one. `services/install-transfer/test/worker-canonical-runtime.test.js` gives 201 for a row with
  `effortSource` and a refusal for `effortSource:"x"`.
- **Migration:** a legacy row passes through migration with no `effortSource` added (fixture equality).

**PR 2, stages and the tip:**
- **Draft:**
  - stage-B tokens save with the mapped RIR;
  - "Not sure" from the arrow menu saves `rir:null` with `unsure`;
  - "3+" saves 3 with `reps_left_3plus`.
- **Switching mid-workout:**
  - completed sets are unchanged;
  - a touched pending set keeps its value and source;
  - untouched pending sets get the new prefill.
  - A browser test drives this through the arrow menu on the real focus screen.
- **Settings:** `effortScale` survives `normalizeSettings`, backup and restore. A setup link made in stage B
  decodes as `rirMode:"effort"` with byte-identical link output (no codec change).
- **The tip:**
  - it appears only in rest, after 6 qualifying workouts (fixture clock);
  - it's never present while a set is being entered;
  - a dismissal keeps it quiet for 4 weeks;
  - a second dismissal stops it.

**PR 3, max sets and the projection (no engine change):**
- `test/effort-calibration.mjs` (unit):
  - W1–W6 to the stated numbers;
  - `impliedError` equals `P − A` for an untouched prefill;
  - the eligibility fixture excludes exactly the 111 IDs; a known performed dumbbell equipment keeps an
    exercise eligible;
  - custom-exercise names follow OD-11.
- **Draft and browser:** the full flow: prompt → guess prefill `n + r − 1` → edit → failure set with the
  safety line on a press → result line "nothing changes yet". The row carries `calibration`, `rir:0` and
  `effortSource:"failure"`. The set counts for records.
- **Frequency rules:** once per workout, 14 days per exercise, twice a week, none in a deload week, none right
  after a 0-RIR set, and monthly at a gauge of 100 %.
- **The prompt switch:** off means no prompt.
- **Contract and Worker:** a `calibration` with a non-integer `predictedReps` is refused; a valid one gets 201.
- **Telemetry:** the existing allowlist test is unchanged. Add an assertion that no event fires during the
  flow.

**PR 4, the gauge and the slow tap:**
- `test/effort-calibration.mjs`:
  - W7 G1–G5 to the stated percentages;
  - G ≤ 45 with no max sets;
  - S's weight is shared out when there are no taps;
  - the gauge is monotone non-increasing with no new evidence;
  - the `H` replay is deterministic and bounded to 30 sets per key.
- **Draft:** `setLastRepSlow` stores a boolean on a completed set, and the row carries `lastRepSlow`. A
  non-boolean is refused by `workout-draft.js`, `isSafeLogRow` and the Worker (`worker-canonical-runtime`).
- **Browser:** the slow tap appears in rest after the first working set of each exercise and never blocks the
  next set. The gauge renders on Progress › Overview with the guess-vs-result rows, and in its small form on
  Today.

**PR 5, engine (after OD-14 to OD-16 are approved):**
- **Engine unit:**
  - W2 and W3 give the stated targets;
  - `Δ = 0` is byte-identical to `077.1` output over the engine corpus fixtures;
  - the step bound clamps a synthetic Δ = 2 case;
  - `failure` rows are never shifted (and excluded from fatigue, if OD-19's proposal is approved);
  - fewer than 3 checks means no shift.
- **Why model:** the Why line for each state, and no "tends to" line when the bound or rounding left the
  suggestion unchanged.

## 8. Catalog states

New and changed states, each in EN and PT, light and dark, at 320 and 390, and at text200:
- `workout-focus/effort-stage-a-chips` (Easy / Hard / Max as chips);
- `workout-focus/effort-stage-b` (0 · 1 · 2 · 3+, one selected);
- `workout-focus/effort-menu` (the arrow menu: the three stages and "Not sure");
- `workout-rest/stage-tip`;
- `workout-focus/max-set-prompt` (before the last set);
- `workout-rest/max-set-guess` (with the prefill and stepper);
- `workout-focus/max-set-active` (the stop rule; a press variant with the safety line);
- `workout-focus/max-set-result` (the first check, "nothing changes yet");
- `workout-rest/last-rep-slow`;
- `why/calibration-uncalibrated`, `why/calibration-under`, `why/calibration-over`, `why/calibration-consistent`;
- `progress-overview/calibration` (the gauge at 27, 53 and 100 %, and the guess-vs-result rows);
- `today/calibration-mini` (the small gauge);
- `settings/effort` (three stages, the max-set prompt switch, and the slow-tap switch).

Each state needs role-inventory rows and CI-rendered frames (strict catalog verify). The Front 1 prototype,
`effort-stages.html`, is the visual reference; native-fidelity side-by-side comparison is required before
merge.

## 9. PR split

| PR | Content | Worker redeploy | Gate |
| --- | --- | --- | --- |
| 0 (this) | Plan 077 + audit | no | the remaining proposed ODs |
| #624 | RIR credit cap of 5, `ENGINE_VERSION 077.1`, mechanics doc fixes (A1, ceiling) | no | **decided**, opened |
| 1 | Provenance (`effortSource`, completion materialisation, A5 fix), History edit source, contract and app validation, OD-23a supersede notes, OD-23e bounds | **yes** | OD-1, OD-24 |
| 2 | Stages A/B/C, arrow menu with "Not sure", mid-workout switch, stage tip, catalog states | **yes** | OD-3; copy review; prototype approval |
| 3 | `effort-calibration.js` (eligibility, checks, estimator), max-set prompt and flow, `calibration` row key, result line | **yes** | OD-8, OD-17; copy review |
| 4 | Gauge (six signals) on Progress › Overview and Today, slow tap (`lastRepSlow`) | **yes** | OD-20's weights and rules, OD-25 |
| 5 | Engine: bias shift, load bound, fatigue exclusion, `ENGINE_VERSION 077.2`, Why lines | no | OD-14 to OD-16, OD-19's fatigue proposal |

PRs 1 → 5 run serially: each depends on the previous row and draft shape. PR 5's limits are decided (OD-18), but
it still waits for the estimator ODs. Until it lands, max sets collect evidence and feed the gauge, and the
engine is unchanged apart from the cap.
