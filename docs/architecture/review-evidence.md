# Architecture specification: review and validation

Scope: documentation only. Base `147e4afa07fea3243efd42b5b7d167c196c6a7ca`. The proposed application tree, contracts, tooling and twenty migration slices in [the specification](agent-first-spec.md) are not implemented.

## Source and integration evidence

- Fresh main fetched from GitHub; old saved checkout `c1d64320` excluded from final measurements. Used a separate documentation checkout/branch. Measurements came from actual source, not September's architecture audit.
- Inspected root/test/tools guidance, current generator 073.4 status/parity specification, ADR 0021/Plan 074, product thesis, transfer ADR, public script/SW/deployment inventories and representative command/read/write paths.
- Read pinned upstream codebase-design SKILL, DEEPENING and DESIGN-IT-TWICE directly through GitHub; exact URLs/revision and adoption/departures are in section 9. No third-party scripts installed or executed.
- Concurrent metadata/patches and selected Lab/test-redesign source read at the heads recorded in section 1. #434 was resolved as an issue with implementation #437. Check runs independently read: #432/#445 successful `ci`; #435/#437 failed at observed heads; #446 ordinary `ci` successful with separate benchmark `report` failed. These remain moving inputs.

## Independent review

Architecture/discoverability and migration/data-safety reviewers inspected the current source independently and are reviewing the complete draft. Final findings and dispositions will be recorded here before handoff. Early corrections already incorporated include current setup v4-only support, full source metric/profile/replay responsibilities, matching historical shells, explicit lock-held policy, truthful settlement, transfer irreversibility and SW cache retention.

## Documentation validation

- `node tools/run-tests.mjs --check`: passed; base inventory 208 commands, every test script classified. This checks inventory consistency, not application behavior.
- `git diff --check`: passed for the documentation diff.
- Migration table parsed: exactly 20 consecutive slices, effort sum 47–86 focused person-days.
- Final-head `ci`: pending draft PR creation. Under current `tools/ci-plan.mjs`, these two ordinary Markdown files are prose-only; expected plan and aggregate run, executable jobs skip. No application/runtime correctness or #446 benchmark result is claimed from this documentation check.

No app source, generated assets, saved schema, CI configuration, deployment, service, credentials or network infrastructure changed. No merge or deployment is part of this work.
