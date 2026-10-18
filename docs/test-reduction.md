# Test reduction and execution measurements

## Goal and present scope

The requested goals are at least 50% fewer tests and complete-suite execution
in at most one quarter of the baseline time. **Neither goal is claimed as met.**
This change removes one demonstrated duplicate inventory execution and reduces
catalog fixture/settling overhead without deleting product or fault assertions.
Further deletions require a stronger retained proof for each plausible bug.

Baseline: `147e4afa07fea3243efd42b5b7d167c196c6a7ca`, after layout D #436 and
iPhone fixes #440. Its [successful CI run](https://github.com/pedrochagasmaster/repforge/actions/runs/39100142670)
executed all 208 inventory commands. Summing their initial execution records
gives 13,758.98 seconds (229.32 runner-minutes). The slowest browser execution
step was 1,182 seconds (19m42s), at 14 browser shards. End-to-end workflow time
was 48m44s, including queue/setup/artifact time. These are different measures.
The earlier failed main run at `5a2a3928` is historical, not this baseline.

## Counts and retained coverage

| Measure | Before | After | Interpretation |
| --- | ---: | ---: | --- |
| Inventory commands | 208 | 207 | 0.48% reduction; not 50% |
| Distinct scheduled executable files | 195 | 195 | No file-count reduction |
| Scheduled simulation named checks | 31 + 706 | 706 | Eliminate the repeated smoke prefix; retain the full simulation |
| Behavioral cases/assertions across the entire repository | Not standardized | Not standardized | Command/file counts cannot be presented as this number |

The simulation check counts above are observed local executions, not a source
regex count. TAP tests, custom boolean checks, generative properties/cases,
and rendered-role measurements use different counting conventions. Combining
them into one invented denominator would misrepresent the reduction. New
verification-tool and fixture protocol checks are additions, not deductions.

| Removed/reworked execution | Stronger retained evidence | Boundary preserved |
| --- | --- | --- |
| Scheduled `simulation.mjs --smoke` | The same file's full run executes phases 1/1b/1c/1d before proceeding, with 52 historical weeks and the final console-error oracle | Historical loading, save pipeline, log/PR invariants, attention board, manifest, viewport, navigation and contrast checks remain. No assertion specifically targets a 12-week boundary. `--smoke` remains available for manual feedback. |
| Empty app boot before catalog seeding, followed by seed retries | Both localStorage and IndexedDB commit on an inert same-origin document before the real production loader boots; `ui-system.mjs` observes the first boot's complete replica values | Fresh isolated context, production normalization, theme/locale/clock/UUID pinning, and scenario journeys remain. Reload uses the same history entry. The exported reseed helper still supports loaded-page scenarios. |
| Settling on repeated identical timer writes | The same 400ms mutation quiet window and 5s cap, ignoring only equal attribute/text writes and equal text-node replacement | Real delayed changes restart the quiet window; element replacement and real style/text changes remain observed. Fonts, visible images, animations, paint wait, and all role/pixel/geometry assertions remain. |

Persistence/race recovery, migrations and historical-writer fixtures, offline
and privacy gates, accessibility, visual variants, and service checks are
unchanged. No slow lane leaves the complete inventory. Concurrency and shard
counts are unchanged.

Program Lab #432 is still open at `ce0b4403341ee9dbdd34dc6994a1244172189fb8`:
its ten additional commands are not yet on this main baseline. Preserve them
and their selection mappings when integrating; rebase and repeat the complete
benchmark if they land first. This patch does not copy #435's device-pixel
sampler repair, change its proposed seven UI shards, or alter the held product
finding #441 or any contrast threshold/exception.

## Reproducible paired complete benchmark

`.github/workflows/test-benchmark.yml` runs when this report or its benchmark
tool/workflow changes in a PR. Each of the original 14 browser scopes, plus
fast and service, runs its baseline and candidate sequentially on the **same
worker** with Node 22.23.0, matching dependency locks, pinned test Chromium, and
generative seed `147443`. Each phase gets an isolated detached worktree and
its own truthful `CI_SOURCE_SHA`. The fast scope includes inventory validation
and the Plan 073 Python verifier; the service scope retains its complete gate.
Initial failures remain failures; benchmark execution never retries to green.
The ordinary final-head `ci` certificate remains separately required.

Before publishing timings, the report runs each source's actual catalog-wide
`merge-ui-system` gate against only that phase's collected shard artifacts.
This preserves the required-selector/exception union check that no individual
shard can decide. Its separately recorded runtime is included after the maximum
parallel-scope execution time.

The report refuses incomplete scopes, missing/duplicate commands, inconsistent
source/seed identities, and unsuccessful initial executions. It reconciles
the union against each source's **complete** executable inventory. Artifacts
retain both runs' logs, evidence, timings and hardware identity for seven days.
Each scope also records unchanged clean source identities before/after each
phase, and browser scopes record the actual launched browser version.
The summary reports commands/files, summed initial runner time, and the maximum
scope execution time at the fixed concurrency. Checkout, installation,
artifact transfer and queue time remain separately visible in Actions; that
maximum execution time must not be called end-to-end workflow time.

For a single scope after installing the pinned test dependencies/browser:

```sh
node tools/benchmark-tests.mjs run <full-base-sha> <full-head-sha> 1/14
node tools/benchmark-tests.mjs run <full-base-sha> <full-head-sha> fast
node tools/benchmark-tests.mjs run <full-base-sha> <full-head-sha> service
node tools/benchmark-tests.mjs summarize <downloaded-paired-artifact-directory>
```

Run every browser scope before summarizing. Both dependency lockfiles must
match; the tool refuses to silently compare different dependency installations.
The paired run is ordered before/after once per worker, so it controls machine
and concurrency but is not a multi-run statistical confidence interval.

## Local evidence and limitations

Linux x64, 5 CPUs, Node 22.23.0, Playwright 1.61.1. The pinned Chromium 149
download returned HTTP 403 in this executor, including the approved escalated
attempt. Local browser checks therefore use explicit Chromium 151.0.7922.173;
they are not claimed as the pinned CI screenshot certificate.

- Untouched baseline: all 59 fast commands passed; simulation smoke passed
  31 checks in 43.59s and the full simulation passed 706 checks in 724.15s.
- The first-boot fixture protocol failed before the setup change (it observed
  an empty boot before the fixture); the revised helper passes.
- Identical timer writes exhausted 5,176ms before the settling change. The
  revised helper passes the timing proof and the real-delayed-mutation proof.
- Six profiled states produced identical screenshots and complete rendered
  check results before/after. Their sampled work totals were 61.735s and
  39.381s; this is focused exploratory evidence, not a complete-suite benchmark
  or a claim about the requested 4x improvement. Background focused checks
  were running, so this sample is not the controlled paired CI measurement.

Complete paired results and final-head CI are pending. Do not infer a whole
suite speedup or a 50% behavioral-test reduction from these local observations.
