# Taurifer — Haiku 5.5 effort sweep, corrected benchmark

Complete: 960 direct Anthropic Messages API calls; model claude-haiku-5-5.
Prompt: exact merged EN/PT i18n prompt; unforced JSON prompt output.
Effort: low / medium / high / xhigh; same 32,768 maximum output tokens.
Dataset: 120 development, 40 validation, 40 stress, 40 owner-exposed holdout.
Gold correction: only day case and unsupported category labeling; all 200 source texts
were byte-for-byte verified unchanged against baseline commit 465a4f4f5.

## Evaluation conclusion

**Medium is the best overall default candidate from this synthetic experiment:**
213/240 exact and zero unsafe accepted prescriptions, matching High and
Xhigh while using fewer tokens, lower latency, and less money. Low was about
12% faster and 12% cheaper but had one wrong-yet-accepted duplicate working
exercise. High costs about 19% more than Medium for no net exact improvement;
Xhigh costs about 63% more and is about 65% slower on average. These are
list-rate estimates, not reconciled charges.

Locale diverges: PT-BR rises from **99/120 at Medium** to **105/120 at Xhigh**,
while English falls from **114/120 at Medium** to **108/120 at Xhigh**. A PT-only
Xhigh + EN Medium policy would be **219/240** ($0.226 estimated total across
240 calls) on this corpus, but choosing it now would overfit a one-shot,
synthetic and already-exposed holdout. Test such routing on a new, independently
annotated PT corpus before any product decision.

All four efforts returned 16/16 correct rejections of non-program text.
The corrected run had **zero transport failures**; no input program source
text changed between the original API sweep and gold regrading.

## Main result

| Effort | Exact | Core prescription | Gap handling | Negative rejection | Unsafe complete | Mean / P95 latency | Estimated USD | USD / faithful import |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| low | 203/240 (84.6%) | 99.2% | 98.4% | 16/16 | 1 | 4066 / 6655 ms | $0.1432 | $0.0008 |
| medium | 213/240 (88.8%) | 100.0% | 100.0% | 16/16 | 0 | 4576 / 7269 ms | $0.1622 | $0.0008 |
| high | 213/240 (88.8%) | 100.0% | 100.0% | 16/16 | 0 | 5463 / 8569 ms | $0.1925 | $0.0010 |
| xhigh | 213/240 (88.8%) | 100.0% | 100.0% | 16/16 | 0 | 7547 / 13370 ms | $0.2652 | $0.0013 |

Costs are derived from published API list rates ($0.10/MTok input,
$0.50/MTok output for prompts under 100K tokens), not an invoice. The
estimated charge per faithful import includes calls to reject non-programs.

Core prescription = correct import/rejection without exercise, day, sets, reps
or gap errors; missing/extra unsupported sidecars are counted separately.

## Exact semantic success by dataset split

| Split | low | medium | high | xhigh |
| --- | ---: | ---: | ---: | ---: |
| development | 85.0% (0 unsafe) | 89.2% (0 unsafe) | 90.0% (0 unsafe) | 86.7% (0 unsafe) |
| validation | 85.0% (0 unsafe) | 80.0% (0 unsafe) | 85.0% (0 unsafe) | 90.0% (0 unsafe) |
| stress | 82.5% (1 unsafe) | 92.5% (0 unsafe) | 90.0% (0 unsafe) | 90.0% (0 unsafe) |
| holdout | 85.0% (0 unsafe) | 92.5% (0 unsafe) | 87.5% (0 unsafe) | 92.5% (0 unsafe) |

## Exact semantic success by locale

| Locale | low | medium | high | xhigh |
| --- | ---: | ---: | ---: | ---: |
| PT | 75.0% | 82.5% | 85.8% | 87.5% |
| EN | 94.2% | 95.0% | 91.7% | 90.0% |

## Pairwise against low effort (family-cluster bootstrap)

- medium: 4.2 percentage points; cluster bootstrap 95% CI [-0.5, 8.8]; improvements 24, regressions 14, new unsafe 0
- high: 4.2 percentage points; cluster bootstrap 95% CI [-0.9, 9.6]; improvements 24, regressions 14, new unsafe 0
- xhigh: 4.2 percentage points; cluster bootstrap 95% CI [-1.9, 10.0]; improvements 27, regressions 17, new unsafe 0

## Unsafe accepted prescriptions

- low/stress/ptx-06: row_count_mismatch, wrong_sets, wrong_reps, wrong_name, missing_exercise

## Error types

| Error | low | medium | high | xhigh |
| --- | ---: | ---: | ---: | ---: |
| duplicate_categories | 0 | 0 | 0 | 1 |
| invented_category_other_notes | 8 | 7 | 10 | 15 |
| invented_category_progression_rules | 1 | 0 | 1 | 0 |
| invented_category_rir_rpe | 0 | 2 | 2 | 1 |
| invented_category_tempo | 0 | 1 | 1 | 0 |
| invented_reps | 1 | 0 | 0 | 0 |
| invented_sets | 1 | 0 | 0 | 0 |
| missing_category_cardio | 4 | 2 | 0 | 1 |
| missing_category_deload | 2 | 0 | 0 | 1 |
| missing_category_other_notes | 15 | 9 | 7 | 8 |
| missing_category_progression_rules | 8 | 6 | 1 | 1 |
| missing_category_rest_times | 11 | 7 | 3 | 2 |
| missing_category_rir_rpe | 4 | 6 | 6 | 2 |
| missing_category_supersets | 2 | 2 | 2 | 1 |
| missing_category_tempo | 2 | 2 | 2 | 1 |
| missing_category_warmups | 4 | 2 | 0 | 1 |
| missing_exercise | 1 | 0 | 0 | 0 |
| row_count_mismatch | 1 | 0 | 0 | 0 |
| wrong_name | 2 | 0 | 0 | 0 |
| wrong_order | 1 | 0 | 0 | 0 |
| wrong_reps | 2 | 0 | 0 | 0 |
| wrong_sets | 2 | 0 | 0 | 0 |

## Interpretation limits

- Synthetic references are not independent real-coach programs.
- This run deliberately exposed the holdout across all four levels; do not
  reuse it as a sealed holdout for subsequent prompt optimization.
- Changed gold labels were corrected via saved synthetic model replies, not
  repeat inference calls, and every original run remains intact.
- CLI-proxy experiments from PR #707 are a separate population, not comparable
  as API latency or billing.
- No effort level is automatically promoted: a safety gate takes priority
  over higher aggregate exact success.

Primary sources:
- Anthropic effort settings: https://platform.claude.com/docs/en/build-with-claude/effort
- Haiku 5.5 pricing: https://www.anthropic.com/claude-haiku-5-5
- Taurifer import contract: docs/adr/0014-free-form-program-import-handoff.md
