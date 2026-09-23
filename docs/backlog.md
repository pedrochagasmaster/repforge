# Taurifer canonical backlog

**Status:** Living source of truth, reconciled through Q602 and the August 2026
deferred-work review.

**Active initiative:** the owner-approved UI overhaul (Plans 049–059) precedes
the noncommercial alpha for polish purposes (G-04). It is specified by
[`docs/ui-audit.md`](ui-audit.md), mapped by
[`docs/ui-overhaul-implementation-sequence.md`](ui-overhaul-implementation-sequence.md),
and contracted per decision and finding in
[`docs/ui-overhaul-disposition-register.md`](ui-overhaul-disposition-register.md).
Unrelated roadmap items below stay deferred; none may be pulled into an
overhaul PR to "complete" a surface.

**Governing product sources:**
[`business-product-thesis.md`](business-product-thesis.md),
[`ADR 0010`](adr/0010-product-business-thesis-and-validation-sequencing.md),
[`ADR 0011`](adr/0011-managed-taurifer-ai.md), and the
[`decision register`](product-grilling-decision-register.md).

This is the repository's only backlog. Plans and specifications explain how a
bounded piece of work should be built; they do not create a second queue. When
a plan finishes, its status belongs in [`plans/README.md`](../plans/README.md).
When a new product idea is accepted, add it here or explicitly reject it.

## Status language

- **Now:** required before the rolling noncommercial alpha or already in the
  active release-readiness path.
- **Next:** approved work that follows the current foundation.
- **Gated:** approved, but starting it before its stated evidence/dependency
  would create avoidable waste.
- **Later:** valid work with no current sequencing claim.
- **Evidence only:** not scheduled; reopen only after observed user or technical
  evidence makes the problem material.
- **Completed / superseded / rejected:** not backlog.

Priority is read top to bottom inside a status. The solo founder handles work
as it arrives; these labels describe dependency and product importance, not
separate teams or synchronized delivery dates.

---

## 1. Now — make the deterministic alpha credible

| Work | Required outcome | Governing detail |
|---|---|---|
| Deliver the owner-approved UI overhaul | Execute Plans 049–059 in DAG order with owner gates honored: reconciled contracts, verified defect fixes, DraftV2/transition/transfer foundations, landing/entry, Focus-only workout, truthful Progress, converged management surfaces, system migration, and same-SHA launch validation. No governing current-tense document contradicts G-01–G-88. | [Plan 049](../plans/049-ui-overhaul-canonical-reconciliation.md), [sequence](ui-overhaul-implementation-sequence.md), [dispositions](ui-overhaul-disposition-register.md) |
| Finish launch-readiness evidence | Complete the remaining real-device iOS/VoiceOver and Android/TalkBack cells, with the exact release-candidate build and evidence required by Plan 041. The implementation itself landed in PR #114. | [Plan 041](../plans/041-prelaunch-all-findings-remediation.md) |

> The remaining PR #239 architecture findings are not a second queue. They are absorbed into Plans 054–059 as explicit implementation/acceptance deltas: entry/lifecycle ownership in 054/057; workout-session and gesture ownership in 055; historical projections in 056; release/cache, presentation and obsolete-path convergence in 058; and final architecture/evidence closure in 059.

The measurement foundation, shared progression engine, program families, and
entry/onboarding flow (Plans 045–048) are implemented; their rows moved to
Completed below. Do not re-add them as Now work.

The rolling alpha starts organically, one participant at a time, after these
foundations are credible. There is no synchronized cohort, special research
onboarding, individual program audit, payment, fake door, or stable entitlement
promise.


## 2. Next — post-overhaul adoption and real-life execution validation

This queue activates only after the owner-approved UI-overhaul and launch-
validation boundary in §1 clears. Nothing here may leak into Plans 049–059.
The ordering is deliberate: remove switching friction first, then validate how
often real-life constraints break an otherwise good program before paying the
complexity cost of broader execution models.

