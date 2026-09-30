# Post-058 open-PR clearance and pre-059 candidate sequence

**Status:** Owner-directed sequencing decision, recorded 2026-09-28, refreshed against merged Plan 058 on 2026-09-29, and amended on 2026-09-30 by the owner's unified-redesign topology decision codified in [Plan 064](../plans/064-unified-redesign-convergence.md). Plan 058 is complete; this clearance sequence is governing (PR #281 merged). The 2026-09-30 amendment replaces the former three separate redesign merges (stages 6–8) with one unified redesign workfront and allows the standalone alpha-readiness work to develop concurrently with serialized integration.

**Purpose:** Clear the current open-PR backlog with the fewest avoidable integrations while making Plan 059 validate the actual intended alpha candidate rather than an intermediate UI. This is an execution sequence for already-open work and the mandatory stabilization it exposes; it is not permission to pull unrelated Later/Gated work forward.

## Owner decisions this records

1. **Plan 058 is complete before this sequence.** PR #256 merged; every later workfront consumes that merged baseline before its own validation and merge.
2. **Plan 059 is last.** It validates one stable candidate after the owner-selected redesign and pre-alpha work is merged.
3. **The landing redesign, Direction D / Plan 063, and the onboarding redesign all land before Plan 059, as one unified production redesign PR (owner decision, 2026-09-30; [Plan 064](../plans/064-unified-redesign-convergence.md)).** PRs #276, #272 and #279 are its design/specification source branches, not three production merge destinations.
4. **PRs #255, #257, and #258 may be finished after 058 and before 059.** Their historical “post-059 rebase” language is a sequencing artifact, not a technical dependency. They still keep their own substantive evidence and product gates.
5. **Do not manufacture work only to clear a PR number.** Superseded/duplicate branches close; externally blocked work is narrowed, deferred, or explicitly allowed to remain open rather than being merged on synthetic evidence.
6. **Standalone alpha-readiness work develops in parallel and integrates one at a time (owner decision, 2026-09-30).** Advisor plans 001, 002, 023 and 024 and PR #255 are five separate branches and PRs, developed concurrently; each merges current `main` by merge commit, allocates its cache revision from the then-live `main` at merge time, and lands only with a green `ci` on its exact final head. They are not combined into one PR and none is absorbed into the redesign.

## Adversarial review of the naive sequence

The first-pass ordering was too mechanical in four places.

### 1. #268 and #269 belong early, not at the end

#268 corrects the plan index after 058. #269 is specifically designed to replace fast-decaying architecture facts in `CLAUDE.md` with pointers to live sources. Delaying them until the end would make the large Direction D/onboarding/feature agents work from stale orientation. Finish them soon after the post-058 sequencing/checker reconciliation.

### 2. Direction D must precede the onboarding production redesign

Direction D's implementation spec applies shared rules to all onboarding catalog states even though their layouts are “rules only.” Implementing the onboarding redesign first would make Direction D immediately touch the newly redesigned onboarding system. The safer ownership order is Direction D first, then the onboarding redesign against D's final shared rules.

*2026-09-30:* this dependency now holds inside one PR as slice order (shared system → Direction D surfaces → onboarding layouts), not as separate merges. See Plan 064 §9.

### 3. Landing copy should precede Direction D

#276 changes shipped recommendation/i18n copy in addition to the marketing artifact. Direction D renders and explains those recommendation outcomes. Landing therefore belongs before D so D consumes the final copy once instead of requiring a copy-driven recapture/review later.

