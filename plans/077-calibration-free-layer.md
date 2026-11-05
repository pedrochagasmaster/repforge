# Plan 077: effort calibration, Free layer

Status: **proposal, awaiting owner decisions** (§3). Docs only; no production code until the ODs are settled.
Source: the owner on 2026-11-05 ("Let's build this before the alpha release") and the strategy synthesis
`calibration-strategy-2026-11-05.md` (§3, §3.1, §4, §5, §9.1, §12). Owner corrections from 2026-11-05 are
folded in: the calibration observation is a pre-set guess followed by a max-reps set, and there is one
user-level calibration gauge.
Written against `main` f40d84f2e; check for drift before executing.

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
3. **An optional max-rep check on safe exercises.** The checks feed a bounded, versioned, per-exercise bias
   correction into the existing engine, and one honest user-level gauge.

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
  is still a second, older provenance flag that §4.1 must not collide with.
- **A8 — low. `hardRir` bounds.** The contract says 1–10 (`:132`); `normSetting` enforces only ≥ 0
  (`app.js:1649`).
- **A9 — low. ADR 0003's tail is out of date.** "Stall/recover gates survive" (`:43`) no longer holds:
  `isStalled` is live in the block summary (`app.js:3986`), but `recoverSignal` is orphaned.

**Not a discrepancy:** fatigue. The engine's fatigue model is the one Plan 067 specifies, and it never used
RIR separately.

## 3. Owner decisions

Each OD has a proposed default. ODs marked **(owner)** record a decision the owner already gave on
2026-11-05; the default only fills in its numbers.

### Effort provenance and stages

- **OD-1, provenance field: one optional row key, `effortSource`.**
  - It's a string enum recorded at commit:

    | Value | Meaning | `rir` holds |
    | --- | --- | --- |
    | `rir` | a typed numeric RIR | the number |
    | `effort` | an Easy/Hard/Max label | 3/1/0 |
    | `reps_left` | a stage-B chip 0, 1 or 2 | the chip |
    | `reps_left_3plus` | the stage-B chip 3+ | 3, as a floor |
    | `unsure` | the stage-B chip "Not sure" | `null` |
    | `prefilled` | the lifter never touched effort; the value is the prefill | the prefill |
    | `failure` | a max-rep check set (§3, OD-7) | 0 |

  - Absent means unknown. Old rows are **never backfilled**.
  - The legacy `rirMeasured:false` flag stays as it is.
  - History edits of RIR set `effortSource:"rir"`, alongside the existing `rirMeasured:true`.
  - Alternative: an object `{mode, entered}`. That's more general, but it adds key validation in three places
    for no current reader.
- **OD-2, "Not sure" is missing RIR.** It's stored as `rir:null` with `effortSource:"unsure"`.
  - The engine drops the set as it does any missing RIR (A1), and Progress shows `missing-effort`.
  - Taurifer never invents a value. If every set of a session is "Not sure", the next suggestion comes from
    earlier history.
  - Alternative: assume the prescription's target RIR. That's friendlier, but it fabricates a report.
- **OD-3, "3+" is stored as 3 with `reps_left_3plus`.** The engine credits 3, a floor that understates
  capacity when more were left. That's the safe direction.
- **OD-4, stage storage: `rirMode` keeps its two values.**
  - Stage C is `rirMode:"numeric"`. Stages A and B are `rirMode:"effort"`.
  - A new device-local setting, `effortScale: "feel" | "reps"`, distinguishes A and B, and is read only in
    effort mode.
  - A third `rirMode` would break the setup-link settings tuple (`shared-setup.js:35`, `886`, `901`) and the
    transfer draft validator (`install-transfer-contract.js:839`).
  - `effortScale` is not shared in setup links. A recipient of a stage-B sender gets stage A, the existing
    `effort` mode.
- **OD-5, switching during a workout: lift the lock.** Today `changeRirMode` refuses while the draft has
  progress. Proposed:
  - The switch takes effect at once for **pending** sets.
  - Completed sets keep their value and source.
  - A pending set the lifter already edited keeps that edit.

  This needs three draft rules (§6.2): completion materialises the value, a vocabulary edit clears the
  sibling field, and the source is decided per set. Alternative: keep the lock and apply the switch from the
  next workout. That needs zero draft change but fails the brief's "immediate switch at any stage".