| Order | Work | User problem / business risk | Smallest observable success condition | Depends on | Scheduling effect |
|---:|---|---|---|---|---|
| 1 | Historical migration foundation — Hevy, Strong, generic CSV | An experienced lifter can prefer Taurifer's progression model and still refuse to switch because years of training history are stranded elsewhere. Program import does not solve that switching cost. | Import real Hevy, Strong, and generic CSV histories through a previewable pipeline with source provenance, identity reconciliation, explicit unresolved rows, partial-failure reporting, and no silent merging of non-comparable movements. Imported sessions remain truthful History records. Use the shipped Plan 061 matcher and pull the systematic alias pass into this work only where the migration corpus proves vocabulary gaps. | Plan 061 import matching; History performed-identity contract; a dedicated history-import plan that settles source schemas, duplicate handling, units, dates, eligibility, and rollback before code. | Replaces the Later `Strong/Sheets CSV import` item. A Sheets export is handled as generic CSV; additional vendor formats remain Later until demand is observed. |
| 2 | Free one-off sessions | Real training weeks contain travel, limited time, crowded gyms, friend sessions, and extra sessions. Requiring every workout to be a program day makes Taurifer brittle exactly where a gym logger must be useful. | Ship the ratified Free one-off semantics: manual, classic, muscle-focus, and user-directed planned-session adaptation with time/equipment constraints, deterministic review, and honest History/program/progression eligibility. Completing a pure one-off must not complete/reorder/edit the program, inflate block adherence, or advance automatic program progression. | The existing one-off specification; post-overhaul Today/Workout/History contracts; existing draft and durable-state guarantees. | Moves the existing deferred Free one-off work to Next. Pro program-aware one-off planning remains Gated and cannot be sold before it works. |
| 3 | Ephemeral equipment-context validation through one-offs | Equipment availability changes by gym, travel, crowding, and session. Building persistent multi-gym identity before proving this is common would front-load one of Taurifer's most complex history-comparability problems. | The one-off/adaptation flow can express exact available equipment, deterministic compatible substitutions, and `Minimize equipment changes` without creating a named persistent gym. Collect only approved privacy-safe categorical evidence needed to learn whether users repeatedly switch contexts or hit substitution friction. | Free one-off sessions; canonical equipment vocabulary; substitution identity semantics; telemetry allowlist approval for any new event. | Full persistent equipment contexts/sibling program instances stay Later until this experiment shows repeated need. |
| 4 | Unsupported workout-grammar measurement | Imported programs contain concepts Taurifer does not execute today. Blindly adding supersets, rest prescriptions, tempo, cardio, or additional set kinds risks turning the product into a generic logger without evidence that those constructs block adoption. | Record privacy-safe categorical counts for unsupported concepts surfaced by the free-form import path — initially `supersets`, `rest_times`, `rir_rpe`, `tempo`, `warmups`, `cardio`, `progression_rules`, and `deload` — without storing source text. The resulting distribution must be sufficient to rank which, if any, executable-model extension deserves a plan. | Shipped free-form import; telemetry/privacy review; the existing unsupported-concept sidecar or an equivalent reviewed categorical contract. | Replaces the vague Later `Free-form import: measure and widen` item. Measurement moves Next; executable grammar expansion remains Evidence only. |

Historical migration should not become an importer arms race. After the initial
three source shapes work, add another vendor only from observed switching demand.
Likewise, the one-off equipment experiment is intentionally not a shortcut to
persistent multi-gym: the latter still needs explicit history-comparability and
machine-identity semantics.

## 3. Gated — working Pro and paid beta

Payment is blocked until all three Pro jobs and the full commerce lifecycle work.

| Work | Required outcome | Gate |
|---|---|---|
| Advanced first-program generation | Specialize one of Taurifer's supported families around priorities and constraints, explain trade-offs, and compile a normal executable program. | Shared engine, families, time/volume allocation specification. |
| History-aware next program | Use complete or partial history and the exit review to recommend resume, repair, rebase, or switch; select and personalize a supported family with visible confidence. | Lifecycle/history semantics and real transition data. |
| Bounded within-program adaptation | Detect recurring skips, stalls, overrides, overruns, and schedule mismatch; ask why; propose the smallest cause-matched versioned change; require approval and evaluate the result. | Intervention catalogue and versioned program changes. |
| Program-aware one-off planning | Recommend the best use of a disrupted session from the active program, recent work, time, and equipment, while leaving the program unchanged and allowing override. | Free one-off semantics working first. Approved Pro extension, not a purchase promise until shipped. |
| Multi-gym Pro intelligence | Recommend/contextualize sibling mappings and program changes across equipment contexts without merging incomparable machines. | Core equipment-context identity working first. Approved Pro extension, not a purchase promise until shipped. |
| Capability and entitlement system | Capability-based checks; twelve-month annual/monthly terms; expiry, restoration, cancellation, refunds, purchase reconciliation, and lapse behavior with no clawback. | Working Pro capabilities. |
| Paid commercial beta | Offer R$24.90/month and R$179.90/year; report purchase, attempt, complementary research access, and product use separately. | Complete Pro MVP and commerce lifecycle. |

