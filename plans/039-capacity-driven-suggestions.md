# Plan 039: Capacity-driven load & rep suggestions — RIR as an extension of reps

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `BASE=$(git log -1 --format=%H -- plans/039-capacity-driven-suggestions.md); git diff --stat $BASE..HEAD -- app.js i18n.js i18n-en.json i18n-pt.json test/simulation.mjs`
> If any in-scope file changed since this plan landed, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Line numbers below were taken at
> `5b34d2f`; match on code, not on line numbers.)

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED-HIGH (rewrites the trigger arithmetic of the deterministic
  engine that every Log-tab suggestion, ghost value, heat gauge, and the
  simulation's progression matrix depend on; status vocabulary is
  preserved, so blast radius is behavioral, not structural)
- **Depends on**: none (wave 1–4 landed; independent of plan 038)
- **Category**: direction / correctness
- **Planned at**: commit `5b34d2f`, 2026-08-12. Baseline verified:
  `node --check app.js` clean, simulation `PASSED: 382, FAILED: 0`.
- **Source**: product-owner grill session (2026-08-12, eleven decisions,
  each locked below); [ADR 0003](../docs/adr/0003-capacity-as-progression-currency.md)

## Product decisions (locked — do not re-litigate)

Each of these was explicitly decided by the product owner. Deviating from
any of them is a STOP condition.

1. **Capacity is the single currency.** A set's capacity =
   `performed reps + min(max(RIR,0), hardRir)`. Normalized across loads as
   **capacity-e1RM** = `e1rm(load, capacityReps)` (the Epley helper already
   in the codebase), inverted to predict performable reps at any load.
   NOT adopted: a fixed target-RIR model (normative — punishes lifters who
   deliberately train at 0 RIR; RIR 0 is a plan, not an error), a
   baseline-RIR model (subsumed by capacity), more threshold rules over
   raw RIR (case-table explosion, granularity lost). See ADR 0003.
2. **RIR credit is capped at `hardRir`** (default 4). Estimates are
   reliable near failure, fantasy far from it. Effort-mode words
   (easy/hard/max → RIR 3/1/0) already sit inside the cap. Blank RIR keeps
   its existing conservative default of 1.
