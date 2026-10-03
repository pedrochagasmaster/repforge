# Onboarding direction G: brief and product decisions PD-1 to PD-4

The migrated brief for the entry hub and every entry route, as selected by
owner gate OG-1 ("G as built") for
[Plan 064](../../plans/064-unified-redesign-convergence.md) slice R4. The
onboarding tournament of PR #279 produced it; its rounds, candidates,
captures and prototype code stay on that branch and are not migrated
(Plan 064 §9 R4, §11.2).

Authority. This brief is the reference interaction model and visual intent
for slice R4. It is not a production contract. Production contracts stay in
Plan 064 (§8 shared design language, §13 STOP conditions),
[`docs/program-entry-flow.md`](../program-entry-flow.md),
[ADR 0007](../adr/0007-shared-setup-links.md),
[ADR 0014](../adr/0014-free-form-program-import-handoff.md) and
[`ui-system-semantic-contract.md`](ui-system-semantic-contract.md). Where this
brief and one of them disagree, the contract wins and the difference is
recorded under "Production normalizations". An owner decision is never
inferred from this brief; owner outcomes are linked, not restated as new
rules.

Provenance. Source PR #279, branch `ccr-15c50ac8-pki40i`, pinned SHA
`1acee97a`. Every path below is relative to
`docs/design/onboarding-tournament/` at that SHA unless it says otherwise.
Read with `git show 1acee97a:<path>`.

## 1. What G is

G ("Síntese") is the Round 2 synthesis, built once from the owner answers
Q622 to Q637 and checked by an acceptance run only, with no judging (Q626).
It depends on no product decision: PD-1 to PD-4 are closed below, minutes and
rest are asked, and no program appears before the lifter answers. It was
built from Round 2 candidate D, the only candidate with no correctness
defect, plus parts of E and F. Every departure from D is an owner decision or
a defect fix the judges found.
(Source: `round-3/candidates/g.notes.md`.)

G is the conventional arm: today's onboarding layout, fixed and finished. It
keeps the entry route graph, the five jobs and every step ID.

### 1.1 Where each part comes from

| Part | Source | Owner decision |
|---|---|---|
| `ROUTE_STEPS` unchanged, program first on every review, import, dialog and conflict behavior, one accent, a helper at the top of the chooser, "You do / You get" lines on the doors | D | Q626 |
| The chooser's featured Recommend block is the goal question; one tap chooses Recommend and answers the goal | F | Q627 |
| Recommend in four sections (about you, schedule, environment, optional priorities and avoidance); Custom in six | F | Q627 |
| Answer chips after the week, first day open, other days collapsed | new | Q628 |
| Inline editing of every answer at every size; the pinned activation hides while an editor is open | E | Q629 |
| Landing: headline, lede, both actions, then the Today proof | D | Q630 (slice R2, not R4) |
| Shared-link gate: Start only | D | Q631 (slice R2, not R4) |
| Build from the import route: a quiet "write it from scratch" link | D | Q632 |
| Resume card on the chooser only | D | Q633 |
| After a change: identity statement plus before/after count, focus and scroll move to it, added exercises carry an accent edge and a "new" tag | F, E | Q637 |

Outcomes are in `docs/product-grilling-decision-register.md`, rows Q622 to
Q637.

### 1.2 Shape

- Header: a left-chevron Back, then a "where" line (route and
  "Section n of N"), a segmented progress bar, and an answer rail (earlier
  answers as chips that jump back to their question). One `h1` per screen.
- Footer: one pinned persistent-action region with a single primary
  (Continue, Show my program, Use this program). A disabled primary drops its
  arrow and states the reason directly above it.
- Chooser: the Recommend block asks the goal question with three goal
  buttons; Custom and Browse are flat door rows with an ask line ("You do")
  and a get line ("You get"); Build, paste and file doors sit in a
  "Use my own program" disclosure. A "Not sure which one?" helper reaches all
  five jobs through two short questions and ends in "Continue with {route}".