## 4. Gated — after paid-beta economics

| Work | Required outcome | Trigger |
|---|---|---|
| Managed Taurifer AI | Managed, adult, PT-BR-first contextual proposals and explanations under ADR 0011: evaluated providers, zero retention, EU service data, consented/redacted research, memory controls, allowances, support controls, numeric release gates, and emergency shutdown. | Deterministic paid beta proves credible economics. |
| Full cross-program dashboards | Useful comparison across program versions/blocks without turning raw history into decorative analytics. | Enough multi-program history and renewal evidence. |
| Multi-block planning and long-horizon analysis | Plan and evaluate several blocks while preserving bounded user-approved decisions. | Cross-program evidence and demonstrated demand. |
| Optional synchronization | Additive sync that never makes core training or record ownership depend on the server. | Retained users demonstrate a real multi-device/durability problem. |
| Native shell | Wrap, not rewrite: native persistence, billing, lifecycle, notifications, and links around the tested web core. | Retention/monetization or measured PWA limitations justify it. |
| Creator conveniences and broader acquisition | Publisher dashboards, larger creator pilots, paid acquisition, and other scalable distribution work. | Retention and monetization work first. |

## 5. Product and UX debt

These are real but do not outrank the foundation above.

| Status | Item | Decision needed / done condition |
|---|---|---|
| Completed | Import exercise matching | Implemented by [Plan 061](../plans/061-import-exercise-matching.md) in PR #230: stopword/equipment/containment scoring, up to three ranked candidates per review row, fixture-gated aliases, and identity-preserving regressions for historical movement IDs. |
| Later | Pound display and actionable increments | Design one end-to-end lb contract for stored historical values, editable targets, load steps, `minJump`, entry parsing, and “Why this weight?” copy. Never falsify history to make a target look loadable. |
| Later | Truthful early workout finish | Let the user finish with incomplete planned work while preserving completed sets and explicitly classifying omitted work; do not pretend the whole prescription was completed. |
| Later | PT-BR bundled/default day labels | Localize Taurifer-authored day labels or deliberately model them as user-owned data with authored PT-BR defaults. Do not mix English `Day N` into a Portuguese first-run program by accident. |
| Later | Swapped-workout headings | Keep the immutable performed/program title separate from a temporary swap annotation; do not rewrite durable history labels to explain a one-session substitution. |
| Later | Remaining native confirmations | Move destructive/discard confirmations into the shared accessible dialog policy without changing their transaction semantics. |
| Later | ~~Focus/List preference~~ → Superseded | Superseded by G-22: Focus is the sole workout-logging experience. No List preference persists. |
| Later | “View exercises” contract | Owned by the overhaul (G-44, UI-25; Plans 055/057): Today's secondary action becomes a real read-only preview. Do not rename it as a stopgap. |
| Later | Progress drill-down and table affordance | Owned by the overhaul (G-34–G-36, UI-08; Plan 056): summary rows with drill-in detail; full tables only as secondary or export views. |
| Later | Volume-signal explanation | Owned by the overhaul (G-30–G-31, G-35; Plan 056): weekly status separated from actionable evidence with neutral baselines. |
| Later | Full factory reset | If added, explicitly distinguish clearing logs, deleting all local Taurifer data, and resetting the installation identifier. Preserve export warnings. |
| Later | One-tap `+1 rep` | Test whether it materially improves active-set speed without creating accidental commits. |
| Later | Client-side encrypted export | Use a separately reviewed Web Crypto/passphrase design with recovery and failure behavior. Bad crypto is worse than none. |
| Later | Additional historical migration sources | After the Next Hevy/Strong/generic-CSV foundation is in real use, add another vendor format only when switching research or failed-import evidence shows material demand. Preserve the same provenance, identity-reconciliation, preview, duplicate, unit/date, and partial-failure guarantees; do not chase format count as a feature metric. |
| Later | Publisher attribution (deferred) | Unrelated to the overhaul: versioned publisher name, handle, description, and referral id with safe creator-specific acquisition events. Attribution is provenance, never engine input. Reopen only before creator pilots with a new scheduling decision. |
| Later | Equipment contexts and sibling program instances (deferred) | Persistent two- or three-gym contexts, curated sibling mappings, comparable free-weight history, separate non-comparable machine histories, and explicit crowded-gym substitutions. Do not schedule from competitive parity alone: first use the Next one-off equipment experiment to establish repeated context switching/substitution demand, then require a new scheduling decision for persistent identity. |
| Later | Cause-routed interventions (deferred) | Unrelated to the overhaul: per-issue evidence, diagnosis question, permitted change, cooldown/ignore behavior, and reassessment window. Reopen with a new scheduling decision. |
| Later | General lifecycle/friction observability (deferred) | Only the Phase 049-approved telemetry allowlist is scheduled (see Completed: Plans 045–048 are done; the overhaul row governs). Persisting general transition/skip/override/friction/reason catalogues beyond that needs a new product decision. Submitted free text stays on the separate consented research path, never PostHog. |
| Later | Program lifecycle and next-program transition (deferred) | Broader than the audit-bounded transition work owned by Plans 052/056: archiving, starting another program of any authorship, and honest partial-history interpretation as general lifecycle. Reopen with a new scheduling decision once the overhaul lifecycle is in place. |
| Later | Existing-user shared-program handoff (deferred) | A reviewed, non-destructive replacement/transition flow for setup links, preserving ADR 0007's released payload contracts. Reopen before a participant receives a later creator program, with a new scheduling decision. |
| Later | Generative/model-based journey expansion (deferred) | Exercise onboarding, generation, strategies, long histories, skips, stalls, overrides, interruptions, abandonment, transitions, and version migrations as a general program. Overhaul plans specify their own required test evidence; broader expansion needs a new scheduling decision. Keep seeds and minimize failures. |
| Later | Pilot-data protection (deferred) | Persistent storage where supported, prominent backup/export, honest prototype-durability disclosure, offline-first training. Reopen with a new scheduling decision; do not turn it into premature cloud sync. |
| Later | Bodyweight and relative-strength trends | Add only when enough users log bodyweight and the view answers a real question; never turn bodyweight-normalized strength into a universal training score. |
| Evidence only | Larger chart ranges/global period | Reopen 12/26/52-week selection or one global Progress period only if users cannot answer real questions with the current scoped controls. |
| Evidence only | Landscape-specific layout | Keep responsive correctness; build a dedicated landscape treatment only after real use shows value. |
| Evidence only | History virtualization beyond current gate | Current linear index is tested at 5,000 sessions/20,000 rows. Add pagination/virtualization only when measured devices cross a performance budget. |
| Evidence only | Web Push and extra reminder types | Reopen a server sidecar, backup/block-end reminders, or explicit schedule UI only when installed-PWA/local notifications fail a demonstrated retention or safety need. Pilot backup prominence is deferred with pilot-data protection above. Unrelated to the one-hour install-transfer exception ([ADR 0013](adr/0013-temporary-install-transfer.md)), which is not a notification or reminder path. |
| Evidence only | Hosted short/opaque setup links | The released self-contained setup formats remain canonical. Add an opaque-token service only when measured URL length, revocation, attribution, or handoff needs justify server dependency. The approved install-transfer token ([ADR 0013](adr/0013-temporary-install-transfer.md)) is a separate one-hour claim object, not a setup-link format. |
| Evidence only | Per-exercise units or plate calculator | First solve the end-to-end lb/load-step contract. Add equipment-specific loading tools only from observed logging friction. |
| Evidence only | Executable workout-grammar expansion | Add a currently unsupported construct only when the Next categorical measurement plus direct user evidence shows it blocks meaningful program adoption or execution. Candidate concepts include supersets, explicit rest prescriptions, tempo, additional set kinds, timed/cardio work, or imported progression/deload rules. Extend the executable/history/progression model deliberately per construct; do not accept richer import JSON that the engine cannot truthfully execute. |
| Evidence only | ~~Opener fallback/backdrop dismissal/coach marks~~ → Superseded in part | Superseded in part by G-40: the global tour is removed in favor of action-linked contextual cues (Plans 054–057 own the registry and anchors). Reopen per cue only with a reproduced accessibility or comprehension problem. |
| Evidence only | ~~Broad Focus/Program/Block redesign~~ → Superseded | Superseded by the owner-approved overhaul (G-02–G-04): whole-product polish, not partial cleanup. File specific observed problems against the overhaul contracts instead. |
| Completed | Free-form program import | "I already have a program" almost never meant a Taurifer file. The import route now has a paste door: the lifter's free-form program is wrapped in a reviewed prompt and handed to their own ChatGPT or Claude through a link they tap, and the reply comes back through the existing import review. No key, account, backend or LLM dependency, and no front-running of ADR 0011. See [ADR 0014](adr/0014-free-form-program-import-handoff.md). |
| Completed | No bundled program before onboarding | Backing out of setup used to leave a bundled three-day program presented as the lifter's own. A device that has not been through onboarding now holds no program, and Today and Program say so and offer the entry hub. |
| Completed | Catalog the two no-program screens | `today/no-program` and `program/no-program` now use the empty-entry fixture and have localized light/dark reference frames generated with the pinned browser. |

