# Architecture migration integration ledger

Owner-authorized implementation of [specification #447](https://github.com/pedrochagasmaster/repforge/pull/447). One integration owner, one branch (`refactor/agent-first-integration`), one draft integration PR. Worker branches are local staging only; all reviewed output integrates here. No merge/deployment/network/credential changes authorized.

Implementation base: `147e4afa07fea3243efd42b5b7d167c196c6a7ca`. Specification imported from `46c1996901841868ba133e860cc5662b053effa6` without merging #447 to main. Runtime is unchanged at initialization. A checkbox closes only with its objective evidence and review recorded below.

## Implementation checklist

- [ ] 1. Baseline and reconciliation contract
- [ ] 2. ESM/checkJs and release protocol
- [ ] 3. Pure values/model/log/progression extraction
- [ ] 4. Generator/catalog/executor ESM
- [ ] 5. Authoring/entry/edit/replay pure seams
- [ ] 6. Pure snapshot policy
- [ ] 7. Durable instance and preferences ownership
- [ ] 8. App session/workout commands
- [ ] 9. Program/custom/history command policy
- [ ] 10. Interchange and transfer local orchestration
- [ ] 11. Browser capabilities and shell lifecycles
- [ ] 12. Today/workout/summary presentation
- [ ] 13. Focus/shelf/rest/Why presentation
- [ ] 14. History and Progress presentation
- [ ] 15. Entry/landing/Build/import/recommendation UI
- [ ] 16. Installed program/library/custom UI
- [ ] 17. Settings/profile/privacy/install/guides UI
- [ ] 18. Lab consumer/package reconciliation
- [ ] 19. Coordinated composition/ESM release cutover
- [ ] 20. Remove temporary architecture and prove agent navigation

## Moving inputs at implementation intake

All remain open drafts, none assumed merged:

| Owner | Exact head | Integration disposition |
| --- | --- | --- |
| Program Lab #432 | `ce0b4403341ee9dbdd34dc6994a1244172189fb8` | Shared engine contract compatibility required; Lab stays separate. Integration decision and parity evidence pending. |
| Test redesign #446 | `9448989d52e144c32c5b036f43b9071dd4648eba` | Ordinary CI 39134455385 passed. Paired benchmark 39134455479 pending at last owner report. Adoption decision pending current run inspection; existing production risks remain required. |
| Focused-name Back #445 | `39581e85ca9850c9dd2baf28742a9215b3063227` | Preserve exact owned guard and production proof, reconcile before editor cutover. |
| Guides #435 | `7c0c438c8f654c7bb12c25db0e9b95c3932c0bbc` | Preserve native dialog/held tap/replay/focus/placement; owner's draft remains independent. |
| Editor #437 / issue #434 / Plan 074 | `1b3de1b8ea8bdfb7bd8d4c85736b9fefa5f149e8` | Preserve candidate A and canonical all-days renumbering; reconcile duplication with #446 exactly once. |

## Evidence

Initialization only. No implementation slice, runtime parity, final architecture, data migration or full CI completion is claimed yet. Required acceptance and rollback contract: [specification sections 6–8](agent-first-spec.md).
