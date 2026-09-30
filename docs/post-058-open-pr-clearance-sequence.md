# Post-058 open-PR clearance and pre-059 candidate sequence

**Status:** Owner-directed sequencing decision, recorded 2026-09-28 and refreshed against merged Plan 058 on 2026-09-29. Plan 058 is complete; this clearance sequence becomes governing when PR #281 merges. This first stage establishes ordering only.

**Purpose:** Clear the current open-PR backlog with the fewest avoidable integrations while making Plan 059 validate the actual intended alpha candidate rather than an intermediate UI. This is an execution sequence for already-open work and the mandatory stabilization it exposes; it is not permission to pull unrelated Later/Gated work forward.

## Owner decisions this records

1. **Plan 058 is complete before this sequence.** PR #256 merged; every later workfront consumes that merged baseline before its own validation and merge.
2. **Plan 059 is last.** It validates one stable candidate after the owner-selected redesign and pre-alpha work is merged.
3. **Direction D / Plan 063, the landing redesign, and the onboarding redesign all land before Plan 059.**
4. **PRs #255, #257, and #258 may be finished after 058 and before 059.** Their historical “post-059 rebase” language is a sequencing artifact, not a technical dependency. They still keep their own substantive evidence and product gates.
5. **Do not manufacture work only to clear a PR number.** Superseded/duplicate branches close; externally blocked work is narrowed, deferred, or explicitly allowed to remain open rather than being merged on synthetic evidence.

## Adversarial review of the naive sequence

The first-pass ordering was too mechanical in four places.

### 1. #268 and #269 belong early, not at the end

#268 corrects the plan index after 058. #269 is specifically designed to replace fast-decaying architecture facts in `CLAUDE.md` with pointers to live sources. Delaying them until the end would make the large Direction D/onboarding/feature agents work from stale orientation. Finish them soon after the post-058 sequencing/checker reconciliation.

### 2. Direction D must precede the onboarding production redesign

Direction D's implementation spec applies shared rules to all onboarding catalog states even though their layouts are “rules only.” Implementing the onboarding redesign first would make Direction D immediately touch the newly redesigned onboarding system. The safer ownership order is Direction D first, then the onboarding redesign against D's final shared rules.

### 3. Landing copy should precede Direction D

#276 changes shipped recommendation/i18n copy in addition to the marketing artifact. Direction D renders and explains those recommendation outcomes. Landing therefore belongs before D so D consumes the final copy once instead of requiring a copy-driven recapture/review later.

### 4. #258 has a real external gate and a plan-number collision

#258's Hevy/Strong fixtures are synthetic and current provider schemas are not yet evidenced. No ordering trick closes that gate. Evidence acquisition should start as soon as 058 lands, but durable History implementation should wait for Direction D's History contract. The branch-local `Plan 063` name must also be renumbered/reconciled because Direction D owns Plan 063 by owner decision.

## Optimized sequence

The order below is the default merge order. “Parallel preparation” means read-only research, evidence acquisition, or design work that does not create a competing merge-active cache/shell branch.

