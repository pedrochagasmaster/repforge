# Plan 063: Direction D redesign

Implementation and review use the [evidence protocol](../docs/agents/implementation-evidence.md)
and the model-routing policy in the `taurifer-model-policy` Codex skill. This
plan defines scope, sequence, proof and gates. The screen contracts, owner
decisions, surface inventory, strings and fixtures live in the
[implementation spec](../docs/design/direction-d-implementation-spec.md) and
its [strings appendix](../docs/design/direction-d-strings.md). The design
reference is `docs/design/main-screen-directions/DIRECTION-D-SPEC.md` and the
review page beside it.

- **Plan number:** 063
- **Phase:** between Plan 058 (system convergence) and Plan 059 (public-launch validation)
- **Status:** Planned. Documentation and the session-outcome fix are on the workfront PR; implementation waits for Plan 058 to merge
- **Workfront PR:** #272, branch `redesign/direction-d`, one PR for the whole plan
- **Owner approval state:** Direction selected and every product decision in spec §1 is made ([ADR 0016](../docs/adr/0016-direction-d-design-reference.md)). Open owner gates: the 17 drawings in P1, the changed frames of every slice, the telemetry retirement in §Owner gates, and the P12 board
- **Depends on:** Plan 058 merged to `main`
- **Blocks:** Plan 059 and the alpha (backlog row "Direction D redesign")
- **Supersedes for the named surfaces:** G-23, G-29, G-44, G-60, G-65
- **Affected surfaces:** Today, Focus and rest, Why this weight, session summary, Progress and the exercise chart, History, Program; D's shared rules reach the rest of the catalog
- **Complexity:** High
- **Risk:** Medium to high. The shelf sits on DraftV2 in the most-used flow

## Problem

Plans 049–058 fixed the audited defects and converged the design system, but
the main screens still show the template instead of the prescription, explain
recommendations as a stack of rows, spread set entry across a card, and
celebrate a saved session. The owner compared seven directions and selected D:
read everything as a ledger of aligned columns and hairlines, act on every set
from one bottom shelf.

## Objective

Rebuild the main screens to Direction D on Plan 058's semantic roles, keeping
every state, persistence, recovery and telemetry contract of Plans 051–058.
The spec's §3 assigns all 143 catalog screens a treatment: 17 redesign, 17
needs drawing, 107 rules only, 2 retired.

## Scope boundary

### In this plan

- The surfaces in spec §4, their catalog states, and the shared components in
  spec §7.
- The session-outcome rule (already on the branch) and its catalog frames.
- The review page as the drawing surface for P1, trimmed to D in P12d.
- New i18n keys from the strings appendix, the D catalog fixture, the
  real-app acceptance gate, and the `DESIGN.md` rewrite.

### Out of scope

- The progression engine, DraftV2 schema, persistence, journal, cross-tab
  lock, setup links and install transfer.
- Onboarding, Settings, Library and install layouts beyond shared rules.
- New capabilities. Every control D shows exists in the app today.
- Code from the review page. It is a drawing; its renderers are not ported.
- The E, F and G candidates.

## Preserved contracts

| Contract | Owner | Proof that must stay green |
| --- | --- | --- |
| DraftV2 edits, commit, correction, reload, cross-tab, journal | Plan 051 | `workout-draft*`, `adversarial-draft-transactions`, `persistence*`, `focus-only-parity` |
| Focus capability parity and Session sheet ownership (G-22, G-41–G-43) | Plan 055 | `focus-*`, `focus-session-sheet`, `focus-exercise-actions`, `workout-finish-boundary` |
| One outcome source for summary, History and Progress | Plans 056–057, spec §5 | `summary-evidence`, `progress-evidence`, `management-summary` |
| Engine targets and explanations | Plans 045–048 engine | `recommendation-parity`, `progression-strategies-ui` |
| Rest timer state machine, notifications, overrun | Plan 055 | `schedule.mjs`, `focus-mode` |
| History read-first editing (G-12, G-68), search | Plan 057 | `history*`, `history-persistence-race`, `history-delete-replay` |
| Program editor and its action layer (G-80), Share repair | Plan 057 | `program-actions`, `program-editor-*`, `share-repair` |
| Progress lifecycle, recovery and evidence contents | Plan 056 | `progress-*` |
| Guide anchors (G-49, G-62, G-69) | Plans 054–057 | `progress-guides`, entry and focus guide suites |
| Semantic roles, contrast, catalog | Plan 058 | `ui-system`, `check-ui-system`, `check-ui-screens` |
| Telemetry allowlist and producers | G-83, backlog "Alpha measurement producers" | `telemetry-runtime`, `telemetry-leakage` |

## Architecture and ownership

No new domain behavior. Each view model lives with the module that already
owns its surface; the backlog's post-overhaul modularity rule applies.