- **OD-6, suggesting a stage up: quietly, after the workout, rarely.**
  - **A→B:** after 6 completed workouts in stage A where ≥ 80 % of working sets have a lifter-chosen label
    (not `prefilled`).
  - **B→C:** after 6 workouts in stage B where ≤ 10 % of working sets are "Not sure".
  - Shown once as a dismissible line on the session summary, never during logging.
  - Dismissing snoozes it for 60 days. A second dismissal stops that suggestion for good.
  - Taurifer never suggests a stage down.
  - Settings always offers all three stages.

### Max-rep check (calibration observation)

- **OD-7, protocol (owner): a pre-set guess, then a max-rep set.**
  1. **During the rest before the exercise's last working set**, Taurifer asks how many reps the lifter can do
     at the same load: "How many reps can you do at 60 kg?"
  2. The guess `P` is prefilled, and the lifter can change it with a stepper (1–30) or skip the check.
  3. The last set is done **to technical failure** at the same load. The lifter logs the actual reps `A`.
  4. The row is stored with `rir:0`, `effortSource:"failure"`, and the `calibration` key (OD-17).

  The check **replaces** the last working set; it never adds one (synthesis §3.1).
- **OD-8, technical failure.** Proposed definition, for the copy shown on the set:
  - **The rule:** stop at the last rep that you complete with the same range of motion and control as your
    first rep. The next rep you couldn't finish that way doesn't count.
  - **Also not counted:** partial reps, bounced or swung reps, or a pause longer than about 2 s to rest
    mid-set.
  - **Safety:** stop at once on pain, or if form breaks down in a way that loads a joint differently.

  EN copy: "Go until you can't do another full, clean rep. Stop if anything hurts." PT: "Vá até não conseguir
  mais uma repetição completa e limpa. Pare se algo doer." (Pending owner copy review.)
- **OD-9, prefill and fatigue allowance: `P = n + r − a`, with `a = 1` rep.**
  - `n` and `r` are the previous working set's reps and RIR, at the same load in the same session.
  - The owner asked for `n + r`. The proposal subtracts the allowance, because the guessed set comes after one
    more rest and one more set.
  - **Why 1 rep:**
    - Between consecutive sets at the same load near failure, rep loss with normal rests (1.5–3 min) is
      commonly 1–2 reps.
    - An allowance that is **too small** makes an untouched prefill read as a slight over-estimate (P > A).
      Under OD-12 that only ever **lowers** loads, the safe direction.
    - An allowance that is too large would flatter the lifter and raise loads.
    - So the smaller common value is chosen.
  - The engine's own adjacent-drop median isn't used. It is computed from the same RIR reports being
    calibrated (`progression-engine.js:355-377`), so it would be circular.
  - **Previous RIR:**
    - If the previous RIR was an effort label, use its mapped value.
    - If it was "3+", use 3.
    - If it was "Not sure" or missing, prefill `P = n` and mark the prefill `basis:"reps"`.
  - Alternative: no allowance (`P = n + r`, exactly as the owner first said). Then untouched guesses read
    about +1 rep high.
- **OD-10, signals (owner: the guess is the main signal).**
  - **Main signal, feeds the bias estimate:** the guess error `e = P − A`, in reps.
    - Positive means the lifter expected more reps than they did: they over-estimate their reserve.
    - Negative means they under-estimate it.
  - **Secondary signal: dropped from the estimate.** That signal is the previous set's implied RIR error,
    `(n + r − a) − A`.
    - With an untouched prefill, it is *identical* to `P − A`. Counting both would double-count one set.
    - With an edited guess, the lifter's own number carries more information than their earlier label.
    - The projection still computes it, as a test-visible diagnostic (`impliedError`), never stored and never
      shown, so the owner can revisit with real data.
  - **Untouched prefills count fully.** The lifter saw the number and confirmed it by not changing it.
    `predictionEdited` is stored, so a later version can weight them differently without a migration.