| Stage | PR/work | Action | Why this position |
| ---: | --- | --- | --- |
| 0 | **#256 — Plan 058** | Complete; merged at `568bdac0` | Sole priority and dependency root. All later branches must consume the merged semantic/catalog baseline. |
| 1 | **#270** | Close as complete overlap | Existing install-transfer contract test already protects the intended invariant; duplicate assertions add signal debt. |
| 1 | **#254** | Close as superseded by #276 | #276 already carries/continues rounds 1–2. Do not merge duplicate design-history branches. |
| 1 | **#179** | Close/defer; recreate later if still wanted | Ancient cache/application baseline and huge corpus diff make rehabilitation riskier than a current-main implementation. Preserve the product idea, not the stale branch. |
| 2 | **#281 — this sequencing PR** | Merge the post-058 main baseline without rewriting history, pass exact-SHA candidate checks, merge | Makes the changed pre-059 boundary explicit before other agents act on it; supersedes the old checker semantics in #273. |
| 2 | **#273** | Close as superseded once this PR carries the replacement guard | Its useful checker work is retained, but its “Next only after launch validation” rule is no longer the owner decision. |
| 3 | **#280** | Revalidate findings on post-058 main, update statuses, merge | The audit is valuable, but its baseline predates final 058. Do not create fixes for findings that 058 already closed. |
| 3 | **#268** | Merge current main without rewriting published history, refresh and merge | Reconcile Plans 055–058 and the active post-058 workfront from live GitHub state. |
| 3 | **#269** | Merge current main without rewriting published history, refresh and merge | Give subsequent agents accurate live-source architecture/cache guidance before large implementation branches resume. |
| 4 | **#271** | Merge post-058 main without rewriting history, revalidate the fix and regression, redo live cache ritual and exact-SHA candidate, merge | Mature P1 data-safety fix with historical green evidence; its divergent shell/cache lineage and changed-baseline review/proof must clear before readiness can be claimed. |
| 4 | **Still-live #280 blocker fixes** | Narrow PRs only | Fix A01–A05/N01–N02 only where still reachable. Do not build throwaway UI that Direction D explicitly retires; closure-by-supersession must be evidenced in the owning redesign. |
| 4 | **Remaining canonical Now stabilization** | Finish before large redesign merge train where practical | Alpha safety items 2–3, approved measurement producers, browser-persistence mitigation, and remaining CI-generation drift should not be left to invalidate the final candidate after the redesigns. |
| 5 | **#255 — Unsupported workout-grammar measurement** | Merge current main, replace old post-059 gate, final privacy/candidate proof, merge | Small, mature, evidence-generating change. Land before the large UI branches so they absorb it once. This does not authorize executable grammar expansion. |
| 6 | **#276 — landing redesign** | Merge current main, reconcile copy/cache/catalog, finish and merge | Final recommendation/i18n copy should be present before Direction D implements/captures the same concepts. |
| 7 | **#272 — Direction D / Plan 063** | Merge post-058 main, update its now-stale “058 → D → 059” wording, execute P0–P12, merge | Major main-app visual/interaction workfront; it should consume the stabilized runtime and final landing copy. It owns Plan 063. |
| 8 | **#279 — onboarding redesign** | Refresh tournament baseline from merged D, reconcile later exploration and owner choices, implement the selected production direction, merge | D applies shared rules to onboarding; onboarding owns its layouts after those rules settle. The current tournament is design evidence, not a selected production winner. |
| 9 | **#258 — Historical migration foundation — Hevy, Strong, generic CSV** | Resolve real-provider evidence, renumber its branch-local plan, integrate merged D History, finish and merge | Canonical Next priority remains switching friction first. If provider evidence is still unavailable, do not invent it; owner must narrow/defer rather than block forever on synthetic fixtures. |
| 10 | **#257 — Free one-off sessions** | Integrate merged D Today/Workout/History, settle DraftV2/transfer/consumer semantics, finish and merge | Avoid implementing one-off consumers against screens that D is about to replace. Keep program-aware Pro planning gated. |
| 11 | **Final convergence** | Re-run open-PR inventory, canonical docs, cache/query contract, catalog and candidate selection | No stale “post-059” or “058 → D → 059” claims; no obsolete open workfront accidentally treated as a dependency. |
| 12 | **Plan 059** | Execute on one immutable final candidate SHA | Final physical-device/accessibility/privacy/offline/catalog/release evidence. Any source fix changes the SHA and invalidates affected evidence. |

## Post-058 evidence snapshot and ownership

Verified on 2026-09-29 against starting `origin/main`
`568bdac09f651ee74208c32f6a8e45a73c69d958`: PR #256's final head
`c681a0bfab93d3be9e9a1ea33af1f7038a8b2d70` is an ancestor; its merge commit
is that starting main SHA. The live shell is `repforge-v340`; later workfronts
must read the then-current shell and protected query inventory rather than
copy this snapshot's revision. Plan 058's final typography, semantic/catalog,
release-contract and selector changes are now the integration baseline; old
branch-local capture counts, CSS assumptions and green CI are historical.

The complete initial open inventory was #179, #254, #255, #257, #258, #268,
#269, #270, #271, #272, #273, #276, #279, #280 and #281. No additional PR was
open at this refresh. #270, #254 and #179 were closed after their stage-1
checks; #273 closes only after #281 is merged. Re-fetch the inventory at each
merge boundary; a new PR is not automatically a pre-059 dependency.

- **#270:** current client/contract suite passes 9/9 and already checks actual
  endpoint requests and the shared claim-response byte limit. No duplicate test
  is needed.
- **#254:** its full head is an ancestor of #276 and every changed file is
  retained byte-for-byte there. No unique production delta is lost.
- **#179:** deferred stale corpus expansion, not rejection of the capability.
  Its v113 shell and pre-overhaul app/matcher lineage are not rehabilitated here.
  Existing migration/alias backlog scope stays intact; closure adds no new
  scheduling authorization.
- **#280:** still open at `45702f4f`, reporting source `29fc1c36`. Its findings
  have not been refreshed after final 058. Typography/catalog changes may affect
  A05; neither that finding nor any other is declared closed here. Reproduce
  every A/N finding against current main in stage 3.
- **#268/#269:** still kickoff-only branches. The plan index still claims Plan
  054 is active and 057/058 are planned; #268 owns that reconciliation, including
  Plan 058's historical draft-gate status line. Those historical status claims
  do not override this current sequence. `plans/README.md` is untouched here.
  #269 owns live-source orientation; no cleanup is absorbed here.