## 6. Engineering debt

> The former draft-result-contract and persistence-extraction debt items were promoted by owner decision into the post-Plan053 architecture bridge in the Now sequence. They are no longer independent Later work.

### Post-overhaul modularity rule

Modularity is a standing implementation constraint, **not** a new standalone
refactor programme. Plans 055–059 already own the remaining accepted
architecture-audit work: workout-session ownership, gesture lifetime, entry and
management workflow ownership, earned historical projections/vocabulary reuse,
release/source coverage, obsolete-facade removal, and final proof that there is
one authority per responsibility. Finish those dispositions through the normal
overhaul sequence before inventing a second architecture queue.

After Plan 059, preserve the architecture review's target: a statically deployed
application composed from a **small number of deep JavaScript modules with
outcome-oriented interfaces**. `app.js` should increasingly act as the
application host/composition layer — boot, wiring, routing of user intent, and
render coordination — rather than becoming the default home for new domain
algorithms or lifecycle protocols.

Apply a strangler rule to post-overhaul work:

1. New substantial domain behavior starts behind an owned module/interface when
   it has a real boundary; do not first grow a large implementation inside
   `app.js` with a promise to extract it later.
2. Historical migration must keep source parsing/normalization, provenance,
   reconciliation, duplicate/unit/date policy, and import outcomes behind an
   importer boundary that reuses the existing identity matcher rather than
   scattering vendor conditionals through the application host.