- Questions: an "about" screen (carried goal, experience, consistency),
  schedule as numeric cards (days 2 to 6, minutes) plus a compact rest list
  with nothing preselected, environment with an inline correction disclosure,
  optional priorities and avoidance with a Skip that shows only while the
  section is empty.
- Review (every route): the program first. Eyebrow, program name as the page
  title, a four-value facts strip, a change-statement slot, the week as
  hairline bands with the first day open, then answer chips with inline
  editors ("Built from your answers"), then "Why it fits", "What Taurifer
  adjusted", "Your constraints" (each with Restore) and "More options".
  Browse, import and shared reviews are the same review without chips.
- Recovery: a resume card on the chooser (route, step, saved date; Resume or
  Start over), a rules-changed card (Rebuild or Keep), a conflict notice
  ("Review again").
- Dialogs: cancel (keep or discard the draft), replace the current program,
  Start over, discard a saved draft. Each returns focus to its opener.

### 1.3 Defect fixes G carries (judge findings, now acceptance rows)

- Skip shows only while the optional section is empty, so it never discards a
  chosen constraint (K-30).
- After an answer, focus stays on the chosen option; a re-render restores
  focus to the control with the same id or data identity (K-27).
- Dialogs take focus, close on Escape and return focus to the control that
  opened them (K-26).
- The change statement is always visible after a change; the review scrolls
  to the top when name, facts and statement fit together, otherwise to the
  statement (K-28).
- Editors are inline, so they never shrink to a small modal body at 200% text
  (K-29).
- Copy: in Portuguese, answers are "salvas", never "guardadas".

### 1.4 Interpretations the build fixed

- "Chips after the first day" (Q628) is the week with only the first day
  open and the others collapsed, then the chips.
- When a change leaves the program identical (for example avoiding an
  exercise that was not in it), the block says "No exercise changed" and
  omits the before/after rows.
- Browse keeps two short context screens (days and minutes, then
  environment); a single filter screen was not decided.

## 2. Product decisions PD-1 to PD-4

Questions are from `round-1/synthesis-spec.md` §10 (lines 618 to 668).
Outcomes are the owner's, in `docs/product-grilling-decision-register.md`
(Q622 to Q624). PD-5 is a pointer only.

### PD-1. Deferred route choice (progressive questioning)

Question: should Start go straight into Recommend's questions, with Custom,
Browse, Build and Import offered later as refinements, instead of opening the
five-job chooser?

- For: removes one decision a new lifter often cannot make; about 400 words of
  door copy at 390 px are saved.
- Against: Plan 054 keeps the five-job chooser and forbids merging Recommend
  and Custom or hiding expert controls; Custom loses its provenance unless it
  stays a route; importers and builders would first pass a Recommend screen.
- Outcome (Q622, closed): the chooser is kept. The featured Recommend block
  may itself be Recommend's first question (Q627), which captures the saving
  without the policy change.

### PD-2. Assumed session length

Question: may the ceiling default to 60 minutes, shown as an assumption,
instead of being asked?

- For: one fewer tap and decision.
- Against: Plan 048 asks for minutes, and the value changes the program: for
  the reference lifter 45 minutes gives 15 exercises and 36 sets where 60
  gives 18 and 49. A lifter with a 45-minute ceiling who accepts the default
  gets sessions longer than the week allows.
- Outcome (Q623, closed, with PD-3): minutes stay asked, nothing preselected.

### PD-3. Assumed or preselected rest

Question: may "Let Taurifer choose" be preselected, or rest assumed?

- For: it is a real answer that satisfies validation; one fewer tap.
- Against: Plan 048 asks for preferred rest, the engine requires an explicit
  `preferredRestSeconds` key that a preselection satisfies without the lifter
  acting, and rest changes the per-day estimate (49, 53, 49 minutes with
  Taurifer's choice against 55, 59, 55 at two minutes for the reference
  lifter) though not the exercise list.
- Outcome (Q623, closed): rest stays asked, nothing preselected.

