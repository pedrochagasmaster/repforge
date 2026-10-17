# Program Lab integration acceptance

Status: planned independent verification; no implementation acceptance is claimed.
Governing spec: PR #426, head 5494f91ecb179a5c979d7c8baec63c099f251fbd.
Reviewed remote main: 5a2a39284e27f7276c2b5e87bb2e11f05d67f3fa; generator 073.4.
The owner explicitly approved adapting Program Lab to 073.4 while preserving production defaults and the experiment/comparison features.

## Approved baseline reconciliation

- Preserve the current canonical-request identity. Seeds from retired fixtures are labels/provenance only; do not make them influential or put request.seed back into current-generation requests.
- Use current recovered allocation, distribution, spillover, ordering and dose rules. Do not restore authored jobs, compact purpose tables, the old emphasis donation procedure or time-cut stages.
- Keep the 13 split identities/17 frequency variants in generation-layout.js authoritative.
- Keep current seven normal cycles, with an optional added first/last deload position. Default deload retains max(1, floor(0.8*N)) prefix sets, rounds rep endpoints by 0.8, adds 3 RIR on repetition metrics and preserves null metrics/rest.
- Preserve current RIR support through 6 and the current experience/prescription behavior. Old beginner reduction and RIR-4 assumptions are obsolete.
- The chosen duration bucket determines a generation budget, not a result ceiling. Diagnostics explain current allocation decisions; materialized own/common estimates remain separate from allocation cost.
- Replace the old 22-job/44-set anchor with an independently inspected current-engine fixture. Candidate counts must influence allocation/distribution at the actual owning boundary; post-output rewriting alone is insufficient.
- Keep full snapshot/revision/run identities, bounded batch/sweep, semantic comparisons, lab-only persistence, bounded atomic archives, historical viewing, cancellation, worker isolation and real packaged browser journeys.

## Acceptance matrix

All proof entries remain planned until executed independently against an identified implementation SHA.

| ID | Observable result and producer/consumer | Deliberate violation / required proof |
| --- | --- | --- |
| PL-01 | Omitted and explicit bundled-default policies preserve complete 073.4 JSON results, including order, IDs, conflicts, explanations and offers. | Capture current-main outputs before extraction across the 180-case factory plus current split, cycle and conflict boundaries; compare exact serialized bytes. Do not refresh fixtures to hide drift. |
| PL-02 | Direct compiler, actual worker and production fallback resolve identical current policies and diagnostics. | Execute default, two-set low-RIR, capped and zero-RIR variants through each path; a discarded options object must fail. |
| PL-03 | Complete policies validate, detach and freeze before queued execution. | Missing/unknown keys, versions, null/partial data, nonfinite numbers, unsafe keys, sparse arrays, cross-field RIR and post-enqueue caller mutation. Limits derive from current policy schema. |
| PL-04 | Primary preset changes realized current-engine set/RIR prescriptions while retaining default rep/rest rules where applicable. | Independently inspect current anchor roles/counts and actual ordinary-cycle targets; obsolete 44/34/10 arithmetic is not the oracle. |
| PL-05 | Beginner/current experience and deload effects follow current-engine precedence. | Compare ordinary, first/last deload and all experience fixtures; prefix retention, rep rounding, RIR 6, and absent/null metrics are explicit. |
| PL-06 | Emphasis/cap policy semantics are truthful under recovered allocation. | Compare priority/depriority cases across supported splits and budgets; independently verify strict cap and explanations, without inventing old donation actions. |
| PL-07 | Candidate rest/dose/cost policy reaches current allocation and selected-cycle estimates. | Change assumptions and inspect both realized work and allocation diagnostics; dropped policy propagation must fail. No result-ceiling time trimming. |
| PL-08 | Own/common duration metrics and allocation cost are distinguishable. | One assumptions-only case and one changed-work case; explicit rest remains prescribed on both sides; common reference snapshot is frozen. |
| PL-09 | Deterministic diagnostics observe current decisions without changing output. | Compare diagnostics on/off complete JSON; account for allocation/distribution/count changes and conflicts using stable current lineage. |
| PL-10 | Semantic diff reports actual prescriptions independently of generated IDs. | Equal policies yield zero differences; template/allocation changes do not inflate unchanged matches; duplicate lineage is rejected explicitly. |
| PL-11 | Single, batch and sweep produce identical cells for identical normalized identities. | Complete scalar allowlist and bounded planning; baseline reuse only by complete identity; main sweep metrics use common successful population. |
| PL-12 | Success, domain refusal, invalid input/policy and worker errors remain distinct. | Success-to-conflict and reverse cases, invalid policy and worker failure; failed programMetrics null; denominator excludes failures. |
| PL-13 | Cancel/timeout/stale responses preserve honest partial runs. | Real active worker termination within one second; pending checkpoint race, no subsequent scheduling or duplicate counts; fresh executor after timeout; reload marks unfinished runs interrupted. |
| PL-14 | Dirty snapshot save/reload/export/import/replay reproduces exact selected run on matching build/catalog. | Exact authoritative result-byte hashes, config-only and canceled-run archives, complete multipart round trip; imports never inherit current editor policy. |
| PL-15 | Imports and persistence faults preserve prior records atomically; historical results stay viewable. | Missing/duplicate parts/cells, corrupt hashes, inconsistent inputs/results, unknown fields, transaction/quota faults; mismatch archived with replay disabled; new build creates new record. |
| PL-16 | Actual packaged UI runs edited policy and persists the resulting snapshot. | Numeric field edit to worker to actual prescription inspector to save/reload; compare independently against compiler. No mocked generator acceptance. |
| PL-17 | Lab uses isolated data/executor/artifact and production remains compatible. | Run/cancel/reload with production sentinel storage, verify no production mutation/SW registration/telemetry; exact worker URLs and catalog pin; production cache/script order; non-four-day candidate allocation. |
| PL-18 | Shipped UI is keyboard-accessible, responsive and computationally bounded. | 200% zoom/narrow geometry, labeled errors/live progress, 180-case two-policy real-worker corpus with environment/time/failures; limits 200 cases/20 sweep values/1000 cells; measured cancel. |

## Archive limits and atomicity checklist

- Validate encoded bytes and counts before deep hashing/rendering: 50 MiB per part, 10 parts, 500 MiB total, depth 40, one run, 1000 planned cells, 200 scenarios, 20 sweep values.
- Validate the largest supported archive and actual oversize rejection; small synthetic limits alone do not establish the published maximum.
- Manifest metadata/cell hashes and assignments must match across every selected part. All declared parts exactly once, all declared cells exactly once, no split cell.
- Stage full validation off the UI thread; commit all records in one transaction after validation; import uses fresh local IDs and records source provenance.
- Complete canceled/failed run archives are not incomplete exports. Full export refusal keeps local data and explains configuration-only export.
- Historical results validate envelope/internal consistency without requiring current catalog eligibility. Names fall back to saved labels/IDs.

## Integration and delivery ownership

Integration owns final test/suites.mjs and tools/test-selection.mjs registration. Workers provide proposed entries and measured durations.
Do not edit implementation-owned modules before handoff. Preserve dirty worktrees and existing data.
Integrate coherent worker commits on one feature branch. Run focused repository gates and actual packaged browser journeys, push coherent green work, and inspect exact-head CI.
Open the implementation PR as draft; reference #426 as documentation context without closing it. No merge, production deployment, public lab exposure or credential/access changes.
No author-reported test is independent verification. Every acceptance verdict names the assertion, command, source SHA and limitations.

