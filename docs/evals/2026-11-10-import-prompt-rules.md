# Import prompt rules for holds, carries, supersets and "same as" (2026-11-10)

The owner's live test of managed import on a Brazilian coach program showed three prompt gaps:
- a plank in seconds and a farmer walk in metres came back as rows with missing reps;
- the second exercise of a bi-set came back without the pair's set count;
- "Rosca martelo — mesma coisa da rosca direta" was handled, but by luck rather than a rule.

The shared `entry.freeform.prompt` (EN and PT) now has three rules. It leaves out timed holds and carries or walks set by distance or time, naming them as `other_notes`. It gives every exercise in a superset or bi-set the group's set count and adds `supersets`. It copies the prescription for "same as X". The first draft of these rules came after the `notImported` rule and made the model drop other categories. The final prompt moves that rule to the end and asks for every category that applies, each once.

## Benchmark

This uses the managed-import configuration: the production prompt, medium effort and 16,384 maximum output tokens. Prompt mode was direct API, concurrency 8, one repeat, on the synthetic development (120) and validation (40) splits. The holdout was exposed on 2026-11-08 and was not used.

| Run | Development strict-exact | Validation strict-exact | Unsafe complete | Mean fidelity (dev) | Cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before (main prompt) | 106/120 (88.3%) | 36/40 (90.0%) | 1 (dev `pt06-05`) | 0.993 | $0.120 |
| First draft (rejected) | 94/120 (78.3%) | 35/40 (87.5%) | 0 | 1.000 | $0.131 |
| **After (shipped)** | **113/120 (94.2%)** | **36/40 (90.0%)** | 1 (dev `pt06-05`) | 0.993 | $0.130 |

- Paired development delta, before → after: +5.8 points (13 improvements, 6 regressions). The family-bootstrap 95% CI is −0.8 to +13.3 points, so the gain is not significant on this synthetic set.
- The first draft's 26 failures were all missing `notImported` categories, and it made no prescription errors. That is why the shipped prompt only moves and sharpens the category rule.
- The one unsafe acceptance is the same case before and after: `pt06-05`, a single reply with row, day and set errors. It did not appear in the 2026-11-08 medium-effort sweep, so it is run-to-run variation the prompt change did not cause.
- These synthetic splits contain few holds, carries or "same as" lines. The owner's own sample is the direct check below.

## The owner's sample, 3 runs per prompt (PT)

| | Before | After |
| --- | --- | --- |
| Rows | 23 (plank and farmer walk included) | 21 (both left out) |
| "Mergulho no banco" (bi-set second) | sets missing in 2 of 3 runs | 3 sets in 3 of 3 |
| "Rosca martelo" (same as rosca direta) | 3x8-10 | 3x8-10 |
| Missing values asked for | 4–5 | 2 (dip reps "até a falha", pull-ups "máximo de reps") |

Two values stay missing on purpose. The source gives no rep number for them, so the gap screen asks the lifter.

Total paid spend for this round: about $0.39, inside the owner's $5 cap. Raw replies stay local and ignored under `tools/program-import-eval/reports/runs/import-quality-2026-11-10/`.