- **OD-11, suitable exercises: catalog rule plus denylist; custom exercises never.** An exercise is suitable
  when it meets all of these:
  - it is a catalog exercise (`metricOrigin:"source_catalog"`);
  - its loading is `external`, `assistance` or `per_side`, not reps-only bodyweight;
  - its rep target is reps;
  - its `stability` is **5** (guided machine path), or **4** and single-joint (isolation);
  - every resistance equipment group is a cable, pin- or plate-loaded machine, or assisted machine (no
    barbell, Smith, EZ/fixed bar, dumbbell, kettlebell, band, sled or bodyweight-only);
  - no movement pattern is Squat, Hip Hinge, Lunge/Split Squat, Olympic Lift, Loaded Carry, Lower Back, Neck,
    Core Stabilisation, Ab/Oblique or Cardio;
  - the name doesn't mark it accentuated-eccentric, jump or plyometric.

  On today's catalog this selects **241 of 1,345** exercises: machine and cable presses (36), pulldowns and
  pull machines (26 + 25 lat), rows (26), curls (13), triceps (10), leg curls (14), leg extensions (4), calf
  raises (18), abductors and adductors (18), and lateral and rear delt work (16). Leg press, hack squat and
  belt squat are excluded (pattern Squat), as are all dumbbell and barbell lifts. Each check also requires:
  - **at least 2** working sets on that exercise today, so there is a previous set;
  - a prescribed rep target ≤ 20;
  - `P` between 1 and 30.

  The rule is computed from catalog fields, versioned (`suitability@077.1`), and pinned by a fixture listing
  the 241 IDs.
- **OD-12, how often.** The check is offered only when all of these hold:
  - the lifter has opted in (OD-13);
  - the exercise is suitable;
  - it's the exercise's last working set;
  - at most **one** check per workout;
  - at most **one** per exercise key every **14 days**;
  - at most **two** per calendar week;
  - not in a lighter (deload) week;
  - not on the first two sessions of an exercise key;
  - not after the lifter reported pain or discomfort for that exercise today, or skipped or trimmed it.

  Taurifer offers the check; it never starts one on its own.
  - "Not now" snoozes that exercise for 14 days.
  - "Stop asking" turns the opt-in off.
- **OD-13, opt-in: one Settings toggle, "Max-rep checks", off by default.**
  - While the toggle is off, Taurifer shows at most one dismissible invitation, on the session summary after a
    workout that included a suitable exercise. Accepting turns the toggle on.
  - The invitation recurs at most every 60 days and stops after two dismissals.

### Calibration projection and the engine

- **OD-14, estimator: a shrunken mean per comparable key.**
  - **The key** is the engine's comparability key: `exerciseId`, `equipmentId`, `loadingConvention`,
    `metricIds` (`progression-engine.js:295-297`).
  - **Observations:** a key's last **6** valid observations, after its last reset (OD-16) and no older than
    **180 days**.
  - **Error clipping:** each `e` is winsorised to [−5, +5].
  - **Bias:** `b̂ = Σe / (n + k)`, with prior weight **`k = 2`** pseudo-observations at 0.
    - With few checks, `b̂` stays near 0; with many, it approaches the plain mean.
    - One check of −3 gives `b̂ = −1.0`, not −3.
  - **Spread:** `s` is the sample standard deviation of the winsorised errors (n ≥ 2).
- **OD-15, the four provisional states** (internal; never shown as labels):

  | State | Rule |
  | --- | --- |
  | uncalibrated | n < 3; or the rows below don't apply |
  | tends to under-estimate reserve | n ≥ 3, `b̂ ≤ −0.75`, `s ≤ 1.5` |
  | tends to over-estimate reserve | n ≥ 3, `b̂ ≥ +0.75` (no spread condition: its effect only lowers loads) |
  | consistently calibrated | n ≥ 3, `|b̂| < 0.75`, `s ≤ 1.25` |

  A lifter with small bias but a large spread stays uncalibrated, reason `inconsistent`.
