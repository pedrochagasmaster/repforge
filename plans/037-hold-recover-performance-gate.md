# Plan 037: Performance-gated Hold · recover

> **Spec**: `docs/superpowers/specs/2026-07-10-hold-recover-performance-gate-design.md`
> **Status**: Ready to execute

## Goal

Fire **Hold · recover** (and attention fatigue) only when last-session avg RIR ≤ 0.5 **and** performance did not improve vs the prior session at the same/lower load. Productive near-failure on low-volume templates should get **Hold · add reps**.

## Steps

1. Add `recoverSignal(ex, sess?, rirCeiling?)` next to `isStalled` / `recommendation` in `app.js`.
2. Replace bare `rir<=0.5` recover branch with `recoverSignal`; update copy.
3. Gate `attentionSignal` fatigue on `recoverSignal` (+ cluster soften at RIR ≤ 1); update why copy.
4. Expose `window.__repforgeRecoverSignal` for verification (match existing `__repforge*` test hooks).
5. Verify decision-table cases via page evaluate; `node --check app.js`.

## Out of scope

Settings, stall window, within-session collapse, UI markup beyond copy strings.
