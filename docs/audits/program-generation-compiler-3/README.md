# Program generation compiler 3 audit

Rerun with `node tools/audit-program-generation.mjs /tmp/audit-c3` against the compiler 3 source at main merge `fd4ff35fc102bdcf1a2d0176dff2c4f504146864`. Baseline counts are from the [3 October 2026 audit](../program-generation-2026-10-03/summary.json). Review verdicts count programs marked `review`; advisory flags sum the cohort's advisory counts.

| Cohort (100 programs each) | Contract failures, before → after | Review verdicts, before → after | Advisory flags, before → after |
|---|---:|---:|---:|
| Representative | 4 → 3 | 65 → 25 | 109 → 35 |
| Stress | 14 → 29 | 72 → 35 | 171 → 64 |

The `slot_intent` check assumes compiler-2 patterns. It reports 12 failures across 8 stress programs; each detail is `Movement and muscle intent compatible`: S025 `growth_6_d5_s4`; S088 and S089 `home_4_d4_s1`; S094 `home_5_d5_s2`; S095 `home_5_d5_s3`; S098 `home_6_d2_s3`, `home_6_d4_s3`; S099 `home_6_d2_s3`, `home_6_d4_s3`, `home_6_d6_s1`; S100 `home_6_d6_s1`, `home_6_d6_s3`.

The other failed dimension is `prescription_bounds`, detail `RIR within authored range`: 3 representative programs (3 failed checks) and 23 stress programs (72 failed checks). These are included in the contract-failure totals above.
