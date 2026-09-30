# G · Síntese: build notes

Files: `round-3/candidates/g.js`, `g.css`, `g.notes.md`. Round 3 page:
`round-3/app.html?c=g&cp=<checkpoint>&lang=…&theme=…&text=…&motion=…`.

## What G is

The synthesis the two Round 2 judges converged on, built once and checked by
the acceptance run only (owner decisions Q622–Q637, recorded in
`docs/product-grilling-decision-register.md`). G depends on no product
decision: PD-1 to PD-4 are closed, minutes and rest are asked, and no program
appears before the answers.

G was built by the orchestrator from D's source (`round-2/candidates/d.js`),
because D was the only Round 2 candidate with no correctness defect and it
already passed K-25. Every departure from D is an owner decision or a defect
fix the judges found.

## Where each part comes from

| Part | Source | Decision |
| --- | --- | --- |
| Structure: `ROUTE_STEPS` unchanged, program-first review on every route, import, dialog and conflict behaviour, one accent, helper at the top of the chooser, "Você faz / Você recebe" doors | D | Q626 |
| Chooser: the featured Recommend block is the goal question; one tap chooses Recommend and answers the goal | F | Q627 |
| Recommend in four sections: about you (carried goal, experience, consistency), schedule, environment, optional priorities; Custom in six | F | Q627 |
| Answer chips after the week (first day open, the other days collapsed) | new | Q628 |
| Inline editing of every answer, at every size; the pinned activation hides while an editor is open | E | Q629 |
| Landing: headline, lede, both actions, then the Today proof | D | Q630 |
| Shared gate: Start only | D | Q631 |
| Build from import: the quiet "Prefiro escrever do zero" link | D | Q632 |
| Resume card on the chooser only | D | Q633 |
| After an apply: identity statement plus before/after count; focus and scroll move to it; added exercises carry an accent edge and a "novo" tag | F, E | Q637 |

## Defect fixes (judge findings, now acceptance checks)

- **Skip** ("Pular esta seção") shows only while the optional section is
  empty, so it can never discard a chosen constraint (Delta D-1, K-30).
- **Focus after an answer** stays on the chosen option: every re-render
  restores focus to the control with the same id or the same `data-*`
  identity (Delta A-shared, K-27).
- **Dialogs** return focus to their opener on Cancel and on Escape (cancel,
  Start over, Recomeçar, replacement, resume discard) (K-26).
- **Change statement** is always visible after an apply (Charlie CH-8,
  Delta D-2, K-28). The review scrolls to the top when the name, facts and
  statement fit together, and otherwise to the statement itself.
- **Editors** are inline, so they never shrink to a small modal body at 200%
  text (Delta D-A1, D/F-A3, K-29).
- **Copy:** "salvas", never "guardadas".

## Interpretations

- **"Chips after the first day" (Q628)** is built as: the week, with only the
  first day open and the others collapsed, then the chips. The chips therefore
  follow the first day's exercises closely without splitting the week in two.
- **No change, no numbers:** when a change leaves the program identical (for
  example, avoiding an exercise that was not in it), the block states
  "Nenhum exercício mudou." and omits the before/after rows, which would only
  repeat the same figures.
- **Browse** keeps D's two short context screens (days and minutes, then
  environment). The owner did not decide F's single filter screen, so the
  spec default stands.

## Polish pass (after Round 4)

The owner found G too timid: today's onboarding, tidied up. A polish pass
(`round-3/polish/AUDIT.md`, commits listed in `round-3/manifest.md`)
changed only how G looks and moves. Structure, steps, controls, routes,
information, copy meaning and every Q622–Q637 decision are as above.

What G now does that D's source did not:

- **Type.** Group questions are body 16/600 sentence case (not uppercase
  labels); review section heads are subtitle 18/600; the program name is
  the page title (30). The label tier is kept for eyebrows, "Você faz /
  Você recebe", ANTES/AGORA and "novo".
- **The review's facts** are a strip of four Mono metric values with their
  unit in caption (2×2 at 320 and at 200%). The catalog facts sentence
  stays as the strip's accessible text, so meaning is unchanged. New
  strings: `g.facts.days`, `g.facts.day_one`, `g.facts.minutes`,
  `g.facts.sets` (PT and EN).
- **Bands, not boxes.** Inside a route page the week, the carried goal,
  cards (`.card`), disclosures and the import metrics are hairline-ruled
  bands. These are scoped compositions over base recipes
  (`.g-main .day`, `.g-main .card`, `.g-main .disclosure`,
  `.g-main .metrics`); no base recipe is redefined. One override reaches
  into the shared import review's inline padding
  (`.g-main .card>div[style^="padding:0 14px"]`) so its rows sit on the
  page grid; it is noted as a shared-harness proposal.
- **Spacing.** One scale, 4 · 8 · 12 · 16 · 20 · 28; page heads are an
  intro stack; no negative margins.
- **Accent budget.** Reason and constraint icons, free-form stage heads
  and the quiet Build link are ink. The accent marks the primary arrow,
  progress, selection, the featured outline, the change rail and "novo".
- **States.** Numeric cards carry Mono metric values; every selection
  control has the shared pressed transform and a short transition; answer
  chips have no per-chip icon and use the selection boundary.
- **Pinned region.** Solid ground with a hairline; the disabled primary
  drops its arrow and keeps its reason line above it.
- **Dark.** Decision panels (editor, change statement, helper) and the
  "novo" row use the surface material so they read as raised bands.
- **Motion.** Editor, change statement and "novo" rows rise 6 px over 200
  ms once, when revealed (`.g-enter`, added in `revealEditor` and
  `showChange`); the day chevron turns; Today enters with the shared view
  fade. Reduced motion is the shared rule.

## Verification

Frozen run (`round-3/acceptance/summary.md`): 360/360 checkpoint cells with no warnings, 122/122 journeys, 61/61 interaction checks. The polish pass reproduced that result before and after its commits (`round-3/manifest.md`, "Polish pass").
