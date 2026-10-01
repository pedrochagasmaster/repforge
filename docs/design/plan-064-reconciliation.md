# Plan 064 reconciliation record

The working record for [Plan 064](../../plans/064-unified-redesign-convergence.md)
slice R0. It pins the sources the unified redesign consumes, re-derives the
surface treatment table from the live manifest, and holds the onboarding
reconciliation board, the terminology inventory and the contract-review record
for Direction D's new content jobs. Plan 064 remains the execution contract;
this file records evidence and engineering resolutions, never owner decisions.
An owner decision is recorded only as a link to the owner's reply on the
workfront PR or a linked issue.

## Workfront base

| Fact | Value at branch cut (2026-10-01) |
|---|---|
| Base `main` | `c1d643206d1c472b34d3f0c0e4b7cb425f571329` (merge of #255; the five §11.1 standalone workfronts are merged: #294 advisor 001, #291 advisor 002, #292 advisor 024, #293 advisor 023, #255) |
| Shell | `sw.js` `CACHE = "repforge-v349"`; `index.html` `app.js?v=317`, `durable-state.js?v=309`, `progress-model.js?v=308`, `history-ui.js?v=308`, every other protected script `?v=307`; `test/exercise-library.mjs` `expectedCacheRevision = "349"` |
| Catalog | 148 screens, 915 frames (`docs/ui-screens/manifest.json`) |
| Open PRs | #257, #258, #272, #276, #279, #282 |

Plan 064 §2 (`cb629036`, `repforge-v345`) is the planning snapshot; the row
above supersedes it for this branch. Facts are re-pinned at every slice
boundary in the workfront PR body.

## Source provenance

Prototype code, candidate rounds and tournament captures never enter `main`.
Their branches stay unmerged and undeleted; this table is how to find them.

| Source | PR | Branch | Pinned SHA | Consumed by | What is consumed |
|---|---|---|---|---|---|
| Direction D | #272 | `redesign/direction-d` | `2f2fc044` | R0 (documents), R3, OG-6 | ADR 0016, Plan 063, `docs/design/direction-d-implementation-spec.md`, `docs/design/direction-d-strings.md`, `DIRECTION-D-SPEC.md` by file copy; the review page stays the OG-6 drawing surface on the branch |
| Landing | #276 | `claude/landing-candidate-s-round-3-9tmm42` | `336b492d` | R2 | `docs/design/landing-candidates/final/` structure and copy; the three `rec.*.text` rewrites and their baseline fixture (I-05) |
| Onboarding tournament | #279 | `ccr-15c50ac8-pki40i` | `1acee97a` | R0 (register section, OG-1 board), R4 | Q622–Q637 register section; the selected direction's brief after OG-1 |

Each head was re-fetched at the branch cut and matched its pin; no delta was
consumed.

## Surface treatment table

Pending (R0 packet: treatment table). Re-derived from the live manifest per
Plan 064 §7.1 and reconcilable row C-06.

## Contract review for Direction D content jobs

Pending (R0 packet: contract review). Resolves C-01 for the shelf, inline
rest, prescription row, frequency counts and any landing surface pair, on the
semantic contract's existing roles where one exists.

## Terminology inventory (input to OG-2)

Pending (R0 packet: terminology inventory).

## Onboarding reconciliation board (input to OG-1)

Pending (R0 packet: OG-1 board), built from existing sources only per Plan 064
§7.2.

## Reconcilable rows

Pending. Each of C-01 to C-09 is resolved here with its evidence or assigned to
the slice that resolves it.
