# Post-058 open-PR clearance and pre-059 candidate sequence

**Status:** Owner-directed sequencing decision, recorded 2026-09-28. This document becomes governing when merged. Until then, Plan 058 / PR #256 remains the only merge-active workfront.

**Purpose:** Clear the current open-PR backlog with the fewest avoidable rebases while making Plan 059 validate the actual intended alpha candidate rather than an intermediate UI. This is an execution sequence for already-open work and the mandatory stabilization it exposes; it is not permission to pull unrelated Later/Gated work forward.

## Owner decisions this records

1. **Finish Plan 058 first.** No other open PR is implementation- or merge-active until #256 lands.
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
| 0 | **#256 — Plan 058** | Finish, owner review, merge | Sole priority and dependency root. All later branches must consume the merged semantic/catalog baseline. |
| 1 | **#270** | Close as complete overlap | Existing install-transfer contract test already protects the intended invariant; duplicate assertions add signal debt. |
| 1 | **#254** | Close as superseded by #276 | #276 already carries/continues rounds 1–2. Do not merge duplicate design-history branches. |
| 1 | **#179** | Close/defer; recreate later if still wanted | Ancient cache/application baseline and huge corpus diff make rehabilitation riskier than a current-main implementation. Preserve the product idea, not the stale branch. |
| 2 | **This sequencing PR** | Rebase on merged #256, pass canonical checks, merge | Makes the changed pre-059 boundary explicit before other agents act on it; supersedes the old checker semantics in #273. |
| 2 | **#273** | Close as superseded once this PR carries the replacement guard | Its useful checker work is retained, but its “Next only after launch validation” rule is no longer the owner decision. |
| 3 | **#280** | Revalidate findings on post-058 main, update statuses, merge | The audit is valuable, but its baseline predates final 058. Do not create fixes for findings that 058 already closed. |
| 3 | **#268** | Refresh and merge | Reconcile Plans 055–058 and the active post-058 workfront from live GitHub state. |
| 3 | **#269** | Refresh and merge | Give subsequent agents accurate live-source architecture/cache guidance before large implementation branches resume. |
| 4 | **#271** | Rebase onto post-058 main, redo live cache ritual, merge | Mature P1 data-safety fix. Its only merge blocker is the obsolete divergent shell/cache lineage. |
| 4 | **Still-live #280 blocker fixes** | Narrow PRs only | Fix A01–A05/N01–N02 only where still reachable. Do not build throwaway UI that Direction D explicitly retires; closure-by-supersession must be evidenced in the owning redesign. |
| 4 | **Remaining canonical Now stabilization** | Finish before large redesign merge train where practical | Alpha safety items 2–3, approved measurement producers, browser-persistence mitigation, and remaining CI-generation drift should not be left to invalidate the final candidate after the redesigns. |
| 5 | **#255 — unsupported grammar measurement** | Rebase, replace old post-059 gate, final privacy/candidate proof, merge | Small, mature, evidence-generating change. Land before the large UI branches so they absorb it once. This does not authorize executable grammar expansion. |
| 6 | **#276 — landing redesign** | Rebase, reconcile copy/cache/catalog, finish and merge | Final recommendation/i18n copy should be present before Direction D implements/captures the same concepts. |
| 7 | **#272 — Direction D / Plan 063** | Merge post-058 main, update its now-stale “058 → D → 059” wording, execute P0–P12, merge | Major main-app visual/interaction workfront; it should consume the stabilized runtime and final landing copy. It owns Plan 063. |
| 8 | **#279 — onboarding redesign** | Refresh tournament baseline from merged D, finish judging/synthesis, implement production winner, merge | D applies shared rules to onboarding; onboarding should be the final owner of its layouts after those rules settle. |
| 9 | **#258 — historical migration** | Resolve real-provider evidence, renumber its branch-local plan, rebase on D History, finish and merge | Canonical Next priority remains switching friction first. If provider evidence is still unavailable, do not invent it; owner must narrow/defer rather than block forever on synthetic fixtures. |
| 10 | **#257 — free one-offs** | Rebase on D Today/Workout/History, settle DraftV2/transfer/consumer semantics, finish and merge | Avoid implementing one-off consumers against screens that D is about to replace. Keep program-aware Pro planning gated. |
| 11 | **Final convergence** | Re-run open-PR inventory, canonical docs, cache/query contract, catalog and candidate selection | No stale “post-059” or “058 → D → 059” claims; no obsolete open workfront accidentally treated as a dependency. |
| 12 | **Plan 059** | Execute on one immutable final candidate SHA | Final physical-device/accessibility/privacy/offline/catalog/release evidence. Any source fix changes the SHA and invalidates affected evidence. |

## Conditional branch for #258

Provider-format evidence is the only current open-PR dependency that cannot be solved by rebasing or coding.

After 058 merges, immediately pursue sanitized clean-account Hevy and Strong exports or authoritative current schema documentation in parallel with the post-058 cleanup. Once Direction D merges:

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

The objective is fewer rebases and one truthful release candidate, not a cosmetically empty Pull Requests page.