3. **Capacity extends triggers, never retracts them.** Demonstrated
   capacity ≥ range top + margin fires a load jump even when performed
   reps sit below the top (6 @ RIR 3 in a 6–8 range = capacity 9 → jump
   now, don't grind two more sessions). Performed-reps-at-the-top keeps
   firing the jump exactly as today (a 0-RIR lifter topping the range must
   still progress). Block-trend tempering still caps aggressiveness.
4. **Capacity-predicted re-entry after every load change.** Suggested reps
   at the new load = predicted performable reps there (inverse Epley on
   the capacity-e1RM) minus the lifter's own recent typical RIR, clamped
   into the rep range — replacing the blind reset to the range bottom.
   The old reset survives only as the clamp (big percentage jumps still
   land at `ex.min` naturally).
5. **In-session prediction is anticipatory, not reactive.** Next-set
   capacity = last completed set's capacity minus an expected per-set
   drop, sourced in fallback order: (a) observed — average drop between
   consecutive completed working sets this session (needs ≥2), (b)
   historical — this lift's median consecutive-set drop over recent
   sessions, (c) zero. The assumed drop is clamped to 0–5% per set.
6. **Cross-exercise signal ("session freshness") is a blend**: each
   completed lift's deviation from its capacity baseline is weighted by
   `0.3 + 0.7 × muscle overlap` with the upcoming exercise (primary↔primary
   full, primary↔secondary half, secondary↔secondary quarter). Templates
   with no muscle data degrade gracefully to the systemic floor.
7. **Session freshness is temper-only, damped, clamped, evidence-gated.**
   Positive deviations may offset negative ones inside the weighted
   average, but the final aggregate is clamped at zero — it never boosts.
   Apply 50% of the measured weighted deficit; cap the total adjustment at
   −5% capacity; stay silent until ≥3 completed working sets exist across
   earlier lifts, and skip any lift without ≥2 sessions of baseline. It
   only affects exercises with **no** completed sets yet this session —
   a lift's own logged sets always dominate.
8. **Reason-tagged one-liners, no new UI surface.** The existing
   `inSessionNote` line gains reason variants (anticipated drop, capacity
   jump, re-entry, freshness temper). Copy names the signal, not the
   arithmetic ("running hot", never "−3.2% weighted capacity deficit").
   No inspector panel in v1.
9. **Full re-derivation, vocabulary preserved.** `recommendation()`'s
   trigger conditions are re-derived on capacity, but the status
   vocabulary (`new`/`add2`/`add`/`reduce`/stalled/recover/`push_reps`/
   `hold_add_reps`), heat values, labels, block-trend tempering, and the
   stall/recover gates stay exactly as they are. No two-brain problem:
   both layers speak capacity.
10. **No new settings.** Capacity reuses `hardRir`, `jumpPct`, `minJump`.
    All new tuning constants live in ONE code table (`CAPACITY` below),
    flagged as tunable. `rirHigh` stays as a setting (it still feeds
    new-lift copy) but the engine's triggers stop reading it.

## Why this matters

The current engine is threshold-driven and RIR-coarse: a load jump
requires *performed* reps at the range top, so a lifter showing 6 @ RIR 3
in a 6–8 range (demonstrably above the top) grinds extra sessions; a set
at RIR 4 and a set at RIR 2 produce identical advice; `RIR ≤ 0` is
treated as an error ("shave a rep") when for a to-failure lifter it is
the plan; the in-session layer reads only the single most recent set, one
set behind the lifter's real drop-off; and grinding three RIR-0 sets of
bench changes nothing about the incline-press suggestion. Capacity fixes
all five with one currency, and the reason-tagged notes keep every
surprising suggestion explainable.

## Current state

All in `app.js` unless noted. Static PWA, no build step; `sw.js` serves
the app shell network-first (plan 011), so **no cache-version bump is
needed** for content-only `app.js` changes.

`app.js:52-53` — Epley e1RM (RIR-blind today) and the muscle splitter:

```javascript
const e1rm=(load,reps)=>load>0&&reps>0?load*(1+reps/30):0;
const muscles=s=>String(s||"").split(",").map(x=>x.trim()).filter(Boolean);
```

`app.js:63` — effort-mode word → RIR mapping (already inside the cap):

```javascript
const EFFORT_RIR={easy:3,hard:1,max:0};
```

`app.js:106` — settings defaults (`hardRir` is the credit cap; `rirHigh`
stays for copy only):

```javascript
const DEFAULTS={jumpPct:2.5,minJump:2.5,rirHigh:2,hardRir:4,restSec:120,...};
```

`app.js:766-777` — `sessionsFor(ex)`: one aggregate per past session
(working sets only), oldest→newest. This is where per-session capacity
aggregates get added:

```javascript
function sessionsFor(ex){const match=matchLift(ex),m=new Map();
  for(const x of state.log){if(!match(x)||!(+x.load>0)||!isWork(x))continue;
    ...
  return [...m.values()].map(o=>({session:o.session,date:o.date,created:o.created,reps:o.reps,
    med:median(o.loads),top:Math.max(...o.loads),minReps:Math.min(...o.reps),maxReps:Math.max(...o.reps),medReps:median(o.reps),
    avgRir:avg(o.rirs),bestE1rm:Math.max(...o.loads.map((load,index)=>e1rm(load,o.reps[index])))}))
```

`app.js:832-841` — the stall and recover gates (UNCHANGED by this plan)
and the jump/round helpers:

```javascript
function isStalled(sess){if(sess.length<3)return false;const r=sess.slice(-3),l0=r[0].med,rep0=r[0].maxReps;
  return r.every(s=>Math.abs(s.med-l0)<0.01)&&r.every(s=>s.maxReps<=rep0)}
function recoverSignal(ex,sess,rirCeiling=0.5){...}
function round(v){const raw=+state.settings.minJump;const inc=Number.isFinite(raw)&&raw>0?raw:2.5;return Math.round(v/inc)*inc}
function jump(load,mult){return Math.max(load*(+state.settings.jumpPct||0)*mult/100,+state.settings.minJump||2.5)}
```

`app.js:895-921` — `recommendation(ex)`: the between-session engine whose
*triggers* this plan re-derives (statuses, heat, labels, tempering stay):

```javascript
function recommendation(ex){
  const sess=sessionsFor(ex);
  if(!sess.length)return{status:"new",heat:.12,...,pushReps:true};
  const l=sess.at(-1),load=l.med,reps=l.reps,n=reps.length,rir=l.avgRir,rirHigh=+state.settings.rirHigh;
  const atTop=reps.filter(r=>r>=ex.max).length,allTop=atTop===n;
  // Majority rule: on 3+ sets, one near-miss (within a rep of top) shouldn't veto the jump.
  const nearTop=n>=3&&atTop>=n-1&&l.minReps>=ex.max-1;
  const stalled=isStalled(sess);
  const rec=(()=>{
    if((allTop||nearTop)&&rir>=rirHigh+1)return{status:"add2",heat:1,...,load:round(load+jump(load,2)),...};
    if(allTop||nearTop)return{status:"add",heat:.82,...,load:round(load+jump(load,1)),...};
    if(l.medReps<ex.min)return{status:"reduce",heat:.18,...,load:Math.max(round(load-jump(load,1)),+state.settings.minJump||2.5),...};
    if(stalled)return{status:"reduce",heat:.3,label:t("rec.stalled.label"),...};
    if(recoverSignal(ex,sess))return{status:"hold",heat:.42,label:t("rec.recover.label"),...};
    if(rir>=rirHigh+1)return{status:"hold",heat:.6,label:t("rec.push_reps.label"),...,pushReps:true};
    return{status:"hold",heat:.48,label:t("rec.hold_add_reps.label"),...,pushReps:true};
  })();
  const trend=blockTrendFor(sess);
  if(rec.status==="add2"&&trend.dir==="falling"){rec.status="add";...}
  rec.block=trend;rec.blockNote=blockTrendNote(trend);
  return rec;
}
```

`app.js:928-936` — `baseSetReps`: the blind reset to `ex.min` on load
changes that decision 4 replaces:

```javascript
function baseSetReps(ex,rec,old){
  if(rec.status==="add"||rec.status==="add2"||rec.status==="reduce")return ex.min;
  const prev=old&&+old.reps>0?+old.reps:null;
  if(prev==null)return ex.min;
  if(!rec.pushReps)return Math.max(ex.min,Math.min(ex.max,prev));
  return Math.max(ex.min,Math.min(ex.max,prev+1))}
```

`app.js:938-957` — `setSuggestion`: the in-session layer. Reads only the
single most recent completed working set; four threshold rules:

```javascript
function setSuggestion(ex,n,rec,draft,old){
  const rirHigh=+state.settings.rirHigh,minJ=+state.settings.minJump||2.5;
  const done=new Set(draft.__done||[]),warm=new Set(draft.__warm||[]);
  // Most recent completed working set for this lift earlier in THIS session.
  let prevInSession=null;
  for(let k=n-1;k>=1;k--){const key=`${ex.id}_${k}`;
    if(!done.has(key)||warm.has(key))continue;
    const ld=fromDisplay(parseDec(draft[`${key}_load`])||0),rp=parseDec(draft[`${key}_reps`])||0;
    if(!(ld>0&&rp>0))continue;
    let rir;if(isEffortMode())rir=EFFORT_RIR[draft[`${key}_effort`]]??1;
    else{rir=parseDec(draft[`${key}_rir`]);if(!Number.isFinite(rir))rir=1}
    prevInSession={load:ld,reps:rp,rir};break}
  if(prevInSession){
    const{load:L,reps:R,rir}=prevInSession;
    if(R>=ex.max&&rir>=rirHigh+1)return{load:round(L+jump(L,1)),reps:ex.min,src:"session-up"};
    if(R<ex.min)return{load:Math.max(round(L-jump(L,1)),minJ),reps:ex.min,src:"session-down"};
    if(rir<=0)return{load:L,reps:Math.max(ex.min,R-1),src:"session-hold"};
    return{load:L,reps:Math.max(ex.min,Math.min(ex.max,R)),src:"session-hold"}}
  return{load:rec.load,reps:rec.load!=null?baseSetReps(ex,rec,old):(old&&+old.reps>0?+old.reps:ex.min),src:"base"}}
```

`app.js:958-968` — `inSessionNote`: the one-line explanation slot that
decision 8 extends (existing i18n keys `log.insession.up|down|hold`);
`app.js:969-978` — `refreshSuggestions`: re-applies suggestions to
untouched later sets after each commit (loop and touched/committed guards
stay as-is).

`app.js:344` — the existing muscle matcher (note: it uses fuzzy
`includes()`; Step 4 defines a stricter exact-match overlap to avoid
"arms" ⊂ "forearms" false positives):

```javascript
  return muscles(ex.primary).concat(muscles(ex.secondary)).some(x=>x.toLowerCase()===m||x.toLowerCase().includes(m))}
```

Suggestion render call sites (ghost values): `renderWorkout` list rows
(~`app.js:1330`), focus mode (~`app.js:1385`), plus `refreshSuggestions`.
All consume `setSuggestion`'s `{load,reps,src}` shape — keep it (extend
with optional fields; never rename existing ones).