*2026-09-30:* same resolution: the copy slice (R2b) commits before the Direction D surfaces consume the keys, inside the unified PR.

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
| 4 | **Standalone alpha-readiness work: advisor plans 001, 002, 023, 024** | Develop concurrently on four branches; integrate one at a time with a merge-time cache revision and exact-head green `ci` (Plan 064 §11.1) | Alpha safety items 2–3, approved measurement producers and browser-persistence mitigation land before the redesign branch is cut so it absorbs them once. Plan 002 starts from a characterization of the live `sw.js`, which already guards `response.ok`; plan 023's producers attach at the DraftV2 commit, Why-open, skip and review boundaries so the redesign keeps them by construction. |
| 5 | **#255 — Unsupported workout-grammar measurement** | Develop concurrently with stage 4; merge current main, rewrite its shell hunk for the release-asset `ASSETS` structure, replace old post-059 gate, final privacy proof on the exact head, merge | Small, mature, evidence-generating change. Land before the redesign branch is cut so it absorbs it once. This does not authorize executable grammar expansion. |
| 6 | **Unified redesign — Plan 064 (sources: #276 landing, #272 Direction D / Plan 063, #279 onboarding)** | Cut one branch from the post-stage-5 `main`; one draft production PR; slices R0–R7 under an Opus orchestrator with Sonnet workers; owner gates for the onboarding direction, PT terminology (#274), the landing final page and the Direction D polish proposals; close #276/#272/#279 as superseded once their content is migrated; stop at OWNER REVIEW | Replaces the former stages 6–8. None of the three source PRs is a production implementation; one PR gives one vocabulary, one token set, one catalog baseline and one controlled cache-revision lineage (interim bumps per precached behaviour change, one final R6 reconciliation) instead of three branches allocating revisions against one another. Direction D keeps Plan 063 as the main-app specification; Plan 064 is the umbrella authority. |
| 7 | **#258 — Historical migration foundation — Hevy, Strong, generic CSV** | Resolve real-provider evidence, renumber its branch-local plan (Plan 063 stays Direction D's), integrate the merged unified-redesign History contract, finish and merge | Canonical Next priority remains switching friction first. If provider evidence is still unavailable, do not invent it; owner must narrow/defer rather than block forever on synthetic fixtures. |
| 8 | **#257 — Free one-off sessions** | Integrate the merged unified-redesign Today/Workout/History, settle DraftV2/transfer/consumer semantics, finish and merge | Avoid implementing one-off consumers against screens the redesign is about to replace. Keep program-aware Pro planning gated. |
| 9 | **Final convergence** | Re-run open-PR inventory, canonical docs, cache/query contract, catalog and candidate selection | No stale “post-059”, “058 → D → 059” or three-separate-redesign-merge claims; no obsolete open workfront accidentally treated as a dependency. |
| 10 | **Plan 059** | Execute on one immutable final candidate SHA | Final physical-device/accessibility/privacy/offline/catalog/release evidence. Any source fix changes the SHA and invalidates affected evidence. |

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
- **#276:** draft at `336b492d` on 2026-09-29 and unchanged at the
  2026-09-30 amendment; rounds 1–5 and the final page remain
  review/implementation work, including production recommendation/i18n copy.
  Main has no landing redesign from this branch. *2026-09-30:* its production
  diff is three `rec.*.text` rewrites and a stale v302 bump; the final page is
  a standalone document. It is a source branch for Plan 064 slice R2.
- **#272:** draft; `964f827e` was its head at the 2026-09-29 refresh
  (historical), and `2f2fc044` is its current head at the 2026-09-30
  amendment. Direction D owns Plan 063. Its 143-screen
  inventory and old `058 → D → 059` shorthand must be refreshed from the live
  148-screen baseline and this expanded sequence. Shared rules still cover
  onboarding; their dependency is unchanged. *2026-09-30:* at `2f2fc044` the
  branch is specification plus a review-page prototype; only slice P2 is
  implemented. Its governing documents migrate to the Plan 064 branch in R0
  and its P-slices become R3.
- **#279:** advanced during the 2026-09-29 clearance to `0b2e9dbf` (initially `de26b2f7`; both historical); its current head at the 2026-09-30 amendment is `1acee97a`. The branch's Round 3 manifest records G
  synthesis and closed PD-1–PD-4 decisions; its Round 4 brief records the owner's
  subsequent request for bolder exploration. The PR body/final report still
  stopping at Round 2 are stale. No production winner or blanket reopening of
  product decisions is inferred here. Reconcile the latest owner selection,
  remaining declarations, and production acceptance after merged D; judging
  may continue in parallel as design preparation. *2026-09-30:* at `1acee97a`
  the branch holds polished Round 3 candidate G, Round 4 directions H–L and a
  branch-local Q622–Q637 owner record with no direction selected. Q636's
  "shipped as its own PR" clause is superseded by the unified topology; the
  direction is owner gate OG-1 in Plan 064.

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

1. stabilization and mature small PRs, developed concurrently and merged one at a time;
2. the unified redesign (landing, Direction D and onboarding in one PR, Plan 064);
3. post-redesign product features (#258, then #257);
4. Plan 059 validation.

Do not repeatedly merge a large redesign branch forward merely to accommodate a small fix that was already known and could have landed first. The redesign branch is cut only after stage 4–5 work is merged or explicitly deferred by the owner; while it is open, no other cache-bumping branch is merge-active.

## What may run in parallel after 058

Parallel work is useful only when it does not create competing merge assumptions:

- concurrent development of advisor plans 001, 002, 023, 024 and #255 on separate branches (owner decision 6);
- #258 provider-format evidence acquisition;
- owner review of the onboarding direction (Plan 064 gate OG-1) while the redesign's shared system, landing and Direction D slices proceed;
- inside the redesign PR, Sonnet workers on disjoint surface regions under the orchestrator's hotspot rules (Plan 064 §10.3);
- read-only characterization and adversarial review;
- preparation of narrow #280 reproductions.

Cache-bumping production PRs remain serialized at merge time.

## Plan 059 entry gate

Plan 059 must not start merely because every old PR number is closed. Start it only when:

- the owner-selected pre-059 candidate work above is merged or explicitly deferred/narrowed;
- the unified redesign PR (Plan 064: landing, Direction D and onboarding) is merged, or its explicitly owner-approved split has merged in full;
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
