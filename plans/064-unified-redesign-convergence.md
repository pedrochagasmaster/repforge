# Plan 064: Unified redesign convergence

One production redesign workfront that turns the public landing, first-run
entry and onboarding, and the Direction D main application into one Taurifer
product, delivered as a single comprehensive production PR, developed as
bounded internal slices by Sonnet workers under an Opus orchestrator.

Implementation and review use the
[evidence protocol](../docs/agents/implementation-evidence.md). The
orchestrator handoff is
[`docs/agents/prompts/plan-064-opus-orchestrator.md`](../docs/agents/prompts/plan-064-opus-orchestrator.md).
This plan defines scope, authority, sequence, delegation, proof and gates.

- **Plan number:** 064
- **Phase:** post-058 candidate construction, before Plan 059
- **Status:** PLANNED — awaiting owner approval of this specification; no
  implementation has started
- **Owner approval state:** the unified topology (one production PR instead of
  three) is an owner decision recorded 2026-09-30 and codified here. Open owner
  gates are listed in §6; the onboarding direction is not selected.
- **Workfront:** one fresh branch from stabilized `main`, one draft production
  PR (§11). Existing PRs #272, #276 and #279 become source/specification
  branches, not merge destinations.
- **Depends on:** merged Plan 058; the standalone alpha-readiness workfronts in
  §11.1 merged or explicitly deferred by the owner; the owner gates in §6 that
  each slice names