**i18n convention**: every new user-facing string needs a key in
`i18n-en.json`, `i18n-pt.json`, AND both `EN`/`PT` dictionaries in
`i18n.js` (three places, kept in sync by hand), rendered via `t("key")`.
PT copy must be real Portuguese. Existing engine keys live around
`i18n-en.json:386-410` (`rec.*`, `log.insession.*`).

**Existing simulation coverage you must respect** (`test/simulation.mjs`):
the state-driven progression matrix asserts `recommendation().status` for
seeded histories (new / add / add2 / hold), plus fatigue trim, heat
gauge, effort-RIR mapping, and in-session note checks. Baseline at
`5b34d2f`: `PASSED: 382, FAILED: 0`. The count only grows.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Syntax check | `node --check app.js` | exit 0, no output |
| Static server (terminal 1, repo root) | `python3 -m http.server 8000` | serves on :8000 |
| Simulation (terminal 2) | `cd test && node simulation.mjs` | `FAILED: 0`, exit 0 |
| Quick sim while iterating | `cd test && REPFORGE_SIM_WEEKS=12 node simulation.mjs` | `FAILED: 0` |

## Scope

**In scope** (the only files you should modify):

- `app.js` — capacity helpers, re-derived `recommendation()` triggers,
  rewritten `setSuggestion`/`baseSetReps`, session-freshness signal,
  extended `inSessionNote`.
