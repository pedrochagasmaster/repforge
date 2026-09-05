# Plan 054: Landing and program entry

Implementation and review use the [evidence protocol](../docs/agents/implementation-evidence.md)
and this plan's [first proof checkpoint](../docs/agents/ui-overhaul-proof-checkpoints.md).

- **Plan number:** 054
- **Phase:** 3 — Landing and program entry
- **Status:** Planned; implementation has not started
- **Owner approval state:** Product flow is approved; landing mini-interface direction requires owner selection before visual implementation
- **Depends on:** Plan 049; Plan 050; Plan 053 for the established-data iOS transfer slice (and transitively Plan 051)
- **Blocks:** Relevant Plan 057 Settings/Privacy integration, Plan 058 full-system migration, and Plan 059 launch validation
- **Governing G decisions:** G-09–G-10, G-17–G-21, G-25–G-26, G-37, G-39–G-40, G-46–G-52, G-62, G-69, G-72–G-73, G-79, G-81–G-82
- **Governing UI findings:** UI-14 (Privacy-page ownership), UI-15, UI-16, UI-17, UI-19, UI-32
- **Affected surfaces:** First-run landing, valid shared-link landing, entry chooser, Recommend/Custom/Browse/Build/Import paths, recommendation preview, install promotion, contextual guidance, Privacy page
- **Complexity:** Very high
- **Risk:** High — activation/privacy boundaries and an explicit visual owner gate

## Problem statement

The current first-run gate leads with Milo and the full ethos passage, explains little about the program → logging → next-target loop, and delays its action. Entry has the right five jobs but weak hierarchy; recommendation result and editable preview are separate; expert controls fail under dense/enlarged content; Browse does not lead with decision facts. Installation and a global modal tour are timed by generic first-run behavior rather than platform/value/context. Privacy prose sits in Share instead of a cached page.

This phase redesigns those flows while preserving candidate-draft and explicit activation boundaries. It does not choose the landing preview visual: the implementation PR must generate faithful alternatives and stop for the owner.

## Approved direction

- First proposition: **Get the right program. Know what to do next.** Explain that Taurifer builds or runs a strength program, tracks completed work, and converts it to next-session targets.
- Put **Start training** early; it opens the five-job chooser.
- Keep one short approved ethos line; remove the full passage.
- Replace Milo with an owner-selected, product-led program → logged set → next target mini-interface using normal Taurifer tokens/components.
- A valid shared link gets an adaptive landing naming the program and leading with **Start this program**, bypassing the chooser and persisting no proposal field before confirmation.
- The generic landing appears once; later no-program visits enter Today/Program no-program states.
- Keep all five jobs. Recommend leads; Custom is the deliberate generated alternative; Browse is separate; Build/Import group as **Bring or build my own**.
- Merge recommendation result and editable preview. Show a real close alternative only when one exists.
- Keep all expert choices visible; make muscle rows labelled 2×2 groups.
- Browse leads with frequency, duration, equipment fit, and progression model.
- Promote install before ordinary local data on iOS, after first value on Chromium, at approved later milestones, and always from Settings. Keep it non-blocking.
- Replace the global tour with dismissible action-linked cues and replayable guides.
- Provide a cached in-app Privacy page linked from landing and Settings; Share stays task-only.

## Preserved strengths

Preserve Taurifer's name/voice, warm paper/ink/burnt-orange system, token-swap dark theme and Sans/Mono roles; all five entry jobs; deterministic compiler language; adjacent validation and pain boundaries; explicit activation; licensed paper art/intentional empty media; local-first behavior and setup-link privacy boundary; and the catalog as the visual reference. The landing may explain the product more clearly without becoming a separate brand world.

## Non-goals