| Piece | Owner | Kind |
| --- | --- | --- |
| Today prescription rows | `app.js` Today section, consuming `recommendation()` | pure view model plus renderer |
| Shelf and ledger | `app.js` Focus section, over the existing DraftV2 commands and `data-k` inputs | renderer; no new commit path |
| Inline rest | `app.js` rest section, reading the existing timer state | renderer |
| Why sheet | `app.js` Why section, consuming `explainRecommendation()` | renderer |
| Frequency counts | `history-ui.js`, new pure `historyFrequency(log, block, plannedPerWeek)` | pure function with unit tests |
| Chart series | `progress-model.js` Strength evidence (existing) | consumer only |
| Motion | `motion-layer.js` | extends existing helpers |
| Catalog fixture | `tools/ui-screens/fixtures.mjs`, new `directionDState()` (spec §11) | test fixture |
| Real-app acceptance gate | `tools/check-direction-d.mjs` plus `test/direction-d.mjs` | new checker with seeded failures |

## Owner gates

Decided with the owner on 2026-09-26. An approval counts only as a reply by
the owner in a #272 comment. The agent posts the board or tunnel link as a
comment, and links the owner's reply in the PR body's Approved rows.

1. **P1 drawings, by flow.** Four review rounds on the review page: Today (2),
   workout sheets (7), Progress (6), History edit (2). The owner approves or
   returns each screen in the round. Pending drawings block only their own
   states: a slice builds its drawn states and leaves the pending ones for a
   later commit in the same slice.
2. **Changed frames, sampled.** From P4, each slice posts one board: every
   changed state at 390 in PT light and EN dark, plus the worst case at 360
   PT with 200 % text. The gate covers every frame. The full changed-frame
   inventory is linked from the comment.
3. **Telemetry.** Decision 10 removes the only producer of
   `program_readiness_navigated`. `telemetry.js` has no retired state, so P11
   deletes the event from the allowlist in `telemetry.js` and from
   `test/fixtures/telemetry.mjs`, and says why in the commit and the backlog.
4. **P12 board.** The owner does the five-second read on Today, Focus and Why
   on a real phone over the tunnel, and reviews a board of every D surface in
   both themes, before Plan 059 starts. Testing with outside lifters belongs
   to Plan 059.

## STOP conditions and routing

A STOP pauses only the dependent slice. Route it by its kind:

| STOP | Route |
| --- | --- |
| A 058 role cannot express a D element; two authorities disagree on a token, role or variant; a new content job needs a contract | **Semantic.** Focused Sol XHigh sub-agent, analysis-only, using the skill's brief schema; the Luna parent verifies and resumes |
| DraftV2, commit path, timer, outcome or engine data flow is unclear; a persistence or recovery invariant would change | **Semantic.** Sol XHigh sub-agent with the exact producer and consumer |
| A drawing is missing, a screen needs a capability that does not exist, copy would change meaning, or a supersession is unclear | **Product.** Owner. Record the question under Outstanding owner decisions and continue other slices |
| A shipped contract in "Preserved contracts" would change | **Product.** Owner |
| A test fails for an actionable, narrowing reason | Not a STOP. Keep working |

Pre-identified semantic questions, likely in P0: which 058 control role and
radius the shelf fields, pads and CTA use; whether the ledger's open row is a
`selected` or `field` treatment; whether the inline rest block reuses the
protected rest-clock variant unchanged; how the prescription row and the
frequency counts enter the role inventory.

## Slices and atomic commit sequence

One PR, commits in this order. A slice may take several commits; each commit
is coherent and proven. Commits already on the branch are marked done.