- `i18n.js`, `i18n-en.json`, `i18n-pt.json` — new note copy, EN + PT.
- `test/simulation.mjs` — updated matrix + new capacity checks.
- `plans/README.md` — status row.

**Out of scope** (do NOT touch, even though they look related):

- `index.html`, `styles.css` — the notes ride the existing `.insession`
  div; no new markup.
- `sw.js` — shell is network-first; no assets added.
- `isStalled`, `recoverSignal`, `blockTrendFor`, block reviews, deltas
  (`DELTA_THRESHOLDS`, `buildSessionDelta`), PR detection, stats — they
  keep RIR-blind `e1rm` and their current semantics.
- Settings surface — no new settings, no removals (`rirHigh` stays).
- The per-set commit / touched / warmup mechanics and draft shape.
- Coach (plan 038) surfaces.

## Git workflow

- Branch: `cursor/plan-039-capacity-engine-<suffix>`.
- Commit style: single-line imperative summary; one commit per logical
  step is fine.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Capacity primitives + constants table

Next to `e1rm` (`app.js:52`), add:

```javascript
// Capacity: what a set demonstrated the lifter COULD have done (ADR 0003).
// RIR credit is capped at hardRir — trustworthy near failure, fantasy far from it.
const CAPACITY={jumpMargin:1,bigJumpMargin:3,pushGap:2,dropClamp:.05,
  baselineSessions:3,temperFloor:.3,temperDamp:.5,temperClamp:.05,temperMinSets:3};
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v)); // no clamp helper exists yet
const capRir=rir=>{const r=+rir;return Math.min(Number.isFinite(r)?Math.max(r,0):1,+state.settings.hardRir||4)};
const capReps=(reps,rir)=>+reps+capRir(rir);
const capE1rm=(load,reps,rir)=>e1rm(load,capReps(reps,rir));
const repsAtLoad=(cap,load)=>cap>0&&load>0?30*(cap/load-1):0; // inverse Epley
```