- No creator avatar/name/trust claims, publisher attribution, or authenticity system (G-82 deferred).
- No merging Recommend and Custom, hiding expert controls, or inventing a sixth entry job.
- No separate landing visual language, new exercise art, or dark treatment of licensed paper art.
- No account/sync/general backend beyond Plan 053's transfer.
- No Focus UI, Progress, management, or global design-system migration.
- No change to setup-link encoding, allowlist, hard length limit, cookie name, or first-run confirmation rule.

## Current-state audit

- `index.html` contains the first-run gate, onboarding shell, entry controls, install surfaces, tour, and Share/Privacy content. `app.js` renders/routes all entry jobs and install/tour behavior.
- `program-entry.js` owns answer state, routes, validation, and candidate semantics; `program-entry-adapter.js` bridges compiler/editor/import/browse candidates; `program-compiler.js` provides deterministic compiler provenance; `program-editor.js` owns editable program state.
- `ProgramEntryAdapter.compile()` currently reports `alternative: null`; the redesign must not fabricate one.
- Plan 048 established an in-memory candidate followed by explicit activation through the existing program replacement transaction. Shared setup already refuses to persist payload fields until **Start this program** and rejects activation on an established device/history.
- No-program Today/Program states and `hasProgramContent()` already support abandoned first run. The current gate needs a device-only “landing seen” preference rather than a fallback program.
- UI prefs in `repforge_ui_v1` already hold theme, install dismissal, tour completion, and surface preferences. Phase 0 makes the new keys canonical.
- Install promotion currently uses a generic banner/card and seven-day dismissal. Existing setup-cookie handoff is distinct from Plan 053 late transfer.
- The tour is a global modal/scripted sequence and current tests intentionally drive List/Focus steps. Those tests become obsolete as contextual cues replace it.
- The current Privacy/settings capture is a section, while Share includes disclosure/cookie prose. The service worker already caches the shell and must cache the routed page content.

## Architecture

### Landing routing and one-time state

Resolve entry intent before ordinary app navigation:

1. If a valid in-memory/cookie-recovered shared setup proposal exists and the established-device gate permits it, render the adaptive shared landing. Do not write proposal fields.
2. Else, if no program/content/history exists and `uiPrefs.entryLandingSeen !== true`, render the generic landing and persist only that device-local UI preference after the landing has rendered successfully.
3. Else boot the app; Today and Program show their existing no-program setup actions.

The setup actions always open the chooser. A shared landing's Start action goes directly to the existing confirmation/activation path; it never opens the chooser. An invalid/ineligible shared proposal uses existing fail-closed messaging and does not fall through to an apparently trusted program.

`entryLandingSeen` is not exported, setup-shared, or treated as program state. It is part of Plan 053's exact device-preference clone. Add a Settings action to replay contextual guides, not the generic marketing landing.

### Mandatory visual approval gate

Before production markup/CSS settles the mini-interface:

1. Use the `imagegen` skill to create at least three preview-only directions showing the same truthful loop: a recognizable program prescription, one completed/logged set, and the derived next-session target.
2. Base prompts on current warm paper/ink/burnt-orange tokens, Plex Sans/Mono roles, normal control/radius/elevation roles, and actual compact mobile components. Do not add illustration motifs, dashboards, fake AI, streaks, social proof, invented metrics, or unlicensed exercise art.
3. Present all directions at the same phone size with the same copy/content, label them A/B/C, and state what layout—not product meaning—differs.
4. Store preview-only outputs outside production assets or attach them to the draft PR. Record prompt/version/hash and accessibility caveats.
5. **STOP.** The owner selects one. Record the selection in the PR and a repository design note. Only the selected direction may be converted into production markup or a catalog/reference asset; delete/exclude unselected directions from production.

This gate is mandatory even if an implementer prefers one direction. It does not permit the owner-approved proposition/flow to change.

### Entry routes and candidate contract

Keep `program-entry.js` as the route/state authority and the adapter/compiler/editor seams from Plans 047/048.

