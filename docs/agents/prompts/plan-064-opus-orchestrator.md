# Plan 064 orchestrator handoff

This is the starting brief for the Opus session that orchestrates the
unified redesign workfront. It does not authorize merging anything. It
assumes the owner has approved
[`plans/064-unified-redesign-convergence.md`](../../../plans/064-unified-redesign-convergence.md);
if that approval is not recorded on the planning PR, stop and ask.

## Where to start

1. Read, in this order: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`,
   `docs/agents/implementation-evidence.md`, `docs/ci.md`,
   `plans/064-unified-redesign-convergence.md` (all of it),
   `docs/post-058-open-pr-clearance-sequence.md`,
   `docs/design/ui-system-semantic-contract.md`,
   `docs/ui-overhaul-disposition-register.md`,
   `docs/ui-overhaul-plans-049-057-audit.md` (N01/N02),
   `docs/program-entry-flow.md`, ADRs 0005–0007, 0009, 0012–0014, and the
   brand guide.
2. Fetch and pin live facts before any work: `origin/main` SHA, the open-PR
   inventory, the live `CACHE` in `sw.js`, every protected `?v=` in
   `index.html`, `expectedCacheRevision` in `test/exercise-library.mjs`,
   the catalog counts from `docs/ui-screens/manifest.json`, CI state on
   `main`. Record them in the PR body. Plan 064 §2 is a planning snapshot,
   not current truth.
3. Verify the precondition in Plan 064 §11.1: advisor plans 001, 002, 023,
   024 and PR #255 are merged, or the owner has explicitly deferred a
   specific one behind the redesign. If neither holds for any of them, do not
   cut the branch; report which are outstanding and stop.
4. Read the source branches read-only at their pinned SHAs (Plan 064 §1):
   `redesign/direction-d` for ADR 0016, Plan 063, the implementation spec,
   the strings appendix, `DIRECTION-D-SPEC.md`, the polish audit and the
   open polish comment on #272; `claude/landing-candidate-s-round-3-9tmm42`
   for `docs/design/landing-candidates/final/`; `ccr-15c50ac8-pki40i` for
   the Round 3 G records, the Round 4 briefs and the Q622–Q637 register
   section. If any head moved since the pinned SHA, diff the delta and
   record what changed before consuming it.

## Branch and PR

- Create `redesign/unified-convergence` from the verified post-standalone
  `main` SHA. Open one draft PR immediately with the acceptance-contract
  section from `docs/agents/implementation-evidence.md`, a slice status
  table (R0–R7), an owner-gate table (OG-1–OG-8) and "Next exact steps".
- Comment on #272, #276 and #279 linking the workfront PR. Do not close
  them yet; close #276 after R2, #279 after R4 and #272 after R3 (its review
  page is the OG-6 drawing surface until then), with the closing comment
  Plan 064 §11.2 describes. Never merge their histories. Never delete their
  branches.
- Push after every focused-green slice commit. Read CI on every head. Never
  rebase, amend or force-push the published branch. Merge `main` explicitly
  at slice boundaries only.

## Slice sequence

R0 authority and reconciliation → R1 shared system → R2 landing and copy
(R2b copy first) → R3 Direction D (R3a gate first; then up to four workers
on disjoint regions) ∥ R4 onboarding (only after OG-1) → R5 journeys → R6
convergence, full catalog and the final cache-revision reconciliation → R7
adversarial review → OWNER REVIEW.

Plan 064 §9 has each slice's objective, owned files, consumed contracts,
unchanged behaviour with its proving suites, prerequisites, parallelism,
hotspots, RED proof, owners, catalog evidence, STOP conditions, completion
evidence and commit boundary. Do not paraphrase those rows into packets;
quote them.

## Owner gates

Ask OG-1 (onboarding direction), OG-2 (PT terminology, issue #274), OG-3
(landing final page), OG-4 (Direction D polish proposals) and OG-5
(`program_readiness_navigated` deletion) in one batch comment at the end of
R0, with the board and inventories Plan 064 §6 lists. Build the OG-1 board
from existing sources only: the tournament's candidate renders beside
Direction D's owner-approved Today and Focus drawings from the review page
at the pinned #272 SHA, both normalized to Plan 058's roles and the Plan 064
§8 rules. No R1 or R3 screen exists at that point; do not wait for one and
do not present one. OG-6 (P1 drawings) runs in four rounds during R3. OG-7 (changed-frame boards) is per slice.
OG-8 (whole-product phone read) is requested after R7.

An approval is an owner reply on the workfront PR or a linked issue. A
"recommended" label in a round README, a PR body, a prototype, silence, or
this document is not an approval. While OG-1 is open, R2, R3 and the app
half of R5 continue; R4 waits. If R2, R3 and R5's app journeys are green and
OG-1 is still open, report it and wait (Plan 064 §3.1 contingency needs an
explicit owner instruction to split).

## Delegation constraints

- You are the only writer of: `sw.js`, `index.html` script tags and shell
  IDs, `test/exercise-library.mjs` revisions (a precached behaviour change
  bumps the revision in its own commit; R6 reconciles the whole lineage), `telemetry.js`, `i18n.js`,
  PNGs, `tools/ui-role-inventory.json` outside R1/R6 rows, `docs/backlog.md`,
  `plans/README.md`, the clearance sequence, and `app.js` boot, routing and
  persistence regions.
- Each Sonnet packet contains, verbatim, the fields in Plan 064 §10.2. Name
  the files a worker may edit and the files it must not touch. Name the RED
  proof and the owners to run. Name the STOP conditions. Require the handoff
  format.
- One writer per hotspot at a time (Plan 064 §10.3). Workers use separate
  worktrees from the integrated head. You integrate serially, regenerate
  `i18n.js`, recapture affected flows, commit frames, push.
- Review every packet against the decision ledger (Plan 064 §5) before
  integrating: reject a second commit path, a target computed in the
  presentation layer, a new token, role, tier, radius or palette value, a
  key outside the packet's namespace, a DraftV2 or transfer envelope change,
  a copy change that alters a promise, or any file outside the packet's
  ownership.
- Workers never decide product questions. A worker that needs one stops
  and reports; you route it to the owner or to the ledger.

## Verification

Per Plan 064 §12: RED proof or characterization first; exact owning suite or
`node tools/run-tests.mjs edit`; commit focused-green; push promptly; CI on
the head; independent review in parallel; `packet --base <slice-start>` only
when it completes usefully and never as merge evidence; `--evidence` on a
clean commit for contract rows. Do not use `candidate` as routine evidence,
do not retry a red run, do not restore expected-SHA mechanics.

## Exact STOP conditions

Plan 064 §13, S-1 through S-11. In particular: a locked row (§5.1) would
change; an owner gate is needed; a second commit path or envelope change
appears; a contract addition outside the review; a rendered-role AA or
never-rendered-selector failure on the head; two writers on a hotspot;
`main` moved with a cache bump; #257, #258, Plan 059 evidence or Later/Gated
work is being pulled in; a frame changed with no owner; OG-1 unresolved
after R2/R3/R5; a physical-device or launch-acceptance claim is about to be
written. Stop the affected packet, continue independent packets, report.

## Completion

Plan 064 §14. The PR stops at OWNER REVIEW. Only an explicit owner
instruction merges it. After merge, the remaining candidate sequence is
Plan 064 §15 and the clearance sequence; Plan 059 owns everything that
touches a physical device, a launch freeze or a candidate SHA.
