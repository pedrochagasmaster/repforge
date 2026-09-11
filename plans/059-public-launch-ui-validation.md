# Plan 059: Public-launch UI validation

Implementation and review use the [evidence protocol](../docs/agents/implementation-evidence.md)
and this plan's [first proof checkpoint](../docs/agents/ui-overhaul-proof-checkpoints.md).
External Herdr workers additionally follow the [Herdr dispatch procedure](../docs/agents/herdr-ui-overhaul-execution.md)
and the [Herdr worker packets](#herdr-worker-packets) section below. The coordinator fills every packet field and the
live SHAs, thread ID, server origin, and PID before dispatch.

- **Plan number:** 059
- **Phase:** 8 — Public-launch validation
- **Status:** Planned; implementation has not started
- **Owner approval state:** Validation method is approved; final launch sign-off belongs to the owner
- **Depends on:** Plans 049–058, the durable-state bridge, their architecture acceptance deltas, and all existing owner gates. No implementation plan is authorized early by this final verification allocation.
- **Blocks:** Public-launch UI/UX acceptance; it does not authorize release/merge by itself
- **Governing G decisions:** G-01, G-05–G-06, G-59, G-74–G-76, G-83
- **Architecture-audit ownership:** Candidate F final-SHA release/cache verification; Candidate G complete runtime/test-scope closure; R9 final architecture/evidence closure; verification of every owner-ratified PR239 disposition.
- **Governing UI findings:** UI-04, UI-31, and regression evidence for UI-01–UI-32
- **Affected surfaces:** Entire shipped PWA, complete catalog, browser/installed modes, service worker/offline, accessibility, telemetry/privacy/release documentation
- **Complexity:** High
- **Risk:** Critical — this is the final evidence boundary before public launch

## Problem statement

Passing unit/browser tests or reviewing one screenshot cannot prove the overhaul is launch-ready. The current catalog can prove membership and pixels but historically did not measure every component overflow. A capture showing content behind the dock does not prove occlusion; the app must be driven to the actual scroll end. Static/emulated evidence cannot prove VoiceOver/TalkBack behavior, tactile reach, safe areas, installed storage separation, or iOS transfer. Finally, shipped code, catalog, ADRs, privacy claims, telemetry schemas, cache inventory, and plans can drift even when each changed independently.

This phase creates one traceable release-candidate acceptance record. It does not reinterpret audit findings or trigger an autonomous redesign.

## Approved direction

- Regenerate and validate the complete live catalog with risk-based EN/PT-BR, light/dark, compact/standard, 200% text, reduced motion, and demanding PT-BR + 200% evidence.
- Drive every long surface to real scroll end in compact/standard, browser/installed contexts and prove final content clears persistent chrome.
- Exercise critical flows on physical iOS Safari/installed PWA with VoiceOver and Android Chrome/installed PWA with TalkBack.
- Validate focus order/restoration, announcements, selected/disabled/validation states, keyboard, touch targets, text scaling, safe areas, scroll discoverability, reduced motion, and dialog/sheet containment.
- Map executable evidence to all UI-01–UI-32 and G-74/G-75 requirements.
- Freeze only the approved privacy-preserving comprehension/task, installation/transfer, and relevant outcome measurements. Owner interprets them.
- Owner provides final sign-off; do not recruit representative lifters for this gate.

## Preserved strengths

Acceptance explicitly protects Taurifer's identity/palette, token-swap themes, Sans/Mono roles, licensed paper art and empty media, Today → Focus → save → Summary, `Why this weight?`, deterministic generation/progression language, adjacent validation and pain boundaries, explicit activation, local-first architecture with only the approved transfer exception, and the screen catalog as visual truth. A test or late fix that erodes one is a launch failure.

## Non-goals

- No new product direction, visual direction, feature, metric, intervention, or post-Wave-3 roadmap work.
- No representative-lifter usability study or automatic redesign threshold.
- No inference of physical-device success from emulation, simulator, screenshot, or automated accessibility tree alone.
- No broad refactor while validating. Failures return to the owning phase or receive a narrowly scoped, separately proved fix.
- No merge/release without explicit authorization after owner sign-off.

## Current-state audit

- Audit baseline (historical): `fe4bf52c`, 72 manifest screens, 221 PNG frames. Current main `c3491c5e` is **75 screens / 317 frames** with Plans 049/050/051 merged; Plans 052–058 change it further. The candidate SHA and its live counts are pinned by 059-P1, not by any figure in this plan.
- Baseline manifest distribution: 31 `standard`, 26 `localized`, 7 `accessibility`, 8 `customAccessibility`; English 200% exists only in selected states and PT-BR + 200% does not.
- `tools/check-ui-screens.mjs` verifies manifest/registration/dimensions. `tools/compare-ui-screens.mjs` enforces image drift. `test/ui-screens.mjs` checks coverage/mobile semantics. Plan 050 extends this with overflow/key/matrix gates; Plan 058 adds role/contrast inventory.
- `body` already reserves dock/safe-area space, so apparent screenshot overlap is not a defect until real scroll-end reachability fails.
- Browser boot tests use `window.__repforgeBooted`; no-program devices correctly never create a day tab.
- Existing browser suites are strong; the planning-baseline counts (Focus 116, History 40, program entry 287, install modes 348, accessibility 171, session summary 45) are historical — 059-P1 re-measures them on the candidate SHA. Several tests will be replaced because they encode old List/tour/first-run behavior.
- Plan 041's implemented accessibility hardening still lacks complete physical-device evidence; this phase absorbs the outstanding launch evidence rather than claiming it from automation.
- The service-worker shell and the **six** protected script query revisions (`program-compiler.js`, `program-entry.js`, `program-entry-adapter.js`, `shared-setup.js`, `workout-draft.js`, `app.js`) must remain in lockstep at the live revision (`repforge-v188` / `?v=188` on `c3491c5e`), not any documented number.

## Architecture

### Architecture-audit adoption: final architecture and evidence closure

Extend the existing release evidence manifest rather than create another
roadmap or acceptance system. Account for every PR239 A–H candidate (including
both H concerns) and R0–R9 disposition from the owner-ratified architecture table.

1. On the exact final candidate SHA, verify one durable settlement/recovery authority, one DraftV2 store with its accepted session owner, one entry/lifecycle workflow, and one explicitly mounted/disposed gesture owner. No obsolete delegate may conceal a second implementation.
2. Verify earned historical-projection and exercise-vocabulary reuse against actual consumers. An explicit, evidenced decision that generalization was not earned is valid where the governing plan allows it; speculative modules or orphaned findings are not.
3. Verify Plan 058's executable release/cache contract, required/optional runtime policies, offline and old/new-worker behavior, and complete source/privacy/syntax coverage. All extracted runtime code must be in the verified scope.
4. Verify that tests follow the production interfaces, removed scenarios have named equivalent evidence, every executable suite is registered once, unknown executable inputs remain conservative, and the merged PR238 runner remains the only suite scheduler. Diagnostic replay never changes a failed authoritative result to pass.
5. Bind each architecture finding to its owning bridge/plan, implementation or explicitly allowed non-extraction disposition, current consumer, exact-SHA command/artifact and acceptance result. Missing evidence is open/failed/blocked, not inferred from historical green runs.
6. Preserve all existing owner, physical-device, accessibility, staging, privacy and same-SHA gates. Plan 053's accepted old-SHA staging/device evidence establishes its predecessor contract; it is not new-SHA release proof. Route defects to their existing owner and rerun affected plus broad evidence after any source change.

This plan verifies closure; it does not resume later architecture redesign or
weaken thresholds to make the final manifest green.

### Release evidence manifest

Add a versioned, machine-checked release evidence manifest keyed to the exact candidate SHA. It contains:

- live catalog screen/frame counts and manifest hash;
- every UI-01–UI-32 disposition, owning plan, automated checks, catalog states, manual/device cases, result, and evidence path;
- every G-01–G-88 disposition or canonical-document proof, with G-74–G-76/G-83 expanded here;
- test commands, environment/browser/device/OS/app-display mode, date, tester/owner, result, limitations, and artifact hashes;
- owner gate/sign-off status;
- final cross-document/cache/telemetry consistency checks.

No row may be “pass” without a named artifact/command/device observation. Split findings (UI-14/UI-19/UI-25/UI-29) name both owners and the one final acceptance result.

### Catalog acceptance matrix

At the live post-Plan-058 manifest:

- every screen: canonical-phone English light/dark and PT-BR light at normal text, production-backed semantic evidence, rendered-copy, document/component overflow;
- every long or interaction-dense screen: 320px and canonical 390px, plus actual scroll-end test;
- every text/control-dense screen: English 200%; the declared demanding set also PT-BR + 200%;
- motion-bearing screen: reduced-motion variant and behavior assertion;
- install/transfer/workout/persistent-chrome screens: browser and installed-mode state where automation can represent it;
- owner-selected spot checks: PT-BR dark where theme/localization composition risk exists.

This is risk-based, not the complete Cartesian product. The manifest/checker must fail if a screen lacks its role-required variants. Every image is generated by `node tools/capture-ui-screens.mjs`; no hand edits.

### Semantic evidence

Each catalog scenario records stable facts besides pixels: visible surface/heading, route/context, enabled/disabled/selected/expanded states, user-state fingerprint (non-sensitive fixture ID), focus target, live-region result where applicable, progress dimension/scope, theme/locale/text/motion, and intentional-scroller markers. This catches a visually plausible screenshot of the wrong state.

### Scroll-clearance driver

For each long tab/page/sheet:

1. enter through the real user route with deterministic fixtures;
2. scroll using wheel/touch/keyboard-compatible behavior until `scrollTop` stabilizes at the actual maximum;
3. locate the final meaningful content and final focusable action;
4. assert their bounding boxes can move fully above the persistent dock/action layer plus safe-area inset and are not clipped by an inner scroller;
5. tab/focus to the final action and assert `scrollIntoView` does not leave it obscured;
6. assert a user can perceive overflow/continuation before reaching the end.

Cover landing/chooser and all long entry routes; Today; workout Session/Exercise sheets; Progress Overview/Review/Evidence/drill-ins; History calendar/read/edit; library list/detail; Program overview/editor/pickers/Share; Settings/Privacy/guides/install transfer; dialogs/sheets. Run compact and standard phone widths, browser, and installed-mode emulation where applicable. Physical cases repeat critical safe-area surfaces.

### Failure routing

A failed acceptance row is assigned to the plan/module that owns the contract. Reopen that PR or create a narrowly named fix PR based on current main; record the failure and retest. Phase 059 may change test/evidence tooling and make trivial fixture/metadata corrections, but it must not hide a failure by weakening thresholds/allowlists or redesign a surface. The candidate SHA changes after any fix, invalidating and rerunning affected plus broad evidence.

## Domain/state model

No user-domain migration. The evidence manifest has closed result states: `not-run`, `pass`, `fail`, `blocked-owner`, `not-applicable-with-reason`. Physical-device observations are tied to candidate SHA and exact mode. Automated reruns invalidate stale evidence when relevant source/manifest hashes change.

## Migrations

No user-data migration. If final consistency reveals schema/doc/cache drift, return it to the owner plan. Test fixtures may migrate to post-overhaul route/state IDs. Preserve historical baseline artifacts separately; replace the public current catalog only via generator. Remove obsolete test cases only when the evidence manifest points to their replacement.

## UX state specification

Acceptance covers every meaningful state specified in Plans 050–058, including:

- empty/loading/valid/invalid/offline/error/retry/success;
- candidate versus activated; preview versus started; active draft versus saved session;
- selected/expanded/disabled-with-reason/validation;
- read/edit/dirty/conflict/delete confirmation;
- baseline/improved/maintained/declined and recommendation actions;
- active/final Review, every transition preview/confirmation/stale/failure;
- install eligible/cooldown/transfer/claim/recovery/divergence;
- light/dark, EN/PT, text scale, reduced motion, browser/standalone.

Missing catalog coverage for a reachable primary state is a failure, not an excuse to mark it untested.

## Accessibility

### Automated/browser

- headings/landmarks and focus order;
- focus restoration after route, sheet, dialog, Share repair, History edit/cancel, workout action, and transition preview;
- live announcements for persistence, set state, timer milestones without spam, validation, stale/conflict, transfer and transition outcomes;
- selected/expanded/pressed/switch/tab states and disabled reason relationships;
- keyboard operation including reorder alternatives, scrollers, native date/input controls, dialogs/sheets;
- ≥44×44 CSS px touch targets; 200% text and 320px without loss/two-dimensional content scrolling;
- safe-area/persistent-chrome/scroll discoverability;
- reduced motion with all information retained;
- modal containment, background inertness, Escape/back behavior, and nested-sheet prevention;
- Plan 058 rendered-role WCAG 2.2 AA results.

### Physical assistive technology

On iOS use VoiceOver in Safari and the installed PWA. On Android use TalkBack in Chrome and the installed PWA. Record observed announcement/control order, rotor/navigation behavior where relevant, keyboard if attached/available, touch exploration, focus after sheets/routes, and whether each critical action is possible without sight. Device evidence includes limitations and never reports “passed” from a simulator.

## Localization

Review all catalog text for raw keys/identifiers, grammar-complete EN/PT, wrapping, data-versus-translation distinction, locale dates, pluralization, units, and accessible names. Validate generated i18n check. A PT-BR screen carrying shared/user-authored English program/exercise data is not automatically a failure; Taurifer-authored untranslated keys/copy are.

## Responsive behavior

The executable matrix includes 320px, canonical 390×844, 430px, applicable desktop, 200% text, and demanding PT-BR + 200%. Physical phones record actual viewport/safe-area/text scaling. Desktop is validated where routes are accessible even though the catalog remains mobile-only. No acceptance threshold is relaxed because a screenshot “looks okay.”

## Light/dark

Every screen has automated English light/dark evidence; risk-selected PT dark is reviewed. Verify theme pre-paint/no flash, native control color scheme, token-only layout equivalence, art paper backgrounds, intentional empty tiles, and rendered-role contrast. Do not treat dark paper art as a defect.

## Offline/PWA

Validate fresh online install, fully offline reload, service-worker upgrade from the last public cache, cache inventory/script revision lockstep, browser/standalone detection, no-program boot, active draft upgrade, Privacy caching, all local critical flows, setup-link handoff, and Plan 053 transfer's explicitly online states. Test install does not gate ordinary offline/browser use. Inspect `ASSETS`/`SHELL` as canonical inventory.

## Failure and recovery

Run the full adversarial matrix inherited from foundations: draft crash/retry/stale/two-tab/removal; transition stale/duplicate/archive crash; transfer create/claim/import/delete/expiry/duplicate/divergence; History stale edit/delete; Share repair stale/invalid; service-worker mixed-version; offline/quota where supported. Every failure preserves the last complete user state and has a recoverable visible outcome. Record exact fault injection and seed.

## Privacy

Use deterministic synthetic data on shared artifacts/devices. Do not record tokens, cookies, payload URLs, workout notes, real bodyweight/history, readiness answers, device identifiers, or telemetry IDs. Verify user-facing claims against actual network/storage behavior: local state, setup fragment/cookie, temporary transfer processing/deletion, telemetry consent, and browser recovery snapshot. Inspect network/log/telemetry output for prohibited fields.

## Telemetry freeze

Create one allowlist/schema document and executable payload test for the events already approved/implemented by prior plans. Allowed categories are:

- comprehension/task funnels: landing → chooser → route → candidate → activation; guide shown/dismissed/completed;
- installation: offer context/milestone and coarse outcome;
- `late_install_transfer`: success under preserved identity/consent, browser → standalone context;
- relevant task outcomes: workout start/leave/save; Progress action/transition preview/confirm/cancel; History edit outcome; Share repair/share outcome, all coarse.

Allowed common properties are event schema version, coarse platform/display context, locale, plan-defined step/outcome code, and non-content experiment/config ID if already approved. Prohibit program/exercise IDs or names, sets/loads/reps/RIR/bodyweight, notes, readiness answers, exact dates, transfer/setup token/payload/URL, exact payload size, archive/draft contents, and cross-device identifiers beyond the existing pseudonymous installation ID. Consent-off emits nothing. No metric has an automatic decision threshold; owner reviews post-launch evidence.

## Testing and executable evidence

The release evidence manifest must include the complete PR239 disposition
matrix and the final architecture checks above, with explicit pass/fail/open
or allowed non-extraction evidence. Reconcile it with the UI/G decisions and
existing physical-device/owner gates on one immutable candidate SHA.

### Finding regression map

| Findings | Required final evidence |
|---|---|
| UI-01–UI-07 | Rendered-copy/generation/geometry/overflow/disabled-state checks in both languages and demanded variants |
| UI-08–UI-12, UI-29 chart | Mobile evidence navigation/rows, exact scopes/periods, 0/1/2/3+ evidence, outcome/action/date semantics, transition safety |
| UI-13–UI-19, UI-23–UI-28, UI-32 | Production-backed management/landing/install/Focus/Today/summary/Program/Settings/timer flows plus catalog/device evidence |
| UI-20–UI-22, UI-30 | Complete role inventory, literal/nesting checks, actual rendered-role contrast in every state/theme |
| UI-04 | Risk matrix membership plus document/component overflow for every manifest state |
| UI-31 | Actual scroll-end and physical assistive-technology evidence, not screenshot inference |

### Critical physical journeys

On each applicable platform/context:

1. generic first run → chooser → Recommend candidate/edit/activate; one alternative entry route;
2. valid shared link → adaptive landing → no persistence before Start → activation; iOS install handoff;
3. established iOS data → explicit transfer → installed claim/import → Safari recovery snapshot/divergence warning;
4. Today Preview (no draft) → Start Focus → edit/complete/correct → exercise actions/session sheet → Leave/resume → save → centered summary → History/Progress;
5. Progress fresh baseline, sparse Evidence, active Review, end-block diagnosis/preview/cancel and one safe confirmed transition in disposable fixture state;
6. History read/edit Cancel/Save/delete confirmation; Share blocked repair → ready share;
7. Program readiness/editor dock; Settings Privacy/guide replay/install/backup entry.

Repeat the accessibility-critical portions with VoiceOver/TalkBack. Owner signs the evidence manifest.

### Commands

Run, at minimum, current equivalents of:

- `git diff --check`
- `node tools/build-i18n.mjs --check`
- `node tools/extract-ui-audit-findings.mjs --check`
- `node tools/check-ui-screens.mjs`
- `node tools/compare-ui-screens.mjs`
- Plan 050/058 copy, overflow, matrix, role, and contrast checks
- `node test/generative/run.mjs --profile ci`
- complete browser suite from the pinned `test/` environment
- static service-worker/cache inventory/revision gate

Record exact commands/results/SHA; do not substitute a proxy check for a real critical flow.

## Screen catalog changes

- **New states:** only states proven reachable but missing from the live manifest; each is routed back to its owning phase and added with scenario/README evidence.
- **Removed states:** stale/obsolete states whose routes were removed by prior plans; removal must have replacement/disposition evidence.
- **Changed states:** complete catalog regenerated against exact release-candidate SHA.
- **Matrix expansion:** final risk-based axes above, semantic/overflow/role evidence, installed/browser states where automatable. Record exact final screen/frame count and delta from both audit baseline (72/221) and pre-Phase-059 main.

## Owner gates

1. Owner conducts/reviews physical iOS Safari + installed PWA + VoiceOver evidence.
2. Owner conducts/reviews physical Android Chrome + installed PWA + TalkBack evidence.
3. Owner reviews the complete catalog, unresolved limitations, telemetry allowlist/privacy network inspection, and final consistency manifest.
4. Owner explicitly signs launch acceptance. Do not recruit representative lifters and do not merge/release on inferred consent.

## STOP conditions

- Stop on any failed UI finding/G decision, physical-device gap, inaccessible critical action, unresolved overflow/scroll occlusion, privacy mismatch, cache/schema drift, or open owner gate.
- Stop if evidence was produced against different SHAs without invalidation.
- Stop if a proposed “fix” weakens a test/allowlist, reopens settled direction, or expands product scope.
- Stop if transfer/log/telemetry inspection reveals sensitive content.
- Stop before merge/release without explicit owner authorization.

## Rollback

Phase 059 is a release hold: a failed candidate is not promoted. Test/evidence changes are independently revertible; product failures return to owner phases through new stable commits. If a late fix lands, invalidate affected evidence and repeat broad/physical cases as dictated by blast radius. Service/install transfer can be kill-switched without blocking ordinary local PWA use. Preserve all new state parsers during rollback; never deploy an older incompatible shell.

## Atomic commit sequence

| # | Exact commit message | Contract delivered | Likely files | Prerequisite | Focused proof | Broader regression | Catalog impact | PR-body update | Rollback boundary |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `test(launch): add UI overhaul evidence manifest` | SHA-bound UI/G traceability, stale-evidence invalidation, owner/device fields | release evidence manifest/checker/docs | Plans 049–058 merged | Seed duplicate/missing/stale rows then pass | Audit/path checks | None | Record candidate SHA/open rows | Evidence tooling only |
| 2 | `test(launch): enforce final catalog and scroll matrix` | Live risk variants, semantic facts, every-state overflow, long-surface real scroll-end | catalog manifest/helpers/tests/scenarios | Commit 1 | Compact/standard/browser/installed scroll cases | Catalog capture/check/compare | Matrix/state corrections and full regeneration | Record exact counts/delta | Revert checker only if wrong; route product failures back |
| 3 | `test(launch): exercise browser accessibility acceptance` | Focus/order/restoration/announcements/states/keyboard/targets/scaling/safe areas/reduced motion/dialog containment | accessibility/critical-flow tests | Commit 2 | Named per-requirement journeys | Complete browser/generative suites | Semantic evidence may change | Fill automated rows/results | Tests only; never weaken to pass |
| 4 | `test(privacy): freeze launch telemetry allowlist` | Event/property/consent/context redaction and actual network/log inspection | telemetry schema/tests/privacy evidence | Commit 1 | Allowed/forbidden payload and consent-off tests | Install/transfer/task suites | None | Record schema/hash and limitations | Revert new unapproved events, not privacy tests |
| 5 | `docs(launch): record physical iOS and Android acceptance` | Safari/PWA/VoiceOver and Chrome/PWA/TalkBack critical journeys, safe-area/scroll evidence | SHA-bound device evidence/artifact hashes | Commits 2–4; exact RC deployed | Owner checklist with device/OS/mode results | Rerun affected automation immediately before devices | No hand-edited catalog | Mark pass/fail/blocked-owner honestly | Evidence invalidates on relevant SHA change |
| 6 | `docs(launch): reconcile final UI release evidence` | Shipped UI/catalog/audit/inventory/backlog/ADRs/plans/brand/telemetry/tests/SW/privacy agreement | evidence manifest and assigned current docs if Phase 049 left drift | Commits 1–5 and all fixes merged | Consistency/path/cache/disposition checks | Full commands listed above | Final catalog hash/count | Fill completion/sign-off/limitations | Revert release declaration; retain evidence |
| 7 | `chore(launch): present UI overhaul for owner sign-off` | Clean remote boundary with no open threads/STOP conditions; no merge | PR body/evidence only | Commit 6 | `git status --short`, remote SHA and owner gate audit | Latest full regression references same SHA | Final artifacts linked | Complete Handoff and exact release action | Withdraw candidate; do not rewrite history |

For every row: mark 🟡; execute only that slice; run focused proof; inspect all changes/artifacts; eliminate unrelated data; commit; push immediately; update the PR immediately. A failed row remains ⛔ with exact next steps rather than a local workaround.

## Herdr worker packets

The atomic commit sequence above is the delivery contract. Each row is dispatched as one or more self-contained packets
per the [Herdr dispatch procedure](../docs/agents/herdr-ui-overhaul-execution.md); the coordinator fills every template
field before dispatch. This phase is an evidence hold, not a build — packets add tooling and record results, and any
product failure is routed back to its owning plan on a fresh commit.

Rules for every packet in this plan:

- **Manifest and immutable candidate first.** 059-P1 pins the candidate SHA and the SHA-bound evidence manifest, and
  **predeclares** every automation helper the later packets need (scroll-clearance driver, semantic-evidence recorder,
  telemetry payload test) as PLANNED manifest rows with an owning packet — no helper appears without a prior
  declaration.
- **Physical-device evidence is human-only.** 059-P5's iOS Safari/PWA/VoiceOver and Android Chrome/PWA/TalkBack rows
  are never satisfied by a simulator, emulator, screenshot, or automated accessibility tree; the owner records them
  against the exact candidate SHA and mode.
- **Route product bugs out.** A failed acceptance row is assigned to the plan/module that owns the contract and fixed
  in that plan's PR or a narrowly named fix PR; 059 may only correct its own tooling/fixtures/metadata and must not
  weaken a threshold or allowlist to pass.
- **Receipt edits do not re-run everything.** A docs-only manifest receipt update does not trigger a full suite; but
  the final candidate must still pass the complete same-candidate gates in 059-P6/P7 before sign-off.
- **Anchors are concrete.** Existing: `tools/check-ui-screens.mjs`, `tools/compare-ui-screens.mjs`,
  `tools/capture-ui-screens.mjs` (`--flow`/`--screen`/`--canonical`), `test/ui-screens.mjs`,
  `test/ui-catalog-contract.mjs`, `test/accessibility.mjs` (`--touch-targets-320`), `test/telemetry-leakage.mjs`,
  `test/generative/run.mjs --profile ci`, `window.__repforgeBooted`, `sw.js` `ASSETS`/`SHELL`. **NEW** (this plan):
  the release evidence manifest + checker, the scroll-clearance driver, the semantic-evidence recorder, the telemetry
  allowlist schema + payload test.
- **Every packet carries a deliberate failing case** and a STOP boundary.

### Row → packet map

| Packet | Maps rows | Bounded objective · mode | Existing anchors (main unless NEW) | Proof-first: PLANNED assertion + independent oracle + deliberate failure | Commands: baseline now → planned | STOP · reviewer gate |
|---|---|---|---|---|---|---|
| 059-P1 | 1 | Pin the candidate SHA; build the SHA-bound evidence manifest + checker with UI-01–UI-32 / G-01–G-88 rows, closed result states, and predeclared PLANNED automation helpers · **build (tooling only)** | governing docs; NEW release evidence manifest + checker | seed a duplicate, a missing, and a stale-SHA row and prove the checker rejects each; no row is `pass` without a named artifact/command/observation (oracle = the manifest schema). Failure: evidence recorded against two SHAs with no invalidation | baseline: `git diff --check` → planned: `node tools/check-release-evidence.mjs` (NEW) | STOP if a helper is used before it is declared, or a `pass` lacks an artifact · reviewer: coordinator records candidate SHA + open rows in the PR |
| 059-P2 | 2 | Final catalog + scroll-clearance matrix: live risk variants, semantic facts, per-state overflow, and a real scroll-end driver for every long surface in compact/standard, browser/installed · **build** | `tools/capture-ui-screens.mjs`, `tools/check-ui-screens.mjs`, `tools/compare-ui-screens.mjs`, `test/ui-screens.mjs`; NEW scroll-clearance driver (declared in 059-P1) | driver enters each long route with deterministic fixtures, scrolls to `scrollTop` max, and asserts the final content + final focusable action clear the persistent dock + safe-area inset and are not clipped by an inner scroller. Failure: occlusion inferred from a screenshot instead of a driven scroll-end | baseline: `node tools/check-ui-screens.mjs && node tools/compare-ui-screens.mjs` → planned: `node tools/capture-ui-screens.mjs` (full) + `node test/scroll-clearance.mjs` (NEW) | STOP if a screen lacks a role-required variant or a driver cannot reach true scroll end · reviewer: reproduces one long-surface clearance |
| 059-P3 | 3 | Browser accessibility acceptance: focus order/restoration, announcements, selected/disabled/validation states, keyboard, targets, scaling, safe areas, reduced motion, dialog containment · **build** | `test/accessibility.mjs`, critical-flow suites, `window.__repforgeBooted` | one named journey per requirement (focus restoration after Share repair, History edit/cancel, transition preview, etc.); each asserts a semantic-tree fact, not a pixel. Failure: a threshold weakened so a failing journey "passes" | baseline: `node test/accessibility.mjs --touch-targets-320` → planned: `node test/launch-accessibility.mjs` (NEW) | STOP if any critical action is not operable without sight in-browser (physical AT is 059-P5) · reviewer: reproduces two per-requirement journeys |
| 059-P4 | 4 | Freeze the launch telemetry allowlist: one schema doc + executable payload test over already-approved events; actual network/log inspection · **build** | `test/telemetry-leakage.mjs`, `telemetry.js` (`installationId`, consent keys); NEW allowlist schema + payload test | allowed events/properties pass; a forbidden property (program/exercise ID, loads/reps, notes, dates, token, exact size) fails; consent-off emits nothing (oracle = the allowlist doc). Failure: an unapproved event slips through | baseline: `node test/telemetry-leakage.mjs` → planned: `node test/launch-telemetry.mjs` (NEW) | STOP if inspection reveals sensitive content or a non-allowlisted event · reviewer: reproduces the consent-off silence and one forbidden-property rejection |
| 059-P5 | 5 | Record physical iOS Safari/PWA/VoiceOver and Android Chrome/PWA/TalkBack critical journeys + safe-area/scroll evidence against the deployed candidate · **human evidence only** | deployed RC; owner devices; SHA-bound evidence rows | owner checklist with device/OS/app-display-mode/date/result/limitations per journey; automation in 059-P2/P3 is re-run immediately before the device session. Failure: a row marked `pass` from a simulator or automated tree alone | baseline: `node test/generative/run.mjs --profile ci` (pre-device automation gate) → planned: SHA-bound device evidence file (NEW) | STOP if physical evidence is claimed from emulation, or the candidate SHA changed after a device run without invalidation · reviewer + owner: signed device evidence |
| 059-P6 | 6 | Reconcile shipped UI, catalog, audit, source inventory, backlog, ADRs, plans, brand guide, telemetry schema, tests, SW/cache inventory, and privacy claims to one candidate · **build (docs + consistency checks)** | `sw.js` `ASSETS`/`SHELL`, governing docs; evidence manifest | consistency/path/cache/disposition checks pass; every UI-01–UI-32 and G-01–G-88 row has a current SHA-bound disposition; a docs-only receipt edit does not trigger a full suite, but a source fix invalidates and re-runs affected + broad evidence. Failure: a stale cache revision or an embedded example that drifted from its fixture | baseline: `node tools/build-i18n.mjs --check` → planned: `node tools/check-release-evidence.mjs --reconcile` (NEW) | STOP on any cross-document/cache/schema drift — route product drift to the owning plan · reviewer: full command list run against the same candidate |
| 059-P7 | 7 | Present the candidate for owner sign-off: clean remote boundary, no open threads or STOP conditions, no merge · **plan** | PR body/evidence; remote SHA | `git status --short` clean; remote head == candidate SHA; every owner gate audited; latest full regression references the same SHA. Failure: presenting with an open ⛔ row or a regression run on a different SHA | baseline: `node test/generative/run.mjs --profile ci` → planned: same, referenced by SHA in the manifest | STOP before any merge/release without explicit owner authorization · reviewer + owner: owner signs the evidence manifest |

## Implementation-agent operating protocol

### Branch/worktree contract

- **Branch:** `ui-overhaul/059-launch-validation`
- **Worktree:** `../repforge-ui-059-validation`
- **Base:** current `origin/main`
- **Dependency gate:** Plans 049–058 merged and all earlier owner gates closed
- **Primary files:** launch evidence/checker, catalog test matrix/scenarios/PNGs, accessibility/telemetry privacy tests, final consistency documentation
- **Shared hotspots:** catalog manifest/artifacts, test helpers, telemetry schema, SW/cache inventory, every governing doc; production code changes route to owning fix PR
- **Conflicting phases:** none may continue changing public surfaces during a candidate run; any fix creates a new candidate SHA and invalidates evidence
- **Safe parallelism:** Automated catalog, accessibility, and privacy checks can run in parallel against the exact same immutable SHA; physical device runs start after automation passes. One coordinator owns the evidence manifest
- **Integration order:** all implementation plans → 059 automation → physical devices → owner sign-off; no release before it

Fetch/inspect main, branches, worktrees, and PRs; resume existing Plan 059 work. Use one coordination/evidence worktree and immutable candidate SHA; never copy uncommitted files or delete another worktree/branch. Push `chore(plan-059): start implementation`, open a draft PR, and populate it before validation work. Target main. When any fix merges, fetch and explicitly merge `origin/main`, invalidate affected evidence, rerun, push, and update the PR. Never rebase published history.

### Required implementation PR body

```markdown
## Objective
## Scope boundary
### In this PR
### Explicitly out of scope
## Dependencies
- Depends on:
- Blocks:
- Required main state:
- Current dependency status:
## Planned commit sequence
| # | Status | Atomic commit | SHA | Focused verification |
|---|---|---|---|---|
<!-- ⬜ planned; 🟡 in progress; ✅ pushed and verified; ⛔ blocked; ↪ changed -->
## Current state
- Current slice:
- Last pushed SHA:
- Worktree:
- Worktree clean:
- Relationship to main:
- Active blocker:
- Owner decision required:
- Completion-gate status:
## Completed work
## Verification evidence
| Check | Result | SHA |
|---|---|---|
## Risks and decisions
### Confirmed decisions
### Assumptions
### Newly discovered risks
### Outstanding owner decisions
## Next exact steps
1.
2.
3.
## Future plan steps
## Handoff
- Branch:
- Worktree:
- PR:
- Base:
- Current main SHA:
- Last known-good SHA:
- Latest focused tests:
- Latest full regression:
- Latest catalog evidence:
- Latest physical-device evidence:
- Files owned:
- Shared hotspots:
- Blocked on:
- Owner approval required:
- Exact next action:
- Last updated:
```

### Push, history, and handoff discipline

Push each coherent evidence slice and update status/results/next steps immediately. Published SHAs are stable: no amend, rebase, force-push, silent rewrite, or stash handoff. Never checkpoint a knowingly false “pass”; failed work stays ⛔ at the last good remote boundary. Do not duplicate/fix prerequisite code in this worktree or use unpublished copies. Assume interruption after every call: preserve exact SHA, commands, artifacts, device state, limitations, owner decisions, and next action in the PR. Before stopping, run `git status --short`; valid handoff is clean. Do not merge or release without explicit authorization.

## Completion gate

- Every UI-01–UI-32 finding and G-01–G-88 decision has a current, SHA-bound disposition/evidence result; no rejected source-audit claim was reintroduced.
- Complete catalog is regenerated; exact screen/frame delta is recorded; manifest/semantic/copy/overflow/role/contrast checks pass across the approved risk matrix.
- Every long surface clears persistent chrome at actual scroll end in compact/standard and applicable browser/installed modes.
- Critical flows pass in physical iOS Safari/PWA/VoiceOver and Android Chrome/PWA/TalkBack; all listed accessibility requirements pass.
- Full browser, generative, cache/SW, offline/upgrade, transfer, draft, transition, destructive/share, localization/theme/text/reduced-motion suites pass against the same candidate.
- Telemetry allowlist/privacy claims match actual network/storage behavior; consent-off is silent and no sensitive property appears.
- Shipped UI, catalog, audit, source inventory, backlog, ADRs, plans, brand guide, telemetry schema, tests, service-worker inventory, and privacy claims agree.
- Owner signs final acceptance, limitations are documented, branch/PR are pushed/current/clean, no STOP condition or review thread remains, and no merge/release occurs without explicit authorization.