- **#271:** implemented fix and old-head candidate proof remain on the branch;
  v302 is obsolete. Current-main integration, review and fresh candidate proof
  are required, not just allocation of a cache number.
- **#255/#257/#258:** unchanged draft heads and unresolved substantive gates.
  Their old post-059 wording must be corrected by their owners under this
  exception; it is not an authority to exclude them from the final candidate.
  #257's original red entry result remains red, and its production/transfer/
  consumer gates stay open. #258's real-provider evidence and branch-local Plan
  063 collision remain unresolved.
- **#276:** still draft at `336b492d`; rounds 1–5 and the final page remain
  review/implementation work, including production recommendation/i18n copy.
  Main has no landing redesign from this branch. Land it before Direction D.
- **#272:** still draft at `964f827e`; Direction D owns Plan 063. Its 143-screen
  inventory and old `058 → D → 059` shorthand must be refreshed from the live
  148-screen baseline and this expanded sequence. Shared rules still cover
  onboarding; their dependency is unchanged.
- **#279:** advanced during this clearance to `0b2e9dbf` (initially `de26b2f7`). The branch's Round 3 manifest records G
  synthesis and closed PD-1–PD-4 decisions; its Round 4 brief records the owner's
  subsequent request for bolder exploration. The PR body/final report still
  stopping at Round 2 are stale. No production winner or blanket reopening of
  product decisions is inferred here. Reconcile the latest owner selection,
  remaining declarations, and production acceptance after merged D; judging
  may continue in parallel as design preparation.

This document records evidence and ordering. It does not implement #280, #268,
#269, #271, #255, #276, #272, #279, #258 or #257, nor certify their readiness.
Published branches integrate main by merge, never by rebase/amend/force-push.

## Conditional branch for #258

Provider-format evidence is an external gate that integrating main or coding cannot satisfy. Owner design choices and the existing device/acceptance gates also remain independent requirements.

With 058 merged, pursue sanitized clean-account Hevy and Strong exports or authoritative current schema documentation in parallel with the post-058 cleanup. Once Direction D merges:

- **If evidence exists:** finish #258 before #257, preserving the canonical switching-friction-first product priority.
- **If evidence does not exist:** do not weaken the parser contract or call synthetic fixtures production support. The owner must choose one explicit disposition before Plan 059: narrow the PR to a truthfully supported scope, defer/close it while keeping the backlog item, or provide the missing evidence. An unresolved external provider gate must not silently turn into a fake pass.

## #280 remediation rule

The audit should generate evidence, not churn. After #256 merges, reproduce every A/N finding against the merged source before scheduling a fix.

- A still-reproducible data integrity, correctness, focus, or evidence-quality defect is fixed before the large redesign train when practical.
- A finding on UI that Direction D explicitly retires may close in #272 only if the replacement removes the defective path and the owning regression/evidence proves it.
- A finding that remains reachable through D/onboarding must not be waved away as “redesigned.”

## Merge/cache discipline

Only one cache/shell-changing branch is merge-active at a time. Every branch with an old `repforge-vN` or protected query revision must derive its final revision from live `main` immediately before merge; historical PR numbers are evidence only.

Large branches should absorb small runtime changes once:

1. stabilization and mature small PRs;
2. landing copy;
3. Direction D;
4. onboarding;
5. post-D product features;
6. Plan 059 validation.

Do not repeatedly merge a large redesign branch forward merely to accommodate a small fix that was already known and could have landed first.

## What may run in parallel after 058

Parallel work is useful only when it does not create competing merge assumptions:

- #258 provider-format evidence acquisition;
- owner design review/judging for #279 while #272 implements, provided production implementation waits for D's merged shared rules;
- read-only characterization and adversarial review;
- preparation of narrow #280 reproductions.

Cache-bumping production PRs remain serialized at merge time.

## Plan 059 entry gate

Plan 059 must not start merely because every old PR number is closed. Start it only when:

- the owner-selected pre-059 candidate work above is merged or explicitly deferred/narrowed;
- Direction D and onboarding production redesigns are merged;
- the landing copy/site work selected for alpha is merged;
- all live P1/P2 findings that affect the candidate have an explicit disposition and evidence;
- canonical backlog, plan index, architecture orientation and PR bodies no longer claim obsolete ordering;
- the complete candidate passes the repository's pre-059 automated/candidate gates;
- one exact candidate SHA can be frozen for device/accessibility/release evidence.

## Non-goals

This sequence does **not** authorize:

- executable workout-grammar expansion from #255 measurements;
- persistent multi-gym identity;
- Pro program-aware one-off planning;
- additional historical-import vendors without observed demand;
- native rewrite, payment, entitlement, or managed-AI work;
- weakening any provider, privacy, durability, accessibility, owner, or same-SHA gate to make the queue clear faster.

The objective is fewer repeated integrations and one truthful release candidate, not a cosmetically empty Pull Requests page.