- Chooser expresses one primary Recommend card; Custom as generated alternative; Browse separately; a subordinate disclosure groups Build and Import.
- Recommend and Custom keep distinct questions/provenance.
- Recommend output is one `ProgramCandidate` view model containing primary candidate, optional compiler-supplied close alternative, rationale reason codes/facts, editable draft, validation, and activation status.
- “Close alternative” requires an explicit compatible compiler candidate and reason; `null` renders nothing. Never derive one by arbitrary set/day mutation.
- Candidate edits remain candidate-scoped. Activation alone calls the existing atomic replacement/first-program commit.
- Explicit activation exists on Recommend, Custom, Browse preview, Build, Import, and shared-link routes. Existing-program replacement confirmation remains.

### Expert controls and Browse summaries

Muscle priorities render one hairline-separated muscle row with an accessible label and four choices in a responsive 2×2 group. All advanced choices remain visible. Duration/frequency/equipment choices reflow under the Phase 050 enlarged-text components.

Each Browse row receives compiler/curation-derived summary fields for frequency, duration, equipment fit, and progression model. Unknown facts display an honest unavailable label or omit the fact per spec; do not infer from names. Detailed days/exercises/prescriptions remain behind preview/disclosure before activation.

### Install policy state machine

Centralize install eligibility/cadence in a pure policy function over context, install capability, display mode, local-value milestones, and UI prefs:

- iOS with no ordinary data: offer on the landing before program creation, preserving setup-proposal handoff;
- iOS with meaningful data: offer Plan 053's explicit install-and-transfer path;
- Chromium: first automatic offer only after the first saved workout/value milestone;
- if declined: offer again after the third saved workout, then no more than monthly;
- Settings action is always available when installation is meaningful/supported and ignores automatic-prompt cooldown;
- never block browser use and never loop on every launch.

Store last-offered milestone/time and dismissed milestone in UI prefs; use server-independent local time defensively against clock reversal. Native `beforeinstallprompt` availability is an input, not the product state. In unsupported/already-installed contexts, show correct explanatory state rather than a dead action.

### Contextual guide registry

Replace `tourDone`/global modal behavior with versioned guide state in UI prefs. Each guide has an ID/version, anchor action, eligibility, status (`unseen`, `shown`, `dismissed`, `completed`), and replay override. Initial coverage is first set, Focus utilities, Progress interpretation, block transition, backup, and installation. This plan wires entry/install/privacy-guide infrastructure and removes the global tour; Plans 055–057 place task-specific anchors.

Performing the anchored action completes the cue. Dismiss suppresses it. Settings replay clears only the chosen guide's presentation state, not user data. Missing/hidden anchors defer; cues never float without an action.

### Cached Privacy page

Implement a real in-app routed/sheet page whose content is in versioned static HTML/i18n and the service-worker shell. It covers local state, setup-link fragment/cookie transport, Plan 053 temporary transfer, telemetry consent, export/delete controls, and limitations. Landing and Settings link to it. Share removes disclosure prose and keeps only task status/actions.

## Domain/state model

- `EntryLandingState`: `generic`, `shared-valid`, `shared-invalid`, `not-shown`.
- `ProgramCandidate`: current Plan 048 candidate plus optional `alternative` with independent ID/provenance and structured rationale codes.
- `InstallPromptState`: `unsupported`, `already-installed`, `ios-empty-handoff`, `ios-transfer`, `chromium-awaiting-value`, `eligible-milestone`, `cooldown`, `manual-settings`.
- `GuideState`: versioned per-guide status and last transition; no program/workout facts duplicated into prefs.

These are pure decisions; DOM state is a projection. Shared payload remains only in memory/historical handoff cookie until confirmation.

## Migrations

