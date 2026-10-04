# Program generation compiler 3 audit

Rerun with `node tools/audit-program-generation.mjs /tmp/audit-c3` against the compiler 3 source at main merge `fd4ff35fc102bdcf1a2d0176dff2c4f504146864`. Baseline counts are from the [3 October 2026 audit](../program-generation-2026-10-03/summary.json). Review verdicts count programs marked `review`; advisory flags sum the cohort's advisory counts.

| Cohort (100 programs each) | Contract failures, before → after | Review verdicts, before → after | Advisory flags, before → after |
|---|---:|---:|---:|
| Representative | 4 → 3 | 65 → 25 | 109 → 35 |
| Stress | 14 → 29 | 72 → 35 | 171 → 64 |

Audit attribution measured on main `fd4ff35`: every contract finding comes from the audit tool encoding superseded compiler-2 policy; none is a compiler defect.

- Stress: 44 findings in 18 programs, `Sets within documented bounds`, are minimum-dose single-set compounds (Plan 065 decision D12; exported `minSets` is 1).
- Stress: 22 findings in 4 programs, `RIR within authored range`, reflect the D15 priority bonus on an efficient slot: it becomes the normal 3 sets at 1–3 RIR, while the evaluator still treats the slot as efficient.
- `RIR within authored range` findings for isolation trimmed to 1 set at the efficient 0–2 RIR (D16): stress has 6 findings in 4 programs, and representative has 3 findings in 3 programs.
- Stress: 12 findings in 8 programs, `slot_intent`, because the checker uses compiler-2 patterns. Each detail is `Movement and muscle intent compatible`: S025 `growth_6_d5_s4`; S088 and S089 `home_4_d4_s1`; S094 `home_5_d5_s2`; S095 `home_5_d5_s3`; S098 `home_6_d2_s3`, `home_6_d4_s3`; S099 `home_6_d2_s3`, `home_6_d4_s3`, `home_6_d6_s1`; S100 `home_6_d6_s1`, `home_6_d6_s3`.