Extend the `sessionsFor` aggregate (`app.js:766`) with two fields
computed from the rows it already collects: `bestCap` (max per-set
`capE1rm`) and `medCappedRir` (median of `capRir(x.rir)`). Add two
derived helpers near it:

```javascript
// The lifter's own recent habitual RIR for this lift — a measurement, not a target.
function typicalRir(ex,sess){sess=sess||sessionsFor(ex);
  const recent=sess.slice(-CAPACITY.baselineSessions);
  return recent.length?median(recent.map(s=>s.medCappedRir)):1}
// Recent typical capacity for off-day detection. null until 2 sessions exist.
function capacityBaseline(ex,sess){sess=sess||sessionsFor(ex);
  if(sess.length<2)return null;
  return median(sess.slice(-CAPACITY.baselineSessions).map(s=>s.bestCap))}
```

**Verify**: `node --check app.js` → exit 0. In the browser console with
seeded data: `capReps(6,3)` → 9; `capReps(6,99)` → 10 (capped at
hardRir 4); `capReps(6,"")` → 7 (blank defaults to 1);
`Math.round(repsAtLoad(e1rm(100,9),100))` → 9.

### Step 2: Re-derive `recommendation()` triggers (statuses unchanged)

In `recommendation(ex)` (`app.js:895`), compute after `l` is taken:
per-set capacities of the last session (`sessionsFor` rows carry parallel
`loads`/`reps`/`rirs` arrays — keep them on the aggregate if needed),
`medCap = median(per-set capE1rm)`, and
`cr = repsAtLoad(medCap, l.med)` (capacity reps at the session's median
load). Replace ONLY the trigger conditions:

| Status | Old trigger | New trigger |
|--------|------------|-------------|
| `add2` | `(allTop\|\|nearTop) && rir>=rirHigh+1` | `cr >= ex.max + CAPACITY.bigJumpMargin` |
| `add` | `allTop\|\|nearTop` | `(allTop\|\|nearTop) \|\| cr >= ex.max + CAPACITY.jumpMargin` |
| `reduce` (below range) | `l.medReps < ex.min` | `cr < ex.min` |
| stalled / recover | unchanged | unchanged (same order in the chain) |
| `push_reps` | `rir >= rirHigh+1` | `cr - l.medReps >= CAPACITY.pushGap && cr <= ex.max` |
| `hold_add_reps` | default | default |

Decision 3's floor: the performed-path `allTop||nearTop` (with the
majority rule) stays verbatim inside the new `add` trigger — a 0-RIR
lifter topping the range still jumps. Note the deliberate semantic
change on `reduce`: 5 @ RIR 2 in a 6–8 range (capacity 7) now holds
instead of backing off — the lifter stopped early; capacity reaches the
range. 5 @ RIR 0 (capacity 5) still reduces.

Load formulas, heat values, labels, i18n keys, `pushReps` flags, and the
falling-block `add2→add` tempering stay byte-for-byte. Attach
`rec.cap=medCap` and `rec.typRir=typicalRir(ex,sess)` for Step 3.
`rirHigh` remains only in the `new`-lift copy interpolation.