- Add defaulted `entryLandingSeen`, install-milestone/cooldown, and guide-state keys to `repforge_ui_v1`; old `tourDone` maps to task-guide completion only where the old tour genuinely covered that action, otherwise guides remain eligible. Do not replay everything blindly.
- Preserve current candidate/recovery drafts across app upgrade. Recommendation result and preview route IDs may merge, but old resume locators migrate deterministically.
- Keep both shared `v1.` and `v2.` decode forever; do not change semantic document version.
- Add/remove cached files and advance live SW/script revisions in lockstep.
- Remove global tour markup/styles/tests only in the commit that has contextual registry/replay equivalents; Plan 055 removes List-specific guide copy after its own parity.

## UX state specification

### Landing

- Generic first view: headline, concrete three-part explanation, early **Start training**, selected product-loop preview, one short ethos line, Privacy link, platform-relevant install action.
- Shared valid: brief Taurifer explanation, received program name and safe summary, primary **Start this program**, optional inspect/back/cancel actions, Privacy link, iOS handoff where relevant.
- Shared invalid/ineligible: fail-closed complete reason and safe way into ordinary no-program app; no creator/trust claim.
- Returning abandoned: Today/Program no-program states, not the landing.

### Chooser and routes

- Closed/open Bring-or-build group; all five jobs keyboard/screen-reader reachable.
- Recommend questionnaire, merged primary recommendation/editable preview, optional genuine alternative, rationale, validation, activation, replacement confirmation.
- Custom expert rows remain fully visible; Build/Import keep current adjacent validation and candidate semantics.
- Browse list scan facts, detail preview, explicit activation.
- Empty/loading/compile failure/rules drift/resume/conflict states remain recoverable and provenance-aware.

### Install/guides/privacy

- Platform/milestone eligible, dismissed/cooldown, unsupported/already installed, transfer handoff, and Settings-manual install states.
- Guide shown/dismissed/completed/replayed/deferred-anchor states.
- Privacy page offline, link-back/focus-restoration, and transfer-unavailable content state.

## Accessibility

Landing has one `h1`, early logical primary action, meaningful mini-interface reading order, decorative elements hidden, and no auto-advancing animation. Chooser grouping is semantic. Muscle controls use `fieldset`/`legend` or equivalent group labeling with selected/disabled reason. Recommendation editing and activation retain adjacent validation/focus restoration. Install/cue state changes announce once; cues do not cover targets or trap focus. Privacy returns focus to its invoking link. Test keyboard, touch targets, reduced motion, headings/landmarks, 200% reflow, VoiceOver/TalkBack in Plan 059.

## Localization

Implement every landing, rationale, Browse fact, install, cue, and Privacy message as complete EN/PT-BR strings. The approved English proposition is source direction; PT-BR receives natural equivalent copy, not fragment assembly. Program/exercise names remain data. Dates/durations use locale roles. Build `i18n.js` from sources and run key/leak checks.

## Responsive behavior

At 320px and 200% text, headline/action remain early, mini-interface reflows without horizontal scroll, chooser groups stack, expert controls remain visible, and muscle choices use 2×2/full-width as needed. Canonical phone is primary composition; 430px may use space without changing hierarchy. Desktop centers a bounded mobile-first entry surface and never exposes app-only background controls. Demanding PT-BR + 200% cases cover landing, chooser, recommendation/editor, muscle priorities, Browse preview, install transfer, and Privacy.

## Light/dark

Use current token swap and Phase 049 roles. The selected mini-interface is built from normal product components in both themes. Licensed art remains on paper when used; this preview should not invent art. Meaning/selection does not depend on accent color.

## Offline/PWA

Landing, all entry routes, compiler/editor, contextual help, and Privacy work offline once cached. Setup-link creation/consumption retains existing offline rules. Only Plan 053 transfer requires a network. Install copy explicitly separates offline capability from installation. Test browser versus standalone, old/new service worker, and cached Privacy.

## Failure and recovery