3. One-off planning must keep deterministic time/equipment/focus planning and
   program-versus-one-off eligibility semantics outside the renderer/host; the
   accepted session result is consumed by the existing workout-session owner
   rather than creating a second workout store or lifecycle.
4. Future persistent equipment-context intelligence, if evidence earns it,
   receives its own domain ownership and must not become a collection of
   cross-cutting `app.js` conditionals.
5. Existing code moves only when extraction materially reduces coupling,
   establishes one authority, makes scheduled work safer, or earns reuse from
   real consumers. Moving helpers into more files without hiding implementation
   details is not progress.
6. When a new owner replaces an old path, migrate callers and delete the old
   implementation/facade once its compatibility duty is finished. Do not leave
   dual authorities.
7. Do not introduce a framework rewrite, repository/service-container layer,
   event bus, global dependency-injection system, package-manager migration, or
   one-file-per-helper architecture merely to make the tree look conventional.

Success is measured by **ownership and caller knowledge, not `app.js` line
count**. A smaller host with callers that still understand draft receipts,
replica settlement, recovery timing, transition internals, or another module's
lifecycle is not a successful refactor. The governing rationale and accepted
owner map remain
[the architecture refactoring plan](taurifer-architecture-refactoring-plan.md).

| Status | Item | Boundary |
|---|---|---|
| Next | Systematic exercise alias pass | Supporting slice of the Next historical-migration work, not an isolated vocabulary project. Extend `tools/exercise-curation.json` with gym vernacular, acronyms and morphological variants in EN/PT from the migration/import corpus, prioritizing observed names over speculative synonym enumeration. Plan 061's fixture-gated identity rules remain authoritative: aliases add ways to reach an entry and never repoint a `libraryId` at a different movement. |
| Later | Centralize browser-test helpers | Unify app boot, lock fixtures, state seeding, and common browser assertions without hiding test intent. |
| Completed | History identity/search contract | Current History matching uses performed library/movement identity for aliases and preserves immutable performed labels; focused tests hold the rule. |
| Completed | Fast-check foundation | The framework exists. The remaining work is expanding domain/state-machine coverage listed under deferred generative expansion, not choosing another property-testing library. |

