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
Three individually duplicated static/runtime assertions are also removed;
their retained owners are mapped below. They are not three removed commands.
The subsequent checker consolidation removes eleven repeated named outcomes
and adds one public-delegation check (net ten fewer outcomes in that suite).
It does not remove an executable command or a unique failure mode.

| Removed/reworked execution | Stronger retained evidence | Boundary preserved |
| --- | --- | --- |
| Scheduled `simulation.mjs --smoke` | The same file's full run executes phases 1/1b/1c/1d before proceeding, with 52 historical weeks and the final console-error oracle | Historical loading, save pipeline, log/PR invariants, attention board, manifest, viewport, navigation and contrast checks remain. No assertion specifically targets a 12-week boundary. `--smoke` remains available for manual feedback. |
| Empty app boot before catalog seeding, followed by seed retries | Both localStorage and IndexedDB commit on an inert same-origin document before the real production loader boots; `ui-system.mjs` observes the first boot's complete replica values | Fresh isolated context, production normalization, theme/locale/clock/UUID pinning, and scenario journeys remain. Reload uses the same history entry. The exported reseed helper still supports loaded-page scenarios. |
| Settling on repeated identical timer writes | The same 400ms mutation quiet window and 5s cap, ignoring only equal attribute/text writes and equal text-node replacement | Real delayed changes restart the quiet window; element replacement and real style/text changes remain observed. Fonts, visible images, animations, paint wait, and all role/pixel/geometry assertions remain. |
| `vendor-runtimes.mjs`'s repeated `navPush === gestureExit` assertion | `motion-vocabulary.mjs`'s navPush section asserts the same equality plus spring type, damping and simulated release velocities | All distinct runtime/vendor assertions remain. |
| Two `runtime-budget.mjs` source-shape assertions for the dnd release entry and absence of a second immutable-runtime list | `vendor-runtimes.mjs` parses the canonical release inventory and checks both runtime layers' owners/optional flags/immutability; its routing assertion also rejects a second immutable-runtime list | Gzip budgets, defer timing, MIME/cache behavior and bundle pin-size assertions remain in runtime-budget. |
| Repeated rules-only checker fixtures for small/compliant/hidden targets, wide/fitting/ellipsis content, and accent fill/text/border/allowlisting | `direction-d-gate.mjs` exercises the exact shared checker functions and evidence collector with the same fixtures plus input/role-button, pseudo-element and allowlist-isolation cases. Rules-only verifies its exported checker delegation. | Positive-color and focus filtering, registered scrolling exceptions, sheet classification, configuration, actual rendered samples and onboarding checks remain in rules-only. |
| Waiting for a toast after a successful simulation Finish | The existing outcome wait observes summary or refusal toast, then reads both atomically. Success and refusal callers keep all their saved-row/no-write/translated-message assertions. | Zero-load success still requires no toast, a visible summary, an increased log and persisted zero. All 706 full-simulation checks remain. `readToast` uses its intended 2,500ms options argument for callers that actually expect a toast. |

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
its own copy of the pinned installed dependencies (outside the timed interval),
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
- The absent-toast regression was reproduced through the real smoke journey:
  all 31 checks passed, but the unchanged source exceeded a 25-second focused
  performance budget at 42.326s; the changed helper passed all 31 in 12.279s.
  This budget is an exploratory external harness, not a new scheduled test.
- The helper change passed all 706 full-simulation checks in 442.629s on clean
  source `58460a19247f7c26b8804d7f575f29d228d348d4`; source identity was unchanged
  before/after preview cleanup. F7 load validation was 146.540s versus the
  earlier 385.556s; initial save flow was 7.254s versus 37.769s. These local
  observations are not a complete-suite paired CI result.
- Its required packet selected exactly that simulation and passed all 706
  checks again in 458.000s. The rules-only owning suite passes 41 named checks
  versus the baseline's 51. The retained Direction D failure fixtures pass,
  but its complete local run remains failed (89/90): Chromium 151 reports
  Portuguese `progress/strength-comparison` text with 71px content in a 69px
  box. A focused differential reproduces the identical finding on untouched
  baseline and candidate. No threshold or product style was changed; pinned
  Chromium 149 passed the complete owner in both phases of the first paired
  benchmark. This local failure must not be relabeled green.

## First complete paired result

The [paired run](https://github.com/pedrochagasmaster/repforge/actions/runs/39123296504)
compared baseline `147e4afa07fea3243efd42b5b7d167c196c6a7ca` with
`80c3e058e0b814c4062abd4f4947622094418230`. Every initial execution and both
source-specific catalog-wide gates passed. Its separately required
[ordinary CI](https://github.com/pedrochagasmaster/repforge/actions/runs/39123296502)
also passed the complete inventory and global UI gate.

| Measure | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Commands | 208 | 207 | 0.48% |
| Files | 195 | 195 | 0% |
| Execution wall at 14 browser shards, including aggregate UI gate | 1,240.235s | 1,101.933s | 11.15% |
| Summed initial runner time | 13,895.877s | 12,411.748s | 10.68% |

Neither requested target is met. The quarter-time limits on this measured
baseline are 310.059s execution wall and 3,473.969s summed runner time. The
later absent-toast and checker changes are not included in this result; their
final-head CI and a new complete paired comparison remain required.

The command logs locate the remaining cost (rounded to hundredths of a
second, distinct from the millisecond aggregate above):

| Complete execution group | Before | After |
| --- | ---: | ---: |
| Six role-audit shards | 5,018.18s | 4,380.13s |
| Six pixel-catalog shards | 2,946.64s | 2,502.13s |
| All other inventory commands | 5,931.04s | 5,529.59s |

Even making both catalog groups free would leave more than the quarter-time
runner budget. Other measured owners include simulation (697.75s), program
generation browser (362.47s), Direction D (284.66s), crash replay (264.08s),
motion integration (204.16s), and Focus geometry (174.35s). Their unique
boundaries cannot be removed merely to satisfy the runtime number.

## Remaining consolidation decision

The declared catalog has 1,118 pixel frames and 772 rendered-role frames.
Their exact capture-key overlap is 579 (351 app, 228 onboarding); sharing
those live production setups would reduce 1,890 setup executions to 1,311,
or 30.6%, while retaining all pixel and role checks. The 193 audit-only frames
are dark Portuguese variants and must remain. Audit focus mutations and its
320px remeasurement must follow catalog observations; onboarding scroll/state
adjustments require separate observation-point equivalence proof. Reusing a
PNG cannot replace the live DOM/CDP audit. This is an unimplemented opportunity,
not measured savings or a 50% reduction in behavioral cases.

Halving the published baseline requires at most 104 commands or 97 executable
files. Repacking commands alone cannot establish that goal. A larger
consolidation must actually share setup and preserve every unique oracle, or
explicitly identify and obtain agreement on reduced behavioral coverage.