- Shared proposal invalid/too long/unknown exercise: fail closed, persist nothing, provide safe exit.
- Compiler/alternative unavailable: show primary if valid; do not fabricate alternative.
- Candidate activation fails/races: candidate remains editable; existing program/draft remains atomic.
- Landing UI-pref write fails: do not block entry; prevent loops within session and retry preference later.
- Install prompt unavailable/dismissed: browser use continues; Settings remains honest.
- Transfer failure follows Plan 053 and never destroys source data.
- Missing cue anchor: defer without orphan overlay; replay remains available.
- Privacy fetch is impossible offline only if cache integrity failed; include it in shell and show no blank route.

## Privacy

Landing and Settings link to the cached page. Shared landing displays only proposal-safe program facts before confirmation. Share loses privacy prose. Transfer consent is explicit and separate from install instructions. No visual prototype or telemetry includes real payload/user data.

## Telemetry

Use only Phase 049-approved coarse comprehension/task funnels: landing viewed → chooser opened; entry route selected → valid candidate → activation; install offer by platform/milestone → dismissed/completed; guide shown/dismissed/completed; `late_install_transfer` remains owned by Plan 053. Respect consent and stable identity. Do not send answers, program/exercise identity, free text, shared payload, tokens, or visual-direction selection. The owner alone interprets results.

## Testing and executable evidence

- Pure routing tests for generic/shared/returning landing and no-program fallback.
- All five route journeys, explicit activation, replacement conflict, resume/rules drift, primary-only and real-alternative recommendation, no fabricated alternative.
- Shared proposal leaves durable state/storage keys unchanged until **Start this program**; established/history device remains blocked.
- Expert controls semantic/geometry tests at 320/390/430, EN/PT, 200%, and PT+200.
- Browse summaries originate from canonical facts and unknown facts never get invented.
- Install policy fake-clock/platform/milestone/cooldown/manual-Settings tests, Plan 053 integration, browser/standalone distinction, setup cookie coexistence.
- Guide state/action completion/dismiss/replay/missing-anchor/focus tests; global modal route absent.
- Privacy page cached/offline, linked from landing/Settings, absent from Share.
- Visual owner gate evidence in PR before mini-interface implementation; selected reference hash matches final component.
- Focused program-entry/install/shared-setup/accessibility/catalog suites, then full browser/generative regression.

## Screen catalog changes

- **New states:** generic landing; adaptive shared landing; optional recommendation alternative; Browse scan/detail; guide cue/replay; Privacy full page; install milestone/cooldown/manual states; eligible late-transfer entry states from Plan 053.
- **Removed states:** old `onboarding-start/first-run` Milo/full-passage form is replaced; separate recommendation `result` and `preview-*` states consolidate into one route (retain first-run/existing activation variants); global `install/tour` is removed after guide coverage exists.
- **Changed states:** chooser/hub variants, every Recommend/Custom/Browse/Build/Import preview/activation surface, shared gate, install banner/iOS sheet, Settings Privacy entry.
- **Matrix expansion:** all entry states retain broad EN/PT; landing, recommendation/editor, muscle controls, shared, install transfer, and Privacy receive 320/200%/PT+200/reduced/theme variants. Record exact manifest/frame delta after final route inventory.

## Owner gates

1. **Hard visual gate:** select one image-generated mini-interface direction before production visual implementation/reference capture.
2. Confirm Plan 053 transfer architecture/privacy gate is closed before exposing established-data iOS promotion.
3. Real-device owner review of landing/entry/install in EN and PT-BR on compact iOS/Android is required for this plan's completion; Plan 059 repeats launch acceptance.

## STOP conditions

- Stop visual implementation at the image-generation selection boundary.
- Stop if a route would persist shared payload/candidate fields before prohibited confirmation or activate without explicit action.
- Stop if a close alternative is not compiler-backed, or a Browse fact requires guessing.
- Stop if an expert option would be hidden merely to shorten the page.
- Stop established-data iOS promotion until Plan 053 is safe and owner-approved.
- Stop if work adds publisher identity, separate landing motif, account/sync, or changes setup-link format.

## Rollback