- **OD-16, confidence resets.**
  - **A new machine or loading setup** is a different key, so it starts uncalibrated. The old key's
    observations are kept and age out.
  - **A long break:** a gap of **≥ 42 days** between two completed sessions of the same key discards that
    key's observations from before the gap.
  - **Changed loading:** observations whose loading context no longer matches the current configuration (the
    engine's `loading_convention_mismatch`) are excluded.
  - **Age:** observations older than 180 days drop out.
- **OD-17, row storage.** The check row adds one optional key: `calibration: {v: 1, predictedReps: P,
  predictionEdited: bool, prefillBasis: "reps_rir" | "reps"}`. Everything else is derived and versioned by the
  projection, nothing derived is stored:
  - `A` is the row's own `reps`;
  - the previous set is `setIndex − 1`;
  - the errors are computed from those.

  History edits:
  - Editing `reps` keeps the block; the lifter is correcting `A`.
  - Editing `load` removes the block; the check's same-load premise no longer holds.
  - Editing RIR to anything other than 0 removes it too.
- **OD-18, how the bias enters the engine: a bounded RIR shift, asymmetric, plus a load bound.**
  - **The shift.** For a key in a "tends to" state, the engine reads each comparable row's RIR as
    `max(0, rir − Δ)`:
    - over-estimate: `Δ = min(b̂, 2.0)`;
    - under-estimate: `Δ = max(b̂, −1.0)`;
    - uncalibrated or consistently calibrated: `Δ = 0`, today's behaviour exactly. That is the conservative
      fallback.
  - **Rows that aren't shifted:** `failure` rows (their RIR 0 is measured) and rows with `rir: null`.
  - **The load bound.** The engine computes the uncalibrated selection too. The calibrated target load may
    differ from it by at most **one available-load step up** or **two steps down**.
  - **What that means in capacity:** a shift of Δ reps changes capacity by `Δ/(30 + reps + RIR)`, about
    ±2.4 % per rep for a 10-rep set at 2 RIR. So capacity can move by at most about **+2.4 % or −4.8 %**,
    then the step bound applies.
  - **Versioning:** `ENGINE_VERSION` `069.1` → `077.1`, and a new `CALIBRATION_VERSION = "calibration@077.1"`.
    `FORMULA_VERSION` is unchanged: the capacity formula is the same and only its input is shifted.
  - **Assumption, stated plainly:** this applies a pre-set guess bias to ordinary in-set RIR reports. The two
    are related but not the same skill (synthesis §1). The bounds and the asymmetry exist because of that.
- **OD-19, how the check set itself feeds capacity.** It's a genuine RIR-0 set, `capacity = L × (1 + A/30)`,
  measured rather than reported. Proposed:
  - The engine treats it as an ordinary performed set: it already parses `rir: 0`.
  - It is **excluded from the fatigue estimate**: the drop into it mixes reporting error with fatigue.
  - It is never RIR-shifted.
  - As the last set, it never becomes an anchor (anchors are set index 0 or the live previous set).
  - Progress counts it as a measured hard set.
  - Option, default **off**: use the latest check, back-projected to set 1, as a **ceiling** on the history
    anchor (it can only lower).

### Gauge, copy, and the audit follow-ups

- **OD-20, the calibration gauge (owner): one user-level number, 0–100 %.** It answers "how much recent
  max-rep-check evidence Taurifer has across your exercises". It is **evidence sufficiency, not accuracy**: a
  lifter who consistently misjudges reserve reaches 100 % too, and the per-key bias handles them inside the
  engine.
  - **Observation weight:** `wᵢ = 0.5^(ageᵢ / 90 days)`, a 90-day half-life. Observations removed by a reset
    (OD-16) weigh 0.
  - **Per-key evidence, saturating at 3 recent checks:** `E_k = min(1, Σᵢ wᵢ / 3)`. Repeating one exercise
    can't fill the gauge.
  - **The gauge:** `G = floor(100 × min(1, Σ_k E_k / K))`, with
    `K = min(4, max(1, suitable keys in the active program))`. Full evidence is three recent checks on each of
    up to four different exercises, or on all of them if the program has fewer.
  - **When it's hidden:** if the active program has no suitable exercise, the gauge is hidden, not shown at
    0 %.
  - **What moves it:**
    - **Up:** only valid checks.
    - **Down:** time (the half-life), a break of ≥ 42 days (resets that key), and a new machine (a new key at
      0; the old key's evidence keeps aging).
    - Ordinary logging never moves it, because ordinary logs can't validate RIR (synthesis §3.2).
  - **Placement and copy:**
    - Placement: Settings › Effort, under the toggle.
    - EN: "Calibration evidence: 45 %" with the caption "From your recent max-rep checks across different
      exercises. It fades without new checks."
    - PT: "Evidência de calibração: 45 %" and "Dos seus testes recentes de repetições máximas em exercícios
      diferentes. Ela diminui sem novos testes."
    - Never "synchronized", "accuracy" or "complete".
  - **This overrides two earlier positions:** brief item 6 ("no score, meter…") and synthesis §3.3/§8. The
    owner chose it; the formula above is the honest version.
- **OD-21, owner intent recorded: the gauge and Pro (open).**
  - The owner intends to use the gauge later for Pro conversion. This plan designs no paywall and no
    entitlement check.
  - **Constitutional conflict to resolve first.** Any rule that turned calibrated suggestions (OD-18) off, or
    made them worse, for non-paying users would contradict:
    - the business thesis §8.1–8.2 (no clawbacks; "progression recommendations already part of the free
      product" and "load/reps/RIR or effort logging" are in the Free floor);
    - ADR 0010 ("Free remains complete for the current program… normal progression"; "Free set progression
      continues" after a lapse);
    - synthesis §6.1 ("Do not intentionally make Free predictions less reliable").
  - That rule would need an **explicit amendment** of the thesis and ADR 0010 before implementation. Before
    the commercial launch the no-clawback clock hasn't started (thesis `:92`), but ADR 0010's Free-floor
    commitments already govern the alpha.
- **OD-22, quiet Why copy, per exercise.**
  - **Where shown:** only on suitable exercises, and only once the lifter has opted in. The line never shows a
    number.
  - **Proposed lines:**

    | State | EN | PT |
    | --- | --- | --- |
    | uncalibrated | "Your effort estimate on this exercise is still being calibrated." | "Sua estimativa de esforço neste exercício ainda está sendo calibrada." |
    | tends to under-estimate | "Your max-rep checks show you usually have more reps left than you log, so this allows a little more." | "Seus testes de repetições máximas mostram que costuma sobrar mais repetições do que você registra, então isto permite um pouco mais." |
    | tends to over-estimate | "Your max-rep checks show you usually have fewer reps left than you log, so this is a little more conservative." | "Seus testes de repetições máximas mostram que costuma sobrar menos repetições do que você registra, então isto é um pouco mais conservador." |
    | consistently calibrated | "Your effort estimates on this exercise have matched your max-rep checks." | "Suas estimativas de esforço neste exercício têm batido com seus testes de repetições máximas." |

  - The "tends to" lines appear only when OD-18 actually moved the suggestion.
  - Copy is pending the owner's review (#315 process).
- **OD-23, audit follow-ups (decide; none is in this plan's PRs unless chosen):**
  - **(a) Documentation.** Correct the mechanics doc's "assumes 1" sentence (A1). Mark ADR 0003 and the
    strategy contract **superseded by Plan 067** for engine arithmetic (A3, A4). *Default: yes, in PR 1.*
  - **(b) Trust ceiling.** Reinstate a performed-RIR credit cap in the engine (A2). It changes suggestions for
    anyone logging RIR > cap. *Default: yes, as part of PR 4 under the same version bump, cap 5.* That keeps
    the engine's prescription ceiling of 6 out of reach for performed credit and stays close to ADR 0003's 4.
    The 0–6 target bound is unchanged.
  - **(c) Dead code.** Delete the unreachable ADR 0003 layer and `recoverSignal` (A3, A9). *Default: separate
    cleanup PR, not this plan.*
  - **(d) Live vs committed effort.** Fix the A5 disagreement. *Default: yes, PR 1, through the completion
    materialisation in §6.2.*
  - **(e) `hardRir` bounds.** Enforce 1–10 in `normSetting` (A8). *Default: yes, PR 1.*

## 4. Worked examples

All numbers assume no fatigue between the anchor and target sets unless stated, and show the shift and the
load bound in isolation. The final candidate is chosen by the engine's existing ranking
(`progression-engine.js:447-480`).

**W1, one noisy check (the synthesis example).**
- **Inputs:** set 2 is 60 kg × 10 at RIR 2. The prefill is `P = 10 + 2 − 1 = 11`, untouched. The check set is
  60 kg × **14**.
- **Errors:** the guess error is `e = 11 − 14 = −3`. The diagnostic implied error is the same −3.
- **Estimate:** `n = 1`, so `b̂ = −3/(1 + 2) = −1.0`. The state is **uncalibrated** (n < 3), so `Δ = 0` and
  suggestions are unchanged.
- **Check-set capacity:** `60 × (1 + 14/30) = 88.0`, against 84.0 from set 2.
- **Why line:** "still being calibrated". **Gauge** (K = 3, one check today): `floor(100 × (1/3)/3) = 11 %`.

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
  2026-07-20 are discarded for that key.

**W7, the gauge over time.** There are 4 suitable keys, so K = 4.

| Key | Checks (days ago) | E today | E after 60 more days |
| --- | --- | --- | --- |
| chest press | 3, 17, 31, 45 | 1.000 | 0.703 |
| pulldown | 10, 24, 38 | 0.834 | 0.526 |
| leg curl | 5, 19 | 0.609 | 0.383 |
| lateral raise | 12 | 0.304 | 0.191 |
| **Gauge** | | **68 %** | **45 %** |

- Three checks each on all four keys within the last 2–3 weeks gives about **93 %**.
- 100 % needs at least three checks on each of four exercises within a few days. The gauge falls without
  new checks, so it can't read as "complete".

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
   - **Value reads:** `numericSetValues` and `toHistoryRows` read per set: `edited.effort` token, else
     `edited.rir`, else the program mode's prefill. They emit `effortSource` from `completion.effortSource`.
   - **Check set:** the draft carries `calibration` while pending and emits it on the row.
   - **New command:** `setRirMode`, which updates `program.rirMode` for prefills of pending sets only.
2. **`app.js`:**
   - **Validation and settings:**
     - `isSafeLogRow` validates `effortSource` (enum) and `calibration` (shape, ints, bools);
     - `normalizeSettings` adds `effortScale` and the opt-in toggle, and bounds `hardRir` to 1–10 (OD-23e);
     - `changeRirMode` drops the lock and dispatches `setRirMode`.
   - **UI:** stage-B chips on the focus card and set row, the session-summary suggestion line, the check
     invitation, the prediction sheet in the rest, the failure-set state with the stop rule, and the result
     line.
   - **Engine feed:** `enginePerformedRow`/`progressionCurrentSession` pass `effortSource`. The live session
     reads the materialised value (fixing A5).
   - **Why and Settings:** the Why line (OD-22) and the Settings › Effort gauge.
   - **History editor:** `history-ui.js` sets `effortSource:"rir"` on RIR edits and applies the OD-17 edit rules.
3. **`effort-calibration.js` (new, pure).** It provides:
   - the suitability rule;
   - observation extraction from rows (errors, the implied-error diagnostic);
   - resets, the estimator and states;
   - `Δ` per key;
   - the gauge.

   It's versioned `calibration@077.1`, has no DOM and no storage, and is loaded before `app.js`. The new
   script needs an `index.html` tag, a `sw.js` `ASSETS` entry, a `transitionAssets` entry and a `CACHE` bump.
4. **`progression-engine.js`:**
   - **New settings fields:** `calibration: {version, shiftByKey}`, validated: `Δ ∈ [−1, 2]`, a finite number,
     and an unknown version means `Δ = 0`.
   - **Applying the shift:** in `parsePerformedSet`, except for `failure` rows.
   - **Fatigue:** exclude `failure` rows from `fatigueFrom`.
   - **Load bound:** compute the baseline selection and apply the step bound (OD-18).
   - **Trust ceiling:** the optional RIR credit cap (OD-23b).
   - **Explanation:** expose `calibration: {state, delta, baselineTargets}` on the recommendation for the Why
     line.
   - **Version:** bump `ENGINE_VERSION`.
5. **`progress-model.js`:** count `failure` rows as measured hard sets. Otherwise unchanged; `unsure` already
   reads as missing.
6. **`install-transfer-contract.js`:** `validateCanonicalLogRow` validates `effortSource` and `calibration`
   when present (strict, OD-24).
7. **`i18n-en.json` and `i18n-pt.json`:** stage-B, check, gauge and Why strings, then regenerate `i18n.js`.
8. **Docs:**
   - OD-23a corrections;
   - a new ADR, "Effort calibration (Free)", recording OD-7 to OD-22;
   - `CONTEXT.md` terms: *max-rep check*, *calibration evidence*, *effort source*.

## 6. Setup-link, transfer, Worker, migration and draft safety

### 6.1 Setup links, transfer and the Worker

- **Setup links: no change.**
  - `effortScale` and the toggle aren't in the closed settings tuple (`shared-setup.js:28-30`).
  - `rirMode` keeps its two values.
  - Setup links never carry logs.
- **Install transfer and the Worker: a redeploy is required for PR 1, PR 2 and PR 3.** The Worker bundles
  `install-transfer-contract.js` with `workout-draft.js`, `program-compiler.js`, `program-entry.js`,
  `exercise-metrics.js` and the catalog.
  - PR 1 and PR 2 change `workout-draft.js`.
  - PR 1 and PR 3 change row validation in the contract.
  - Each must be redeployed from its exact merge head **before** merge (`services/install-transfer/RUNBOOK.md`).
    Production transfers are latched off, but the gate applies.
  - PR 4 (engine only) doesn't touch the Worker.
- **OD-24, transfer strictness: validate the new row keys in the contract (default).**
  - Today `validateCanonicalLogRow` ignores unknown keys, so the new keys would pass through the Worker
    unvalidated.
  - Strict validation means a malformed `calibration` is refused at the Worker instead of at the receiving
    app.
  - New keys add well under 200 characters per row, against the 8,000-character cap
    (`install-transfer-contract.js:28`).
- **Version skew.**
  - A draft with stage-B tokens transferred to an app *older* than PR 2 fails that app's save validation
    (`invalid-effort`).
  - Transfers run between installs of the same origin, which update together through the service worker. The
    risk is accepted and stated in the PR.
  - Rows with the new keys are accepted by older apps: `isSafeLogRow` ignores unknown keys.

### 6.2 Migration and draft-safety rules

1. **No fabrication.**
   - Rows written before PR 1 have no `effortSource`, and no migration adds one.
   - `rirMeasured:false` keeps its meaning (A7).
   - The projection treats an absent source as unknown. It is never `prefilled`, never `rir`.
2. **Completed history is immutable to mode changes.** Changing stage or `rirMode` never rewrites a saved row.
   Only explicit History edits do, under the OD-17 rules.
3. **Draft safety.**
   - A completed set's effort value and source are frozen at completion (materialised). An open draft from
     before PR 2 still finishes; its completed sets lack `completion.effortSource` and save without the key.
   - A pending set keeps any value the lifter already entered.
   - A mode switch changes only the control and the prefill of untouched pending sets.
   - The recovery and replica paths (`durable-state.js`) carry the draft unchanged, because the new fields are
     ordinary draft JSON.
4. **Check cancellation.**
   - If the lifter changes the load of the check set, or logs it with RIR other than 0, the set saves as a
     normal set without `calibration`.
   - If they abandon the workout, nothing is stored.
5. **Backups and restore.** New keys round-trip as ordinary row fields, and the restore validator accepts them
   (§5.2).

## 7. Tests (each red before its change)

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

**PR 2, three stages:**
- **Draft:**
  - stage-B tokens save with the mapped RIR;
  - "Not sure" saves `rir:null` with `unsure`;
  - "3+" saves 3 with `reps_left_3plus`.
- **Switching mid-workout:**
  - completed sets are unchanged;
  - a touched pending set keeps its value and source;
  - untouched pending sets get the new prefill.
  - A browser test drives this through the real focus screen.
- **Settings:** `effortScale` survives `normalizeSettings`, backup and restore. A setup link made in stage B
  decodes as `rirMode:"effort"` with byte-identical link output (no codec change).
- **The stage suggestion:**
  - appears after 6 qualifying sessions (fixture clock);
  - a dismissal snoozes it for 60 days;
  - a second dismissal stops it.

**PR 3, checks and projection (no engine change):**
- `test/effort-calibration.mjs` (unit):
  - every worked example in §4, W1–W7, to the stated numbers;
  - `impliedError` equals `P − A` for an untouched prefill;
  - the suitability fixture is exactly the 241 IDs;
  - the gauge is hidden with no suitable keys;
  - the gauge is monotone non-increasing without new checks.
- **Draft and browser:** the full check flow (invitation → prediction prefill `n + r − 1` → edit → failure set
  → result line). The row carries `calibration`, `rir:0` and `effortSource:"failure"`.
- **Frequency rules:** one check per workout, the 14-day key snooze, two per week, none in a deload week.
- **Contract and Worker:** a `calibration` with a non-integer `predictedReps` is refused; a valid one gets 201.
- **Telemetry:** the existing allowlist test is unchanged. Add an assertion that no event fires during the
  check flow.

**PR 4, engine (after the numeric ODs are approved):**
- **Engine unit:**
  - W2 and W3 give the stated targets;
  - `Δ = 0` is byte-identical to `069.1` output over the engine corpus fixtures;
  - the step bound clamps a synthetic Δ = 2 case;
  - `failure` rows are excluded from fatigue and never shifted;
  - the RIR credit cap (OD-23b) limits a logged RIR 10.
- **Why model:** the Why line for each state, and no "tends to" line when the bound or rounding left the
  suggestion unchanged.

## 8. Catalog states

New and changed states, each in EN and PT, light and dark, at 320 and 390, and at text200:
- `workout-focus/effort-stage-b` (chips, one selected; "Not sure" selected);
- `workout-focus/effort-switch` (the stage switch control);
- `workout-summary/stage-suggestion`;
- `workout-summary/check-invitation`;
- `workout-focus/check-prediction` (in the rest, with the prefill and stepper);
- `workout-focus/check-active` (the failure set with the stop rule);
- `workout-focus/check-result`;
- `why/calibration-uncalibrated`, `why/calibration-under`, `why/calibration-over`, `why/calibration-consistent`;
- `settings/effort` (three stages, the toggle, the gauge at 0, 45 and 100 %, and hidden with no suitable
  exercise).

Each state needs role-inventory rows and CI-rendered frames (strict catalog verify). The Front 1 prototype,
`effort-stages.html`, is the visual reference; native-fidelity side-by-side comparison is required before
merge.

## 9. PR split

| PR | Content | Worker redeploy | Gate |
| --- | --- | --- | --- |
| 0 (this) | Plan 077 + audit | no | owner ODs |
| 1 | Provenance (`effortSource`, completion materialisation, A5 fix), History edit source, contract and app validation, OD-23a docs, OD-23e bounds | **yes** | OD-1, OD-2, OD-23, OD-24 |
| 2 | Three-stage logging, `effortScale`, mid-workout switch, stage suggestion, catalog states | **yes** | OD-3 to OD-6, copy review, prototype approval |
| 3 | `effort-calibration.js`, opt-in, check flow, `calibration` row key, gauge, Why "still being calibrated" line only | **yes** | OD-7 to OD-17, OD-20, OD-22 |
| 4 | Engine: shift, load bound, fatigue exclusion, RIR credit cap, `ENGINE_VERSION 077.1`, the remaining Why lines | no | OD-18, OD-19, OD-23b; **numeric approval before any engine change** |

PR 1 → 2 → 3 → 4 run serially: each depends on the previous row and draft shape. PR 4 can wait for alpha
evidence (synthesis Phase C) without blocking PR 1–3. Until then, checks collect evidence and the engine is
unchanged.