### PD-4. An illustrative program before any answer

Question: may the first screen show a compiled, non-activatable example
program built from defaults?

- For: shows value before asking.
- Against: the landing already carries the owner-selected product-loop proof;
  a compiled example invites "use this" and describes an intermediate lifter
  (the source cites the tournament's product principle 1 against it).
- Outcome (Q624, closed): no compiled program appears before the lifter
  answers. The landing keeps the owner-selected Today proof.

PD-5 (production catalog corrections for European-Portuguese strings and the
`why_goal` composition) was routed by Q625 to a standalone catalog change. It
is not part of this brief; Plan 064 §11 absorbs it into slice R4 only if it
has not landed.

## 3. Owner decisions that bound the work

Q627 to Q633 and Q637 are listed in section 1.1. Two more bound the process:

- Q626: G is built once and checked mechanically; there is no judging round.
- Q634: the acceptance bar is the eight checks in section 5, with zero hard
  failures across the matrix.

## 4. Visual rules

The ranked polish findings F01 to F21 (`round-3/polish/AUDIT.md`), as rules
G applies, with the production role each lands on. Values are G's; production
snaps every length, weight and spacing to the contract's existing scales
(section 6).

| Rule | G's treatment | Lands on |
|---|---|---|
| F01 Review focal point | Program name is the page title. Facts are a four-cell strip with hairlines: value in Mono `metric`, unit in `caption` (days, minutes per session, exercises, working sets); 2 by 2 at 200% text. The catalog facts sentence stays as the strip's accessible text. | `title`, `metric`, `caption` |
| F02 Questions | Group questions are `body` 16/600 sentence case in ink, not uppercase labels. The label tier is kept for true labels (route eyebrow, "You do / You get", Before and Now, "new"). | `body`, `label` |
| F03 Bands, not boxes | The week, the carried goal, disclosures and import metrics are hairline-ruled bands. A group is never a bounded box inside another. Notices keep their rail because it is the affordance. | `flat` |
| F04 Accent budget | Reason and constraint icons, free-form stage heads and the quiet Build link are ink. | Plan 064 §8.8 |
| F05 Numeric cards | Schedule values in Mono `metric`, unit in `caption`; a pressed state and the shared focus outline. | `metric`, `caption`, selection facets |
| F06 One spacing scale | No negative margins; the title, optional tag and lede sit in one intro stack. | Plan 064 §8.3 |
| F07 Answer chips | No per-chip icon on the review; the section hint carries the affordance; open state uses the selection grammar. Rail chips on question screens keep one pencil each. | selection facets |
| F08 Review section heads | Sentence-case `subtitle` heads, with space above. | `subtitle` |
| F09 Pinned region | Solid ground and one hairline, no gradient; a disabled primary hides its arrow and states its reason above. Content clears the region at scroll end. | `persistent-action` |
| F10 Browse facts | A wrapping Mono row without "·" separators that strand at line ends. | `body-small` |
| F11 Change statement | A two-column grid: label column and Mono values, so before and after align. | `label`, `body-small` |
| F12 Inline editor | A well with a rail, tied to its open chip; enters once with a short, interruptible transition. | `subtitle` |
| F13 Featured block | Outline and type; no tinted head. Door titles stay `subtitle`; recovery cards are hairline bands with their rail. | featured entry action variant |
| F14 Motion | Selection and chip states ease briefly; the editor and statement rise once as they appear; the day chevron turns; all zero under reduced motion. | `motion-layer.js` |
| F15 Dark | Bands replace lit boxes; decision panels read as bands, not holes. | token swap |
| F16 Invalid link | A hairline band holding the reason. | slice R2 |
| F17 Notices | The "not imported" note is `body-small` soft ink in a quiet band; import metrics lose their outer box. | `body-small`, `metric` |
| F18 Heights | Compact choices, numeric cards, list choices and chips each have one height across the five routes; the 44 px floor holds. | Plan 064 §8.12 |
| F19 Chrome | The counter sits with the segbar; the rail has air above and below, so the title is the first thing with room around it. | Plan 064 §8.3 |
| F20 Landing brand row | On the scale; no other change. | slice R2 |
| F21 Icons | A 28-glyph set on a 24 grid, 1.75 stroke, round caps and joins, one optical weight, drawn as masks. | see section 6 |

Proposals G did not build: P-1 drop minutes from day meta once the facts strip
states the range; P-2 show only identity-changing chips; P-3 make the featured
block's question the chooser `h1`. None is adopted.

## 5. Acceptance rows (K-25 to K-32)

Q634 turned the defects the Round 2 judges found by hand into mechanical
checks (`round-2/JOURNEYS.md` §6, `round-3/acceptance-checks.md`). In
production each is a row in the entry browser and accessibility suites.

| Check | Requirement |
|---|---|
| K-25 Import work kept | No import-mode control discards paste-door work. Tapping any mode control, including the active one, and returning to the paste door shows the same stage, or a confirmation opens first. |
| K-26 Dialog focus | Every dialog takes focus inside itself, closes on Escape, and returns focus to the control that opened it. |
| K-27 Focus after an answer | After an answer by tap or Space, focus stays on the chosen option. |
| K-28 Change statement in view | Right after a change, the statement is in the viewport, above the pinned region. |
| K-29 Editor height | A modal editor's scrolling body keeps at least half the viewport; inline editors pass. |
| K-30 Skip keeps constraints | Skip never discards a constraint the lifter chose. |
| K-31 No raw keys | No catalog key, `undefined`, `NaN` or `[object Object]` in visible text or accessible names. |
| K-32 Program first | On every review the first day's name and its first exercise are in the first viewport above the pinned region at 390 px. |

Prototype results at freeze, for reference only: 360 of 360 checkpoint cells
without hard failures, 122 of 122 journeys, 61 of 61 interaction checks. Taps
from landing to Today for the reference lifter: 13; a correction from the
review: 6; avoiding an exercise from the review: 5. These figures describe the
prototype harness and are not production evidence.

## 6. Production normalizations

Decisions that bind production slice R4 where G as built differs from the
shared contract. Source: the owner and orchestrator decisions on PR #295,
comment 5927122354, and Plan 064 §8. They are not changes to G's intent.

- Selection ink. Entry selections (selected option ring, featured Recommend
  outline, open chip) use the quiet ink selection from slice R1b, not the
  accent. The orange budget of Plan 064 §8.8 holds on entry surfaces.
- Scale snapping. G's weight 650, spacing 20 and 28 and row heights 52 and 68
  snap to the existing weight, spacing and control-height tokens. A value
  that cannot snap stops the slice.
- Icons. G's 28-glyph set becomes the app-wide set through a separate shared
  icon change, not through the entry slices. Entry surfaces use the existing
  icon masks until then.
- Hub with a saved draft. The five doors are inert while the resume card
  shows, until the lifter chooses Resume or Start over (confirmed).
- Hub exit. The hub's back chevron is Cancel with its keep or discard
  dialog; G's silent exit is not adopted.
- Guide anchor. Every goal button carries `data-entry-route="recommend"` so
  the entry guide's anchor still matches.
- Cancel on the shared-link preview keeps today's behavior; returning to the
  gate needs an owner rule for the persisted setup draft (ADR 0007).

## 7. What was not migrated

Rounds 1, 2 and 4 and their judge reports; candidates A to F and H to L;
`final-report.md`; G's prototype code (`round-3/candidates/g.js`, `g.css`),
the harness (`runtime.js`, `base.css`, `tokens.css`, `shared-screens.js`, the
vendored modules) and its icon generator (`round-3/polish/icons.mjs`); all
captures, including the 124 polish before and after PNGs; the 45 per-checkpoint
decisions of `round-1/synthesis-spec.md` §2 to §8; the Round 4 production
finding PF-1 (a catalog label, compiler truth outside this workfront).