| Slice | Commit | Delivers | Focused proof | Catalog |
| --- | --- | --- | --- | --- |
| docs | done | Review page, D spec and amendments, candidates, frequency views, ADR 0016, spec, strings appendix, this plan, backlog order | `checks/acceptance.mjs` 5/5 on D–G; `strings-table.mjs` | none |
| P2 (landed early) | done: `Make session outcomes describe the logged sets` | Session-outcome rule, anchor Why reps, EN pause | simulation 927/0; affected lane; see PR evidence | 10 summary frames |
| P0 | `docs(plan-063): refresh the D code map and role mapping after 058` | Spec §7 and §13 against merged 058; Sol consultations resolved and recorded | owner review of the diff | none |
| P1 | `docs(design): draw the remaining D screens` | The 17 drawings on the review page, owner-approved | `checks/acceptance.mjs` over the new screens | none |
| P3a | `test(direction-d): add the real-app acceptance gate` | Checker and test for targets, overflow, orange budget, parity, strings over D-owned states, with seeded failures | the gate rejects each seeded failure and passes today's app with D states pending | none |
| P3b | `test(catalog): add the Direction D fixture` | `directionDState()` per spec §11 | fixture unit test: the engine targets match the review page's | none |
| P3c | `refactor(ui): add D shared components on 058 roles` | Ledger row, verdict mark, tab row, sheet header, shelf shell, unused | `ui-system`, gate, no frame change | none |
| P4 | `feat(today): show the prescription` | Today per spec §4.1; Preview retired; mixed-strategies state | `today-*`, `recommendation-parity`, `focus-only-parity`, gate, i18n | today |
| P5a | `feat(focus): add the shelf over DraftV2` | Shelf, ledger, cue, header routes, units, effort mode, correction, completion actions | draft, focus, persistence, finish-boundary suites, gate | workout |
| P5b | `feat(focus): restyle the workout sheets` | Session sheet, exercise actions, note, warm-up, reorder, skipped, substituted, early finish | `focus-session-sheet`, `focus-exercise-actions`, gate | workout |
| P5c | `refactor(focus): remove the input well` | Old well removed after the shelf passes everything | full workout lane | none intended |
| P6 | `feat(rest): move rest inline` | Inline rest, overrun, presets sheet | `schedule.mjs`, `focus-mode`, `motion-integration`, gate | workout |
| P7 | `feat(why): lead with sentences` | Why per spec §4.3 and its four new states | `progression-strategies-ui`, `recommendation-parity`, gate | workout |
| P8 | `feat(summary): end each lift on its next target` | Summary per spec §4.4; summary-first state | `session-summary`, `summary-evidence`, `management-summary`, gate | session |
| P9a | `feat(progress): one tab row and the D overview` | Tabs, overview, attention, strength rows | `progress-*`, gate | progress |
| P9b | `feat(progress): the honest exercise chart` | Step series, e1RM toggle, snapping plot, table | `progress-evidence`, gate | progress |
| P10a | `feat(history): list sessions by week with frequency counts` | Week list, `historyFrequency`, calendar sheet | `history*`, frequency unit test, gate | history |
| P10b | `feat(history): the session as a page` | Session page and edit states | `history-edit`, `history-delete-replay`, `history-persistence-race`, gate | history |
| P11 | `feat(program): the program as a ledger` | Program per spec §4.9; readiness retired | `program-actions`, `program-editor-*`, `share-repair`, telemetry suites, gate | program |
| P12a | `refactor(ui): apply D rules to the remaining surfaces` | Rules-only sweep | `ui-system`, gate | rules-only flows |
| P12b | `docs(design): rewrite DESIGN.md for Direction D` | D's rules on 058's roles | doc review | none |
| P12c | `test(catalog): regenerate the complete catalog for Direction D` | Full catalog, compare, gate over every D state | `run-tests.mjs all`, `capture-ui-screens.mjs`, `check-ui-screens.mjs`, `compare-ui-screens.mjs` | all |
| P12d | `docs(design): trim the review page to Direction D` | Remove the A, B, C, E, F and G renderers and styles; D stays as the drawing reference | `checks/acceptance.mjs` on D | none |

Every commit that changes a precached asset bumps the cache revision in
`sw.js`, `index.html` and `test/exercise-library.mjs` in the same commit.

## Operating protocol

For each commit row:

1. Mark the row 🟡 in the PR's Planned commit sequence and update Current
   state.
2. Re-read the spec section and the preserved contracts it touches. Trace the
   real producer and consumer before editing.
3. Implement only that row. If a STOP appears, route it (table above).
4. Run the row's focused proof, then `node tools/run-tests.mjs affected --base
   <row-start-sha>`; record evidence with `--evidence /tmp/<row>.json`.
5. Capture the row's catalog flows; inspect every changed frame in PT and EN,
   light and dark, 360 and 430, 200 % text; list them in the PR.
6. Inspect the complete diff; remove anything unrelated; `git diff --check`.
7. Commit with the exact message, push immediately, mark the row ✅ with its
   SHA, and update Verification evidence, Next exact steps and Handoff.
8. Never rebase or force-push published history. Synchronize with `main` by an
   explicit merge commit. Never merge the PR without owner authorization.

Model routing follows `taurifer-model-policy`: GPT-6 Luna Max owns the PR end
to end; a semantic STOP gets one focused Sol XHigh sub-agent that returns a
decision; product STOPs go to the owner. After P5a and before P12c, the parent
may spawn one Sol XHigh review sub-agent for the shelf's draft invariants and
the final contract review.

## Testing and evidence

- Per commit: the row's focused suites, the affected lane, `test/i18n.mjs`,
  `node tools/build-i18n.mjs --check`, the gate, and the row's catalog flows.
- The gate (P3a) is the review page's five checks moved to the real app,
  specified in spec §10. Its seeded failures are part of its own test.
- Outcome and target parity keep an independent oracle: outcomes from
  `compareExerciseSession` in the app versus the rule table in `CONTEXT.md`
  encoded in the test; targets versus `evaluateProgression` in Node.
- Visual evidence: the D fixture's captures are compared by the owner with the
  review page's drawings of the same state.

## Rollback

Each commit reverts on its own. P3c's components are unused until a screen
adopts them. P5a keeps the input well behind the same commit path until P5c
removes it. There is no runtime switch back to the input well (owner, 2026-09-26):
nothing ships to lifters before Plan 059, and P5a and P5c revert cleanly. The session-outcome commit reverts independently of every screen.

## Handoff

The PR body is the living record: Planned commit sequence, Current state,
Verification evidence, Review findings, Outstanding owner decisions and Next
exact steps, in the shape of PR #227.
