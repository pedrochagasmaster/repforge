# Taurifer canonical backlog

**Status:** Living source of truth, reconciled through Q602 and the August 2026
deferred-work review.

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
| Finish launch-readiness evidence | Complete the remaining real-device iOS/VoiceOver and Android/TalkBack cells, with the exact release-candidate build and evidence required by Plan 041. The implementation itself landed in PR #114. | [Plan 041](../plans/041-prelaunch-all-findings-remediation.md) |
| Finish the measurement foundation | Audit the existing PostHog SDK/proxy integration; freeze the allowlisted event catalogue, identifiers, definitions, windows, funnels, dashboards, opt-out behavior, leakage tests, and measurement-health alerts before reading alpha results. No workout values, free text, setup fragments, full URLs, or uncontrolled properties may escape. | [Plan 045](../plans/045-posthog-measurement-foundation.md), governed by [Plan 044](../plans/044-posthog-measurement-experiments-paywall.md) |
| Evolve the shared progression engine | Replace double progression as the only prescription policy with versioned range, rep-goal, anchor-plus-back-off, paired-exposure, block-profile, and manual strategies. Capacity remains shared evidence, not the universal rule. | [Plan 046](../plans/046-multi-strategy-progression-engine.md) |
| Build the initial Taurifer program families | Ship original hypertrophy/general-strength families through the shared compiler. Principal families need real three- and five-day siblings; Recommend/Custom must also cover two and six days. Home is a separate limited-equipment family; Foundation is an internal simple-start profile. Compiled slots carry exercise-library provenance, so illustrations, display aliases, performed attribution, and History identity resolve for every authored program rather than only for wizard-generated ones. | [Plan 047](../plans/047-taurifer-program-families-compiler.md) |
| Replace the conflated entry/onboarding flow | Separate Recommend, Generate custom, Browse, Build, and Import by authorship. Keep setup short, show progress, let users skip genuinely optional questions, and finish with an editable review. Ask goal/experience/recent consistency/time/rest/equipment, and never ask users to estimate volume tolerance or choose Taurifer's programming math. | [Plan 048](../plans/048-program-entry-onboarding-redesign.md) |
| Make lifecycle and friction observable | Persist complete/partial/unfinished program transitions; structured skip, override, session-overrun, schedule, pain, intensity, session-length, exercise-affinity, equipment, motivation, and free-text reasons; confidence and source type; resume/repair/rebase/switch outcomes. Submitted free text uses the separate consented research path, never PostHog. | Thesis §§8.3, 11–12; decision register §§5–6 |
| Expand generative/model-based journeys | Exercise onboarding, generation, all supported strategies, long workout histories, skips, stalls, overrides, interruptions, abandonment, transitions, and version migrations. Keep seeds, minimize failures, and promote them into regressions. | Thesis §12; `test/generative/` |
| Protect pilot data | Request persistent storage where supported, make backup/export prominent, explain prototype durability honestly, and keep core training usable offline. Do not turn this into premature cloud sync. | Thesis §22 |

The rolling alpha starts organically, one participant at a time, after these
foundations are credible. There is no synchronized cohort, special research
onboarding, individual program audit, payment, fake door, or stable entitlement
promise.

## 2. Next — complete the program relationship