Route/entry changes retain the old activation adapter until new journeys pass. A feature flag or UI-pref schema default can return first-run routing to the no-program app without inventing a program; never roll back to code that loses a candidate/shared proposal or cannot read newer prefs. Install transfer creation can be killed independently. Contextual guides can be disabled while their prefs remain. Cache rollback must serve a schema-compatible entry/app bundle.

## Atomic commit sequence

| # | Exact commit message | Contract delivered | Likely files | Prerequisite | Focused proof | Broader regression | Catalog impact | PR-body update | Rollback boundary |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `test(entry): characterize activation and first-run boundaries` | Existing five routes, candidate/shared no-persist, abandoned/no-program, install/tour baseline | entry/shared/install tests and fixtures | Plans 049/050 | Storage diffs and route journey matrix | Existing program-entry/shared suites | None | Record baseline and already-fixed issues | Tests only |
| 2 | `design(landing): present product-loop preview directions` | Three+ faithful imagegen previews with prompts/equal content and explicit owner STOP | preview-only design note/PR artifacts; no production asset | Commit 1 | Token/content checklist and accessibility review | None | No catalog reference yet | Mark ⛔ until owner selects; record selection/hash | Delete/exclude unselected previews |
| 3 | `feat(entry): route one-time and shared adaptive landings` | One-time generic landing, adaptive shared route, early CTAs, Privacy link, no-program return | `index.html`, `app.js`, entry prefs, i18n, tests, selected asset only if needed | Commit 2 owner selection | Routing/storage/shared boundary tests | Entry/shared/install/accessibility suites | Replace/add landing/shared frames | Record selected direction and storage proof | Revert route while keeping pref parser |
| 4 | `feat(entry): establish five-job chooser hierarchy` | Recommend/Custom/Browse/Bring-or-build grouping without route loss | entry renderers/styles/i18n/tests | Commit 3 | Five route keyboard/click journeys | Program-entry suite | Hub states changed | Record route parity | Revert presentation only |
| 5 | `feat(entry): merge recommendation and editable preview` | Primary, genuine optional alternative, rationale, editor, validation, explicit activation | entry/adapter/compiler view model, editor/app/styles/i18n/tests | Commit 4 | Primary-only/alternative/edit/activate/conflict tests | Compiler/entry/recovery suites | Result/preview states consolidate | Record provenance and no-fabrication proof | Revert merged view; retain candidate data compatibility |
| 6 | `feat(entry): reflow expert controls and Browse summaries` | Visible muscle 2×2 rows and scan-first canonical facts | entry modules/styles/i18n/tests | Plan 050 components; Commit 4 | Geometry/semantics/fact-source tests | Entry/accessibility suite | Custom/Browse frames changed/added | Record PT+200 evidence | Revert view layer, keep facts optional |
| 7 | `feat(install): apply platform and milestone promotion policy` | iOS/Chromium timing, cooldowns, Settings availability, Plan 053 transfer route | install policy/app/prefs/i18n/tests | Plan 053 merged; Commit 3 | Platform/fake-clock/browser/standalone tests | Install/shared/telemetry suites | Install states changed/added | Record milestone matrix/transfer SHA | Kill automatic offers; keep manual Settings |
| 8 | `feat(help): replace the global tour with contextual guides` | Versioned cue registry, dismiss/complete/replay, initial entry/install anchors | app/index/styles/i18n/tests; remove obsolete tour code | Core route anchors stable | Action/dismiss/replay/focus/missing-anchor tests | Focus/Progress integration deferred; accessibility | Remove tour; add cue/replay states | Record remaining Plan 055–057 anchors | Disable registry; do not restore obsolete List tour after Plan 055 |
| 9 | `feat(privacy): add cached in-app privacy page` | Landing/Settings links; complete disclosures; Share task-only | index/app/styles/i18n/SW, shared/privacy tests | Plan 049/053 wording approved | Offline/page/link/focus/Share absence tests | Install/shared/accessibility suites | Privacy page replaces section; Share changes later in 057 | Record privacy approval/cache version | Revert links/page/Share copy as one privacy-consistent unit |
| 10 | `test(entry): regenerate and prove landing-entry evidence` | Complete catalog, cross-locale/theme/text/reduced/device evidence | manifest/scenarios/PNGs/docs | Commits 3–9 | Capture/check/compare/overflow/key tests | Full browser + generative suite | Exact delta recorded | Fill owner/device/completion evidence | Evidence rolls back with owning slices |

