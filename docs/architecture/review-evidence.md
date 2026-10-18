# Architecture specification: review and validation

Scope: documentation only. Base `147e4afa07fea3243efd42b5b7d167c196c6a7ca`. The proposed application tree, contracts, tooling and twenty migration slices in [the specification](agent-first-spec.md) are not implemented.

## Source and integration evidence

- Fresh main fetched from GitHub; old saved checkout `c1d64320` excluded from final measurements. Used a separate documentation checkout/branch. Measurements came from actual source, not September's architecture audit.
- Inspected root/test/tools guidance, current generator 073.4 status/parity specification, ADR 0021/Plan 074, product thesis, transfer ADR, public script/SW/deployment inventories and representative command/read/write paths.
- Read pinned upstream codebase-design SKILL, DEEPENING and DESIGN-IT-TWICE directly through GitHub; exact URLs/revision and adoption/departures are in section 9. No third-party scripts installed or executed.
- Concurrent metadata/patches and selected Lab/test-redesign source read at the heads recorded in section 1. #434 was resolved as an issue with implementation #437. Check runs independently read: #432/#445 successful `ci`; #435/#437 failed at observed heads; #446 advanced during review from `5a501e0a` to `9448989d`; compared both new commits and all three changed files (telemetry test and ledger/docs only). Its new exact-head ordinary `ci` is successful, new paired benchmark pending; the previous benchmark had failed `report`. These remain moving inputs. Main and all other feature heads were unchanged at final reconciliation.

## Independent review

Two read-only reviewers inspected fresh main and the complete draft: architecture/discoverability and migration/data safety. Both confirmed no remaining substantive blockers after corrections. Their review covers specification adequacy, not future runtime correctness.

| Finding | Correction / closing evidence |
| --- | --- |
| A1: release gate would regress first visit/no-SW/registration failure | Section 7 distinguishes exact network startup without a controller from incompatible controlling-worker startup. Offline readiness requires successful installation. Slice 2 includes no-SW and first-install proofs. |
| A2: deferred ESM could load after immediately executing classic host | Section 5 specifies one awaited bridge gate and exactly-once classic startup; old immediate start path is removed, prepaint stays synchronous. |
| A3: production migration implicitly blocked on Lab merge | Slice 18 has a concrete owner patch/proof-map disposition if #432 remains unmerged; production completion does not promise or require its merge. |
| A4: relative catalog/worker/CSS paths lacked a concrete layout rule | Section 3 mirrors the full source/assets layout in each release, gives exact catalog and sibling worker URL examples and rewrites only root HTML references. |
| M1: intermediate ESM slices preceded release safety | Slice 2 now implements the graph/cache/start-gate protocol for the first real migrated leaf; all later slices ship through it. Slice 19 removes the last classic root. |
| M2: pre-protocol worker can overwrite its cached old shell | Section 7 explicitly allows read-only offline update recovery after new HTML has replaced the predecessor shell, requires old-tabs-closed/reopen liveness, and imports no writer graph before the controlling-worker gate. |
| M3: authoring/compiler and command/session dependencies omitted | Slice 5 depends on 4; slice 9 depends on 8. Dependency backbone and parallelism amended; exact count remains 20. |
| M4: blanket ban contradicted current missing-ID legacy backfill | Risk register and slice 6 preserve existing characterized name/day/performed-identity guards and add ambiguous-name negatives; only new inference is forbidden. |

Early source-review corrections also incorporated current v4-only setup support, full metric/profile/replay responsibilities, matching historical shells, lock-held validation, distinct export durability policy and irreversible verified transfer commit. Final small wording aligns release failure stopping at slice 2/first affected slice and the uncontrolled-startup exception. Section 8 maps actual retained risk suites to migration slices; these are planned implementation evidence, not reported passes.

## Documentation validation

- `node tools/run-tests.mjs --check`: passed; base inventory 208 commands, every test script classified. This checks inventory consistency, not application behavior.
- `git diff --check`: passed for the documentation diff.
- Migration table parsed: exactly 20 consecutive slices, effort sum 47–86 focused person-days.
- Local `classifyChange` proof: all three changed Markdown files are prose-only under current `tools/ci-plan.mjs`; executable jobs should skip. Relative documentation links resolve.
- Final-head `ci`: inspect the source-specific check on [draft PR #447](https://github.com/pedrochagasmaster/repforge/pull/447/checks). Final check/run identity is recorded in the PR description after the final push, avoiding a self-referential evidence-only commit that invalidates its own head claim. Expected plan and aggregate run, executable jobs skip. No application/runtime correctness or #446 benchmark result is claimed from this documentation check.

No app source, generated assets, saved schema, CI configuration, deployment, service, credentials or network infrastructure changed. No merge or deployment is part of this work.