| Work | Required outcome | Gate / source |
|---|---|---|
| Program lifecycle and next-program transition | Archive the current program without touching the log; preserve provenance and history; start another Recommended, Custom, Browsed, Built, Imported, or Shared program; interpret partial history honestly. | Needed before early alpha users reach transition. |
| Existing-user shared-program handoff | Add a reviewed, non-destructive replacement/transition flow for setup links. Preserve ADR 0007's released payload contracts. | Needed before a participant receives a later creator program. |
| Publisher attribution | Versioned publisher name, handle, description, and referral id with safe creator-specific acquisition events. Attribution is provenance, never engine input. | Required before creator pilots. |
| Free one-off sessions | Implement manual, classic, muscle-focus, and user-directed temporary adaptation with honest History/program/progression eligibility. | [One-off specification](superpowers/specs/2026-08-25-one-off-session-design.md) |
| Equipment contexts and sibling program instances | Let a user maintain two or three gym contexts, curate sibling mappings, share genuinely comparable free-weight history, and keep non-comparable machine histories separate. Support explicit crowded-gym substitutions. | Decision register §§14–15. |
| Cause-routed interventions | Specify each observed issue, minimum evidence, diagnosis question, permitted change, cooldown/ignore behavior, and reassessment window. Deload requires performance stagnation/degradation plus corroboration. | Decision register §5. |

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
| Next | Pound display and actionable increments | Design one end-to-end lb contract for stored historical values, editable targets, load steps, `minJump`, entry parsing, and “Why this weight?” copy. Never falsify history to make a target look loadable. |
| Next | Truthful early workout finish | Let the user finish with incomplete planned work while preserving completed sets and explicitly classifying omitted work; do not pretend the whole prescription was completed. |
| Next | PT-BR bundled/default day labels | Localize Taurifer-authored day labels or deliberately model them as user-owned data with authored PT-BR defaults. Do not mix English `Day N` into a Portuguese first-run program by accident. |
| Next | Swapped-workout headings | Keep the immutable performed/program title separate from a temporary swap annotation; do not rewrite durable history labels to explain a one-session substitution. |
| Next | Remaining native confirmations | Move destructive/discard confirmations into the shared accessible dialog policy without changing their transaction semantics. |
| Later | Focus/List preference | Persist the user's preferred workout presentation as a device-only UI preference; do not put it in program export or shared setup. |
| Later | “View exercises” contract | Either make Today's secondary action a real read-only preview or rename it to say that it starts list-mode logging. |
| Later | Progress drill-down and table affordance | Give Strength/Volume/PR rows a clear destination and make horizontally overflowing data visibly discoverable or mobile-native. Reuse the existing exercise-navigation seam. |
| Later | Volume-signal explanation | Explain what “under target” means and where the threshold came from without presenting volume tolerance as known. |
| Later | Full factory reset | If added, explicitly distinguish clearing logs, deleting all local Taurifer data, and resetting the installation identifier. Preserve export warnings. |
| Later | One-tap `+1 rep` | Test whether it materially improves active-set speed without creating accidental commits. |
| Later | Client-side encrypted export | Use a separately reviewed Web Crypto/passphrase design with recovery and failure behavior. Bad crypto is worse than none. |
| Later | Strong/Sheets CSV import | Define mapping, identity reconciliation, preview, and partial-failure behavior before implementation. |
| Later | Bodyweight and relative-strength trends | Add only when enough users log bodyweight and the view answers a real question; never turn bodyweight-normalized strength into a universal training score. |
| Evidence only | Larger chart ranges/global period | Reopen 12/26/52-week selection or one global Progress period only if users cannot answer real questions with the current scoped controls. |
| Evidence only | Landscape-specific layout | Keep responsive correctness; build a dedicated landscape treatment only after real use shows value. |
| Evidence only | History virtualization beyond current gate | Current linear index is tested at 5,000 sessions/20,000 rows. Add pagination/virtualization only when measured devices cross a performance budget. |
| Evidence only | Web Push and extra reminder types | Reopen a server sidecar, backup/block-end reminders, or explicit schedule UI only when installed-PWA/local notifications fail a demonstrated retention or safety need. Pilot backup prominence is already Now. |
| Evidence only | Hosted short/opaque setup links | The released self-contained setup formats remain canonical. Add an opaque-token service only when measured URL length, revocation, attribution, or handoff needs justify server dependency. |
| Evidence only | Per-exercise units or plate calculator | First solve the end-to-end lb/load-step contract. Add equipment-specific loading tools only from observed logging friction. |
| Evidence only | Opener fallback/backdrop dismissal/coach marks | The shipped modal policy and current focus restoration are intentional. Reopen only with a reproduced accessibility or comprehension problem. |
| Evidence only | Broad Focus/Program/Block redesign | There is no standing “redesign” task. File a specific observed problem with screenshots, affected state, and success criterion. |
| Completed | No bundled program before onboarding | Backing out of setup used to leave a bundled three-day program presented as the lifter's own. A device that has not been through onboarding now holds no program, and Today and Program say so and offer the entry hub. |
| Completed | Catalog the two no-program screens | `today/no-program` and `program/no-program` now use the empty-entry fixture and have localized light/dark reference frames generated with the pinned browser. |

## 6. Engineering debt

| Status | Item | Boundary |
|---|---|---|
| Next | One draft-transaction result contract | Replace the mixture of result kinds/flags with one documented shape without weakening partial-write and compensation semantics. |
| Later | Extract the persistence protocol | Move the dual-replica write, WAL, lock rebasing, and recovery protocol out of `app.js` behind a tested module boundary. This is a refactor, not a storage rewrite. It also unblocks the generative recommendation-determinism/provenance and backup round-trip properties, which are deliberately waiting on a clean domain seam rather than scraping `app.js`; sequence it against the Now-tier generative expansion rather than after it. |
| Later | Centralize browser-test helpers | Unify app boot, lock fixtures, state seeding, and common browser assertions without hiding test intent. |
| Completed | History identity/search contract | Current History matching uses performed library/movement identity for aliases and preserves immutable performed labels; focused tests hold the rule. |
| Completed | Fast-check foundation | The framework exists. The remaining work is expanding domain/state-machine coverage listed under Now, not choosing another property-testing library. |

## 7. Completed, superseded, or rejected

Do not re-add these as backlog without new owner evidence.

### Completed or absorbed

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
