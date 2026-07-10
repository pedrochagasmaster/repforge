# Hold · recover — performance-gated design

> **Status**: Spec ready for human review (2026-07-10).
> **Branch**: `cursor/hold-recover-performance-gate-9cc1`
> **Scope**: Recommendation engine + attention-board fatigue signal only.
> **Evidence base**: Live `app.js` recommendation / attention paths at workspace HEAD.

## Problem

**Hold · recover** fires whenever last-session average RIR is ≤ 0.5, even when the lifter is progressing inside the rep range.

That conflicts with RepForge’s default training model:

- Many templates are low volume (e.g. 2×4–8).
- Target effort is RIR 0–`rirHigh` (default 0–2).
- Effort mode maps Hard → RIR 1, Max → RIR 0.

On a correctly trained low-volume session, avg RIR ≤ 0.5 is common and productive. Double progression still wants **same load, chase reps**. Today those sessions get a recovery nudge instead.

The attention board repeats the same false positive: `avgRir ≤ 0.5` → “Possible fatigue / sets grinding near failure.”

## Goal

Treat near-failure as the **prescription**, not the fatigue alarm.

**Hold · recover** should appear only when sets are grinding **and** performance failed to improve versus the prior session at that load.

Otherwise, mid-range sessions at RIR 0–1 should get **Hold · add reps**.

## Non-goals

- No new settings knobs (`rirHigh`, `hardRir`, jump %, etc. unchanged).
- No change to add / add2 / back-off / stalled priority order.
- No mesocycle / planned-deload calendar.
- No volume-aware special case (e.g. “skip recover when sets ≤ 2”) — performance gating covers low and high set counts.
- No glossary or onboarding rewrite beyond the recover copy string itself.

## Current behavior (verified)

`recommendation(ex)` priority (`app.js`):

1. **Add load ++** — all/near-top of range and avg RIR ≥ `rirHigh + 1`
2. **Add load** — all/near-top of range
3. **Back off** — median reps below `ex.min`
4. **Stalled · deload** — three sessions, same load, no gain in top-set reps (`isStalled`)
5. **Hold · recover** — avg RIR ≤ 0.5 ← **broken gate**
6. **Push reps** — avg RIR ≥ `rirHigh + 1`
7. **Hold · add reps** — default

Session metrics used: last session’s `med` load, per-set `reps`, `avgRir`, `medReps`, `maxReps`, `minReps` from `sessionsFor(ex)`.

Attention fatigue (`attentionSignal`):

```text
last.avgRir ≤ 0.5
  OR (fatigueCluster AND status === "hold" AND last.avgRir ≤ 1)
→ key "fatigue", why "sets grinding near failure."
```

## Proposed rule

### Recommendation: Hold · recover

After add / reduce / stall checks, replace bare `rir ≤ 0.5` with:

**Hold · recover** when all of the following are true:

| # | Condition | Detail |
|---|-----------|--------|
| 1 | Grinding | Last session `avgRir ≤ 0.5` |
| 2 | Prior session exists | `sessionsFor(ex).length ≥ 2` |
| 3 | Load not progressing up | Last `med` load ≤ prior `med` load (tolerance: `abs(delta) < 0.01` counts as same; any clear increase skips recover) |
| 4 | Reps did not improve | Last `maxReps ≤` prior `maxReps` **and** last `medReps ≤` prior `medReps` |

If grinding but any of 2–4 fail → fall through (typically **Hold · add reps**, or **Push reps** if RIR is high).

If there is no prior session, grinding alone never yields recover (first logged session at RIR 0 is still “chase reps”).

### Why both maxReps and medReps

- `maxReps` catches “top set didn’t move.”
- `medReps` catches “one lucky top set, typical sets worse/flat.”
- Requiring **both** ≤ prior means any clear improvement on either signal keeps the lifter on **Hold · add reps**.

### Load increase skips recover

If the lifter already added load and is grinding at the new load with flat/down reps, that is normal adaptation to a jump — not a recover cue. Existing **Back off** / **Stalled · deload** still catch true failure after a jump.

### Attention board

Align fatigue with performance, not effort alone.

Fire `key: "fatigue"` when either:

1. `recoverSignal(ex)` is true (same gate as the lift card), or
2. **Cluster soften:** `fatigueCluster` is true, recommendation status is `"hold"`, last `avgRir ≤ 1`, **and** conditions 2–4 of the recover rule hold (prior exists, load not up, reps not improved) — i.e. the same performance gate, but with a slightly looser effort ceiling (≤ 1 instead of ≤ 0.5) when the day already looks fatigued.

Do **not** fire fatigue on `avgRir ≤ 0.5` alone.

Why text when the gate fires: `hard sets, but reps did not move.`

### Copy

| Surface | New copy |
|---------|----------|
| Lift card label | `Hold · recover` (unchanged) |
| Lift card text | `Hard sets, but reps didn't move. Hold the load and bank recovery.` |
| Attention why | `hard sets, but reps did not move.` |

## Decision table (examples)

Assume `ex.min=4`, `ex.max=8`, `rirHigh=2`. Prior and last are consecutive sessions for one lift.

| Prior | Last | Result |
|-------|------|--------|
| 60×6,6 @1 | 60×7,6 @0 | **Hold · add reps** (reps improved despite grind) |
| 60×6,6 @0 | 60×6,6 @0 | **Hold · recover** (grind + flat) |
| 60×7,6 @0 | 60×6,5 @0 | **Hold · recover** (grind + down) |
| 60×8,8 @0 | — | **Add load** (topped range; recover never consulted) |
| 60×6,6 @0 | 62.5×5,5 @0 | **Hold · add reps** (load went up; grind alone ≠ recover) |
| 60×6,6 @3 | 60×6,6 @3 | **Push reps** (left RIR; not grinding) |
| — | 60×6,6 @0 | **Hold · add reps** (no prior; no recover) |
| 60×3,3 @0 | 60×3,2 @0 | **Back off** (below min; recover never consulted) |

## Architecture / touchpoints

Single behavioral seam: derive a shared helper so recommendation and attention cannot drift.

```text
function recoverSignal(ex, sess = sessionsFor(ex)) → boolean
  // true iff grinding + prior exists + load not up + reps not improved
```

Call sites:

1. `recommendation(ex)` — replace `if (rir <= 0.5) … Hold · recover`
2. `attentionSignal(ex, fatigueCluster)` — gate fatigue on `recoverSignal` (plus optional cluster clause as specified above)

No storage / schema / settings changes. No UI markup changes beyond the two copy strings.

## Error / edge handling

| Edge | Behavior |
|------|----------|
| One session of history | Never recover |
| Warmup sets | Already excluded from session aggregates via existing working-set filters; do not reintroduce |
| Effort mode Max/Hard | Still maps to RIR 0/1; only the *gate* changes |
| Floating load equality | Use existing stall-style epsilon (`abs(a-b) < 0.01`) for “same load”; treat last > prior + epsilon as load-up |
| `medReps` / `maxReps` missing | Should not happen for valid sessions; if a session summary lacks them, treat as “no recover” (fail open to add-reps) |

## Testing / verification

1. `node --check app.js`
2. Manual or scripted cases from the decision table above (seed two sessions per row, assert `recommendation(ex).label` / attention key).
3. Regression: topped-range still **Add load** at RIR 0; stalled still **Stalled · deload**; below-min still **Back off**.
4. Effort-mode smoke: two Max sets that add a rep vs prior → **Hold · add reps**, not recover.
5. Existing `test/simulation.mjs` suite still passes (no intentional assertion on recover copy today; re-grep if any appear).

## Out of scope / follow-ups (explicitly deferred)

- Within-session set-to-set collapse heuristics (e.g. set 1 @8 RIR1 → set 4 @4 RIR0).
- Changing `isStalled` window or fatigue-watch thresholds.
- Surfacing recover as a distinct attention group separate from fatigue.

## Success criteria

- A lifter logging RIR 0–1 on a low-volume template who is still adding reps sees **Hold · add reps**, not **Hold · recover**.
- Recover still appears when grinding coincides with flat or declining reps at the same (or lower) load.
- Attention “Possible fatigue” no longer fires on productive near-failure sessions.
- Add / reduce / stall behavior unchanged.
