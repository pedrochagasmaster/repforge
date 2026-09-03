# Taurifer UI audit: consolidated finding register

**Status:** final and owner-approved on 2026-09-03
**Current baseline:** `fe4bf52c`, 72 manifest screens, 221 catalog frames
**Scope:** the four independent audits merged in PRs #215, #216, #217, and #219, reconciled against the current repository

This report replaces the four source reports as the place to triage UI work. The source reports remain in the repository as evidence. They do not create separate queues, and their priorities do not override [`docs/backlog.md`](backlog.md).

## Sources

| PR | Source report | Review standard | Audited product baseline |
| --- | --- | --- | --- |
| [PR #215](https://github.com/pedrochagasmaster/repforge/pull/215) | [`docs/ui-screen-audit-opus-taste.md`](ui-screen-audit-opus-taste.md) | Taste skill plus its mobile companion | `a4abd24c` for cited CSS lines; the report's 71-screen and 218-frame count is not reproducible at its PR base |
| [PR #216](https://github.com/pedrochagasmaster/repforge/pull/216) | [`docs/taurifer-ui-audit-sol-design.md`](taurifer-ui-audit-sol-design.md) | Anthropic frontend-design skill plus the Taurifer brand guide | `6681f130`; 70 manifest screens and 215 catalog frames, not the stated 71 and 218 |
| [PR #217](https://github.com/pedrochagasmaster/repforge/pull/217) | [`docs/ui-screen-audit-sol-taste.md`](ui-screen-audit-sol-taste.md) | Portable parts of the Taste skill | `6681f130`; 215 catalog frames plus 13 supporting real-screen captures |
| [PR #219](https://github.com/pedrochagasmaster/repforge/pull/219) | [`docs/ui-audit-opus-design.md`](ui-audit-opus-design.md) | Anthropic frontend-design skill plus the Taurifer brand guide | 70 screens and 215 catalog frames |

Run `node tools/extract-ui-audit-findings.mjs` to print the source inventory. Run it with `--check` to verify the source set, the current catalog count, and this register's IDs.

## Reconciled verdict

The audits agree on the important part. Taurifer has a distinct identity and a strong daily workout loop. The main weaknesses sit in configuration, analysis, and enlarged-text layouts.

Seven current defects need no further product decision: raw identifiers, a missing translation, broken composed copy, fixed-width controls at 200% text, overlapping exercise filters, colliding program-editor labels, and a misleading disabled-action treatment. The owner also settled the Progress component, first-run, installation, Focus-only workout, History, sharing, onboarding, design-system, validation, and delivery questions through G-01–G-88.

The audits overstate several claims. Some apply a marketing-page standard to dense product UI. Others conflict with existing ADRs or mistake an intentional state for a defect. This register separates observed failures from taste hypotheses so a high severity label cannot substitute for evidence.

## Status terms

- **Fix** means the current artifact proves the defect. Product intent is already clear.
- **Plan** means an existing plan or backlog item already governs the work. The audit can refine acceptance criteria but cannot reopen the product decision by itself.
- **Decide** means the evidence is real, but the remedy or sequence needs an owner choice.
- **Validate** means static captures suggest a problem but do not prove runtime behavior or WCAG failure.
- **Defer** means the finding is credible polish with no present sequencing claim.

## Grilling decisions

| Decision | Answer | Consequence |
| --- | --- | --- |
| G-01, evidence bar | Two lanes | Fix defects proven by current artifacts. Require runtime, owner evaluation, or post-launch behavioral evidence before scheduling taste and comprehension hypotheses. |
| G-02, prior decisions | Nothing is off the table | ADRs, the brand guide, Plan 048, and backlog placement may be superseded if this review reaches a better decision. Factual corrections remain facts. |
| G-03, ambition | Preserve the core and redesign the weak surfaces | Keep Taurifer's identity and core workout loop. Redesign configuration, analysis, and management where the audit shows weaker structure. |
| G-04, milestone | Public-launch polish before alpha | Broader visual and structural work may move ahead of the noncommercial alpha. The canonical backlog and governing strategy documents will need reconciliation after the interview. |
| G-05, delivery model | Gated program | Deliver verified defects, product-flow redesign, system convergence, and real-device validation as separate verifiable phases. |
| G-06, evidence method | Task tests plus automated checks; owner decides | G-76 later excludes representative-lifter testing: automated gates, real-device owner evaluation, and post-launch telemetry provide the evidence. The product owner alone decides whether it justifies a change. |
| G-07, platform boundary | Static PWA by default, with case-by-case exceptions | Keep the Phase 1 local-first architecture unless the product owner approves a specific exception on its evidence and cost. |
| G-08, workout-core preservation | Preserve behavior and contracts; allow justified UX changes | Visual normalization is allowed. A larger workflow change remains possible when its improvement earns owner approval. |
| G-09, first-run gate | Redesign it as a landing page | Explain what Taurifer is and what it does before asking the visitor to proceed. Put the primary action early. The current illustration is not protected: it is too graphic and does not communicate the product's essence. |
| G-10, program-entry jobs | Keep all five jobs | Preserve Recommend, Custom, Browse, Build, and Import, but improve their grouping and labels. |
| G-11, Progress purpose | Hybrid decision guide and record | Overview and Review should guide training decisions. Strength, Volume, and PRs should provide the supporting record and evidence. |
| G-12, History interaction | Read first, then edit in place | Open a readable session. An explicit action switches that same surface into an editing state. |
| G-13, elevation | Bounded elevation roles | Avoid both flat monotony and nested-card tunnels. Reserve depth for a small set of meaningful roles. |
| G-14, component convergence | Shared semantics with contextual variants | Components share tokens, states, and meaning, while workout, editor, and management contexts may use variants when the task justifies them. |
| G-15, workout logging | Focus-led | The owner chose Focus as the direction; G-22 settles the remaining question by removing List. |
| G-16, tour and installation | Unresolved and split | Decide tour format separately from install timing. The owner sees the tour's context problem and the installed PWA's experiential advantage. |
| G-17, sharing disclosure | Task-only sheet; separate privacy page | Remove privacy and transport explanations from the sharing action. Put all disclosure on a dedicated page, accepting that users can share without reading it. |
| G-18, first-run proposition | “Get the right program. Know what to do next.” | Follow the headline with a concrete explanation that Taurifer builds or runs a strength program, tracks completed work, and turns it into next-session targets. |
| G-19, first-run visual | Product-led preview | Replace the Milo illustration with a restrained view of the program → logged set → next target loop. |
| G-20, first-run action | One early “Start training” action | Open the five-job program-entry chooser from the landing page instead of placing all five choices in the hero. |
| G-21, first-run ethos | Distill it | Keep one short ethos line on the landing page. G-73 removes the complete passage instead of relocating it. |
| G-22, workout logging | Focus only | Remove List mode. Focus becomes Taurifer's sole workout-logging experience. |
| G-23, History calendar | Session replaces calendar | After selection, show compact date context and a Back-to-calendar action rather than retaining the month above the session. |
| G-24, Progress vocabulary | Separate outcome from recommendation | Outcomes are improved, maintained, or declined. Recommendations are progress, repeat, or review. |
| G-25, expert configuration | Keep every option visible | Improve information design and responsive layout without collapsing or deferring advanced choices. |
| G-26, Browse comparison | Scan-first summaries | Lead with frequency, duration, equipment fit, and progression model, then disclose programming detail. |
| G-27, sparse Progress data | Adapt to evidence count | One point is a snapshot, two are a comparison with a delta, and three or more form a trend chart. |
| G-28, design-system convergence | Complete migration before public launch | Define the bounded type, radius, progress, elevation, and control-role system, then migrate every public surface in a dedicated phase. |
| G-29, Progress navigation | Two levels | Keep Overview and Review primary. Group Strength, Volume, and PRs under Evidence. |
| G-30, Overview contract | Weekly status plus program action queue | Answer both how the week is going and what currently needs action, without mixing their scopes. |
| G-31, insufficient evidence | Neutral baseline | Describe untested and early observations as baseline-building. Reserve attention for evidenced, actionable conditions. |
| G-32, Review and End block | One lifecycle surface | Review is read-only during the block and exposes confirmed transition actions when the block ends. |
| G-33, recommendation fidelity | Implement faithful transitions | A simpler schedule must change scheduling and a deload must follow a defined deload model. Every structural change requires preview and confirmation. |
| G-34, Strength scope | Current block by default | Provide an explicit all-history view as supporting context. |
| G-35, Volume scope | This week plus block-to-date | Compare both periods with the plan for their actual elapsed time. |
| G-36, mobile Progress evidence | Summary rows with drill-in | Keep full tables only as secondary detail or export views. |
| G-37, shared-link first run | Adaptive landing page | Explain Taurifer briefly, identify the received program, and lead with `Start this program`; bypass the five-job chooser. |
| G-38, dates | Locale-aware roles | Use long dates for headings, short dates for lists, and the platform-native date control while editing. |
| G-39, installation timing | Platform-sensitive promotion | Treat installation as the intended mobile experience. Offer it before local data exists on iOS, preserve shared-link handoff, promote it after first value on Chromium, and keep it in Settings. G-48 and G-72 define persistent non-blocking reminders. |
| G-40, tour format | Contextual guidance | Remove the global modal tour. Teach logging, Progress, and block review inside the first real use of each task, with replayable help in Settings. |
| G-41, Focus order | Structured flexibility | Let users inspect and reorder exercises and repeat last-session values, but enter each exercise's sets in order. |
| G-42, Focus utilities | Layer by scope | Put session overview, date, bodyweight, notes, and early finish in a Session sheet. Put substitution, warm-ups, setup notes, skip/restore, and repeat-last under exercise actions. |
| G-43, active-workout navigation | Immersive with safe exit | Keep the global dock hidden. An explicit Leave workout action returns to the app while preserving the draft. |
| G-44, Today preview | Read-only session map | `Preview session` shows the planned exercises without starting the workout; `Start workout` enters Focus. |
| G-45, share repair | Repair unresolved rows in context | List each unresolved exercise in Share, open the existing explicit replacement flow for that row, and return to Share afterward. |
| G-46, privacy location | Cached in-app page | Link the page from the landing page and Settings, not from the task-only Share sheet. |
| G-47, abandoned first run | Enter the no-program app | The landing page appears once. Later visits use the Today and Program no-program states and their setup actions. |
| G-48, installation pressure | Persistent but non-blocking | Present installation as the intended mobile experience, remind at meaningful milestones with a cooldown, and never lock browser use behind successful installation. |
| G-49, contextual guidance | Action-linked cues | Attach short guidance to real controls, complete it through real use, and keep replayable task guides in Settings. |
| G-50, entry chooser hierarchy | Recommend leads | Make Recommend primary, Custom its deliberate alternative, Browse separate, and Build/Import a `Bring or build my own` group. |
| G-51, landing preview execution | Compare generated directions before selection | Use the imagegen skill during the landing-page visual phase to create several preview-only, faithful mini-interface directions. The owner chooses the direction before it becomes a project asset or implementation reference. |
| G-52, visible expert controls | Reflowing rows | Show every muscle in a hairline-separated row with a labelled 2×2 choice group that survives enlarged text. |
| G-53, simpler-schedule diagnosis | Ask what failed | Distinguish fewer available days from sessions running too long, then preview a reconstructable lower-frequency or shorter-duration sibling. |
| G-54, full-block volume reduction | Separate explicit action | Name it `Reduce training volume`, respect protected/minimum work, and preview the next-block change. |
| G-55, deload model | Volume-only recovery week | Reduce eligible sets in week one of the next normal block, then restore the canonical prescription in week two. |
| G-56, deload evidence | Performance plus corroboration | Require stagnation or decline plus a short user recovery/readiness check before recommending a deload. |
| G-57, typography | Preserve the Sans/Mono jobs | Keep Plex Sans for language and controls and Plex Mono for training data and technical values; normalize the scales. |
| G-58, dark-mode exercise art | Preserve paper backgrounds | Treat licensed illustrations as physical paper artifacts placed on the dark surface. |
| G-59, enlarged-text validation | Risk-based matrix | Capture both languages broadly, add Portuguese at 200% for demanding surfaces, and assert overflow across every screen. |
| G-60, outcome color | Semantic but restrained | Use green for improved, a reserved warning color for declined, and neutral styling for maintained; words and icons always carry meaning. |
| G-61, unreconstructable transition | Guided manual repair | Preserve the exact program, open a transition editor with the diagnosed target highlighted, and require explicit changes. |
| G-62, contextual-cue dismissal | Dismiss once | Performing the action completes the cue; dismissing suppresses it; Settings can replay it. |
| G-63, summary muscle volume | Ranked counts without bars | Show top muscles and weighted hard-set totals without a target-like relative bar. |
| G-64, Today progress | Block plus week | Keep current block position and one weekly completion line beside the day strip. |
| G-65, Program readiness | Actionable nonzero count | Hide zero; otherwise show `N exercises ready to add weight` as a route to those exercises. |
| G-66, Settings hierarchy | Visible task-based sections | Group training behavior, app experience, data/privacy, and help; route detailed explanations to dedicated surfaces. |
| G-67, rest-timer accent | Orange progress, neutral controls | Let the ring communicate the live timer state without a competing orange action mass. |
| G-68, History edit commit | Explicit Save and Cancel | Track unsaved changes and place deletion behind a separate confirmation. |
| G-69, contextual-guidance coverage | Lifecycle essentials | Cover the first set, Focus utilities, Progress interpretation, block transition, backup, and installation. |
| G-70, recovery-week minimums | Separate recovery policy | Aim for roughly half the working-set volume, omit optional work first, allow ordinary `minSets` to be crossed, and retain at least one working set for primary movement patterns. |
| G-71, post-data iOS installation | Automatic temporary transfer service | Use a real short-lived backend record and a one-time install token; import atomically, delete on claim or expiry, and leave the Safari copy untouched. This is an approved exception under G-07: local-first does not mean local-only. |
| G-72, install reminder cadence | Milestones with increasing cooldown | Offer at the platform-sensitive first-run point, after the first saved workout, after the third workout if declined, and then no more than monthly; measure and revise. |
| G-73, complete ethos passage | Remove it | Keep only the short ethos line chosen in G-21; do not relocate the complete poem elsewhere in the product. |
| G-74, contrast standard | WCAG 2.2 AA by rendered role | Test actual text, graphics, controls, boundaries, surfaces, sizes, and states instead of replacing the accent globally. |
| G-75, runtime accessibility | Automated and real-device gates | Test scroll clearance and critical flows in browser and installed modes on iOS and Android, including VoiceOver and TalkBack; the owner signs off. |
| G-76, redesign evaluation | Owner only | Do not recruit representative lifters for prototype or implemented-flow testing. Automated evidence and the owner's evaluation govern acceptance. |
| G-77, delivery order | Foundations first | Fix verified defects and validation tooling, repair state/provenance foundations, then deliver landing/entry, Focus, Progress/transitions, management surfaces, system convergence, and launch validation. |
| G-78, planning structure | Umbrella initiative with bounded child plans | Give each phase explicit dependencies, migrations, acceptance criteria, tests, and a completion gate; reconcile the canonical backlog and affected ADRs. |
| G-79, recommendation result | Merge result and editable preview | Show the primary recommendation, close alternative when present, rationale, editable program, and explicit activation on one coherent surface. |
| G-80, Program action dock | Shallow sticky layer | Give persistent editor actions a restrained boundary and elevation without making the dock a card or modal sheet. |
| G-81, landing visual continuity | Use normal product language | Build the landing composition from the normal tokens and components; do not create a special motif that onboarding must repeat. |
| G-82, shared creator identity | Defer | Do not imply trust with an unverified name or avatar; wait for a real publisher-identity and authenticity contract. |
| G-83, post-launch comprehension evidence | Privacy-preserving telemetry | Measure the relevant funnels and task outcomes; the owner alone interprets the evidence and decides changes. |
| G-84, installation-transfer scope | Exact logical clone | Transfer durable and draft state, device preferences, analytics consent, and telemetry identity. Exclude volatile journals, locks, transaction markers, caches, and service-worker state. |
| G-85, installation-transfer lifetime | One hour maximum | Delete a transfer immediately after successful claim and expire any unclaimed record after 60 minutes. |
| G-86, transfer consent | Explicit install-and-transfer action | Explain the temporary encrypted copy and expiry before creating it; keep the original browser state untouched. |
| G-87, migrated telemetry identity | Preserve it | Treat Safari and the installed PWA as one logical Taurifer installation, emit `late_install_transfer`, and distinguish browser from standalone context. |
| G-88, browser state after transfer | Recovery snapshot | Stop normal browser use after confirmed import, direct the user to the installed app, and provide an explicit divergence warning before `Resume in browser`. |

## Correctness and accessibility

### UI-01 Internal identifiers reach visible copy

**Status:** Fix. **Sources:** PRs #215, #216, #217, and #219.

The Build editor still joins raw `day_empty:*` issue strings in `updateOnboardingEditorActions()`. The current catalog prints `day_empty:manual_d1`, `day_empty:manual_d2`, and `day_empty:manual_d3`. The custom-exercise sheet also prints `picker.equipment.band` because that surface asks for a key that the current dictionaries do not define.

Map activation issues to day labels before interpolation. Use the existing `entry.equip.band` translation or make the picker use the same equipment-key namespace. Add a rendered-copy check that rejects key-shaped text.

### UI-02 Composed copy produces broken sentences

**Status:** Fix. **Sources:** PRs #215 and #219, with related localization concerns in PR #217.

The exercise detail page renders `Understand` next to `Why this weight?` with no separator. Recommendation reasons insert display labels into sentences and produce copy such as `Written for a Full commercial gym.` The visible strings are not wrong because of translation quality. They are wrong because the UI composes fragments that require different grammar.

Give the exercise-detail action one complete label. Replace sentence-fragment interpolation with complete variants or values designed for sentence use in both languages.

### UI-03 Fixed controls fail at 200% text

**Status:** Fix. **Sources:** all four PRs.

The current Custom schedule still packs five duration choices into one row, so every `minutes` label overlaps its neighbors at 200% text. The muscle-priority screen still clips `Prioritize` and `De-emphasize` inside four fixed tracks. Import and review metric bands become crowded, although their current captures remain readable. PR #220 improved several onboarding strings and captures, so the recommendation-result title needs a fresh runtime overflow check rather than an inherited failure label.

Switch fixed segments to full-width rows or at most two columns when enlarged text cannot fit. Treat the schedule and priority controls as component failures, not font-size tuning.

### UI-04 The catalog records enlarged text but does not gate overflow

**Status:** Validation direction decided. **Sources:** PRs #216 and #219. **Decision:** G-59.

The catalog has English 200% frames but no combined PT-BR plus 200% variant. The checks compare files and catalog membership. They do not fail when a captured document or control has horizontal overflow.

Use a risk-based matrix rather than a full language × theme × text-size product. Keep broad normal-size coverage in both languages, add combined PT-BR and 200% variants for the most demanding surfaces, and run document/component overflow assertions across every catalog screen. Image comparison alone cannot tell whether an edge is a designed scroller.

### UI-05 Exercise filter chips overlap

**Status:** Fix. **Sources:** PRs #215, #217, and #219. PR #216 correctly notes that a partially visible next chip can be a useful continuation cue.

The current Library capture shows the Barbell chip drawn over the Chest chip. The last chip is intentionally partial, but the preceding overlap is not. Preserve an edge cue while restoring non-overlapping chip geometry and a clear horizontal scroll region.

### UI-06 Program-editor labels collide

**Status:** Fix. **Sources:** PRs #215 and #219.

`REP RANGE` and `MIN` still collide in the installed editor. `.program-editor__range legend` has a `-4px` bottom margin while the installed range has a `4px` row gap. The rules cancel each other.

Remove the negative margin or give the legend a real row. Check both themes and enlarged text after the change.

### UI-07 The blocked Build action has the wrong visual weight

**Status:** Fix. **Sources:** PRs #215 and #219.

The disabled `Use this program` action is a filled grey button with white text and a live orange arrow. The enabled `Save draft` action beside it is lighter. This does not establish a WCAG failure because disabled controls are exempt, and PR #215's quoted 2.5:1 ratio came from a different opacity. It does establish reversed hierarchy.

Reuse the established `.btn--cta:disabled` treatment without the `.program-editor__activate:disabled { opacity:.5 }` override. Remove or mute the arrow while the action is unavailable.

### UI-08 Progress tables hide data without a scroll cue

**Status:** Redesign decided. **Sources:** all four PRs. **Decisions:** G-34 through G-36. **Existing queue:** Product and UX debt, `Later`, `Progress drill-down and table affordance`.

Strength and Volume use `table { min-width:520px }` inside a 358px content column at the canonical phone width. The rightmost heading is cut, mobile scrollbars are hidden, and no fade or label says that more data exists. On Strength, the affected field is the change in estimated one-rep max.

The labels also overstate the model. Strength's `Δ block` is latest minus first across all available history, with no block filter. Volume places a raw 28-day total beside a one-week plan without normalizing either period.

Replace the phone tables with summary rows and drill-in detail. Keep full tables only as secondary detail or export views. Strength defaults to the current block with explicit all-history context. Volume compares this week and block-to-date against the plan for their actual elapsed periods.

## Product states and flows

### UI-09 Progress treats missing history as poor performance

**Status:** Redesign decided. **Sources:** all four PRs. **Decisions:** G-30 and G-31.

With no completed sessions, Overview says `Needs more data` and also presents ten exercises as `attention` with orange warning dots. The count mixes program-wide conditions into a weekly summary: untested lifts, inactivity, low one-week volume, stalls, and fatigue can all contribute. The ordered headline rules can also return `On track` with zero improved and zero maintained lifts because zero is greater than or equal to zero.

Make Overview answer two labeled questions: how the current week is going, and what currently needs action across the program. Treat untested lifts and insufficient comparisons as neutral baseline-building. Reserve attention for evidenced, actionable conditions, and make the headline rules incapable of declaring progress without positive evidence.

### UI-10 Progress Review reports a recommendation without an action

**Status:** Lifecycle and fidelity redesign decided. **Sources:** all four PRs. **Decisions:** G-32 and G-33.

Review repeats the same session, lift, and volume facts in a label block and a paragraph. It ends with `Repeat with a simpler schedule.` but gives no way to inspect or make that change. The separate End block flow maps that recommendation to removing one set from every exercise; its deload recommendation performs the same set reduction and implements no deload. Mid-block Review also compares completed work with the full block's planned sessions and volume.

Merge Review and End block into one lifecycle surface. It remains a read-only checkpoint during the block and exposes transition actions when the block ends. If schedule fit failed, ask whether the user now has fewer days or needs shorter sessions, then preview the reconstructable same-family sibling. When safe recompilation is impossible, preserve the exact program and open a guided transition editor with the diagnosed constraint highlighted. Keep permanent `Reduce training volume` separate and respect protected/minimum work. Define deload as an explicitly approved, evidence-triggered volume-only recovery week at the start of the next normal block, with canonical sets restored in week two. Require stagnation or decline plus a short recovery/readiness check. Aim for roughly half the normal working-set volume, omit optional work first, allow the recovery prescription to cross ordinary `minSets`, and retain at least one working set for primary movement patterns. Preview, confirm, version, preserve compiler provenance, and reassess every transition; never mutate the program silently.

The recovery-week prescription is evidence-bounded rather than evidence-settled. A direct 2026 trial found comparable eight-week hypertrophy and 10RM outcomes after two large volume reductions that preserved load range and technical-failure effort, but it studied 19 untrained men and did not establish recovery benefits or an optimal dose. A coach Delphi study found consensus that deload volume falls but no standard load or effort rule. A 2024 trial also cautions against treating complete training cessation as harmless for strength. These sources support a conservative experiment, not an automatic universal formula: [Pancar et al., 2026](https://www.nature.com/articles/s41598-026-40612-5), [Bell et al., 2023](https://link.springer.com/article/10.1186/s40798-023-00633-0), and [Coleman et al., 2024](https://pubmed.ncbi.nlm.nih.gov/38274324/).

### UI-11 Progress navigation and PR rows need a phone hierarchy

**Status:** Navigation direction decided. **Sources:** PRs #215, #217, and #219. **Decision:** G-29.

Five primary Progress tabs fill the phone width with little continuation affordance. PRs adds a second tab row. Its wide pale bands label record type but encode no quantity, while dates, exercise names, loads, and deltas align to different edges.

Use two navigation levels: Overview and Review are primary decision surfaces; Strength, Volume, and PRs sit under Evidence. Resolve their rows with the mobile component decision in UI-08. A broader cross-program dashboard remains evidence-gated.

### UI-12 Lift outcomes and dates use inconsistent language

**Status:** Direction decided. **Sources:** PRs #215 and #219, with partial support from PR #217. **Decisions:** G-24 and G-38.

Overview uses `improved / stable / attention`, Review uses `improved / flat / stalled`, and Session summary uses `improved / regressed`. Gains appear in green, orange, or plain ink depending on the screen. Dates use long prose, short prose, ISO, and a native locale-dependent input.

Keep two explicit vocabularies: observed outcomes are `improved`, `maintained`, or `declined`; suggested actions are `progress`, `repeat`, or `review`. Use locale-aware long dates for headings, short dates for lists, and the platform-native date control while editing. Color must support the words rather than replace them.

### UI-13 History combines reading and editing under a dominant calendar

**Status:** Direction decided. **Sources:** all four PRs. **Decisions:** G-12, G-23, G-38, and G-68.

The month calendar takes most of the first viewport even after the user selects a session. The session then opens as a dense edit form with truncated exercise names, a native date input, numeric boxes, and delete controls shaped like neighboring inputs. PR #216 considered the controls adequate, but all four audits agree that the hierarchy and truncation are weak.

Show a readable session first. After selection, replace the month with compact date context and a Back-to-calendar action. An explicit `Edit session` action switches that surface into editing; Save and Cancel form the commit boundary, and deletion has a separate confirmation. Preserve full exercise names and use the locale-aware native date control while editing.

### UI-14 Share setup explains the block but offers no repair path

**Status:** Direction decided. **Sources:** all four PRs. **Decisions:** G-17, G-45, and G-46.

In the captured state, `Copy link` is disabled because seven program slots have no valid built-in or live custom identity. The sheet gives one generic instruction, but does not name them or route to them. Repair currently requires closing Share, entering Program Edit, finding each row, and replacing it with a built-in or newly defined custom exercise. Raw slots can lack the equipment and primary-muscle facts required for a custom definition, so blind automatic conversion is unsafe. A long cookie, host, `index.html`, compression, and encryption paragraph receives more space than the task.

List every blocking exercise in Share with its own `Repair` action. Open the existing explicit built-in/custom replacement flow for that row and return to Share afterward. Never omit unresolved slots, fuzzy-match their names, or manufacture missing exercise facts. Keep the action sheet task-only. Move every privacy and transport fact to a cached in-app Privacy page linked from the landing page and Settings, but not from Share. Reconcile AGENTS.md, ADR 0007, the brand guide, copy catalogs, tests, and service-worker inventory with that choice.

### UI-15 Optional expert configuration is too dense

**Status:** Direction decided; plan must be reconciled. **Sources:** all four PRs. **Decision:** G-25. **Current governing plan:** [Plan 048](../plans/048-program-entry-onboarding-redesign.md).

The clearest example is muscle emphasis: 13 muscles, four buttons per muscle, and a separate status pill that repeats the selected value. Environment correction, exercise preferences, and custom-exercise metadata add similar early density.

Keep every available expert option visible rather than moving it behind progressive disclosure. For muscle priority, show every muscle in a hairline-separated row with a labelled 2×2 choice group that reflows at enlarged text. Apply the same principle to the other expert controls: improve grouping and responsive layout without hiding choices. Reconcile Plan 048's short-setup and genuinely-optional requirements with this decision.

### UI-16 Onboarding routes overlap, but their authorship split is already decided

**Status:** Direction decided; plan must be reconciled. **Sources:** PRs #216 and #217, with related density findings in PRs #215 and #219. **Decisions:** G-10, G-50, and G-79. **Current governing plan:** Plan 048.

The audits recommend merging Recommend and Custom and often merging result with review. G-10 retains five distinct jobs: Recommend, Custom, Browse, Build, and Import. G-79 merges the recommendation result and editable preview into one coherent surface while preserving explicit activation.

Make Recommend the primary job and Custom its deliberate generated alternative. Keep Browse separate. Group Build and Import under `Bring or build my own`. On the merged result/preview, show the primary recommendation, a close alternative when one exists, rationale, editable program, and one explicit activation action. Use the audit as a clarity test for labels and step count, then reconcile Plan 048 with the final first-run landing-page design.

### UI-17 Browse program entries are hard to compare

**Status:** Direction decided; plan must be reconciled. **Sources:** PRs #216 and #217. **Decision:** G-26. **Governing plans:** Plans 047 and 048.

Catalogue entries present frequency, duration, equipment, progression, and tradeoffs as dense copy. Replace them with scan-first summaries led by frequency, duration, equipment fit, and progression model. Disclose detailed programming after the comparison choice. Plans 047 and 048 still determine which program families and compatibility facts exist.

### UI-18 Active-workout chrome and list mode are crowded

**Status:** Redesign decided. **Sources:** all four PRs, with disagreement about severity. **Decision:** G-22. **Existing queue:** Focus/List preference is `Later`; broad Focus redesign is `Evidence only`.

List mode mixes a chevron, timer, `SKIP`, disclosure, recommendation, copy-last, stepper, save, and the global dock. Focus is calmer, but List currently owns substitution and undo, warm-up marking, session notes, bodyweight, programmed setup notes, early finish, last-exercise skipping, selective restore, out-of-order work, uncommitting sets, copy-last, day switching, whole-session inspection, and richer recommendation context. Focus also relies on hidden List inputs to preserve and save off-screen set data; deleting that markup first would lose draft values.

Replace the DOM-backed value carriers with an explicit draft-backed set model before deleting List markup. Focus retains a session map, arbitrary exercise navigation, repeat-last-session values, and ordered sets within each exercise. A Session sheet owns overview, date, bodyweight, notes, and early finish; exercise actions own substitution, warm-ups, setup notes, skip/restore, and repeat-last. Keep the shell immersive, with an explicit Leave workout action that preserves the draft. `Preview session` on Today opens a read-only session map without starting a workout. Then remove List and its routes, tests, catalog frames, tour copy, translations, and obsolete specification. Validate accidental exits, exercise navigation, set correction, substitutions, finish/save behavior, draft survival, and one-handed logging on real phones before declaring the resulting shell ready.

### UI-19 Install promotion and the first-use tour compete with the task

**Status:** Redesign decided. **Sources:** all four PRs. **Decisions:** G-39, G-40, G-48, G-49, G-62, G-69, G-71, G-72, and G-84 through G-88.

The install banner can sit between Today's workout action and the dock. Installation gives Taurifer a launcher icon, easier re-entry, a standalone window, portrait presentation, and safe-area treatment. It is not required for offline operation, ordinary browser use, or Taurifer's current notification code. It matters specifically for handing a received setup link from Safari into a fresh iOS 17.2+ Home Screen installation. Installation still does not provide native-grade background reminders or guaranteed storage durability.

Treat installation as Taurifer's intended mobile experience while keeping its timing capability-honest. Offer it before ordinary local data exists on iOS, preserve the received-link handoff, promote it after first value on Chromium, and keep it available in Settings. Continue with milestone-based reminders and a cooldown until installation, but never block browser use. When iOS Safari already contains data, `Install and transfer my data` creates an encrypted, one-hour backend record and one-time installation token. The installed PWA claims and atomically imports an exact logical clone, including durable state, draft, UI preferences, analytics consent, and telemetry identity, while excluding recovery journals, locks, transaction markers, caches, and service-worker state. Delete the record immediately after claim or expiry. Preserve Safari's state as a recovery snapshot, stop normal use there, and require an explicit divergence warning before `Resume in browser`. Emit a dedicated `late_install_transfer` event under the preserved pseudonymous identity and distinguish browser from standalone activity. This is an explicit local-first—not local-only—exception, and the service must be treated as capable of accessing the temporary payload. Do not claim installation is required for offline use or supplies native-grade reminders or durability.

Remove the global tour. Attach one short cue to the relevant real control for the first set, Focus utilities, Progress interpretation, block transition, backup, and installation. Performing the action completes its cue; dismissing suppresses it. Keep task guides replayable from Settings. Preserve access to the strong numbered iOS installation instructions where installation remains available.

## Design system and consistency

### UI-20 The written surface policy and the stylesheet disagree

**Status:** Direction decided. **Sources:** all four PRs. **Decision:** G-13.

The brand guide says that hairlines and whitespace replace cards and that surfaces have no drop shadows. Current CSS uses bounded cards and drop shadows for focus mode, charts, sheets, dialogs, toasts, entry choices, and the dock. Several of those surfaces are among the strongest screens in the audits.

Replace the literal no-card policy with named, bounded elevation roles. Keep page content mostly flat, allow depth where it communicates selection or floating/modal behavior, and prohibit nested-card tunnels. Update the guide and stylesheet together.

### UI-21 Equivalent controls have too many forms

**Status:** Direction decided. **Sources:** PRs #215, #217, and #219, with related findings in PR #216. **Decision:** G-14.

The audits count three steppers, several selection treatments, multiple dismissal placements, different disclosure glyphs, and two Skip treatments. Some differences express context, while others make the same action look unrelated. The flat Program editor dock is explicitly intentional and is not an accidental defect.

Define shared tokens, states, and semantics for each control role. Use contextual variants only where the task differs enough to justify them, such as fast logging versus program editing. Do not force unlike interactions into one visual component.

### UI-22 Type, radius, eyebrow, and progress rules are loose

**Status:** Direction decided. **Sources:** all four PRs. **Decision:** G-28.

PR #215 counted many literal radii and font sizes. The audits also find uppercase eyebrows on nearly every group and repeated progress markers in Focus, Today, onboarding, and the tour. Some markers describe different dimensions, such as block week and sessions this week, so deleting all but one would lose information.

Preserve Plex Sans for language and controls and Plex Mono for training data and technical values. Define small type and radius scales, reduce labels that only repeat structure, and name each progress dimension before removing duplicate encodings. Migrate every public surface during a dedicated convergence phase before public launch instead of limiting migration to touched components.

### UI-23 Focus mode wastes space and changes timer geometry

**Status:** Include in the Focus-only redesign. **Sources:** PRs #215 and #219. **Decision:** G-22.

The fixed-height Focus card leaves a large blank region after a short previous-session table. The header timer changes from a square icon to a wider running pill, which can shift the centered day title.

Make the prior-session region content-driven within a tested minimum height. Reserve timer width or remove strict visual centering during the active countdown.

### UI-24 Session summary has strong hierarchy but weak exception styling

**Status:** Direction decided. **Sources:** PRs #217 and #219. PR #216 calls this the product's best information hierarchy. **Decisions:** G-60 and G-63.

The summary emphasizes `improved` in green while leaving `regressed` neutral. The muscle-volume bar can read as 100% even when it reports 1.5 sets, and the fixture's 100kg lateral raise makes the record delta implausible.

Preserve the centered completion hierarchy. Use restrained semantic outcomes: improved is green, declined uses a reserved warning color, and maintained is neutral; words and icons always carry the meaning. Remove the relative muscle bars and show ranked weighted hard-set totals. Fix the fixture separately.

### UI-25 Today repeats weekly completion

**Status:** Direction decided. **Sources:** PRs #215, #217, and #219. **Decision:** G-64.

`1 of 3 sessions completed` appears near the block bar and again above the weekday row. `Week 4 of 6`, weekly session completion, and weekday placement are different facts, not contradictions.

Remove the duplicate sentence. Keep block position plus one weekly completion line beside the day strip.

### UI-26 Program overview and editor affordances are uneven

**Status:** Direction decided. **Sources:** PRs #215, #217, and #219. **Decisions:** G-14 and G-65.

The editor nests day, exercise, and field boundaries. Replace and Remove have similar visual weight in light mode. Program overview uses different chevrons and detail actions for rows that look alike, and `0 ready` does not name a clear quantity.

Address the label collision in UI-06 first. Define expansion, navigation, replacement, and removal as separate action roles. Give the editor's persistent action dock a restrained sticky boundary and shallow elevation rather than making it flat, card-like, or modal. Hide the readiness count at zero; otherwise show `N exercises ready to add weight` as a route to those exercises.

### UI-27 Settings disclosure hierarchy is too flat

**Status:** Direction decided. **Sources:** PRs #216, #217, and #219. **Decisions:** G-46, G-49, G-62, G-66, and G-69.

Settings is long, uses a nested inset that differs from other tabs, and gives incidental help and decision-critical privacy copy the same muted treatment. The analytics switch does not depend on color alone because its knob moves and its accessibility state changes.

Use visible task-based sections for training behavior, app experience, data/privacy, and help. Keep summaries short, route detailed privacy facts to the cached in-app Privacy page, and expose replayable lifecycle guides for cues that were completed or dismissed.

### UI-28 Rest timer uses the accent at maximum scale

**Status:** Direction decided. **Sources:** PR #219. **Decision:** G-67.

The timer stacks a large orange ring and a filled orange control, while neighboring glyphs use mixed stroke and fill weights. This is a credible brand-consistency observation, not a task failure.

Keep the live progress ring orange, make the controls neutral, and normalize glyph weight.

### UI-29 The two-point chart and its fixtures need separate judgments

**Status:** Direction decided. **Sources:** PR #215. PRs #216 and #217 praise the chart. **Decision:** G-27.

Two points connected across a narrow y-axis can make a small change look dramatic. That is a chart-policy question. The 100kg machine lateral-raise fixture is a separate credibility defect in the design catalog.

Fix the fixture without waiting. Adapt the visualization to its evidence: one point is a snapshot, two points are an explicit comparison with a delta, and three or more points form a trend chart. Dates and values remain visible rather than relying on the line alone.

## Validation findings

### UI-30 Contrast needs a control-role audit, not a blanket token swap

**Status:** Validation direction decided. **Sources:** PRs #215, #217, and #219. **Decision:** G-74.

The light `--accent` is 3.57:1 on `--bg`, while `--accent-deep` is about 4.95:1. Most small orange text already uses the deeper token, and one cited failure is an `aria-hidden` icon that meets the 3:1 graphical-object threshold. `--rule` and `--rule-strong` are too light to identify a control by themselves, but many controls also have a distinct surface, shape, or state.

Apply WCAG 2.2 AA to each rendered role. Inventory the actual foreground, background, size, and state; split decorative rules from required control boundaries where the boundary is the only cue; and test the light-theme distinction between Replace and Remove. Preserve decorative orange where valid and use deeper tokens where contrast is required. Dark secondary text already clears normal-text AA by a wide margin, so do not raise it indiscriminately.

### UI-31 Dock occlusion and runtime accessibility remain unproven

**Status:** Validation direction decided. **Sources:** PRs #215 and #217, with static-screen observations in PR #219. **Decision:** G-75.

Several captures show content behind the floating dock. The proposed cause is wrong: `body` already reserves `calc(var(--nav) + env(safe-area-inset-bottom))`. A screenshot at one scroll position does not prove that the last row is unreachable. The audits also cannot prove focus order, screen-reader output, animation timing, or tactile behavior.

Drive each long tab to its real scroll end at compact and standard phone widths and verify that every last action clears the dock. Exercise critical flows in iOS Safari/PWA and Android Chrome/PWA with VoiceOver and TalkBack. File a dock defect only if content cannot be brought fully above it or users cannot perceive that more content exists. The owner provides final sign-off.

### UI-32 The first-run gate does not explain the product or expose the action soon enough

**Status:** Redesign direction decided. **Sources:** PRs #215, #216, and #217. PR #219 argues for leaving the hero untouched. **Decisions:** G-09 and G-18 through G-21.

At 320px, the first screenful contains only the identity, title, illustration, and the start of the poem. It does not explain that Taurifer builds or runs a strength program, records performance, and turns it into a clearer next action. The current illustration is visually forceful but does not carry that explanation, and the first action is too far below it.

Lead with `Get the right program. Know what to do next.` Explain that Taurifer builds or runs a strength program, tracks completed work, and turns each session into next-session targets. Use a restrained product preview to show the program → logged set → next target loop. During the visual phase, use imagegen to create several preview-only mini-interface directions and let the owner select one before it becomes a project asset or implementation reference. An early `Start training` action opens the five-job chooser. Keep one short ethos line and remove the complete passage from the product. For a valid shared link, adapt the landing page to identify the received program and lead with `Start this program`, bypassing the chooser while retaining the existing no-persistence-before-confirmation boundary. If the visitor leaves without activating a program, later visits enter the existing no-program Today and Program states rather than reopening the landing page or resuming an abandoned route. Reconcile or supersede ADR 0006 after the owner selects the imagegen direction.

## Reconciled disagreements and prior decisions

| Audit claim | Resolution | Repository basis |
| --- | --- | --- |
| Cut or move the first-run poem so a control appears above the fold | Superseded by G-09, G-18 through G-21, and G-73. Keep one short ethos line, remove the complete passage, show the product loop, and expose an early action. | [`docs/adr/0006-first-run-ethos-hero.md`](adr/0006-first-run-ethos-hero.md) and the brand guide currently protect the old composition, so both require reconciliation. |
| Remove the ethos em dash and numeric-range en dashes | The complete poem is removed under G-73, so its exception disappears. Preserve semantic en dashes in numeric ranges. | The brand guide already permits en dashes for numeric ranges. |
| Make exercise-art backgrounds dark-theme aware | Rejected by G-58. Preserve the paper backgrounds as part of each licensed artifact in both themes. | The brand guide and ADR 0009 already require the paper treatment. |
| Merge Recommend and Custom into one route | Rejected by G-10. Keep five jobs and improve their grouping and labels. | Plan 048 already keeps the five jobs, although the new landing page may change how users reach them. |
| Always merge recommendation result and review | Accepted by G-79 for the onboarding recommendation result and editable preview. Explicit activation remains the commit boundary. | Plan 048 must be reconciled because it currently models these as sequential surfaces. |
| The Portuguese shared gate is untranslated | Closed. The shown proposal carries English as its shared language. | ADR 0007 says setup payloads carry language. Browser locale does not override an accepted proposal. |
| English exercise or fixture names on a Portuguese screen are always localization leaks | Not proven. User-authored names and fixed fixture labels are data. Taurifer-authored day-label localization is already a separate `Next` backlog item. | Backlog product and UX debt. |
| Scripted page-heading focus is visually broken | Fixed in PR #218. | `0c807118` suppresses rings on scripted `tabindex="-1"` focus while retaining keyboard focus indication. |
| Dark secondary text fails AA | Rejected as stated. | At the audited values, dark `--ink-soft` and `--ink-faint` exceed 5.5:1 on dark surfaces. Control boundaries still need UI-30. |
| Workout targets are generally smaller than 44px | Not proven. | Core icon buttons, steppers, focus navigation, and save controls already use 44px or larger targets. Crowding remains under UI-18. |
| `5 lifts` beside `5 sets` is necessarily contradictory | Not proven. | One logged set for each of five lifts is valid. The fixture alone cannot establish a terminology bug. |
| The Program editor's flat dock is accidental drift | The old treatment was intentional, but G-80 replaces it with a shallow sticky action layer under the bounded-elevation policy. | `styles.css` documents the superseded choice. |
| Every visible use of `--accent` fails text contrast | Rejected. | Uses have different sizes and roles. Several are icons or borders, and most small orange text uses `--accent-deep`. See UI-30. |
| Remove or ration all middle dots | No consolidated finding. | The reports show some crowded lines, but the repository has no blanket ban. Fix a separator only where it causes a specific wrap or comprehension problem. |
| Portuguese uses inconsistent grammatical gender for Taurifer | Fixed in PR #220. | Current entry copy uses `O Taurifer`. |
| Add creator avatars and trust metadata to shared setup now | Deferred by G-82 until Taurifer has a real publisher-identity and authenticity contract. | The current payload has no avatar contract. Publisher attribution is `Next` in the canonical backlog. |
| Carry the first-run visual theme deeper into the app | Rejected by G-81. The landing page uses normal product tokens and components rather than creating a separate visual world. | ADRs 0004 and 0006 require reconciliation with the new landing direction. |
| Use Plex Mono more throughout the app | Resolved by G-57. Preserve Sans for language/controls and Mono for training data/technical values, then normalize their scales. | Current CSS already uses Mono for core training data. |

## Preserve these strengths

Every report protects the same foundation:

- the brand belief that strength is built gradually, while its expression on first run is redesigned under G-09;
- the warm paper, ink, burnt orange, and token-swap dark theme;
- Plex Sans for language and Plex Mono for training data;
- licensed exercise illustrations and intentionally empty tiles for movements without licensed media;
- the Today, workout, save, and session-summary loop;
- Focus mode's one-exercise, one-decision hierarchy;
- `Why this weight?`, deterministic generation language, adjacent validation, pain handling, and explicit activation;
- the local-first privacy model, with the explicit one-hour installation-transfer exception in G-71 and G-84 through G-88; and
- the mobile screen catalog as the visual source of truth.

## Approved delivery program

Deliver this work as one umbrella initiative with the bounded child plans below. Each child plan must leave the repository in a verifiable state and satisfy its completion gate before dependent work begins. Do not implement the initiative as one change.

| Phase | Primary findings | Outcome | Completion gate |
| --- | --- | --- | --- |
| 0. Canonical reconciliation | All decisions | Update the canonical backlog, superseded ADRs 0005–0007 where needed, ADR 0010, Plans 047–048, the brand guide, privacy/data claims, and obsolete dual-workout specifications. Specify the temporary transfer service and recovery-week intervention before code consumes them. | No governing document contradicts G-01–G-88; every child plan has dependencies, migrations, acceptance criteria, tests, and rollback/recovery behavior. |
| 1. Proven defects and test leverage | UI-01–UI-07 and UI-29's fixture | Fix raw identifiers, translation/copy composition, 200% control failures, chip overlap, editor-label collision, disabled-action hierarchy, and the implausible fixture. Add the overflow checker and risk-based catalog matrix from UI-04. | Generated files are current; all affected English, PT-BR, theme, and enlarged-text frames pass; the complete catalog is regenerated. |
| 2. State and lifecycle foundations | Foundations beneath UI-10, UI-18, and UI-19 | Replace DOM-backed workout state with an explicit draft model; preserve compiler provenance and progression contracts across block transitions; define logical-clone boundaries; build the one-hour installation-transfer service, atomic claim/import, recovery snapshot, and allowlisted late-install telemetry. | Crash, retry, expiry, duplicate-claim, cross-tab, draft-removal, backup round-trip, and browser/standalone divergence tests pass. No user state depends on hidden List markup. |
| 3. Landing and program entry | UI-14–UI-17, UI-19, and UI-32 | Use imagegen to compare landing preview directions with the owner. Then ship the selected product-led landing page, adaptive shared-link state, five-job hierarchy, merged result/preview, platform-sensitive installation, cached Privacy page, contextual-guidance framework, and visible responsive expert controls. | Owner approves the generated visual direction and real-device flow; no proposal persists before confirmation; every entry route reaches explicit activation; late iOS installation transfers or recovers safely. |
| 4. Focus-only workout | UI-18, UI-23, and the Today preview in UI-25 | Port required List capabilities into the Session and exercise-action layers, add the read-only session map, deterministic resume, safe leave/early-finish behavior, and then delete List routes, markup, copy, tests, and catalog states. Fix Focus spacing and timer geometry in the same shell. | Ordinary execution, substitution, warm-ups, notes, bodyweight, skips/restores, repeat-last, drafts, validation focus, reduced motion, accessibility, and save/summary behavior pass on real phones. |
| 5. Progress and block lifecycle | UI-08–UI-12 and UI-29 | Build two-level navigation, weekly status plus program action queue, neutral baseline states, block-correct Strength/Volume measures, mobile summary rows, evidence-adaptive charts, unified Review/End block, faithful schedule repair, permanent volume reduction, and the approved recovery-week model. | Every label matches its time scope and action; transitions preview exact diffs, preserve provenance, archive atomically, and cannot claim deload/schedule repair from insufficient evidence. |
| 6. Management surfaces | UI-13, UI-14, UI-24–UI-28 | Deliver read-first History with explicit edits, in-context share repair, Today/Program hierarchy corrections, task-grouped Settings, summary semantics, and restrained timer treatment. | Destructive actions remain isolated and confirmed; share remains fail-closed; full names, locale-aware dates, and actionable labels survive compact and enlarged-text layouts. |
| 7. System convergence | UI-20–UI-22 and UI-30 | Finalize bounded elevation and component roles, Sans/Mono and radius scales, progress dimensions, semantic colors, and control-boundary contrast. Migrate every public surface, not only touched ones. | A role inventory accounts for every exception; rendered-role WCAG 2.2 AA checks pass; no nested-card tunnel or accidental one-off control remains. |
| 8. Public-launch validation | UI-04 and UI-31, plus regression coverage for all findings | Regenerate the complete catalog, run every suite, exercise critical browser and installed flows on iOS and Android with VoiceOver and TalkBack, and validate scroll clearance. Freeze the allowlisted post-launch comprehension and late-install measurements. | The owner signs off every real-device gate. The catalog, source inventory, decision register, backlog, ADRs, plans, telemetry schema, and shipped behavior agree. |

This order is architectural, not cosmetic. Phase 2 prevents the Focus and transition redesigns from preserving hidden or lossy state. Phase 7 happens after the principal surfaces stop moving, while its roles and tokens are defined in Phase 0 so earlier work does not invent new variants.

## Method and limits

I read all four reports, their merged PR metadata, the current captures they cite, the relevant runtime code and tests, the brand guide, ADRs 0005, 0006, 0007, 0009, and 0010, Plans 047–048, and the canonical backlog. Targeted code investigations traced Progress semantics, List/Focus capability and persistence differences, setup-link repair, install/tour behavior, and block-transition mutations. I treated current repository facts as stronger evidence than old screenshot counts. Agreement between reports raised confidence, but it did not set priority.

The recovery-week direction is deliberately evidence-bounded: current research supports materially reduced volume as a plausible deload strategy but does not establish an optimal universal prescription. The approved v1 must remain described as a lower-volume recovery week, not proven injury prevention or treatment.

Static screenshots prove visible layout and copy. They do not prove reachability, assistive-technology behavior, keyboard order, animation timing, or user comprehension. The approved runtime and real-device gates close the first four limits. Per G-76, prelaunch comprehension is evaluated only by the owner; allowlisted privacy-preserving telemetry supplies behavioral evidence after launch.

The owner confirmed the shared understanding behind G-01–G-88 on 2026-09-03. The future imagegen comparison under G-51 is an explicit visual-selection gate, not an unresolved product assumption.