**Verify**: `node --check app.js`; quick sim
(`REPFORGE_SIM_WEEKS=12 node simulation.mjs`) — expect progression-matrix
failures ONLY where semantics deliberately changed (the reduce case
above); fix those assertions in Step 6, but eyeball now that add/add2/
hold cases still pass.

### Step 3: Capacity re-entry + anticipatory in-session prediction

1. **Re-entry** — replace `baseSetReps` (`app.js:928`) internals: when
   `rec.status` is `add`/`add2`/`reduce` (load changed), return
   `clamp(Math.round(repsAtLoad(rec.cap, rec.load) - rec.typRir), ex.min, ex.max)`;
   keep the existing behavior for holds (`prev+1` chase when `pushReps`,
   plain clamp otherwise) and the `ex.min` fallback when no history.
2. **Expected per-set drop** — new helper: given the ordered completed
   working sets of this lift today (each with `capE1rm`), if ≥2 return the
   mean of `max(0,(cap[i]-cap[i+1])/cap[i])`; else compute the historical
   median consecutive-set drop from the last `baselineSessions` sessions'
   raw rows (group `state.log` rows by session, order by `set`); else 0.
   Clamp to `[0, CAPACITY.dropClamp]`.
3. **Rewrite `setSuggestion`** (`app.js:938`) keeping the signature and
   the `{load,reps,src}` return shape:
   - Collect ALL completed working sets of `ex` this session (same
     draft-reading loop, ascending, no early break).
   - If any exist: `L` = last set's load; `predCap` = last set's
     `capE1rm × (1 - drop)`; `predPerf = repsAtLoad(predCap, L) - typRir`.
     - `predPerf >= ex.max + CAPACITY.jumpMargin` → `L2=round(L+jump(L,1))`,
       reps = re-entry at `L2`, `src:"session-up"`.
     - `predPerf < ex.min` → `L2=Math.max(round(L-jump(L,1)),minJ)`,
       reps = re-entry at `L2`, `src:"session-down"`.
     - else → hold `L`, `reps=clamp(Math.round(predPerf),ex.min,ex.max)`,
       `src:"session-hold"`, plus `drop:true` when the anticipated drop
       lowered the target below the last set's performed reps.
   - Else: base path as today (`rec.load` + new `baseSetReps`), then
     Step 4's freshness temper.
   - Re-entry helper shared by both layers:
     `clamp(Math.round(repsAtLoad(predCap,L2)-typRir),ex.min,ex.max)`.
   - The old special-case `rir<=0 → R-1` is deleted — the anticipated
     drop replaces it with a measured version.
4. `refreshSuggestions` and both render call sites need no changes beyond
   tolerating the optional new fields.

**Verify**: `node --check app.js`. In the browser: commit set 1 of a
6–8 lift at 100×8 @ RIR 1 → set 2 ghost shows 100 and 7–8 reps (not a
blind repeat); commit set 2 lower → set 3 anticipates the observed drop;
commit a set at 6 @ RIR 4 (capacity 10) → next set jumps load with
re-entry reps inside the range, not `ex.min` blindly.

### Step 4: Session freshness (cross-exercise temper)

New function, used ONLY in `setSuggestion`'s base path (no completed sets
for this lift yet):

```
sessionFreshness(ex, draft) -> factor in [1 - CAPACITY.temperClamp, 1]
```

- For every OTHER exercise `o` in the program with ≥1 completed
  (non-warmup) working set in the draft: `todayCap` = max `capE1rm` over
  its completed sets; `base = capacityBaseline(o)` (skip when null);
  `dev = clamp((todayCap - base)/base, -.5, .5)`.
- Weight `w = CAPACITY.temperFloor + (1 - CAPACITY.temperFloor) × overlap(ex, o)`.
  `overlap`: max over muscle pairs — shared primary↔primary 1,
  primary↔secondary (either direction) 0.5, secondary↔secondary 0.25,
  none 0. Match on trimmed lowercase **equality** of `muscles()` tokens
  (NOT the fuzzy `includes()` of `app.js:344` — avoid "arms"⊂"forearms").
  Templates without muscle data get overlap 0 and degrade to the floor.
