# Taurifer backlog

The only list of open, deferred and paused work. Order is top to bottom within each section; plans are implementation history and contracts, not another queue.

## Now (before alpha)

- Plan 059: starts once the owner's real-phone testing below is done (owner, 2026-11-15). Validate one release candidate end to end on one commit, including accessibility, privacy, telemetry, offline and update behavior.
- Real-phone pass (owner testing over several days from 2026-11-15): install, install transfer, a full workout with the keyboard and 200% text, a setup link opened into the installed app, Android installed-app launch, program generation and Your profile, plus wheel/sheet/dock behavior; include iOS/VoiceOver and Android/TalkBack on the release candidate.
- Backup cue (Packet E, #811, promoted from Later): a quiet "Save a backup copy" on the finish screen once three saved sessions and seven days have passed since the later of the last backup and the last "Not now"; same file as Settings' export, to the share sheet or a download; no cloud sync. Owner to approve the trigger rule, whether it also appears on Today, and the EN/PT copy.

## Waiting on owner

- #315 Portuguese exercise names: the 128 movements Generate uses are published (`test/fixtures/generator-pt-names.json`). Remaining: 56 owner approvals saved on `backup/2026-10-15/pt-name-review-progress` for movements Generate does not use, and the other 1,150 drafted names (Build and Import picks), through the existing review tool.

## After alpha (Next)

- Import Hevy, Strong and generic CSV history with preview, source provenance, movement reconciliation, duplicate/unit/date rules, partial failures and rollback.
- Free one-off sessions: manual, classic, muscle-focus and time/equipment adaptation; pure one-offs never advance or reorder the active program or its progression.
- Validate temporary equipment contexts through one-offs: exact available equipment, compatible substitutions and fewer equipment changes; measure repeated switching before adding persistent gyms.
- Collect alpha data on unsupported import concepts; categorical measurement shipped in #255, and executable grammar expansion waits for evidence of blocked adoption.
- [Plan 085](../plans/085-warmups-partials.md): suggested warm-ups that learn from saved workouts and partial reps after 0 reps left. Preserve working-set slots and full-rep progression. Policy and EN/PT copy approved 2026-11-21; slices #804 (merged), #805 and the Prelude slice in progress.

## Bugs after alpha

- #692: after another tab commits, Review → Confirm → Try again repeats stale errors until reload; with a pending reduce-volume journal and a removed typed set, retry keeps the successor while reload rolls back; reproduce both and reconcile settlement without losing draft bytes, including read-throw/corrupt journals that claim settled then refuse retry.
- #698: hold a rest-preset save, tap a later preset, then fail the held save; the old write still announces a storage error although the latest preset owns the clock; decide whether that error should be silent.
- #704: reproduce Escape leaving History's delete confirmation open, Library reload adding Back entries with no visible change, text inputs dragging sheets about 8 px, a second finger taking over a held stepper, and an ended rest returning after both remove/write fail and the tab is lost; fix only cases still present.
- #314: large archived blocks still take about 290 KB; per-set metric definitions were deduplicated, so measure repeated provenance and long set IDs before a reviewed compact-schema migration and size proof.

## Paid tier (gated)

- Advanced first-program generation: specialize supported families around priorities and constraints, explain trade-offs and produce an executable program; requires the shared engine and allocation rules.
- History-aware next program: recommend resume, repair, rebase or switch from complete or partial history; requires lifecycle semantics and real transition data.
- Bounded within-program adaptation: go beyond Free's shipped Plan 082 weekly-review adaptations; ask why, propose one cause-matched versioned change, require approval and evaluate it.
- Program-aware one-off planning: suggest a disrupted session from recent work, time and equipment without changing the program; requires working Free one-offs.
- Multi-gym intelligence: suggest equipment mappings without merging incomparable machine histories; requires proven persistent equipment-context identity.
- Entitlements: record the provider, Pix/card, expiry, restoration, cancellation, refunds, reconciliation and no-clawback behavior in an ADR before funnel work; requires working Pro capabilities.
- Your profile paywall design: the owner's post-alpha choice; everything stays Free in alpha, and payment, lapse or refusal never changes saved evidence or ring fill.
- Paid beta: offer R$24.90/month and R$179.90/year only after all three Pro jobs and the full commerce lifecycle work; distinguish paid, attempted and research access.

## After paid-beta economics

- Managed Taurifer AI under ADR 0011: contextual, approved proposals with privacy, provider evaluation, allowances and shutdown controls; no account or LLM dependency in core.
- Cross-program dashboards: add comparisons only when multi-program history and renewal evidence show a useful question.
- Multi-block planning: preserve bounded user-approved changes; requires cross-program evidence and demand.
- Optional sync: core training and record ownership stay independent of the server; requires a demonstrated multi-device or durability problem.
- Native shell: retain the tested web core and add native persistence, billing, lifecycle, notifications and links only when retention, monetization or measured PWA limits justify it.
- Creator publishing conveniences, larger pilots and paid acquisition: wait for retention and monetization evidence.

## Later / evidence-only

- Pound display: settle one truthful lb contract for history, targets, increments, `minJump`, parsing and Why; equipment-specific units and a plate calculator wait for observed friction.
- PT default day labels: localize app-authored names or explicitly treat them as user data with PT defaults.
- Swapped-workout headings: keep immutable performed/program titles separate from temporary swap annotations.
- Manual-slot authored load: carry the field through schema, sanitizer, editor, import, setup links and Today/Program/Focus without inventing a load for manual rows.
- Refused setup-link cookie: decide in ADR 0007 whether refusal clears the proposal cookie before changing its behavior.
- Native confirmations: replace remaining destructive/discard `confirm()` calls with the accessible dialog policy while preserving transaction semantics.
- Factory reset: distinguish deleting history, all device data and the installation identifier, with export warnings.
- One-tap +1 rep: test whether faster logging outweighs accidental commits.
- Encrypted export: review passphrase, recovery and failure behavior before implementing client-side encryption.
- More history-import vendors: add only after the Hevy/Strong/CSV foundation sees real switching demand.
- Publisher attribution: version publisher name, handle, description and referral id before creator pilots; provenance never affects recommendations or restyles the app.
- Persistent gym contexts and sibling programs: wait for repeated equipment switching; specify machine identity and comparable history before building.
- Cause-routed interventions beyond weekly review: define evidence, diagnosis, permitted change, cooldown and reassessment only after a new scheduling decision.
- General friction/reason telemetry: closed-enum adoption coverage shipped; broader reason catalogs require a product decision and free text stays outside telemetry.
- Broader program lifecycle: revisit archiving and next-program transitions across authorship only from unmet cases beyond the shipped block lifecycle.
- Existing-user setup links: design non-destructive archive-and-replace before a participant receives a second coach program; retain released payload compatibility.
- Bodyweight and relative-strength trends: add only when enough logged bodyweight answers a real user question; no universal strength score.
- #387 larger-program setup links: use refusal/file-share data to reassess demand; Build/manual programs already have Share as file, so no hosted store is authorized without evidence and a new ADR.
- Managed-import validation: build an independently annotated, consented real-program holdout and measure completion, activation and cost before promoting prompt/configuration changes; keep source text out of telemetry.
- Explain "e1RM" in plain language on Progress without changing the figure or its limits; owner option.
- Larger chart ranges or a global period: reopen only when scoped controls fail real questions.
- Landscape layout and history virtualization: preserve responsive behavior; add dedicated layout or paging only after observed value or measured device limits.
- Web Push and extra reminders: require installed-PWA notification failures that affect retention or safety; backup cues remain separate.
- Executable workout grammar: add supersets, rest, tempo, set kinds, timed/cardio or imported rules only when measured omissions block adoption and the engine can execute them truthfully.
- Contextual guides and further visual changes: require a reproduced accessibility/comprehension problem and current owner-approved design; do not revive old audit batches or change approved modal tips from an old proposal.
- Exercise illustration style, former #296: owner chooses replacement scope, figure, licensed pose sources and thumbnail crop; approve six representative drawings before replacing any of the 96 licensed images.
- Social recruitment, former #282: after alpha opens, decide founder channels and capacity, use real shipped proof in PT-BR posts and recruit one participant at a time; no invented users or claims.

## Engineering

- DraftV2 store model search: generate save, stale-save, removal, fault, quota and reboot commands through production interfaces; turn minimized counterexamples into regressions.
- Durable-state fault hook: inject draft faults through `configureHost`, replacing the undeclared host global and updating the model harness.
- Transfer-client constant drift: verify or add endpoint and size/identifier-limit assertions against the shared contract; the existing parity suite does not prove every duplicated constant.
- Browser-test helpers: share boot, locks, seeding and common assertions without hiding test intent.
- Render/history scans: memoize recommendations per render and picker lookups per log identity, with deterministic row-visit counts and unchanged output.
- Fixed test sleeps: replace waits with observable state, starting with the simulation; preserve every valid assertion.
- Summary-share capture readiness, former #790: `session/summary-share` (phone-390 dark PT) once timed out in `page.waitForFunction` after 20 s during a catalog capture and passed on retry. Keep the full scenario exception so a missed sheet open can be told apart from render or file readiness; no longer timeouts or sleeps.
- Small correctness hardening: reachable dynamic-i18n fallbacks, usual training hour across midnight, and setup URL parsing that fails closed without widening cookie paths.
- Vendored build tooling: refresh the build-time esbuild pin with payload and browser-equivalence evidence; no application dependencies.
- Browser-install caching and split-language catalogs: reopen only from CI cost/time or boot complaints; EN remains the mandatory fallback.
- Generative journeys: expand production-backed onboarding, long histories, skips, overrides, interruptions, transitions and migrations with seeds and minimized failures when scheduled.
- Paused architecture migration, former #447/#448/#467: no automatic resume; remeasure current main and get owner scheduling before native ESM, strict JS checking and named commands; preserve durable/offline/transfer protocols, old-worker upgrades and rollback, port retained suites and validate the assembled release before cutover.
- If architecture migration resumes, recheck its unvalidated restored-suite ports, Program Lab native imports, editor/guide catalog states and migration-only answer-rebuild, superseded-motion and import-copy defects; none is a proven main defect.
