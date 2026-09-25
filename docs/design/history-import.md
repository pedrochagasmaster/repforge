# History import evidence and mapping

## Authority and current evidence

[Advisor Plan 027](../../advisor-plans/027-competitor-history-import-spike.md) is the specification spike required by the [canonical backlog](../backlog.md). [Plan 063](../../plans/063-history-migration-foundation.md) is a draft implementation plan derived from it. The spike is not complete, and no owner decision in the repository authorizes this feature to merge before the post-Plan-059 queue activates.

Checked 2026-09-25: [Hevy's export guide](https://help.hevyapp.com/hc/en-us/articles/43708290987415-Exporting-Your-Data-from-Hevy) and [Strong's export guide](https://help.strongapp.io/article/235-export-workout-data) confirm CSV export. Neither supplies a current complete header and representative rows. This worktree has no clean test-account exports. The two committed provider fixtures are **synthetic parser examples**, not authoritative current exports. The Advisor 027 STOP condition applies separately to Hevy and Strong. Their current-format support remains **BLOCKED — source evidence**. Do not relabel the fixtures as current exports. Record an export date and app version with any future test-account export, sanitize it, then compare exact headers and representative rows before changing parser claims.

The draft parser currently rejects unknown columns. That exact reviewed allowlist is its present code behavior. The final provider policy, either exact schema versions or required fields plus explicitly safe ignored extensions, remains pending real export evidence. Do not silently ignore new columns.

## Proposed source mapping

These rules describe the draft pipeline. They are not a claim that either provider currently exports the listed columns.

| Source fact | Normalized candidate | Proposed Taurifer row |
|---|---|---|
| Source workout ID, or timestamp and title, or date and title | Source-scoped session key | Stable `session` ID; re-import compares fingerprint under the same key |
| Source date and timestamp | Calendar date and optional instant | `date`, `created`; ambiguous slash date requires DMY or MDY choice |
| Workout title | Session title | `day`, shown as the source label, never used as program identity |
| Exercise label and source exercise ID | Name plus source-scoped movement ID | `name`, `performedName`, and matched `performedLibraryId` only after exact, alias, or explicit review |
| Set order | Source set index and row order | `set`; indexed sets canonicalize order, unindexed order remains meaningful |
| Weight and explicit source unit | Unrounded canonical kilograms | `load`; missing unit blocks review, no device-setting guess |
| Repetitions | Valid nonnegative count | `reps` |
| RPE or RIR | RIR when RPE is 6 through 10, else unknown | `rir`; RPE below 6 maps to `null` |
| Warm-up and set type | Source set type | `warmup`; reps-based drop sets remain work |
| Exercise and session notes | Bounded source text | `exNote`, `notes`; no invented text |
| Source metadata and partial result | Immutable provenance | `historyImport` with source, keys, fingerprints, identity, and `sessionStatus` |
| No source equivalent | None | `primary`, `secondary`, and block/program identity remain unset unless a reviewed canonical match supplies safe performed attribution |

Duration-only and distance-only rows do not become strength sets. Strong rest-timer rows are reported and skipped. A session with rejected source rows carries `sessionStatus: "partial"` on each included row. It remains truthful athlete History, but it cannot become progression evidence.

## Identity, review, and scope

`history-import.js` accepts a matcher callback. Browser integration calls the shipped Plan 061 matcher. A probable match remains a review candidate; machine-specific labels stay source-scoped unless the lifter makes an explicit link. The new `Bench Press (Barbell)` alias maps to the existing flat barbell bench ID `pr_bb`. [Hevy's exercise page](https://www.hevyapp.com/exercises/how-to-bench-press-barbell/) independently names that movement and distinguishes incline and close-grip variants. This supports the alias meaning, not the current CSV header claim. Existing library IDs must not be repointed.

The eventual entry belongs under Settings → Data beside backup import. The lifter reviews source warnings, unresolved identities, duplicate candidates, and partial sessions before any durable action. A matched complete session may inform the first recommendation; unmatched or partial work remains visible without earning program progression. The parser and immutable proposal are plausible, but a production review UI, transaction adapter, current provider fixtures, and match-rate measurement on the Advisor 027 corpus are still missing. Build effort remains to be scheduled after the spike.

## Acceptance contract

The repository's [implementation evidence protocol](../agents/implementation-evidence.md) governs these rows. `node test/history-import-unit.mjs` and `node test/history-import-fingerprint.mjs` test the draft parser and proposal. The provider fixture gates cannot close until real export evidence exists.

| Boundary | Producer → representation → consumer → observable result | Deliberate failure and status |
|---|---|---|
| Raw export → parsed records | `parseSourceText` reads bounded CSV into source-tagged records. | Unsupported schema, unknown or ambiguous headers, bad quoting, and limits reject the file. **Foundation tested; provider format BLOCKED.** |
| Parsed records → normalized candidates | `normalizeSourceRecords` creates dated, unit-normalized sets and source session fingerprints. | Ambiguous date or unit blocks review; hash unavailability returns `hash-unavailable`. **Foundation tested.** |
| Candidates → identity reconciliation | `reconcileCandidates` calls the injected Plan 061 matcher and records exact, alias, probable, or unresolved identity. | Probable and unresolved identities cannot auto-link. **Foundation tested; provider corpus pending.** |
| Reconciled candidates → immutable proposal | `buildImportProposal` checks source conflicts, same-source retry, changed source, cross-source semantic duplicates, malformed partial sessions, and explicit choices. | Each conflict returns a review blocker; cancellation leaves no storage write. **Foundation tested.** |
| Proposal → durable transaction | Future adapter must revalidate the lock-held durable head and append once through `commitProposedState`. | Retry, stale head, or transaction failure must never report success or lose the proposal. **PENDING — durable integration.** |
| Durable rows → History and progression | Future validators, backup, and selectors must preserve `historyImport`; all performed rows appear in History and partial rows do not feed progression. | Unresolved performed identity cannot match a current program by name; legacy rows without provenance need a compatibility rule. **PENDING — durable integration.** |

## Durable integration hard gates

Before a proposal can be committed, prove all of these on the post-Plan-059 baseline: the durable row validator preserves `historyImport`; JSON backup, export, import, and restore round-trip it; duplicate detection repeats against the lock-held head; `sessionStatus: "partial"` is excluded from progression while its performed work stays in History; unresolved identity cannot join a current program through name fallback; legacy rows lacking provenance retain an explicit compatibility behavior; retries and transaction failures are recoverable without duplicate writes. These are **PENDING — durable integration**, not acceptance evidence for PR #258.

## Future rebase note

Plan 058 #256 may collide with this branch in `test/suites.mjs`, `tools/test-selection.mjs`, `test/ci.mjs`, exercise catalogue generation, `exercises.js`, and History presentation tests. Resolve only after Plan 059 establishes the actual baseline. Do not use this branch to change Plan 058 or the release candidate.