- **Blocks:** Plan 059; #257 and #258 production integration (§15)
- **Child/reference plan:** [Plan 063 (Direction D)](#4-authority-structure)
  remains the main-app specification and is consumed by slice R3
- **Supersedes:** the three-production-merge sequence "#276 landing → #272
  Direction D → #279 onboarding" in
  [`docs/post-058-open-pr-clearance-sequence.md`](../docs/post-058-open-pr-clearance-sequence.md)
- **Affected surfaces:** every public surface: landing, entry hub and all
  entry routes, Today, workout (Focus, rest, Why, sheets), session summary,
  Progress, History, Program, Settings, Library, install and transfer states,
  the dock, sheets, dialogs, and the screen catalog
- **Complexity:** Very high
- **Risk:** High. One long-lived branch over `app.js`, `styles.css` and
  `index.html`; the workout shelf sits on DraftV2 in the most-used flow

## 1. Problem and rationale

Three open PRs carry the owner-selected redesign, but none of them is a
production implementation:

| PR | Head inspected | What it really contains | Production diff vs `main` |
|---|---|---|---|
| #276 landing | `336b492d` | Five candidate rounds and a final standalone landing page under `docs/design/landing-candidates/final/` | Three `rec.*.text` copy rewrites, a stale cache bump (v302), one stale catalog frame. The Plan 054 landing markup in `index.html` is untouched. |
| #272 Direction D | `2f2fc044` | ADR 0016, Plan 063, the implementation spec and strings appendix, the review-page prototype and its polish pass | Slice P2 (session-outcome rule, Why anchor copy, EN "Pause"), a stale cache bump (v302). Slices P0, P1 and P3–P12 are not started. |
| #279 onboarding | `1acee97a` | Rounds 1–4 of the onboarding tournament, polished Round 3 candidate G (complete on all 45 checkpoints), Round 4 directions H–L (built to 21 core checkpoints), owner decisions Q622–Q637 recorded in a branch-local register section, no owner pick of a direction | None. Its harness vendors `styles.css` tokens and the entry modules at the Plan 058 head; the entry modules are byte-identical to `main` today. |

The previous sequence (clearance stages 6–8) would have required each branch
to grow a full implementation phase on its own, then merge serially, each
absorbing the previous one's shell, tokens, copy and catalog. Direction D's
spec marks all 45 onboarding screens "rules only" and the landing spec
requires the normal Taurifer system (G-81), so serial merges guarantee that
the onboarding and landing frames are restyled by D and then replaced by
their own redesigns. That is the waste this plan removes.

The objective is one product: public landing → entry/onboarding → activation
→ Today → workout → Progress / History / Program, with one visual language,
typography, hierarchy, spacing and density, controls, navigation, sheets,
iconography, color and accent semantics, dark mode, motion, copy voice,
terminology, accessibility, responsive and 200% behaviour, reduced-motion
behaviour, and empty/error/loading/recovery states.

## 2. Baseline evidence

Pinned on 2026-09-30 by the planning session that wrote this document:

| Object | State |
|---|---|
| `origin/main` | `cb629036fdf89ad21dbb1a607c4bab5991b9c9a3` ("docs(agents): make packet supplemental verification"); CI run 18 green |
| Live shell | `sw.js` `CACHE = "repforge-v345"`; `index.html` `app.js?v=313`, `durable-state.js?v=309`, `progress-model.js?v=308`, `history-ui.js?v=308`, the rest `?v=307`; `test/exercise-library.mjs` `expectedCacheRevision = "345"` |
| Catalog | 148 screens, 915 frames (`docs/ui-screens/manifest.json`) |
| Open PRs | #255 `db5819e2`, #257 `e013984d`, #258 `ef49788f`, #272 `2f2fc044`, #276 `336b492d`, #279 `1acee97a`, #282 `5f57e2de` (marketing docs, not a candidate dependency) |
| Merged since the clearance sequence was refreshed | Plan 058 (#256), A01–A04 fixes (#284, #286, #287, #288), the single sharded CI workflow (#283, #285), #289 test stabilization, packet-as-supplemental (`cb629036`) |
| Audit findings | A01–A05 closed; N01 (untranslated set count in the exercise-actions sheet) and N02 (Preview omits programmed RIR) open and assigned to Direction D acceptance |
| Open issue | #274 "PT: rename programa to treino across the app and glossary", owner-authored, `needs-triage`, unscheduled |
| Branch-local owner record on #279 | Q622–Q637 (register section "onboarding design tournament, reopened September 29, 2026"): Q622 keeps the five-job chooser (PD-1 closed), Q624 keeps "no compiled program before the lifter answers" (PD-4 closed), Q625 routes the PT-BR entry catalog corrections (PD-5) to a standalone PR, Q636 sequenced the onboarding redesign "as a new plan sequenced before Plan 059, shipped as its own PR". Q636's own-PR clause is superseded by the 2026-09-30 unified-topology decision this plan codifies; every other answer stands and is migrated to `main` in R0. |

Every later reader re-fetches these facts. They are evidence for this plan's
decisions, not a snapshot to copy into implementation.

## 3. Architectural verdict

Evaluated independently before codifying the owner's proposal.

| Criterion | Three serial production PRs | One comprehensive PR (this plan) |
|---|---|---|
| Repeated integration | Three "merge main, rerun affected proof, redo cache ritual" cycles; each later branch absorbs the earlier one's shell and tokens | One integration branch; standalone alpha work lands first and is absorbed once |
| Shell and cache churn | Three `CACHE` bumps and three protected-query rituals | One coherent shell revision at merge (interim bumps only when a precached file changes, per `AGENTS.md`) |
| Catalog recapture and review | Shared-shell frames (≈570) and onboarding frames (≈250) regenerated and re-reviewed up to three times; three changed-frame inventories | One full recapture and one changed-frame disposition inventory, plus per-slice affected boards |
| i18n | Landing copy must land before D renders it; onboarding keys after D; three regenerations with cross-branch conflicts in `i18n.js` | One vocabulary decision (§8.10) applied once; keys owned per namespace; generated output regenerated by the orchestrator only |
| Reviewability | Smaller PRs, but "does this read as one product" is only reviewable after the third merge | One large PR, reviewable by atomic slice commits and per-slice frame boards; the whole-product review is a first-class slice (R7) |
| Rollback | Three revert points in theory; in practice onboarding depends on D's shared rules and D consumes landing copy, so reverting the middle PR is not clean | One merge commit to revert before Plan 059 freezes a candidate |
| Regression isolation | Bisectable by PR | Bisectable by slice commit; every slice pushes focused-green commits and CI runs the full inventory on each pushed head |
| Product cohesion | Achieved by hand across three merges | The stated objective of the workfront |
| Agent coordination | Three sequential agent sessions, each rediscovering the previous branch's drift | One orchestrator owning the integration branch and the hotspot map |
| Mega-PR failure risk | Lower per PR | Real: long-lived branch, review fatigue, one red suite blocking everything, an unresolved owner gate stalling the whole PR. Mitigated in §3.1 |
| Ratified contracts | Preserved by each PR's own gates | Preserved by the decision ledger (§5) and STOP conditions (§13); the same suites guard the same contracts |
| Plan 059 | 059 validates the third merge's result | 059 validates one merge's result; fewer intermediate UIs never validated |

**Verdict:** the unified PR is preferable. The strongest reasons are that no
source PR is an implementation, so the "three PRs" would each have grown a
full implementation anyway; that Direction D's shared rules already reach
every onboarding, landing, Settings, Library and install screen, so serial
merges triple the shared-surface work; and that one product needs one
vocabulary decision, one token set and one catalog baseline.

### 3.1 Risks and safeguards

| Risk | Safeguard |
|---|---|
| Long-lived branch drifts from `main` | Standalone work merges before the branch is cut (§11.1). Nothing else cache-bumping is merge-active while the redesign is open. If an unavoidable fix lands on `main`, the orchestrator merges `main` explicitly at the next slice boundary; never rebase. |
| One red suite blocks the whole PR | Every slice commit is focused-green before push; CI runs the complete inventory on every pushed head; a red head is fixed before the next slice starts. |
| Review fatigue | Slice commits are atomic and named; each slice posts a frame board; R7 is a separate adversarial whole-product review with fresh reviewer agents. |
| Owner gate stalls the PR (onboarding direction, terminology) | Gates are front-loaded into R0 and asked for as a batch (§6). R2 and R3 do not depend on the onboarding pick; R4 waits. See the contingency below. |
| Shared-file conflicts between workers | Hotspot ownership (§10.3); one writer per hotspot at a time; the orchestrator integrates commits serially. |
| Visual polish hides accessibility regressions | `tools/check-ui-system.mjs --strict-css`, the role inventory, the rendered-role AA audit and the accessibility suites run in CI on every head; no role, size tier, radius step or palette value is added outside a contract review (§8). |
| Scope creep from #257/#258/Plan 059 | §16 non-goals; STOP condition S-8. |

**Contingency, not the default.** If the onboarding direction is still
unselected when R2, R3 and R5's landing-to-app journeys are complete and
green, the orchestrator reports that state to the owner. Only an explicit
owner instruction may split the PR into "landing + shared system + Direction
D" and "onboarding" as two production PRs. The second PR then consumes the
first's merged shared system exactly as the old stage 8 intended. The
orchestrator never chooses an onboarding direction to avoid the split.

## 4. Authority structure

- **Plan 064 (this document)** is the execution and product authority for the
  unified redesign workfront. It owns the cross-surface contracts (§8), the
  slice sequence (§9), delegation (§10), topology (§11), verification (§12),
  STOP conditions (§13), the completion gate (§14) and the post-redesign
  sequence (§15).
- **Plan 063 (Direction D)** keeps its number and its owner decisions. It is
  the main-app specification consumed by slice R3, together with ADR 0016,
  `docs/design/direction-d-implementation-spec.md` and
  `docs/design/direction-d-strings.md`. These files live on `redesign/direction-d`
  today; R0 migrates them to the workfront branch by explicit file copy with
  the source SHA in the commit message. Plan 063's own P-slice table is
  re-expressed inside R3; its P2 commit is cherry-picked by content, not by
  history. Plan 063's "Plan 058 → Plan 063 → Plan 059" ordering and its
  "one PR for the whole plan" workfront line are superseded by this plan; R0
  amends those two lines when the file is migrated.
- **The branch-local `plans/063-history-migration-foundation.md` on #258**
  must be renumbered by #258's owner when that work resumes (§15). It takes
  the next free number at that time; no number is reserved here. Two live
  Plan 063 files must never coexist on `main`.
- **`docs/post-058-open-pr-clearance-sequence.md`** remains the sequencing
  authority for the candidate window. This plan is the unified redesign stage
  inside it.
- **Precedence when sources disagree:** owner decisions recorded in this
  plan's decision ledger and gates (§5, §6) → Plan 058's frozen semantic
  contract → ADR 0016 and the Direction D implementation spec for main-app
  surfaces → the landing final page's copy and structure for the landing →
  the owner-selected onboarding direction's brief for entry surfaces → the
  drawings and prototypes, which never ship as code.

## 5. Decision ledger

Every design decision the workfront touches is one of four kinds. A worker
may act only on locked, inherited and reconcilable rows; owner-gated rows stop
the dependent slice.

### 5.1 Locked (ratified; reopening needs a new owner decision outside this plan)

| ID | Decision | Source |
|---|---|---|
| L-01 | Direction D is the main-app reference for Today, Focus and rest, Why this weight, session summary, Progress and the exercise chart, History and Program. Its fifteen §1 owner decisions stand, including the supersession of G-23, G-29, G-44, G-60 and G-65 for those surfaces and the retention of G-42. | ADR 0016 (accepted 2026-09-25) |
| L-02 | Plan 058's semantic contract owns roles, the type scale, radius scale, elevation roles, control roles, progress dimensions, color roles and rendered-role AA. A new role, tier, radius step or palette value goes through a versioned contract review, not a slice. | `docs/design/ui-system-semantic-contract.md`, ADR 0012 |
| L-03 | Durable state, DraftV2, the crash journal, replica settlement, block-transition provenance, install transfer, setup-link codec and confirmation gate, privacy boundary and the telemetry allowlist are unchanged. Presentations sit over existing commands; there is one commit path per action. | `AGENTS.md`, ADR 0007, ADR 0013, ADR 0014, Plans 051–053, bridge, Direction D spec §5 |
| L-04 | First-run holds no program; nothing mints one behind the lifter's back; cancelling onboarding returns to the no-program states. | `AGENTS.md`, backlog Completed row |
| L-05 | Setup links persist nothing before **Start this program**; the common editable preview and explicit activation follow; never applied over an onboarded program or existing history. | ADR 0007 |
| L-06 | Free-form import is a hand-off, not an integration; the prompt is `entry.freeform.prompt`; tab-scoped `sessionStorage` cleared at the five exits. | ADR 0014 |
| L-07 | Five entry jobs, Recommend-primary hierarchy, expert configuration visible, Browse scan-first, merged result/preview, explicit activation labels **Use this program** / **Archive current program and use this one**. | G-10, G-25, G-26, G-50, G-79, `docs/program-entry-flow.md` |
| L-08 | Landing appears once, uses the normal Taurifer system, carries one short ethos line, early Build/Track actions, a product-led prescription → logged sets → next-target preview from real engine output, Privacy linked, no creator identity, no separate motif. | G-09, G-18–G-21, G-47, G-81, G-82, ADR 0006 |
| L-09 | Install promotion by capability and platform with milestone cadence and cooldown; explicit informed install-and-transfer. | ADR 0005, ADR 0013, G-39, G-48, G-72, G-86 |
| L-10 | No global tour; action-linked contextual guides with Settings replay. | G-40, G-49, G-62, G-69 |
| L-11 | Focus is the sole logger; List stays deleted; no runtime switch back to the input well once the shelf passes. | G-22, Plan 063 rollback rule (owner, 2026-09-26) |
| L-12 | History and progression truthfulness: outcomes and recommendations are separate vocabularies; insufficient evidence is a neutral baseline; the session-outcome rule in `CONTEXT.md`; no gamification. | G-24, G-31, ADR 0016 §4, `CONTEXT.md` |
| L-13 | Dark mode is the `:root[data-theme="dark"]` token swap; paper-backed licensed art stays; no second design. | ADR 0009, G-58 |
| L-14 | Five navigation destinations; no sixth tab; the production glass dock is unchanged in structure. | Register, Direction D spec §5.12 |
| L-15 | No executable unsupported workout grammar; #255 is measurement only. | Backlog, clearance non-goals |
| L-16 | No Pro, payment, entitlement, managed AI, native shell, package manager, backend platform, or fake door. | ADR 0010, ADR 0011, plans README guardrails |
| L-17 | Free one-off sessions (#257) and historical migration (#258) are outside this workfront. | §15, §16 |

### 5.2 Inherited (already specified; applied as written unless a reconcilable row says otherwise)

| ID | Decision | Source | Consuming slice |
|---|---|---|---|
| I-01 | The Direction D screen contracts §4.1–4.9, behaviour contracts §5, strings appendix, motion §8, accessibility §9, five-check acceptance gate §10, catalog fixture §11 | Direction D implementation spec (branch `redesign/direction-d`) | R3, R6 |
| I-02 | Plan 063 owner gates: P1 drawings approved by flow; sampled changed-frame boards per slice; the `program_readiness_navigated` allowlist deletion; the P12 phone read | Plan 063 §Owner gates | R0, R3, R7 |
| I-03 | Direction D "rules only" treatment for every screen D does not draw: shared ledger row, verdict mark, tab row, orange budget and sheet header band; layouts otherwise stay as 058 left them | Direction D spec §3 | R1, R6 |
| I-04 | The landing final page's section order, headline, subtitle, CTAs, FAQ content, engine-true numbers and copy rules (RIR explained where first used, no absolute promises, usage data only in the FAQ) | `docs/design/landing-candidates/final/` on `claude/landing-candidate-s-round-3-9tmm42` | R2 |
| I-05 | The three `rec.*.text` rewrites (`rec.add.text`, `rec.reduce.text`, `rec.hold_add_reps.text`) and the refreshed recommendation baseline fixture | #276 production diff | R2, consumed by R3 |
| I-06 | Onboarding tournament owner answers Q622–Q637 except Q636's own-PR clause: five-job chooser kept (PD-1), minutes and rest asked with nothing preselected (PD-2/PD-3), no compiled program before answers (PD-4), PT-BR catalog corrections as their own small change (PD-5), program-first review with inline chip editing, "Start only" on the shared gate, resume card on the chooser only, the K-25–K-32 acceptance bar, before/after count with accent edge and "novo". Round 3 candidate G is the reference interaction model. | #279 register section, Round 1 synthesis spec §10, Round 3 manifest and polish records | R4 (after gate OG-1) |
| I-07 | Plan 058 typography proof for 200% text and the A05 closure evidence | `docs/ui-overhaul-plans-049-057-audit.md` | R6 |
| I-08 | N01 and N02 close inside this workfront with rendered PT proof and removal/no-draft evidence respectively | Audit finding matrix; backlog | R3 |
| I-09 | Alpha measurement producers (`set_saved`, `recommendation_explained`, `exercise_skipped`, `block_review_viewed`) attach at the DraftV2 commit, Why-open, skip-dispatch and review-navigation boundaries, not to DOM controls the redesign replaces | Advisor plan 023, Direction D spec §5 | R3 preserves whichever landed first |

### 5.3 Reconcilable (engineering judgment inside the workfront, recorded in R0)

| ID | Question | Rule for resolving it |
|---|---|---|
| C-01 | Token names the Direction D prototype introduced on the review page (`--rule-on-surface`, `--space-*`) versus `styles.css` on `main` | Use the contract's existing tokens where a role exists; propose only the tokens D's new content jobs (shelf, inline rest, prescription row, frequency counts) genuinely need, through the contract review recorded in R0. |
| C-02 | Rest clock: D's `clamp(2rem, 10cqi, 2.625rem)` proposal versus the protected `clamp(32px,10vw,42px)` | The protected variant stands unless the owner accepts the polish proposal (OG-4). |
| C-03 | Landing preview captures show pre-058 screens | Regenerate the landing's in-app shots from the R3 Today/Focus/Why states before R6; never ship a screenshot of a retired UI. |
| C-04 | Sibling recommendation keys still say "top of the range" after I-05 | R2 aligns `rec.add2.text`, `rec.add.tempered.text`, `rec.hold_add_reps.text_effort` and `rec.push_reps.text` to the same vocabulary in both languages; the baseline fixture records every change. |
| C-05 | `entry.freeform.privacy` is European Portuguese on `main` | R2 rewrites it in PT-BR with the same meaning; ADR 0014's disclosure content is unchanged. |
| C-06 | Direction D screen inventory counts 143 screens; `main` has 148 | R0 re-derives the treatment table from the live manifest and assigns the five newer screens a treatment. |
| C-07 | Catalog states the redesign retires (`today/preview`, `program/readiness`, `workout/rest-timer` sheet) and adds (D §3 list; onboarding states from the selected direction; landing states) | Each slice edits the manifest and scenarios for its own states; the orchestrator owns PNGs (§10.3). |
| C-08 | Guide anchors that move with controls | The owning slice moves the anchor and proves the cue still fires (G-49, G-62, G-69). |
| C-09 | The exercise-actions sheet copy (N01) and the retained `⋯` actions under G-42 | R3's sheet slice fixes N01 with a complete translated message and count handling. |

### 5.4 Owner-gated

See §6. A gated decision is never inferred from a prototype, a PR body, a
"recommended" label in a round README, or the absence of objection.

## 6. Owner gates

Approvals count only as an owner reply on the workfront PR (or a linked
issue) and are recorded in the PR body's Approved rows. R0 posts one batch
comment asking for OG-1 through OG-5 together so the owner decides once.

| Gate | Decision needed | Blocks | What the orchestrator provides |
|---|---|---|---|
| **OG-1 Onboarding direction** | Which candidate (G, or one of H–L, or G's interaction architecture in another direction's visual treatment) becomes the production entry/onboarding, judged as the beginning of the product Direction D becomes after activation. Advancing J reopens Q622 (PD-1) and advancing L reopens Q624 (PD-4); both also omit Custom, Browse and Build, so either needs an explicit owner reopening of L-07 before it can be built | R4 and the onboarding half of R5 | The reconciliation board and decision matrix in §7.2, rendered beside the R1 shared system and D's Today/Focus at 390 PT light and EN dark |
| **OG-2 PT terminology** | Confirm or reject issue #274 ("programa" → "treino" for the program, "sessão" for one workout) as the product-wide rule for landing, entry and app | R2 copy, R4 copy, the §8.10 vocabulary | The affected-key inventory (the landing page's `P` override table plus every `programa` value in `i18n-pt.json`), and the `CONTEXT.md` glossary amendment text |
| **OG-3 Landing final page** | Accept `docs/design/landing-candidates/final/` as the landing to implement, or name what changes. The branch records no explicit owner selection; "definitive" is the agent's word | R2 | The final page and its screens, plus the list of catalog values it quotes |
| **OG-4 Direction D polish proposals** | Accept or reject the five open proposals from the 2026-09-30 polish comment on #272 (focal-name role, section-heading role, exercise-complete shelf drawing, invalid-set reason string, overrun after Skip) and the seven proposed 058 content jobs | The affected R3 sub-slices only | The polish audit and comment link; the contract-review text for each content job |
| **OG-5 Retirements with a telemetry effect** | Confirm the `program_readiness_navigated` allowlist deletion (already decided 2026-09-26 for #272) applies inside this workfront | R3 Program slice | The `telemetry.js` and fixture diff |
| **OG-6 P1 drawings** | Approve each "needs drawing" Direction D screen on the review page, by flow, as Plan 063 §Owner gates already defines | The states those drawings cover | Four review rounds: Today, workout sheets, Progress, History edit |
| **OG-7 Changed-frame boards** | Approve each slice's sampled board (every changed state at 390 PT light and EN dark plus the worst 360 PT 200% case) | The next dependent slice's merge into the integration branch is not blocked; the completion gate is | Board per slice, linked from the PR body |
| **OG-8 Whole-product read** | The owner's phone read of the complete journey at R7: landing → entry → activation → Today → Focus → save → summary → Progress / History / Program, in PT and EN, light and dark | The completion gate (§14) | The R7 review report and the final catalog |

## 7. Unified surface inventory

### 7.1 Treatment by flow

Counts are from the live manifest (148 screens). R0 re-derives this table
and pins it in the PR body; the numbers here are the planning baseline.

| Flow (screens) | Treatment | Source of the design | Slice |
|---|---|---|---|
| Public landing / first-run (`onboarding-start/first-run`, install and shared variants) | Redesign to the final landing page's structure and copy on the shared system; adaptive shared-link variant preserved | I-04, L-08 | R2 |
| Entry hub and routes (`onboarding-start` hub states, recommend 11, custom 7, browse 4, build 4, import 10, shared 3, recovery 2) | Redesign to the owner-selected direction's layouts on the shared system; step IDs, routes, draft key, activation semantics unchanged | OG-1, L-05–L-07 | R4 |
| Today (7) | Direction D redesign; `preview` retired; `mixed-strategies` added | I-01 §4.1 | R3 |
| Workout (17) | Direction D redesign: shelf, inline rest, Why, sheets; `rest-timer` sheet retired; rest and Why states added | I-01 §4.2–4.3 | R3 |
| Session (4) | Direction D ledger summary; `summary-first` added | I-01 §4.4 | R3 |
| Progress (28) | D overview, tab row and chart; lifecycle/recovery screens rules only | I-01 §4.5–4.6 | R3 |
| History (6) | D week list, frequency counts, session page | I-01 §4.7–4.8 | R3 |
| Program (15) | D ledger overview; `readiness` retired; editor, picker, custom exercise, share and text-export rules only | I-01 §4.9 | R3 |
| Settings (6), Library (5), install (15) | Rules only: shared components, type roles, sheet header band, orange budget; the Settings durability row from advisor plan 024 restyled if it landed | I-03 | R6 |
| Dock, sheets, dialogs, toasts, scrims | Shared system | §8 | R1 |

### 7.2 Onboarding reconciliation framework (input to OG-1)

PR #279 is design evidence. R0 builds one board that shows each candidate
direction as the first minutes of the same product: its entry hub, one
Recommend step, the merged result/preview, activation, and then the R1/R3
Today and Focus screens, side by side, at 390 PT light and EN dark.

The owner judges each direction on the dimensions below. The orchestrator
fills the matrix with evidence, never with a recommendation disguised as a
fact.

| Dimension | Question | Kind |
|---|---|---|
| Harmony with D | Does the direction read as the same product as D's Today and Focus (type roles, ledger rows and hairlines, orange budget, sheet grammar, dock)? | visual |
| Intentional contrast | Where it differs from D, is the contrast deliberate and explained (for example a warmer first-run), and does it collapse into D's grammar at activation? | visual |
| Different product | Does it introduce a card, motif, colour, type family or navigation pattern that D forbids and that would have to be carried into the app? | visual, disqualifying if yes |
| Ratified semantics | Does it reopen L-04–L-10 (bundled program, persistence before Start, free-form as integration, fewer than five jobs, hidden expert configuration, fake doors, tour, install timing)? | semantic, disqualifying if yes |
| Separability | Can its interaction architecture be rendered in another candidate's visual treatment without changing what the lifter does? | structural |
| Cosmetic vs semantic difference | For each difference from G: is it skin (tokens, spacing, imagery) or flow (order of steps, what is asked, what is promised)? | classification |
| Accessibility and scaling | At 360 PT with 200% text and reduced motion, do the layouts survive without a new type tier or ellipsis? | measured |
| Cost | Which shared components does it need that R1 does not already provide? | engineering |
| Completeness | How many of the 45 checkpoints and the non-core routes (Custom, Browse, Build, shared gate, recovery) exist in the candidate today, and what R4 would have to draw from scratch? | engineering |

What the tournament records already establish, as evidence for the board:

| Direction | Interaction versus G | Kind of difference | Reopens a closed decision | Built coverage |
|---|---|---|---|---|
| G Síntese | reference | — | no | all 45 checkpoints, dark, motion, edge states, own icon set |
| H Concreto | same routes and steps; one decision per screen, full-height editor sheets, 18 taps | mostly cosmetic; the pacing and editor choices are separable interaction choices | no | 21 core; shared gate, helper and recovery not built |
| I Ficha | follows G's contract explicitly; 13 taps | cosmetic | no | 21 core; non-core routes reuse restyled shared widgets |
| J Conversa | no chooser; Recommend starts immediately; Custom, Browse and Build not offered; reply-to-correct | semantic | yes: Q622 (PD-1) and L-07 | 21 core; thread height at 320/200% exceeds 10k px |
| K Linhas | G's contract without the goal-in-chooser graft; network-map chooser; stations strip; 14 taps | cosmetic with one flow difference Q627 permits | no | 21 core; non-core routes restyled shared widgets |
| L Pino | compiled program from defaults before answers; pin tuning; activation locked until every pin is the lifter's; Custom, Browse and Build not drawn | semantic | yes: Q624 (PD-4) and L-07 | 21 core; shared gate falls back to the landing |

Portable ideas that do not change G's flow and may be offered as options
inside OG-1: K's stations-remaining strip, I's struck-through corrected
answer, J's quoted-reply change record, L's "missing answers" lock reason.

Candidate G's interaction architecture (the Round 3 synthesis with PD-1–PD-4
closed) is the reference interaction model because it is the only candidate
the tournament has polished through edge states, dark theme, motion and
inline editors. The board must show whether that architecture can wear each
Round 4 direction's treatment. The owner has already judged G "too timid";
that judgment is about finish and identity, and the board must therefore
show G on the R1 shared system beside D, not the harness's vendored Plan 058
tokens. The final choice is the owner's.

## 8. Shared design-language contract

These rules bind every slice. They add no role, tier, radius, palette value
or component the semantic contract does not already have, except through the
contract review R0 records for Direction D's new content jobs.

1. **Typography.** Plex Sans for language and controls, Plex Mono for
   training values chosen by value. The 058 tier scale (label 11, caption
   12, body-small 14, body/control 16, subtitle 18, metric 22, section-title
   24, feature-title/focal-data 28, title 30, display 40) and the four exact
   contextual variants are the only sizes. Direction D's mapping (§7 of its
   spec) applies to main-app surfaces; landing and onboarding use the same
   roles, so a landing headline is the existing first-run headline variant,
   not a new size.
2. **Hierarchy and surfaces.** Reading screens are flat paper with hairline
   bands; groups are never cards. The only floating material is the dock,
   the workout shelf (`persistent-action`) and sheets/dialogs (`modal`).
   Landing sections are bands on the same paper; the "night" hero band from
   the final page must be expressed as a surface token pair that exists in
   both themes and passes rendered-role AA, or it is not built.
3. **Spacing and density.** One spacing scale from the contract; ledger rows
   at least 48 px, two-line rows 56 px; one hairline per break; a CTA
   reservation so the last content clears persistent chrome.
4. **Controls.** The eight control roles and their shared states. The shelf
   fields, pads and CTA are `adjustment`, `field` and `primary`; landing CTAs
   keep the `landing-accent-primary` and `landing-bordered-navigation`
   recipes; entry doors keep `quiet-navigation` with the `entry-alternative`
   variant. `data-action-role` values are preserved.
5. **Navigation.** The dock is structurally unchanged; hidden during workout,
   rest and summary; the shelf replaces it in workout. Back is a left chevron
   everywhere. Progress is one tab row of five (D decision 5). Onboarding
   keeps its route header, Cancel and step progress semantics.
6. **Sheets.** One header band (handle, `section-title` title, 44 px close
   reserve) for every sheet: Why, day picker, timer presets, calendar,
   exercise actions, Session sheet, entry-route sheets. Rest is not a sheet.
7. **Iconography.** Verdict marks from `rec.*.label`; the existing icon
   masks; the empty media tile stays empty; no artwork on list rows; the
   Round 3 G icon set may be adopted only if it is expressed through the same
   mask mechanism and inventoried.
8. **Color and accent.** The orange budget: verdict glyphs, the current
   exercise segment, a running timer's drain bar, the CTA arrow and the
   active dock icon. Records use `--positive`; declines are ink. Small accent
   text uses `--accent-deep`. No blanket orange swap, no darkened art.
9. **Dark mode.** Token swap only; every new surface pair is declared for
   both themes; `test/appearance.mjs` remains the palette guard.
10. **Copy voice and terminology.** Brand-guide voice: sentence case, no
    exclamation marks, no em dashes, complete sentences, `{curly}`
    placeholders, one Portuguese word per thing, EN and PT together. The
    vocabulary decision OG-2 applies product-wide once made: the landing, the
    entry hub and the app never disagree on what the lifter's plan is called.
    Recommendation copy uses "target/meta" and "weight/peso" as I-05 and C-04
    set; RIR is explained where it first appears on each surface; "Pause",
    never "Hold", for the timer.
11. **Motion.** Everything through `motion-layer.js`; reduced motion removes
    all of it; new motion limited to the shelf crossfade (≤160 ms), the drain
    bar transform, disclosure height, and the landing's scroll-linked proof
    section only if it degrades to static bands without JavaScript and under
    reduced motion. Nothing animates to celebrate. Record each addition in
    `docs/design/interaction-runtime-audit.md`.
12. **Accessibility.** 44 × 44 targets at 360 in PT and EN; focus order and
    restoration per surface; `aria-pressed` on shelf fields; sheets never
    trap focus; charts and counts are labeled with text alternatives;
    rendered-role AA in both themes including 200% text; the contract's
    ARIA patterns (no `aria-pressed`/`aria-selected` on one-shot buttons).
13. **Responsive, 200% and reduced motion.** 320/360/390/430 phone widths;
    no horizontal page scroll; PT validated first at 360; names wrap and are
    never ellipsized; the demanding PT 200% matrix stays for every
    surface it covers today and gains the new D and onboarding states.
14. **Empty, error, loading and recovery states.** No-program Today and
    Program, stale/invalid/persist-retry drafts, transition recovery,
    transfer recovery and divergence, import failure and repair, share
    blockers, offline shell: every one keeps its semantics and receives the
    shared system. None is redesigned into a dead end or a celebration.

## 9. Implementation slices

Slices are internal commit groups on one branch, not PRs. Each slice ends
with a focused-green, pushed head and the evidence its row names. Slice
names are R0–R7; sub-slices carry letters.

| Field | Meaning in every row below |
|---|---|
| Owns | Files or regions the slice's workers may edit |
| Consumes | Contracts read but not edited |
| Unchanged | Product behaviour that must be identical before and after, and the suite that proves it |
| Prerequisite | Slices or gates that must be complete |
| Parallelism | Which sub-slices may run concurrently on separate worktrees |
| Hotspots | Shared files with one writer at a time (§10.3) |
| RED proof | The characterization or failing test established first |
| Owners | Focused test owners from `test/suites.mjs` |
| Catalog | Visual evidence expected |
| STOP | Conditions that halt the slice |
| Done | Completion evidence |
| Commit | Expected commit boundary and message prefix |

### R0 — Authority and reconciliation

- **Objective:** freeze the sources, re-derive the surface inventory from the
  live manifest, migrate the governing Direction D documents, prepare the
  owner-gate batch, and record the contract review for D's new content jobs.
- **Owns:** `plans/063-direction-d-redesign.md`, `docs/adr/0016-*.md`,
  `docs/design/direction-d-implementation-spec.md`,
  `docs/design/direction-d-strings.md`,
  `docs/design/main-screen-directions/DIRECTION-D-SPEC.md` (migrated by file
  copy from `redesign/direction-d` at its pinned SHA, with §1 row 2 and the
  workfront line amended); the Q622–Q637 section of
  `docs/product-grilling-decision-register.md` migrated from #279 with a
  note that Q636's own-PR clause is superseded by this plan; a new
  `docs/design/plan-064-reconciliation.md`
  holding the re-derived treatment table, the onboarding board, the
  terminology inventory and the contract-review record; the PR body;
  `tools/check-canonical-contradictions.mjs` SCOPE gains this plan and the
  reconciliation document.
- **Consumes:** every governing document in §4; `docs/ui-screens/manifest.json`.
- **Unchanged:** all production files. R0 ships no runtime change.
- **Prerequisite:** the branch exists (§11.2); the standalone workfronts are
  merged or dispositioned.
- **Parallelism:** the document migration, the onboarding board and the
  terminology inventory are three independent packets.
- **Hotspots:** none in production; `docs/backlog.md` and `plans/README.md`
  are orchestrator-only.
- **RED proof:** `node tools/check-canonical-contradictions.mjs` and
  `node tools/check-ui-overhaul-disposition.mjs` pass with the migrated
  documents; a deliberately duplicated Plan 063 file fails the plan-index
  check.
- **Owners:** `fast` lane document checkers; `tools/build-i18n.mjs --check`.
- **Catalog:** none.
- **STOP:** a migrated document contradicts a locked row; the live manifest
  has a screen the treatment table cannot classify; the owner rejects the
  batch framing.
- **Done:** OG-1–OG-5 asked in one comment; treatment table pinned; contract
  review text for the shelf, inline rest, prescription row, frequency counts
  and any landing surface pair recorded; PR body acceptance contract filled.
- **Commit:** `docs(plan-064): …` commits only.

### R1 — Shared visual and interaction language

- **Objective:** implement the shared components and tokens every later
  slice consumes: the ledger row, verdict mark, tab row, sheet header band,
  shelf shell (unused until R3), the landing surface pair if approved, and
  the spacing scale, on Plan 058's roles, with no frame change.
- **Owns:** `styles.css` shared and component sections; `motion-polish.css`;
  `motion-layer.js` vocabulary additions; `tools/ui-role-inventory.json`
  rows for the new components; `docs/design/ui-system-semantic-contract.md`
  contract-review amendment for the approved content jobs; `DESIGN.md`
  draft rules section.
- **Consumes:** the contract; C-01 resolution; OG-4 outcome for any token D
  proposed.
- **Unchanged:** every rendered frame (`tools/capture-ui-screens.mjs --verify`
  reports no pixel change); `tools/check-ui-system.mjs --strict-css` passes;
  no runtime behaviour.
- **Prerequisite:** R0 contract review recorded.
- **Parallelism:** none. One worker; the orchestrator reviews.
- **Hotspots:** `styles.css`, `tools/ui-role-inventory.json`.
- **RED proof:** the ui-system checker fails on an unused component that
  lacks an inventory row and passes once the row exists with `catalogStates`
  pending; the strict-CSS gate rejects a seeded literal.
- **Owners:** `test/ui-system.mjs`, `tools/check-ui-system.mjs` shards,
  `test/appearance.mjs`, `test/runtime-budget.mjs`, `test/vendor-runtimes.mjs`.
- **Catalog:** no changed frames.
- **STOP:** a component needs a size, radius or colour outside the scale; the
  shelf shell needs `app.js` changes (it does not; it is CSS and inventory only).
- **Done:** components exist, inventoried, unrendered; strict CSS green; CI
  green on the pushed head.
- **Commit:** `refactor(ui): add the shared redesign components on 058 roles`.

### R2 — Public landing and cross-product copy

- **Objective:** rebuild the first-run landing (`#firstRun`) to the final
  page's structure and copy on the shared system, including the adaptive
  shared-link variant and the install variants; land the cross-product
  recommendation copy (I-05, C-04, C-05) and the OG-2 vocabulary in both
  languages.
- **Owns:** the `#firstRun` region of `index.html`; the landing sections of
  `styles.css`; the landing render and seen-state functions in `app.js`;
  `landing.*`, `setup.*`, `rec.*`, and (under OG-2) every affected PT value
  in `i18n-en.json` / `i18n-pt.json`; `test/fixtures/recommendation-baseline.json`;
  landing catalog scenarios and manifest entries; `CONTEXT.md` glossary
  under OG-2; `docs/design/landing-candidates/` gains only a short
  provenance README pointing at the source branch SHA (candidate rounds are
  not migrated).
- **Consumes:** ADR 0006, ADR 0007 gate semantics, `install-policy.js`,
  `shared-setup.js`, the contract's landing recipes.
- **Unchanged:** shared-link adaptive behaviour and no-persist before Start
  (`test/shared-setup-flow.mjs`, `test/entry-landing*.mjs`); install
  eligibility states (`test/install-modes.mjs`); landing seen-state and the
  no-program states after it (`test/onboarding-cancel.mjs`); privacy page
  route; engine parity of every number shown (`recommendation-parity`).
- **Prerequisite:** R1; OG-2 and OG-3.
- **Parallelism:** R2a landing markup/CSS/app and R2b copy/i18n/fixture are
  two workers; R2b commits first so R3 consumes the final keys.
- **Hotspots:** `index.html` (region-scoped), `i18n-*.json` (namespace-scoped),
  `i18n.js` (orchestrator regenerates).
- **RED proof:** a characterization test of the current landing's five
  shared/standard/install variants (headline, both CTAs, shared Start, Privacy
  link, install link) that must keep passing with new copy; a failing
  assertion for each new landing section's presence and its engine-true
  numbers.
- **Owners:** `entry` lane: `test/program-entry-browser.mjs`,
  `test/install-modes.mjs`, `test/shared-setup-flow.mjs`,
  `test/entry-privacy.mjs`, `test/ui-catalog-contract.mjs`; `fast`:
  `tools/build-i18n.mjs --check`, `test/i18n.mjs`, `test/progression-fixtures.mjs`.
- **Catalog:** `onboarding-start/first-run*`, shared and install variants;
  the recommendation-copy change touches Focus and Why frames, captured in R3.
- **STOP:** any landing number is not produced by `progression-engine.js`; a
  section needs a new type tier; the shared-link variant loses the
  confirmation gate; copy adds an absolute promise.
- **Done:** landing board approved (OG-7); owners green; CI green.
- **Commit:** `feat(landing): …` and `copy(i18n): …` commits; one per
  coherent step.

### R3 — Established main app (Direction D)

- **Objective:** implement Plan 063's slices on the shared system. Plan
  063's P-table maps as follows; its P0 and P1 are absorbed by R0 and OG-6,
  and its P12 sweep by R6.

| Sub-slice | Plan 063 origin | Region | Prerequisite |
|---|---|---|---|
| R3a gate and fixture | P3a, P3b | `test/`, `tools/ui-screens/screens-app.mjs`, D acceptance checker | R1 |
| R3b Today | P4 | Today render region of `app.js`, Today CSS, `today.*` keys; Preview retired; N02 closed by removal with no-draft evidence | R3a, R2b |
| R3c Focus shelf | P5a | Focus region of `app.js` over DraftV2 commands, shelf CSS, `focus.shelf.*`; one commit path | R3a |
| R3d workout sheets | P5b | sheet renderers, N01 fixed, `⋯` actions per G-42 | R3c |
| R3e input well removal | P5c | Focus region | R3c, R3d green |
| R3f inline rest | P6 | rest state consumers, `rest.inline.*` | R3c |
| R3g Why | P7 | Why sheet, `why.*`, four new states | R2b |
| R3h summary | P8 | `#sessionSummary`, `summary.*` | R3b |
| R3i Progress | P9a, P9b | Progress region, `progress-model.js` consumers only, chart | R3a |
| R3j History | P10a, P10b | `history-ui.js`, History region | R3a |
| R3k Program | P11 | Program region; readiness retired; OG-5 allowlist deletion | R3a, OG-5 |

- **Consumes:** I-01, I-02, I-08, I-09; DraftV2, `progress-model.js`,
  `program-transition.js`, `progression-engine.js` read-only.
- **Unchanged:** every contract in Direction D spec §5, proved by
  `workout-draft-parity`, `focus-only-parity`, `persistence`,
  `persistence-race`, `workout-finish-boundary`, `adversarial-draft-transactions`,
  `recommendation-parity`, `summary-evidence`, `progress-evidence`,
  `management-summary`, `history-edit`, `history-delete-replay`,
  `history-persistence-race`, `program-actions`, `share-repair`, the
  telemetry runtime and privacy suites, and `test/simulation.mjs`.
- **Prerequisite:** R1; R2b for copy; OG-6 for each drawn state.
- **Parallelism:** four concurrent workers at most, on disjoint regions:
  {R3c → R3d → R3e → R3f} serial in one worktree; {R3b, R3g, R3h} one worker
  serially; {R3i} one worker; {R3j} one worker; {R3k} after any of the above
  finishes. R3a first, alone.
- **Hotspots:** `app.js` (region-scoped; the orchestrator integrates in
  sub-slice order), `styles.css` surface sections, `i18n-*.json`
  namespaces, `index.html` sections, `tools/ui-screens/*` scenarios and the
  manifest, `telemetry.js` (R3k only).
- **RED proof:** per sub-slice, the D acceptance gate (targets, overflow,
  orange budget, parity, strings) rejects seeded failures before the surface
  is built; a characterization run of the existing surface's owners on the
  base commit is recorded with `--evidence`.
- **Owners:** the suites listed above per region, plus the D acceptance gate.
- **Catalog:** per sub-slice affected flows; retired states removed from the
  manifest in the same commit that removes the route.
- **STOP:** a second commit path for a set; a target computed in the
  presentation layer; a DraftV2 or transfer envelope change; a producer
  detached from its telemetry boundary; a state the drawing round has not
  approved; the rest clock or any protected variant changed without OG-4.
- **Done:** every sub-slice board approved (OG-7); owners green; N01/N02
  closure evidence linked; CI green.
- **Commit:** one `feat(<surface>)` or `refactor(<surface>)` commit per
  sub-slice, matching Plan 063's messages where they still apply.

### R4 — Onboarding and entry

- **Objective:** implement the owner-selected direction (OG-1) for the entry
  hub and every entry route on the shared system, preserving the entry state
  machine, step IDs, route transitions, draft key, activation semantics and
  the five jobs.
- **Owns:** the `#onboarding` section of `index.html`; entry CSS sections;
  `program-entry-adapter.js` presentation only; the entry render functions in
  `app.js`; `entry.*`, `onb.*`, `import.*`, `picker.*` keys; entry catalog
  scenarios and manifest; a migrated
  `docs/design/onboarding-<direction>-brief.md` from #279 (the selected
  direction's brief and PD-1–PD-4 only; rounds and captures are not migrated).
- **Consumes:** `program-entry.js` (unchanged), `program-compiler.js`
  (unchanged), `docs/program-entry-flow.md`, ADR 0007, ADR 0014,
  `shared-setup.js`; the R2 landing (the tournament harness renders the Plan
  054 landing, which R2 replaces, so R4 never ports a landing).
- **Known engine finding, not absorbed:** the tournament's PF-1 (a growth
  three-day program's Day 1 label names lower-body hypertrophy over
  upper-body content) is compiler truth, not presentation. It is triaged as
  its own narrow fix outside this workfront.
- **Unchanged:** every entry contract: `test/program-entry.mjs`,
  `test/program-entry-contracts.mjs`, `test/program-entry-production-adapter.mjs`,
  `test/program-entry-browser.mjs`, `test/program-entry-rules-runtime.mjs`,
  `test/program-entry-conflict-runtime.mjs`, `test/program-freeform-import.mjs`,
  `test/entry-privacy.mjs`, `test/shared-setup-flow.mjs`, `test/onboarding-cancel.mjs`,
  `test/generative-entry-runtime.mjs`; activation archiving from advisor plan
  001 if landed.
- **Prerequisite:** R1; OG-1; OG-2; R2b copy.
- **Parallelism:** R4a hub and shared components, R4b Recommend/Custom/Browse
  steps, R4c import and shared-link routes, once R4a's components exist.
  R4 may run concurrently with R3 (disjoint regions).
- **Hotspots:** `index.html` `#onboarding` region, `app.js` entry region,
  `program-entry-adapter.js`, `i18n-*.json` entry namespaces.
- **RED proof:** the entry state-machine suites recorded green on the base
  commit; a failing catalog-contract assertion for each new entry state;
  the semantic step-ID assertions in `test/ui-catalog-contract.mjs` held.
- **Owners:** `entry` lane in full; `fast` entry suites.
- **Catalog:** all `onboarding-*` flows (≈250 frames).
- **STOP:** any change to `program-entry.js` state or `program-compiler.js`;
  a route or step ID renamed; persistence before Start; the free-form door
  gains a request; fewer than five jobs reachable; a bundled program appears.
- **Done:** entry board approved (OG-7); `entry` lane green; CI green.
- **Commit:** `feat(entry): …` commits per sub-slice.

### R5 — Cross-surface journeys

- **Objective:** make the transitions one product: landing → entry →
  activation → Today; shared link → gate → preview → activation → Today;
  install and transfer paths from landing, Settings and milestones;
  no-program Today/Program → entry hub; cancel and return; first session →
  summary → Progress.
- **Owns:** transition glue in `app.js` (route focus, announcement, scroll
  reset), guide anchors moved by earlier slices, journey tests.
- **Consumes:** everything above.
- **Unchanged:** G-47 landing once; G-62 guides once; install cadence; the
  first-run gate's `modal` interaction semantics.
- **Prerequisite:** R2, R3b, R3c, R4.
- **Parallelism:** two workers: journeys into the app; journeys out to
  install/transfer/privacy.
- **Hotspots:** `app.js` boot and route region (orchestrator-serialized).
- **RED proof:** a production-backed journey test per path that fails on a
  seeded broken hand-off (focus lost, guide not fired, landing re-shown).
- **Owners:** `test/program-entry-browser.mjs`, `test/install-modes.mjs`,
  `test/install-transfer-ui.mjs`, `test/focus-*.mjs`, `test/session-summary.mjs`,
  accessibility suites.
- **Catalog:** transition states already in the manifest; no new screens
  unless a journey exposes an unclassified state (then C-07).
- **STOP:** a journey needs a new screen the treatment table does not have;
  install or transfer semantics change.
- **Done:** journey suites green; CI green.
- **Commit:** `feat(journeys): …` per path group.

### R6 — Complete visual and system convergence

- **Objective:** apply the shared rules to every rules-only surface
  (Settings, Library, install, Progress lifecycle, Program management, import
  review), rewrite `DESIGN.md`, regenerate the landing's in-app shots
  (C-03), regenerate the complete catalog, run the role audit on the union,
  and perform the one coherent cache and protected-query revision.
- **Owns:** rules-only surface CSS; `DESIGN.md`; `docs/ui-screens/**`;
  `tools/ui-role-inventory.json` `catalogStates` and `observed` header;
  `sw.js` `CACHE` and precache URLs; `index.html` script query revisions;
  `test/exercise-library.mjs` expected revision; `docs/design/interaction-runtime-audit.md`.
- **Consumes:** all slices.
- **Unchanged:** offline shell and upgrade behaviour (`test/sw-upgrade.mjs`,
  `test/install-transfer-sw-upgrade.mjs`, `test/program-transition-sw-upgrade.mjs`,
  `test/workout-draft-sw-upgrade.mjs`); historical-app fixtures for
  boot-bound IDs.
- **Prerequisite:** R2–R5 green.
- **Parallelism:** one worker for the rules-only sweep; the orchestrator
  alone performs the catalog regeneration and the revision ritual.
- **Hotspots:** every shared file; this slice is the serialization point.
- **RED proof:** the ui-system merge reports every inventory selector
  rendered; the catalog verify sharded commands pass on the staged full
  capture; a seeded stale revision fails `test/exercise-library.mjs`.
- **Owners:** `visual` lane in full; `state` lane upgrade suites; `fast`
  release checks.
- **Catalog:** the full catalog, with the changed-frame disposition inventory
  (expect an inventory of the same order as Plan 058's 273 frames).
- **STOP:** any rendered-role AA failure; any selector never rendered; a
  frame that changed without a slice owning it.
- **Done:** full catalog committed; revision ritual done once; CI green on
  the head.
- **Commit:** `refactor(ui): apply the shared rules to the remaining surfaces`,
  `docs(design): rewrite DESIGN.md for the unified redesign`,
  `test(catalog): regenerate the complete catalog`, `chore(release): advance
  the shell revision`.

### R7 — Adversarial final candidate review

- **Objective:** review the whole product before merge as a reviewer who did
  not build it: every journey, both languages, both themes, 320/360/390/430,
  200% text, reduced motion, offline shell, keyboard and screen-reader
  semantics in the browser, the telemetry allowlist, and every locked row.
- **Owns:** `docs/design/plan-064-review-report.md`; fixes flow back to the
  owning slice as new atomic commits.
- **Consumes:** everything.
- **Prerequisite:** R6 green.
- **Parallelism:** three independent reviewer packets (journeys and
  semantics; visual and accessibility matrix; contracts and telemetry),
  each with fresh context, then the orchestrator's synthesis.
- **RED proof:** each finding has a reproduction and a closing assertion;
  stable finding IDs.
- **STOP:** a locked row is violated; a Plan 059-only claim appears in the
  report as satisfied.
- **Done:** all blockers closed with evidence; the owner's phone read
  (OG-8) requested with the final catalog.
- **Commit:** fix commits named by the finding they close.

## 10. Opus and Sonnet delegation model

### 10.1 Opus orchestrator responsibilities

1. Pin `origin/main`, the open-PR inventory, the live shell revision and the
   catalog counts before any work, and again at every slice boundary.
2. Create and own the integration branch and the one draft PR; keep the PR
   body's acceptance contract, slice status, gate status and next exact steps
   current after every integration.
3. Assign packets (§10.2) with exact file ownership; never two writers on one
   hotspot at once (§10.3).
4. Review every packet result before integration: run the packet's owning
   suites, read the diff adversarially against the decision ledger, and
   reject scope creep, a second commit path, a new token or role, or a copy
   change outside the packet's namespace.
5. Integrate commits serially onto the branch; resolve conflicts; regenerate
   `i18n.js`; recapture affected catalog flows; commit PNGs; push promptly
   once focused-green.
6. Run and read CI on every pushed head; a red head is fixed before the next
   integration; never retry to green.
7. Enforce the cache and protected-query discipline: interim bumps only when
   a precached file's behaviour changes; one coherent revision in R6 from the
   then-live `main`.
8. Post the frame boards and the owner-gate batch; stop dependent slices at
   a gate; record every owner reply in the PR body.
9. Freeze the candidate head after R7; hand to the owner at OWNER REVIEW.
10. Keep the standalone workfronts (§11.1) and the post-redesign PRs (§15)
    out of the branch.

### 10.2 Sonnet worker packet contract

Every packet the orchestrator sends contains, verbatim:

- the slice and sub-slice ID and its objective in one sentence;
- the exact surface or contract, with the governing document sections;
- files and regions the worker may edit, and files it must not touch;
- the RED proof or characterization to establish first, with the command;
- the focused owners to run before handing back, with `--evidence` where the
  slice requires provenance;
- the expected commit boundary and message;
- the STOP conditions for that packet;
- the handoff format: base SHA, head SHA, commands run with results, the
  evidence path, changed files, open questions, and an explicit "no product
  decision was made" line or the decision it needs.

Workers never invent shared design rules, tokens, roles, keys outside their
namespace, or test policy. A worker that needs one stops and reports.
Workers do not commit PNGs, `i18n.js`, `sw.js`, `index.html` script tags or
`test/exercise-library.mjs` revisions; the orchestrator does.

### 10.3 Hotspot ownership and concurrency

| Hotspot | Rule |
|---|---|
| `index.html` | Region-scoped: `#firstRun` (R2), `#onboarding` (R4), one main section per R3 sub-slice, script tags and shell IDs orchestrator-only. |
| `app.js` | Region-scoped by surface render function group; boot, routing and persistence regions orchestrator-only; at most four concurrent workers on disjoint regions. |
| `styles.css` | R1 owns shared and component sections alone; later workers append or edit only their surface section; tokens are orchestrator-only after R1. |
| `i18n-en.json`, `i18n-pt.json` | Namespace-scoped per packet; `i18n.js` regenerated by the orchestrator only; never hand-merged. |
| `tools/ui-screens/*`, `docs/ui-screens/manifest.json` | Workers add or retire their own states; the orchestrator captures and commits frames. |
| `tools/ui-role-inventory.json` | R1 and R6 only, plus the row a sub-slice's new selector needs, reviewed by the orchestrator. |
| `sw.js`, `test/exercise-library.mjs` revision, `telemetry.js` | Orchestrator-only (R3k's allowlist deletion is prepared by the worker and applied by the orchestrator). |
| `docs/backlog.md`, `plans/README.md`, the clearance sequence | Orchestrator-only, and only for status. |

Concurrency map: R0 packets in parallel; R1 alone; R2a ∥ R2b (R2b first);
R3a alone; then up to four R3 workers on disjoint regions ∥ R4 (after OG-1)
∥ R2a; R5 after its prerequisites; R6 and R7 orchestrator-led.

## 11. Branch and PR topology

### 11.1 Standalone alpha-readiness workfronts (parallel development, serialized integration)

| Workfront | Branch/PR | Development | Integration order and rule |
|---|---|---|---|
| Advisor 001 archive-on-activation | new branch | now, in parallel | Small, `app.js` one function plus a `shared-setup-flow` case |
| Advisor 002 never cache an error response | new branch | now, in parallel | Starts with the RED characterization against live `sw.js`; `main` already guards `response.ok` on every `cache.put` after the release-asset restructure, so the deliverable may reduce to the regression suite and a doc line, with no revision bump. If the characterization passes on `main`, close the plan as satisfied instead of manufacturing a change. |
| Advisor 023 alpha trust producers and coverage guard | new branch | now, in parallel | Producers attach at the DraftV2 commit boundary, `openWhySheetFor`, individual skip dispatch and review navigation, not to `.saveset` DOM handlers, so R3 keeps them by construction; the guard test is new on `main` |
| Advisor 024 persistent storage and durability status | new branch | now, in parallel | Request at the first completed session commit point; the Settings row is restyled by R6 |
| #255 unsupported-grammar measurement | `t3code/measure-unsupported-workout-grammar` | now | Merge current `main` by merge commit; its `sw.js` hunk and shell test must be rewritten for the release-asset `ASSETS` structure; replace the old post-059 gate wording; privacy proof on the exact head |
| PT-BR entry catalog corrections (PD-5, Q625) | new small branch, optional | now, if the owner wants it before the redesign | Value-only PT-BR fixes for the European-Portuguese entry strings still on `main`; consistent with Q625. If it has not landed when R4 starts, R4 absorbs it under the OG-2 vocabulary pass. |

Rules:

1. Development is concurrent. Integration into `main` is one at a time, in
   the order the branches become green and reviewed, with these exceptions:
   001 before 002 if both are ready (advisor README dependency), and 023
   before 024 if both touch the first-session commit point.
2. Each branch merges current `main` by an explicit merge commit before its
   final proof; published branches are never rebased, amended or
   force-pushed.
3. Cache revision is allocated at merge time from the then-live `main`
   (`CACHE` + every protected `?v=` + the expected revision), never from the
   plan text or a PR number. Only one cache-bumping branch is merge-active at
   a time; the others wait and re-merge `main`.
4. Conflict ownership: the later-merging branch resolves; `app.js` regions
   are disjoint (activation, saveset/why/skip/review, first-session and
   Settings, free-form import), so conflicts are expected only in `sw.js`,
   `index.html` script tags and `test/exercise-library.mjs`.
5. Exact-head CI: a green `ci` on the final pushed head after the last
   `main` merge is the merge evidence. Independent review reads the same head.
6. The unified redesign branch is cut only after these five are merged or the
   owner has explicitly deferred a stalled one behind the redesign. A small
   PR merging forward over the redesign is cheap; the reverse is not.

### 11.2 Unified redesign branch and PR

- **Branch:** `redesign/unified-convergence`, created from the stabilized
  post-standalone `main` SHA, recorded in the PR body as the base.
- **PR:** one draft production PR titled for Plan 064, opened before R0 work
  with the acceptance contract from `docs/agents/implementation-evidence.md`.
  It stops at OWNER REVIEW; only an explicit owner instruction merges it.
- **Source PRs #272, #276, #279:** remain open as reference artifacts, with
  a comment linking to the workfront PR, until the corresponding migration
  commit exists on the workfront branch (R0 for #272's documents, R2 for
  #276's copy and page, R4 for the selected onboarding brief). Each is then
  closed, not merged, with a closing comment naming the workfront commit
  that carries its useful content and the SHA at which it was read. Their
  branches are retained unmerged for provenance; nothing deletes them.
- **Never** merge their Git histories into the production branch. The
  prototype code, candidate rounds and tournament captures do not enter
  `main`; `docs/design/plan-064-reconciliation.md` records where each source
  lives (branch, SHA, path) so provenance stays discoverable.
- **Cache discipline inside the branch:** a precached file that changes
  behaviour bumps the revision in the same commit as `AGENTS.md` requires;
  the orchestrator squashes nothing, so interim bumps stay in history; R6
  performs the final coherent revision from the then-live `main`.
- **Merging `main` into the branch:** at slice boundaries only, by explicit
  merge commit, followed by the affected owners and a push.

## 12. Verification model

The merged CI contract applies unchanged:

1. Establish the RED proof or characterization named by the slice.
2. Implement the smallest coherent step; run the exact owning suite or
   `node tools/run-tests.mjs edit`.
3. Commit when focused-green; push promptly so remote `ci` runs the complete
   inventory on the head.
4. Run independent review of the packet in parallel with CI.
5. Run `node tools/run-tests.mjs packet --base <slice-start-sha>` when the
   environment can complete it usefully; it is supplemental, never merge
   evidence.
6. A green `ci` on the exact final head after R7 is the broad completion
   evidence. Owner boards and the phone read are separate, human evidence.

Not restored: the manual `candidate` mode as routine evidence, the old
feedback/candidate workflow, expected-SHA mechanics, or retries to green.
`candidate` and `shard k/n` are for reproducing a remote failure only.

Evidence provenance: focused proofs for contract rows use
`--evidence /tmp/proof-<slice>.json` on a clean commit and are linked from
the PR body; `.ci-results/` artifacts on CI are the retained logs.

## 13. STOP conditions

| ID | Condition | Action |
|---|---|---|
| S-1 | A locked row (§5.1) would change | Stop the packet; report; no workaround |
| S-2 | An owner-gated decision is needed to continue | Stop the dependent slice; continue independent slices; post the gate |
| S-3 | A second commit path, a presentation-layer target, or a DraftV2/transfer/setup-link envelope change appears | Reject the packet |
| S-4 | A new role, type tier, radius, palette value or shadow outside the contract is required | Stop; route through the R0/R1 contract review |
| S-5 | A rendered-role AA failure, never-rendered selector, or strict-CSS literal on the head | Fix before the next integration |
| S-6 | Two writers on one hotspot | Serialize; the later packet re-bases on the integrated head by merge, never by rebase of published history |
| S-7 | `main` moves under the branch with a cache bump | Merge `main` at the next slice boundary; re-run affected owners; no work continues on a stale base |
| S-8 | #257, #258, Plan 059 evidence, or any Later/Gated backlog item is being pulled in | Remove it; §16 |
| S-9 | A catalog frame changes with no owning slice | Investigate before accepting |
| S-10 | The owner has not selected the onboarding direction when R2, R3 and R5's app journeys are green | Report; wait; the §3.1 contingency needs an explicit owner instruction |
| S-11 | A physical-device or launch-acceptance claim is about to be written as satisfied | Remove it; Plan 059 owns it |

## 14. Completion gate (OWNER REVIEW)

The workfront is ready for owner review when all of the following hold on
one pushed head:

- R0–R7 complete with their Done evidence linked in the PR body;
- every owner gate OG-1–OG-7 recorded as approved with the owner's reply;
- N01 and N02 closed with evidence;
- `ci` green on the exact head; the ui-system merge reports every inventory
  selector rendered; the full catalog committed and its changed-frame
  disposition inventory reviewed;
- the shell revision advanced once from the then-live `main`;
- `DESIGN.md`, `CONTEXT.md` glossary (under OG-2), the interaction-runtime
  audit, ADR 0016's amendment lines, `plans/README.md` and the backlog
  status rows are current;
- `docs/post-058-open-pr-clearance-sequence.md` and
  `docs/ui-overhaul-plans-049-057-audit.md` next-steps carry no obsolete
  three-merge claim;
- #272, #276 and #279 are closed with their provenance comments;
- the review report (R7) has no open blocker;
- OG-8 requested.

Merge needs an explicit owner instruction. The merged SHA is the input to
the remaining candidate sequence (§15), not yet the Plan 059 candidate.

## 15. Post-redesign sequence and the Plan 059 boundary

After the unified redesign merges:

1. **#258 historical migration foundation.** Real Hevy and Strong evidence
   (sanitized clean-account exports or authoritative current schema
   documentation) remains mandatory; the committed fixtures are synthetic and
   must never be relabeled as provider support. Allowed owner dispositions if
   evidence is still unavailable: narrow the PR to generic CSV with truthful
   provenance; defer/close the PR while the backlog row stays; or supply the
   evidence. The branch-local Plan 063 file is renumbered on resume. Durable
   History integration consumes the merged Direction D History contract.
2. **#257 free one-off sessions.** Production implementation requires the
   post-redesign Today, Workout and History contracts, a DraftV2 version or
   migration strategy proved through install-transfer fidelity, consumer
   migration (adherence, block review, recommendations, History readers),
   adherence and progression truthfulness, and resolution of the
   protected-purpose rule. Its original red entry result stays red until
   proved otherwise on a current head. Program-aware Pro planning stays Gated.
3. **Final convergence.** Re-run the open-PR inventory, canonical documents,
   cache and protected-query contract, catalog and candidate selection; no
   stale "post-059" or three-merge claim survives.
4. **Plan 059.** One immutable candidate SHA. Plan 059 alone owns: the SHA
   pin and release evidence manifest; the final launch catalog and
   scroll-clearance matrix; launch accessibility acceptance; the
   telemetry/privacy launch freeze; physical iOS Safari/PWA/VoiceOver and
   Android Chrome/PWA/TalkBack evidence; final reconciliation; owner
   sign-off. This workfront produces pre-059 implementation evidence only
   and never claims a 059 gate.

## 16. Non-goals

- No new design tournament, no blank-sheet reopening of ratified decisions.
- No executable workout grammar, one-off sessions, historical import,
  publisher attribution, equipment contexts, Pro, payment, entitlement,
  managed AI, cloud sync, native shell, root dependency, framework, event
  bus, or repository/service layer.
- No generic SaaS pattern: no cards for reading content, no avatars, no
  streaks, badges, scores, celebrations, no carousel onboarding, no
  permanent chat tab, no cookie-banner theatre.
- No weakening of History/progression truthfulness, privacy, durability,
  accessibility, owner or same-SHA gates to make the PR merge faster.
- No physical-device or launch-acceptance claim.