- Evidence gate: return 1 (no-op) unless total completed working sets
  across contributing exercises ≥ `CAPACITY.temperMinSets` AND ≥1
  exercise contributed a baseline.
- `aggregate = Σ(w·dev)/Σw`;
  `factor = clamp(1 + CAPACITY.temperDamp × Math.min(aggregate, 0), 1 - CAPACITY.temperClamp, 1)`.
  Positive aggregates → exactly 1 (decision 7: never boosts).

In the base path: when `rec.cap` exists, scale it by the factor before
computing re-entry reps at `rec.load`; if the tempered rep target falls
below `ex.min`, shave the load one `jump()` step (floor `minJump`) and
recompute. Tag the result `tempered:true` when factor < 1 for Step 5's
note. Load is otherwise never changed by freshness.

**Verify**: `node --check app.js`. Browser: seed two chest lifts with
2+ sessions of history; complete bench sets well below its baseline
(low reps, RIR 0) → the untouched incline first-set ghost reps drop
(vs. what they showed before the bench sets were committed); a leg lift
with no shared muscles moves less or not at all; complete bench ABOVE
baseline → downstream first sets are unchanged (no boost).

### Step 5: Reason-tagged notes (i18n ×3 files)

Extend `inSessionNote` (`app.js:958`) — same single-line slot, first
match wins across the still-unlogged sets:

- `src:"session-up"` → existing `log.insession.up` (copy stays).
- `src:"session-down"` → existing `log.insession.down`.
- `src:"session-hold"` with `drop:true` → NEW `log.insession.drop`, e.g.
  EN: `"This session: sets are trending down — set {set} aims for {reps} reps at {load} {unit}."`
- `src:"session-hold"` otherwise → existing `log.insession.hold`.
- base path with `tempered:true` → NEW `log.insession.temper`, e.g. EN:
  `"Earlier lifts ran hot today — easing into the first set."`
- base path when `rec.status` is `add`/`add2` and re-entry reps > `ex.min`
  → NEW `log.insession.reentry`, e.g. EN:
  `"New load {load} {unit} — {reps} reps should land at your usual effort."`

All three new keys go into `i18n-en.json`, `i18n-pt.json`, and BOTH
dictionaries in `i18n.js` (real Portuguese, matching the tone of the
existing `log.insession.*` entries). Copy names the signal, never the
arithmetic (decision 8).

**Verify**: `node --check app.js i18n.js`;
`rg -c '"log\.insession\.(drop|temper|reentry)"' i18n-en.json i18n-pt.json i18n.js`
→ 3, 3, 6. Browser in PT shows translated notes.

### Step 6: Simulation coverage

In `test/simulation.mjs`:

1. **Update** progression-matrix assertions that deliberately changed:
   the below-range `reduce` seed must now use capacity below `ex.min`
   (e.g. 5 reps @ RIR 0), and add a companion check that 5 @ RIR 2 in a
   6–8 range yields a hold-family status, NOT `reduce`.
2. **New checks** (pure via `page.evaluate` where possible):
   - `capReps(6,3)===9`, cap at `hardRir`, blank-RIR default.
   - Capacity-triggered add: seed last session 6 @ RIR 3 (range 6–8) →
     `recommendation().status==="add"`; 6 @ RIR 5+ (capped) does not
     over-trigger `add2` beyond `cr>=max+3`.
   - Performed floor: all sets at 8 @ RIR 0 → still `add`.
   - Re-entry: after an `add` with surplus capacity, first-set ghost reps
     land above `ex.min` and within the range; a big-percentage jump
     (light lift, `minJump` dominant) still lands at `ex.min` via clamp.
   - Anticipatory drop: commit two declining sets via the UI → third-set
     suggested reps ≤ second set's performed reps.
   - Freshness temper: seeded baselines, grind lift A below baseline →
     overlapping lift B's first-set reps drop; non-overlapping lift moves
     less; lift A above baseline → no change (clamp at 1); fewer than 3
     completed sets → no change (evidence gate).
   - Effort mode: easy/hard/max map to capacity via 3/1/0 unchanged.
   - New note keys render (assert `.insession` text against the i18n
     strings for drop/temper/reentry scenarios).
