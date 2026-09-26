# ADR 0016: Direction D is the design reference for the main screens

- **Status:** Accepted, 2026-09-25 (owner)
- **Supersedes:** G-23, G-29, G-44, G-60 and G-65 in
  [`ui-overhaul-disposition-register.md`](../ui-overhaul-disposition-register.md),
  for the surfaces named below
- **Amends:** [`DESIGN.md`](../../DESIGN.md) once Plan 063 lands
- **Implemented by:** [Plan 063](../../plans/063-direction-d-redesign.md);
  specified in [`docs/design/direction-d-implementation-spec.md`](../design/direction-d-implementation-spec.md)

## Context

Three design directions for the main screens (A, B and C, PR #259) went
through two independent design reviews. Their findings were consolidated into
Direction D, "Folha e polegar" (PR #260: `DIRECTION-D-SPEC.md`). D and three
further candidates built on it (E, F and G) were drawn on the review page in
PR #264. All four use live engine targets, canonical outcomes and shipped
strings, and all pass the same acceptance checks (touch targets, overflow,
orange budget, outcome and target parity, strings) in PT and EN. The owner
compared them on the page and on a phone and selected D.

D's idea: A's record, B's hand. Everything the lifter reads is a ledger of
aligned mono columns and hairlines. Everything the lifter does mid-set sits
in one bottom shelf.

## Decision

1. **D is the reference** for Today, Focus and rest, Why this weight, the
   session summary, Progress and the exercise chart, History and Program. A
   change to those screens that departs from D needs an owner decision.
2. **Order.** Plan 058 finishes first. D is then built on 058's semantic
   roles, Plan 059 validates the result, and nothing ships to lifters before
   Plan 059 signs off on D (backlog row "Direction D redesign").
3. **Plan 058 owns the numbers.** Where D names a size, radius or depth that
   058's frozen role scale does not have, 058's role wins. Anything D needs
   that 058 lacks (the workout shelf, the inline rest block, the prescription
   row, the History frequency counts) goes through 058's contract review as a
   new content job.
4. **Outcomes describe the logged sets.** The "Session outcome" rule in
   `CONTEXT.md` (PR #265) lands with D.
5. **Superseded decisions.** The owner reviewed each overlap between D and an
   implemented overhaul decision:

   | Decision | Was | Now |
   | --- | --- | --- |
   | G-29 | Two-level Progress navigation (Overview and Review primary, evidence tabs beneath) | One tab row: Visão geral, Força, Volume, PRs, Revisão; scrolls horizontally at 360 PT |
   | G-60 | Centered completion hierarchy; improved green, declined in a reserved warning color | Left-aligned ledger summary; no check circle; outcome words in ink; green only for personal records |
   | G-23 | History leads with the month calendar; a selected session replaces it | History leads with sessions grouped by week, under two small frequency counts; the calendar opens as a sheet; a session opens as a page |
   | G-44 | Read-only "Preview session" action on Today | No Preview action: Today shows the full prescription, and a tap on a row opens the exercise page |
   | G-65 | "N exercises ready to add weight" route on Today and Program | No readiness route; each row carries its verdict mark |

   G-42 (session sheet versus exercise actions) stands: D's table-view button
   opens the Session sheet, and ⋯ holds only the exercise actions.

## Consequences

- Plans 055–057 remain the record of what they built. Plan 063 changes those
  surfaces and must keep their state, persistence and recovery contracts.
- The catalog loses `today/preview` and `program/readiness` and gains D's
  states (inline rest, in-session Why, the mixed-strategy Today, first
  session). Every changed frame is reviewed by the owner.
- `DESIGN.md` is rewritten to D's rules on 058's roles when Plan 063 lands:
  the orange budget, the shelf as the only floating layer besides the dock
  and sheets, ledger rows instead of cards, and the ledger type roles.
- The review page (PR #264) stays as the drawing surface. Surfaces D has not
  drawn are drawn there first (Plan 063 P1) before they are built.
