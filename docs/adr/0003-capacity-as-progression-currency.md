# Capacity (reps + trusted RIR) replaces threshold-RIR rules as the progression currency

The deterministic suggestion engine (`recommendation`, `baseSetReps`,
`setSuggestion` in `app.js`) read performed reps and RIR through fixed
thresholds: load jumps required *performed* reps at the range top, RIR
mattered only via cliff-edge comparisons against the `rirHigh` setting,
and `RIR ≤ 0` was treated as a problem to correct ("shave a rep"). That
shape misreads lifters at both ends: someone who deliberately trains
every set to 0–1 RIR gets nagged to back off despite progressing, and
someone who logs 6 reps @ RIR 3 in a 6–8 range — demonstrably above the
range top — still gets told to grind performed reps up one session at a
time. A set at RIR 4 and a set at RIR 2 produced identical advice.

Decision (product owner, 2026-08, grilled decision-by-decision): the
engine's single currency is **capacity** — what a set demonstrated the
lifter could have done: `performed reps + min(RIR, hardRir)`. Normalized
across loads as **capacity-e1RM** via the Epley formula already in the
codebase (`e1rm(load, capacityReps)`), and inverted to predict
performable reps at any load. Everything derives from it: load-jump
triggers (fire on demonstrated capacity, with performed-reps-at-top kept
as a floor so capacity extends but never retracts today's triggers), rep
targets after a load change (predicted reps at the new load minus the
lifter's own recent typical RIR, clamped into the range — no more blind
reset to the range bottom), in-session next-set prediction (anticipating
the lifter's typical per-set drop-off), and a weak, temper-only
cross-exercise fatigue signal (completed lifts running below their
capacity baselines, weighted by muscle overlap over a systemic floor).

RIR credit is capped at the `hardRir` setting (default 4) because RIR
estimates are reliable near failure and fantasy far from it; effort-mode
words (easy/hard/max → 3/1/0) already sit inside the cap.

We rejected: a fixed target-RIR model (normative — it punishes lifters
who train to failure on purpose; RIR 0 is a plan, not an error), a
baseline-RIR model steering toward each lifter's habitual RIR (subsumed
— capacity measures the same thing without judging the number), and
extending the existing threshold-rule table (every new signal multiplies
the case table, and RIR granularity stays collapsed into buckets).

Unchanged: the engine stays deterministic and local ("recommendation"
remains reserved for it; later managed Taurifer AI under ADR 0011 is a separate
surface). The status vocabulary (`new`/`add2`/`add`/`reduce`/`hold`
variants), heat gauge, block-trend tempering, and stall/recover gates
survive — only the trigger arithmetic underneath changes. No new
settings: capacity reuses `hardRir`, `jumpPct`, `minJump`; tuning
constants live in one code table. See `plans/039-capacity-driven-suggestions.md`
for the implementing spec.