3. Update any heat-gauge / in-session-note checks broken by the new
   sources — if more than ~8 existing checks break, STOP (coupling wider
   than mapped).

**Verify**: `cd test && node simulation.mjs` → `FAILED: 0`,
`PASSED ≥ 382 + ~12`.

### Step 7: Manual smoke test

Serve, hard-reload (SW gotcha), then on a phone-sized viewport: one full
Log-tab session — commit sets and watch ghosts anticipate; force a
capacity jump mid-session; confirm the temper note appears on a second
exercise after grinding the first; Stats/History unaffected; PT pass.

## Test plan

- Pure math: `capReps`/`capRir` (cap, blank, negative), `repsAtLoad`
  round-trip with `e1rm`, `typicalRir`/`capacityBaseline` windows.
- Engine: the re-derived trigger table (each row, both directions),
  performed-reps floor, falling-block tempering intact, stall/recover
  gates untouched.
- In-session: anticipatory drop (observed + historical + zero fallbacks,
  clamp), re-entry after up/down moves, deleted `rir<=0` special case
  replaced by measured behavior.
- Freshness: blend weights, evidence gates, no-boost clamp, graceful
  degradation without muscle data.
- Notes: all six sources render the right key in EN and PT.
- Existing checks: everything else, `FAILED: 0`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `node --check app.js` exits 0
- [ ] `cd test && node simulation.mjs` exits 0 with `FAILED: 0` and PASSED ≥ 394
- [ ] `rg -c 'capE1rm' app.js` ≥ 1; `rg -c 'CAPACITY\.' app.js` ≥ 5 (constants actually consumed)
- [ ] `rg -n 'rirHigh' app.js` shows NO reads inside `recommendation`'s trigger chain or `setSuggestion` (settings surface + new-lift copy interpolation are fine)
- [ ] `rg -c '"log\.insession\.(drop|temper|reentry)"' i18n-en.json i18n-pt.json` → 3 and 3; both `i18n.js` dictionaries carry all three
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any "Product decisions" item would be violated — a normative RIR target,
  uncapped RIR credit, freshness boosting a suggestion, a new user-facing
  setting, a renamed/removed status or i18n key, non-deterministic logic,
  or capacity retracting a jump that performed-reps-at-top would fire.
- The current-state excerpts have drifted (see drift check).
- More than ~8 existing simulation checks break.
- `isStalled`/`recoverSignal`/`blockTrendFor` turn out to need changes to
  keep the chain coherent — report the conflict; do not quietly rewrite
  gates this plan promised to leave alone.
- The draft-reading loop in `setSuggestion` cannot see committed sets the
  way this plan assumes (`__done`/`__warm` semantics changed).

## Maintenance notes

- Every tunable lives in `CAPACITY`; expected tuning candidates after
  real-world use: `temperDamp`, `temperClamp`, `dropClamp`, `pushGap`.
  Change them there only — never inline.
- `bestE1rm` (RIR-blind) intentionally survives for stats/PRs/block trend
  so historical charts don't reprice; `bestCap` is the engine-side twin.
  If block trend later migrates to capacity, that's its own plan.
- The freshness overlap matcher is exact-token by design; if template
  muscle vocabularies drift ("Chest" vs "Pecs"), the 0.3 systemic floor
  still carries the signal. A synonym table is a possible follow-up, not
  v1.
- Reviewer should scrutinize: `repsAtLoad` behavior at very low loads
  (division amplifies), the historical-drop query cost inside render
  paths (memoize per exercise per draft-change if the Log tab slows —
  protect Log-tab speed above all else), and that `typicalRir` of a
  brand-new lift (default 1) doesn't make first-week suggestions weird.
