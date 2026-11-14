# Taurifer canonical backlog

**Status:** Living source of truth, reconciled through Q602, the August 2026
deferred-work review, the Q603–Q621 advisor-plan triage, and shipped work through
14 November 2026.

**Active initiative:** finish the noncommercial alpha's release evidence. The
UI overhaul's implementation in Plans 049–059, except final launch validation,
unified redesign, coach layer and Your profile have shipped. Plan 059 remains the final same-SHA launch-validation boundary;
implementation completion does not close physical-device or owner gates.
Unrelated Later/Gated work stays deferred.

**Owner sequencing amendment (2026-11-14):** the Now rows below replace the
completed October 28 triage sequence. The [post-058 clearance sequence](post-058-open-pr-clearance-sequence.md)
remains the historical integration contract, not a second execution queue.

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
| Plan 059 launch validation | Validate one release candidate end to end on one commit, binding automated, catalog, privacy, telemetry, accessibility and device evidence to that same SHA. Plans 049–058 and their implementation follow-ups are shipped; their release acceptance remains here. | [Plan 059](../plans/059-public-launch-ui-validation.md), [Plan 041](../plans/041-prelaunch-all-findings-remediation.md), [dispositions](ui-overhaul-disposition-register.md) |
| Pre-launch owner checklist | Finish the remaining owner decisions/actions, including the release notes and launch authorization. Reconcile older checklist text with its dated comments; transfer was re-enabled on 1 November, so the old blanket “transfers off” text is not current status. | [#425](https://github.com/pedrochagasmaster/repforge/issues/425) |
| Physical-device acceptance | Confirm installed Android launch and the remaining Focus keyboard/device cells on the release candidate, alongside iOS/VoiceOver and Android/TalkBack. #304 and #300 are closed and their fix shipped in #305. #300 records an owner test on a physical iPhone on 2 November; #304 records closure on the fix, not Android acceptance. Do not infer the remaining device results from issue closure. | [#304](https://github.com/pedrochagasmaster/repforge/issues/304), [#300](https://github.com/pedrochagasmaster/repforge/issues/300), [#425](https://github.com/pedrochagasmaster/repforge/issues/425), [device matrix](design/interaction-runtime-device-matrix.md) |
| Operations | Complete the install-transfer deletion-latch acknowledgement and the program-import Worker redeploy after #745. The coordinator owns both; completion is not recorded here without its outcome. | [install-transfer runbook](../services/install-transfer/RUNBOOK.md), [#745](https://github.com/pedrochagasmaster/repforge/pull/745) |
| CI and documentation drift, unverified remainder | Retain advisor 006's transfer-client constant-drift guard until its exact endpoint and limit assertions can be verified. The i18n CI check and orientation-doc corrections are recorded as completed below. | Q612; [advisor plan 006](../advisor-plans/006-install-transfer-constant-drift-guard.md) |

The rolling alpha starts organically, one participant at a time, after these
foundations are credible. There is no synchronized cohort, special research
onboarding, individual program audit, payment, fake door, or stable entitlement
promise.


## 2. Next — post-overhaul adoption and real-life execution validation

This remains the default post-launch-validation queue, after alpha: remove
switching friction first, then
validate how often real-life constraints break an otherwise good program.
The four priorities below are unchanged. Unsupported-grammar measurement
shipped in #255; its remaining work is collecting and interpreting alpha data.
The pre-059 exception mapping for #255, #257 and #258 is retained as
historical integration context. No other Next item is pulled forward, and
nothing here may leak into Plan 058.

The complete authorized exception mapping is below. Work names refer to the
ordered Next rows, not a separate product queue. The canonical checker derives
the workfront mapping from this table and checks it against the clearance stages.

| Pre-059 PR | Next work |
|---|---|
| #255 | Unsupported workout-grammar measurement |
| #257 | Free one-off sessions |
| #258 | Historical migration foundation — Hevy, Strong, generic CSV |

| Order | Work | User problem / business risk | Smallest observable success condition | Depends on | Scheduling effect |
|---:|---|---|---|---|---|
| 1 | Historical migration foundation — Hevy, Strong, generic CSV | An experienced lifter can prefer Taurifer's progression model and still refuse to switch because years of training history are stranded elsewhere. Program import does not solve that switching cost. | Import real Hevy, Strong, and generic CSV histories through a previewable pipeline with source provenance, identity reconciliation, explicit unresolved rows, partial-failure reporting, and no silent merging of non-comparable movements. Imported sessions remain truthful History records. Use the shipped Plan 061 matcher and pull the systematic alias pass into this work only where the migration corpus proves vocabulary gaps. | Plan 061 import matching; History performed-identity contract; a dedicated history-import plan that settles source schemas, duplicate handling, units, dates, eligibility, and rollback before code; [advisor plan 027](../advisor-plans/027-competitor-history-import-spike.md) is that specification spike (Q615). | Replaces the Later `Strong/Sheets CSV import` item. A Sheets export is handled as generic CSV; additional vendor formats remain Later until demand is observed. |
| 2 | Free one-off sessions | Real training weeks contain travel, limited time, crowded gyms, friend sessions, and extra sessions. Requiring every workout to be a program day makes Taurifer brittle exactly where a gym logger must be useful. | Ship the ratified Free one-off semantics: manual, classic, muscle-focus, and user-directed planned-session adaptation with time/equipment constraints, deterministic review, and honest History/program/progression eligibility. Completing a pure one-off must not complete/reorder/edit the program, inflate block adherence, or advance automatic program progression. | The existing one-off specification; post-overhaul Today/Workout/History contracts; existing draft and durable-state guarantees. | Moves the existing deferred Free one-off work to Next. Pro program-aware one-off planning remains Gated and cannot be sold before it works. |
| 3 | Ephemeral equipment-context validation through one-offs | Equipment availability changes by gym, travel, crowding, and session. Building persistent multi-gym identity before proving this is common would front-load one of Taurifer's most complex history-comparability problems. | The one-off/adaptation flow can express exact available equipment, deterministic compatible substitutions, and `Minimize equipment changes` without creating a named persistent gym. Collect only approved privacy-safe categorical evidence needed to learn whether users repeatedly switch contexts or hit substitution friction. | Free one-off sessions; canonical equipment vocabulary; substitution identity semantics; telemetry allowlist approval for any new event. | Full persistent equipment contexts/sibling program instances stay Later until this experiment shows repeated need. |
| 4 | Unsupported workout-grammar measurement | Imported programs contain concepts Taurifer does not execute today. Blindly adding supersets, rest prescriptions, tempo, cardio, or additional set kinds risks turning the product into a generic logger without evidence that those constructs block adoption. | Record privacy-safe categorical counts for unsupported concepts surfaced by the free-form import path — initially `supersets`, `rest_times`, `rir_rpe`, `tempo`, `warmups`, `cardio`, `progression_rules`, and `deload` — without storing source text. The resulting distribution must be sufficient to rank which, if any, executable-model extension deserves a plan. | Shipped free-form import; telemetry/privacy review; the existing unsupported-concept sidecar or an equivalent reviewed categorical contract. | Replaces the vague Later `Free-form import: measure and widen` item. Alpha data collection remains Next; executable grammar expansion remains Evidence only. Measurement is implemented by PR #255 (`program_import_unsupported_concept`, closed category enum, counted once per accepted review); the categorical distribution has not yet been collected. |

Historical migration should not become an importer arms race. After the initial
three source shapes work, add another vendor only from observed switching demand.
Likewise, the one-off equipment experiment is intentionally not a shortcut to
persistent multi-gym: the latter still needs explicit history-comparability and
machine-identity semantics.

Engineering work that follows the shipped data-safety fixes (Q612). These are test
and tooling changes, not post-overhaul product work, so under Q604 they may
start as standalone PRs under their existing contracts:

| Work | Required outcome | Governing detail |
|---|---|---|
| DraftV2 store model search | Generated save, stale-save, removal, fault, quota, and reboot sequences never lose or invent a workout draft. Counterexamples become regressions, not in-plan fixes. A bounded slice of the deferred generative expansion. Starts after the crash-journal fix lands. | Q612; advisor plan [009](../advisor-plans/009-generative-draft-store-model.md) |
| Durable-state fault hook through the host adapter | `durable-state.js` takes its draft fault-injection hook through `configureHost` instead of an undeclared `app.js` global, so Node harnesses can drive every draft path. | Q612; advisor plan [016](../advisor-plans/016-durable-state-fault-hook-via-host.md) |

## 3. Gated — working Pro and paid beta

Payment is blocked until all three Pro jobs and the full commerce lifecycle work.

| Work | Required outcome | Gate |
|---|---|---|
| Advanced first-program generation | Specialize one of Taurifer's supported families around priorities and constraints, explain trade-offs, and compile a normal executable program. | Shared engine, families, time/volume allocation specification. |
| History-aware next program | Use complete or partial history and the exit review to recommend resume, repair, rebase, or switch; select and personalize a supported family with visible confidence. | Lifecycle/history semantics and real transition data. |
| Bounded within-program adaptation | Free already includes the weekly-review adaptations shipped in Plan 082 / [#687](https://github.com/pedrochagasmaster/repforge/pull/687); Pro must go beyond that Free capability. Detect recurring skips, stalls, overrides, overruns, and schedule mismatch; ask why; propose the smallest cause-matched versioned change; require approval and evaluate the result. | Intervention catalogue and versioned program changes. |
| Program-aware one-off planning | Recommend the best use of a disrupted session from the active program, recent work, time, and equipment, while leaving the program unchanged and allowing override. | Free one-off semantics working first. Approved Pro extension, not a purchase promise until shipped. |
| Multi-gym Pro intelligence | Recommend/contextualize sibling mappings and program changes across equipment contexts without merging incomparable machines. | Core equipment-context identity working first. Approved Pro extension, not a purchase promise until shipped. |
| Capability and entitlement system | Capability-based checks; twelve-month annual/monthly terms; expiry, restoration, cancellation, refunds, purchase reconciliation, and lapse behavior with no clawback. A dedicated ADR records the lifecycle (provider, Pix and card, device-side token, restoration, refunds, reconciliation) before any funnel work (owner, 2026-11-08, D-13). Where Pro is first presented and the trial's shape are decided after the alpha (D-10, D-11); the [coach-layer strategy](coach-layer-strategy-2026-11-08.md) §6 records the proposed target. | Working Pro capabilities. |
| Your profile paywall design | Decide whether and how the profile participates in the paid offering, preserving saved evidence and the Free floor. Everything remains Free in alpha; this is the owner's post-alpha choice. | After alpha evidence and an owner decision; [Plan 084 §8](../plans/084-gauge-return.md#8-post-alpha-notes-only) defines no paid boundary, offer, trial or trigger. |
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
| Later | Larger-program setup links, #387 | Re-assess whether setup links need to carry bigger programs using current refusal and file-share evidence. Recipe-plus-edits shipped in #579; full Build/manual programs can use Share as file. No server store is authorized by this row. |
| Later | PT exercise-name review tool, #315 | The review tool exists; finish the owner's Portuguese exercise-name review and publish approved names after launch. No automatic approval or replacement of catalog identities. |
| Later | Plain-language strength wording in Progress | Owner option after alpha: review "e1RM" wording so the figure and its limits are understandable, without changing calculations or historical values. |
| Later | Program-change retry and settlement consistency, #692 | After alpha, make retry and boot agree on the durable state and clear stale errors after recovery, preserving the transaction contract. |
| Later | Superseded rest-preset write errors, #698 | After alpha, show a storage error only for the still-current failed preference change, not a tap superseded by a later choice. |
| Later | Short-list review leftovers, #704 | After alpha, resolve the issue’s bounded low-severity findings, including held-stepper pointer ownership, without widening into a redesign. |
| Later | Pound display and actionable increments | Design one end-to-end lb contract for stored historical values, editable targets, load steps, `minJump`, entry parsing, and “Why this weight?” copy. Never falsify history to make a target look loadable. |
| Later | PT-BR bundled/default day labels | Localize Taurifer-authored day labels or deliberately model them as user-owned data with authored PT-BR defaults. Do not mix English `Day N` into a Portuguese first-run program by accident. |
| Later | Swapped-workout headings | Keep the immutable performed/program title separate from a temporary swap annotation; do not rewrite durable history labels to explain a one-session substitution. |
| Later | Manual-slot authored load | Direction D draws a manual slot's program-authored load (Plan 064 RF-4, owner decision on #295). Add it as a program field end to end: schema and boot sanitizer, editor, free-form import, the setup-link codec with its released-format compatibility (ADR 0007), and the Today, Program and Focus rows that would show it. Until then manual rows show sets × range and "manual" with no load. |
| Later | Refused setup-link cookie | A refused or invalid setup link leaves the `repforge_setup_v1` cookie set (Plan 064 R7 J N-5, recorded on #295). ADR 0007 does not say whether refusal clears it. Decide that in ADR 0007 before changing it: the cookie is setup-link storage, not a display detail. |
| Later | Remaining native confirmations | Move destructive/discard confirmations into the shared accessible dialog policy without changing their transaction semantics. |
| Later | ~~Focus/List preference~~ → Superseded | Superseded by G-22: Focus is the sole workout-logging experience. No List preference persists. |
| Later | Full factory reset | If added, explicitly distinguish clearing logs, deleting all local Taurifer data, and resetting the installation identifier. Preserve export warnings. |
| Later | One-tap `+1 rep` | Test whether it materially improves active-set speed without creating accidental commits. |
| Later | Client-side encrypted export | Use a separately reviewed Web Crypto/passphrase design with recovery and failure behavior. Bad crypto is worse than none. |
| Later | Additional historical migration sources | After the Next Hevy/Strong/generic-CSV foundation is in real use, add another vendor format only when switching research or failed-import evidence shows material demand. Preserve the same provenance, identity-reconciliation, preview, duplicate, unit/date, and partial-failure guarantees; do not chase format count as a feature metric. |
| Later | Publisher attribution (deferred) | Unrelated to the overhaul: versioned publisher name, handle, description, and referral id with safe creator-specific acquisition events. Attribution is provenance, never engine input. Reopen only before creator pilots with a new scheduling decision. First step when scheduled: the versioning and URL-size spike, [advisor plan 026](../advisor-plans/026-publisher-attribution-spike.md) (Q615). |
| Later | Equipment contexts and sibling program instances (deferred) | Persistent two- or three-gym contexts, curated sibling mappings, comparable free-weight history, separate non-comparable machine histories, and explicit crowded-gym substitutions. Do not schedule from competitive parity alone: first use the Next one-off equipment experiment to establish repeated context switching/substitution demand, then require a new scheduling decision for persistent identity. |
| Later | Cause-routed interventions (deferred) | Unrelated to the overhaul: per-issue evidence, diagnosis question, permitted change, cooldown/ignore behavior, and reassessment window. Reopen with a new scheduling decision. |
| Later | General lifecycle/friction observability (deferred) | Only the Phase 049-approved telemetry allowlist is scheduled (see Completed: Plans 045–048 are done; the overhaul row governs). Persisting general transition/skip/override/friction/reason catalogues beyond that needs a new product decision. Submitted free text stays on the separate consented research path, never PostHog. The owner approved adoption and friction coverage on 2026-10-11 ([Plan 071](../plans/071-telemetry-coverage.md)): the onboarding funnel, editor actions, landing and install, block transitions and settings, all as closed enums. Reason catalogues and free text remain excluded. |
| Later | Program lifecycle and next-program transition (deferred) | Broader than the audit-bounded transition work owned by Plans 052/056: archiving, starting another program of any authorship, and honest partial-history interpretation as general lifecycle. Reopen with a new scheduling decision once the overhaul lifecycle is in place. |
| Gated | Existing-user shared-program handoff | A reviewed, non-destructive replacement/transition flow for setup links, preserving ADR 0007's released payload contracts and reusing the entry hub's archive-and-replace activation. Gate: an owner-approved design ([advisor plan 025](../advisor-plans/025-existing-user-setup-link-handoff.md), Phase 1) before any participant receives a second coach program (Q615). Product/UX work, so it waits for the overhaul (Q604). |
| Later | Generative/model-based journey expansion (deferred) | Exercise onboarding, generation, strategies, long histories, skips, stalls, overrides, interruptions, abandonment, transitions, and version migrations as a general program. Overhaul plans specify their own required test evidence; broader expansion needs a new scheduling decision. Keep seeds and minimize failures. |
| Later | Proactive backup reminder | The remainder of pilot-data protection after the shipped browser-persistence mitigation (Q606, Q620): an action-linked backup cue through the guide registry that does not nag. Needs an owner-approved design before building. Must not make a fresh device ineligible for install transfer. Do not turn it into premature cloud sync. |
| Later | Bodyweight and relative-strength trends | Add only when enough users log bodyweight and the view answers a real question; never turn bodyweight-normalized strength into a universal training score. |
| Evidence only | Larger chart ranges/global period | Reopen 12/26/52-week selection or one global Progress period only if users cannot answer real questions with the current scoped controls. |
| Evidence only | Landscape-specific layout | Keep responsive correctness; build a dedicated landscape treatment only after real use shows value. |
| Evidence only | History virtualization beyond current gate | Current linear index is tested at 5,000 sessions/20,000 rows. Add pagination/virtualization only when measured devices cross a performance budget. |
| Evidence only | Web Push and extra reminder types | Reopen a server sidecar, backup/block-end reminders, or explicit schedule UI only when installed-PWA/local notifications fail a demonstrated retention or safety need. A proactive backup cue is the Later "Proactive backup reminder" item above, not a push notification. Unrelated to the one-hour install-transfer exception ([ADR 0013](adr/0013-temporary-install-transfer.md)), which is not a notification or reminder path. |
| Evidence only | Encrypted server-backed setup links | The released self-contained setup formats remain canonical. A setup link carries a generated program as its regeneration recipe, and an edited generated one as that recipe plus its edits while the current generator still regenerates it (#527: light and typical review edits fit); a Build or imported program, or a generated one from an earlier generator, must carry its full definition, which exceeds the link limit (about 12,500 characters against 3,072). Since PR #312 the sheet then offers **Share as file** instead of a dead end. Candidate design if evidence reopens it: encrypt the setup payload in the browser and keep the key only in the URL fragment, so the server stores ciphertext it cannot read; store it in the existing EU-jurisdiction install-transfer service ([ADR 0013](adr/0013-temporary-install-transfer.md)) rather than a new database; cap payload size, expire links (30–90 days), rate-limit creation, name the processor in the share consent and the Privacy page; record a new ADR because it amends [ADR 0007](adr/0007-shared-setup-links.md)'s "no hosted program store". A smaller alternative is a recipe-plus-edits link form. **Reopen when** production `share_setup_outcome` (see [dashboard recipe](measurement/posthog-dashboard-recipes.md#dashboard-program-sharing)) shows, over at least 50 installations attempting a link on the current release: `link_refused` on 10% or more of attempts, or refused attempts that do not reach `file_shared` within an hour on half or more of installations. Use `program_kind` and `size_vs_limit` to pick the fix: refusals that are mostly `generated_edited` point to the recipe-plus-edits form; refused `manual` or `other` programs, or anything `over_4x`, point to the server store; refusals only just `over_limit` may need no more than a leaner full form. The install-transfer token is a separate one-hour claim object, not a setup-link format. |
| Evidence only | Per-exercise units or plate calculator | First solve the end-to-end lb/load-step contract. Add equipment-specific loading tools only from observed logging friction. |
| Evidence only | Executable workout-grammar expansion | Add a currently unsupported construct only when the Next categorical measurement plus direct user evidence shows it blocks meaningful program adoption or execution. Candidate concepts include supersets, explicit rest prescriptions, tempo, additional set kinds, timed/cardio work, or imported progression/deload rules. Extend the executable/history/progression model deliberately per construct; do not accept richer import JSON that the engine cannot truthfully execute. |
| Evidence only | ~~Opener fallback/backdrop dismissal/coach marks~~ → Superseded in part | Superseded in part by G-40: the global tour is removed in favor of action-linked contextual cues (Plans 054–057 own the registry and anchors). Reopen per cue only with a reproduced accessibility or comprehension problem. |
| Evidence only | ~~Broad Focus/Program/Block redesign~~ → Superseded | Superseded by the owner-approved overhaul (G-02–G-04): whole-product polish, not partial cleanup. File specific observed problems against the overhaul contracts instead. |
| Completed | Free-form program import | "I already have a program" almost never meant a Taurifer file. The import route now has a paste door: the lifter's free-form program is wrapped in a reviewed prompt and handed to their own ChatGPT or Claude through a link they tap, and the reply comes back through the existing import review. No key, account, backend or LLM dependency, and no front-running of ADR 0011. See [ADR 0014](adr/0014-free-form-program-import-handoff.md). |
| Completed | No bundled program before onboarding | Backing out of setup used to leave a bundled three-day program presented as the lifter's own. A device that has not been through onboarding now holds no program, and Today and Program say so and offer the entry hub. |
| Completed | Catalog the two no-program screens | `today/no-program` and `program/no-program` now use the empty-entry fixture and have localized light/dark reference frames generated with the pinned browser. |
| Completed | Program generation engine overhaul (Plan 065) | Compiler 3 adds authored function-aware exercise selection, week-aware ranking and explicit dose fitting; documented with the audited residuals in ADR 0017 (PR #306). |

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
| Later | Archived-block storage growth, #314 | After launch, reduce the roughly 290 KB per large archived block. Per-set metric definitions were deduplicated, but repeated provenance and long set IDs still dominate; a stored-format change needs its own reviewed migration and size proof. [#314](https://github.com/pedrochagasmaster/repforge/issues/314) remains open by owner decision. |
| Later | Centralize browser-test helpers | Unify app boot, lock fixtures, state seeding, and common browser assertions without hiding test intent. |
| Later | Render and search history scans | Today recomputes each recommendation several times per render, and the exercise picker rescans history per keystroke. Memoize within one render and cache per log identity, proven by deterministic row-visit counts with unchanged output. After the overhaul (Q611). See [advisor plans 007](../advisor-plans/007-today-render-history-scans.md) and [008](../advisor-plans/008-exercise-picker-keystroke-cost.md). |
| Later | Replace fixed test sleeps | ~399 `waitForTimeout` calls; start with `test/simulation.mjs` (127, ≥ 20.8 s per run). Wait on observable state instead; no assertion weakened (Q612). See [advisor plan 015](../advisor-plans/015-replace-fixed-sleeps-in-simulation.md). |
| Later | Small correctness hardening | Reachable fallbacks for dynamically built i18n keys; the usual training hour computed across midnight; setup-link URL helpers that fail closed without ever widening the cookie path (Q613). See [advisor plans 012](../advisor-plans/012-i18n-dynamic-key-fallbacks.md), [017](../advisor-plans/017-usual-hour-circular.md), [020](../advisor-plans/020-shared-setup-url-parse-hardening.md). |
| Later | Vendored-runtime build tool refresh | Bump the build-time esbuild pin, with runtime-budget and browser equivalence evidence (Q613). See [advisor plan 014](../advisor-plans/014-bump-vendor-build-esbuild.md). |
| Evidence only | CI browser-install cache | Measured at 19–26 s per parallel job. Reopen when browser lanes approach their timeout or CI cost becomes a problem (Q608). See [advisor plan 010](../advisor-plans/010-ci-playwright-browser-cache.md). |
| Evidence only | Single-language i18n catalogs | EN is the mandatory fallback and the market is PT-first. Reopen for an English-first launch or measured boot-time complaints, starting with the measurement spike (Q608). See [advisor plan 021](../advisor-plans/021-i18n-catalog-split-spike.md). |

> Duplicate `app.js`/`durable-state.js` validators and thirteen unreferenced `app.js` functions fold into Plan 058's obsolete-path removal rather than a separate item (Q613); see [advisor plans 013](../advisor-plans/013-dedupe-durable-state-validators.md) and [019](../advisor-plans/019-remove-dead-app-functions.md).
| Completed | History identity/search contract | Current History matching uses performed library/movement identity for aliases and preserves immutable performed labels; focused tests hold the rule. |
| Completed | Fast-check foundation | The framework exists. The remaining work is expanding domain/state-machine coverage listed under deferred generative expansion, not choosing another property-testing library. |

## 7. Completed, superseded, or rejected

Do not re-add these as backlog without new owner evidence.

### Completed or absorbed

The October 28 triage sequence and bounded maintenance are closed. Shipped
implementation and issue closure do not substitute for the Now device gates.

| Work completed | Result | Shipping evidence |
|---|---|---|
| October 28 reliability and telemetry, #304, #528, #300, #529 | Installed-launch/keyboard fixes, next-workout selection, startup-event delivery, first-working-set milestone and privacy reconciliation shipped. Physical acceptance is qualified in Now above. | [#305](https://github.com/pedrochagasmaster/repforge/pull/305), [#536](https://github.com/pedrochagasmaster/repforge/pull/536), [#555](https://github.com/pedrochagasmaster/repforge/pull/555), [#551](https://github.com/pedrochagasmaster/repforge/pull/551), [#556](https://github.com/pedrochagasmaster/repforge/pull/556), [#575](https://github.com/pedrochagasmaster/repforge/pull/575) |
| October 28 interaction fixes, #519, #521, #524, #525, #526 | Editor rest pill, obscured shelf, mobile set table, planned-volume audit and clipped date input fixed. | [#543](https://github.com/pedrochagasmaster/repforge/pull/543), [#544](https://github.com/pedrochagasmaster/repforge/pull/544), [#545](https://github.com/pedrochagasmaster/repforge/pull/545), [#546](https://github.com/pedrochagasmaster/repforge/pull/546), [#547](https://github.com/pedrochagasmaster/repforge/pull/547) |
| Focus instruction and evidence, #517, #518, #523 | Hero instruction, evidence line and accessible completed sets shipped together. | [#550](https://github.com/pedrochagasmaster/repforge/pull/550) |
| Edited-program sharing and session duration, #527, #515 | Lossless v5 recipe-plus-edits links and durable actual session duration shipped separately. | [#579](https://github.com/pedrochagasmaster/repforge/pull/579), [#552](https://github.com/pedrochagasmaster/repforge/pull/552) |
| Older closure candidates, #318, #323, #456, #487 | Build opt-in and per-side progression, generation inputs, UI-system shard headroom and the rewritten wheel proof are shipped. #314 remains Engineering debt; #323's variable-length follow-up shipped in #566. | [#381](https://github.com/pedrochagasmaster/repforge/pull/381), [#386](https://github.com/pedrochagasmaster/repforge/pull/386), [#312](https://github.com/pedrochagasmaster/repforge/pull/312), [#498](https://github.com/pedrochagasmaster/repforge/pull/498), [#500](https://github.com/pedrochagasmaster/repforge/pull/500), [#501](https://github.com/pedrochagasmaster/repforge/pull/501), [#566](https://github.com/pedrochagasmaster/repforge/pull/566), [#563](https://github.com/pedrochagasmaster/repforge/pull/563), [#503](https://github.com/pedrochagasmaster/repforge/pull/503) |
| Bounded maintenance, #411, #462, #516, #520, #458 | Splash reference, unknown preview lane, reorder scroll position, shared rep-range stepper and rest-day naming fixed. | [#561](https://github.com/pedrochagasmaster/repforge/pull/561), [#562](https://github.com/pedrochagasmaster/repforge/pull/562), [#559](https://github.com/pedrochagasmaster/repforge/pull/559), [#560](https://github.com/pedrochagasmaster/repforge/pull/560), [#574](https://github.com/pedrochagasmaster/repforge/pull/574) |
| UI-overhaul implementation and unified candidate | Plans 049–058, the unified redesign and mobile viewport/touch stabilization shipped. Plan 059 retains final release/device acceptance. | [#243](https://github.com/pedrochagasmaster/repforge/pull/243), [#244](https://github.com/pedrochagasmaster/repforge/pull/244), [#248](https://github.com/pedrochagasmaster/repforge/pull/248), [#256](https://github.com/pedrochagasmaster/repforge/pull/256), [#295](https://github.com/pedrochagasmaster/repforge/pull/295), [#308](https://github.com/pedrochagasmaster/repforge/pull/308) |
| Generation, catalog and adaptive prescriptions | Plan 067 replacement and Plan 073 recovered deterministic generation shipped. Accurate Build/per-side explanations and opt-in shipped through Plan 069. Stored definitions remain readable by their authored structure. | [#312](https://github.com/pedrochagasmaster/repforge/pull/312), [#422](https://github.com/pedrochagasmaster/repforge/pull/422), [#381](https://github.com/pedrochagasmaster/repforge/pull/381), [#386](https://github.com/pedrochagasmaster/repforge/pull/386) |
| Alpha data safety | Failed rebase-journal writes abort, activation archives existing program content, and service-worker error responses cannot replace good cached copies. | [#271](https://github.com/pedrochagasmaster/repforge/pull/271), [#294](https://github.com/pedrochagasmaster/repforge/pull/294), [#291](https://github.com/pedrochagasmaster/repforge/pull/291) |
| Truthful session outcomes | Shared read-time outcomes, performed anchor reps and pause wording shipped in the unified redesign. No history rewrite. | [#295](https://github.com/pedrochagasmaster/repforge/pull/295) |
| Alpha measurement and browser persistence | Four recommendation-trust event producers and their coverage guard shipped; persistent storage is requested after a completed session and Settings reports durability. Unsupported-import measurement also shipped; alpha data is still Next. | [#293](https://github.com/pedrochagasmaster/repforge/pull/293), [#292](https://github.com/pedrochagasmaster/repforge/pull/292), [#255](https://github.com/pedrochagasmaster/repforge/pull/255) |
| CI and orientation-document corrections | The CI inventory runs `build-i18n --check` and guards that entry. CLAUDE.md architecture corrections and the plan-index reconciliation shipped. Advisor 006 remains unverified in Now. | [#269](https://github.com/pedrochagasmaster/repforge/pull/269), [#268](https://github.com/pedrochagasmaster/repforge/pull/268); CI check present at [b30bfc8df](https://github.com/pedrochagasmaster/repforge/commit/b30bfc8df) in `test/suites.mjs` and `test/ci.mjs` |
| The coach layer, Plans 078–083 | Effort ladder, session zero, estimator, profile/findings, weekly-review facts and approved adaptations, and the landing test-set additions shipped. All remain Free in alpha; post-alpha entitlement decisions stay gated. | [#687](https://github.com/pedrochagasmaster/repforge/pull/687), merged as `991163048` |
| Your profile, Plan 084 | Saved-evidence stages and the ink-only ring shipped on Today, Progress and session finish, without a printed percentage or celebration. | [#753](https://github.com/pedrochagasmaster/repforge/pull/753), [#754](https://github.com/pedrochagasmaster/repforge/pull/754), [#755](https://github.com/pedrochagasmaster/repforge/pull/755), [#761](https://github.com/pedrochagasmaster/repforge/pull/761) |
| Truthful early workout finish | Confirm omitted work, preserve completed sets and save only after explicit consent. | [#243](https://github.com/pedrochagasmaster/repforge/pull/243), [#295](https://github.com/pedrochagasmaster/repforge/pull/295) |
| “View exercises” contract | Read-only exercise/prescription preview shipped with Focus and the unified redesign; Today exposes the prescription without starting a session. | [#243](https://github.com/pedrochagasmaster/repforge/pull/243), [#295](https://github.com/pedrochagasmaster/repforge/pull/295) |
| Progress drill-down and table affordance | Summary rows drill into scoped detail; full tables are secondary views. | [#244](https://github.com/pedrochagasmaster/repforge/pull/244) |
| Volume-signal explanation | Weekly status and scoped evidence use neutral baselines; muscle rows expose the sets behind their totals. | [#244](https://github.com/pedrochagasmaster/repforge/pull/244) |
| Open-issues sweep, 12–14 November | Closed #750, #748, #746, #725, #732, #726, #720, #723, #665, #727, #741, #740, #759, #764, #765, #768, #771, #775, #779, #780. Fixed layout/large-text defects, missing-artwork fallback, route cleanup, preference durability and transfer eligibility, plus focused verification and catalog defects. | [#752](https://github.com/pedrochagasmaster/repforge/pull/752), [#756](https://github.com/pedrochagasmaster/repforge/pull/756), [#757](https://github.com/pedrochagasmaster/repforge/pull/757), [#758](https://github.com/pedrochagasmaster/repforge/pull/758), [#763](https://github.com/pedrochagasmaster/repforge/pull/763), [#770](https://github.com/pedrochagasmaster/repforge/pull/770), [#773](https://github.com/pedrochagasmaster/repforge/pull/773), [#774](https://github.com/pedrochagasmaster/repforge/pull/774), [#777](https://github.com/pedrochagasmaster/repforge/pull/777), [#778](https://github.com/pedrochagasmaster/repforge/pull/778), [#782](https://github.com/pedrochagasmaster/repforge/pull/782), [#760](https://github.com/pedrochagasmaster/repforge/pull/760), [#767](https://github.com/pedrochagasmaster/repforge/pull/767), [#766](https://github.com/pedrochagasmaster/repforge/pull/766), [#769](https://github.com/pedrochagasmaster/repforge/pull/769), [#772](https://github.com/pedrochagasmaster/repforge/pull/772), [#776](https://github.com/pedrochagasmaster/repforge/pull/776), [#781](https://github.com/pedrochagasmaster/repforge/pull/781) |

- The post-Plan053 durable-state architecture bridge is implemented in PR
  #240 and merged at `3710f34bb677c59674a3677c03d2fc1427e07cef`.
  `durable-state.js` owns the normalized outcome, settlement, recovery, WAL,
  replica, and DraftV2 transaction-sidecar contracts. Plan 054 followed this
  bridge; the current workfront is governed by the post-058 clearance sequence.

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
- A root `.editorconfig` (advisor plan 018): the tree has no whitespace
  problem; re-propose only if whitespace churn appears in reviews (Q608).

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