## 7. Completed, superseded, or rejected

Do not re-add these as backlog without new owner evidence.

### Completed or absorbed

- The post-Plan053 durable-state architecture bridge is implemented in PR
  #240 and merged at `3710f34bb677c59674a3677c03d2fc1427e07cef`.
  `durable-state.js` owns the normalized outcome, settlement, recovery, WAL,
  replica, and DraftV2 transaction-sidecar contracts. Plan 054 is the active
  overhaul implementation.

- Plans 045–048 are implemented (measurement foundation, shared progression
  engine, program families/compiler, program entry/onboarding). Their former
  Now rows above are closed; follow-up work belongs to the overhaul or a new
  scheduling decision, not to these plans.

- Plans 001–028, 030–037, 039, 042, and 043 are implemented. Plan 024's mesocycle
  lifecycle/build work also shipped; its old draft banner was documentation
  drift, not unfinished product work.
- The pre-launch findings in Plan 041 shipped in PR #114. Only the physical-
  device evidence cells remain.
- The mic emoji was replaced by the current icon system.
- The short “essentials” idea is covered by the shipped trim behavior and the
  approved time-constrained one-off design; it is not a separate readiness
  generator.
- Progression-rule explanation is covered by the shipped “Why this weight?”
  surface and the maintained mechanics documents; there is no separate
  “export rules document” task.
- Import merge, warm-up flags, PR ledger, mesocycle fields/lifecycle,
  substitutions, notifications, and setup links all shipped; their old plan
  “backlog” notes describe pre-implementation context.
- The old feature tracker described a much earlier application and is removed.
  Executable tests and current specs are the source of behavioral truth.

### Superseded

- BYOK/browser-direct AI, provider keys, Ollama/custom endpoints, ADR 0002, and
  Plan 038 are superseded by managed Taurifer AI under ADR 0011.
- Copied/named classic program templates and program-specific progression
  engines are superseded by Taurifer-owned families plus the shared engine.
- Plan 029's old four-phase roadmap and the old Wave/backlog narrative in the
  plan index are superseded by this backlog and the Q602 strategy.
- Fake doors, annual-only/three-price experiments, manual timeless Pro codes,
  special research onboarding, individual participant program audits, and a
  synchronized cohort are superseded by the rolling-alpha/working-Pro sequence.
- A separate missed-day/rigid-calendar overhaul is not currently authorized;
  current program order, Choose another day, one-offs, and transition behavior
  own the real cases. Reopen only from user evidence.
- Coach snapshots/log sharing, a two-athlete buddy optimizer, reusable one-off
  templates, and automatic progression credit for pure one-offs are not
  authorized follow-ups. They require a new product decision rather than an
  old specification's “deferred” label.
- Changing recover/stall windows, fatigue thresholds, or adding set-collapse
  heuristics is model-tuning work only after real evidence; it is not standing
  feature scope.
- The pre-overhaul alpha-before-polish ordering is superseded by G-04: broader
  visual and structural overhaul work moves ahead of the noncommercial alpha,
  with the measurement, engine, family, and entry foundations continuing in
  parallel.

### Rejected

- Powerlifting/meet preparation in the initial product.
- Social feed, leaderboards, streaks, badges, XP, and PR-sharing community.
- Full coach CRM/SaaS, billing/scheduling/nutrition/messaging for trainers.
- Wearable/HRV/readiness dashboards or injury diagnosis.
- Form-check video empire, a launch marketplace, a sixth navigation tab, or a
  default white-label product.
- Mandatory accounts/cloud storage for Free/core training.

---

## 8. Maintenance rule

Every new backlog entry must state:

1. the user problem or business risk;
2. the smallest observable success condition;
3. what it depends on;
4. whether it is Now, Next, Gated, Later, or Evidence only; and
5. which existing item it replaces, if any.

For substantial post-overhaul implementation work, the plan must also identify
the domain owner/interface it extends or justify a new deep module boundary.
Defaulting new domain behavior into `app.js`, or extracting code only to reduce
file size, is not an acceptable architecture rationale.

Do not preserve an idea merely because an old audit mentioned it. Do not delete
an accepted decision merely because implementation is inconvenient.