Each row is marked 🟡 before work, implemented alone, narrowly proved, fully diff-reviewed, committed, pushed, and reflected in the PR immediately. Do not accumulate completed local slices.

## Implementation-agent operating protocol

### Branch/worktree contract

- **Branch:** `ui-overhaul/054-landing-entry`
- **Worktree:** `../repforge-ui-054-landing-entry`
- **Base:** current `origin/main`
- **Dependency gate:** Plans 049/050 merged; transfer slice waits for 053; imagegen slice stops for owner selection
- **Primary files:** first-run/entry/install/privacy portions of `index.html`, `app.js`, program-entry modules, i18n, focused styles/tests/catalog scenarios
- **Shared hotspots:** `app.js`, `styles.css`, `index.html`, i18n/generated file, SW/script revisions, program-entry modules, shared setup, manifest
- **Conflicting phases:** Plan 057 owns final Settings/Share management; Plan 058 owns global token migration; Plan 055 owns Focus guide anchors/List removal
- **Safe parallelism:** Plan 055 may work after 051 on workout-owned regions; Plan 056 after 052 on Progress-owned regions. Serialize i18n, shell, SW, prefs, and catalog manifest merges
- **Integration order:** 049/050 → visual gate/core 054; 051 → 053 → install slice; 054 before dependent Plan 057/058/059 work

Fetch current main; inspect branches/worktrees/PRs; resume existing work. Use one worktree; keep coordination checkout clean; never copy uncommitted files or delete another agent's worktree/branch. Push `chore(plan-054): start implementation`, open a draft PR, and complete its body before substantive work. Target main. When prerequisites merge, fetch and explicitly merge `origin/main`, resolve deliberately, rerun affected verification, push, and update the PR. No rebasing after publication.

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

Published SHAs are stable: no amend, rebase, force-push, silent rewrite, or stash handoff. Push every coherent tested slice and update PR status/evidence/next steps immediately. Never commit a knowingly broken checkpoint. Do not duplicate or copy unpublished prerequisite contracts. Record imagegen prompts/selection, install/recovery gates, device evidence, and exact commands/results in the PR. Before stopping, run `git status --short`; a valid handoff is clean. Unless explicitly authorized, do not merge; owner review requires visual/device gates, catalog, accessibility, reviews, and all rows complete.

## Completion gate

- The owner-selected imagegen direction—not an agent-selected substitute—is the implemented/reference mini-interface.
- Generic/shared/abandoned first-run routes behave exactly as approved; every job has explicit activation and prohibited candidate/shared data is absent before confirmation.
- Five-job hierarchy, merged recommendation/editor, optional real alternative, visible expert controls, muscle 2×2 groups, and Browse scan facts pass EN/PT and responsive tests.
- Install policy is platform-sensitive, milestone/cooldown-correct, Settings-accessible, non-blocking, honest about offline/reminders, and safely integrated with Plan 053.
- Global modal tour is gone; contextual cues dismiss/complete/replay and cover owned lifecycle actions, with later anchors assigned.
- Cached Privacy is linked from landing/Settings and Share is task-only.
- Light/dark, compact/canonical/desktop, 200%, PT+200, reduced motion, overflow, accessibility, installed/browser, SW upgrade, and full regression pass.
- Real-device owner review is recorded; branch/PR are pushed, current, clean, and stopped at owner review.
