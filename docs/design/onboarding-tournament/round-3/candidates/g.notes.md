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

## Verification

Frozen run (`round-3/acceptance/summary.md`): 360/360 checkpoint cells with no warnings, 122/122 journeys, 61/61 interaction checks.
