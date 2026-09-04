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

The measurement foundation, shared progression engine, program families, and
entry/onboarding flow (Plans 045–048) are implemented; their rows moved to
Completed below. Do not re-add them as Now work.

The rolling alpha starts organically, one participant at a time, after these
foundations are credible. There is no synchronized cohort, special research
onboarding, individual program audit, payment, fake door, or stable entitlement
promise.

## 2. Next — complete the program relationship

No independent Next work is scheduled: the overhaul DAG above owns the
sequenced program-relationship work (Plans 052–057), and everything else that
lived here is deferred to Later below with its gate preserved.

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
| Later | Strong/Sheets CSV import | Define mapping, identity reconciliation, preview, and partial-failure behavior before implementation. |
| Later | Publisher attribution (deferred) | Unrelated to the overhaul: versioned publisher name, handle, description, and referral id with safe creator-specific acquisition events. Attribution is provenance, never engine input. Reopen only before creator pilots with a new scheduling decision. |
| Later | Free one-off sessions (deferred) | Unrelated to the overhaul: manual, classic, muscle-focus, and user-directed temporary adaptation with honest History/program/progression eligibility. See the one-off specification. Reopen with a new scheduling decision, not through an overhaul PR. |
| Later | Equipment contexts and sibling program instances (deferred) | Unrelated to the overhaul: two or three gym contexts, curated sibling mappings, comparable free-weight history, separate non-comparable machine histories, explicit crowded-gym substitutions. Reopen with a new scheduling decision. |
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
| Evidence only | ~~Opener fallback/backdrop dismissal/coach marks~~ → Superseded in part | Superseded in part by G-40: the global tour is removed in favor of action-linked contextual cues (Plans 054–057 own the registry and anchors). Reopen per cue only with a reproduced accessibility or comprehension problem. |
| Evidence only | ~~Broad Focus/Program/Block redesign~~ → Superseded | Superseded by the owner-approved overhaul (G-02–G-04): whole-product polish, not partial cleanup. File specific observed problems against the overhaul contracts instead. |
| Completed | No bundled program before onboarding | Backing out of setup used to leave a bundled three-day program presented as the lifter's own. A device that has not been through onboarding now holds no program, and Today and Program say so and offer the entry hub. |
| Completed | Catalog the two no-program screens | `today/no-program` and `program/no-program` now use the empty-entry fixture and have localized light/dark reference frames generated with the pinned browser. |

## 6. Engineering debt

| Status | Item | Boundary |
|---|---|---|
| Later | One draft-transaction result contract | Replace the mixture of result kinds/flags with one documented shape without weakening partial-write and compensation semantics. |
| Later | Extract the persistence protocol | Move the dual-replica write, WAL, lock rebasing, and recovery protocol out of `app.js` behind a tested module boundary. This is a refactor, not a storage rewrite. It also unblocks the generative recommendation-determinism/provenance and backup round-trip properties, which are deliberately waiting on a clean domain seam rather than scraping `app.js`; sequence it against the overhaul's persistence-adjacent work (Plans 051–053) rather than after it. |
| Later | Centralize browser-test helpers | Unify app boot, lock fixtures, state seeding, and common browser assertions without hiding test intent. |
| Completed | History identity/search contract | Current History matching uses performed library/movement identity for aliases and preserves immutable performed labels; focused tests hold the rule. |
| Completed | Fast-check foundation | The framework exists. The remaining work is expanding domain/state-machine coverage listed under deferred generative expansion, not choosing another property-testing library. |

## 7. Completed, superseded, or rejected

Do not re-add these as backlog without new owner evidence.

### Completed or absorbed

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

Do not preserve an idea merely because an old audit mentioned it. Do not delete
an accepted decision merely because implementation is inconvenient.
