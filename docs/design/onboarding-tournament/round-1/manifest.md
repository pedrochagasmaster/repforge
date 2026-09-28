# Round 1 — judge artifact manifest

Frozen for independent judging. Do not revise candidates after judges begin
unless a factual defect prevents evaluation; if that happens, judging restarts
from the corrected commit.

- Repository: `pedrochagasmaster/repforge`, branch `ccr-15c50ac8-pki40i`
- Artifact commit: **`<ROUND1_SHA>`** (filled at freeze; see the commit that
  introduces this file)
- Redesign baseline: PR #256 head `f61ce44b05b1b6717abb4ef00b2395204e9c9636`
- Harness entry: `docs/design/onboarding-tournament/index.html` (served from the
  repository root); candidate documents: `app.html?c={a|b|c}&cp=<checkpoint>&lang={pt|en}&theme={light|dark}&text={100|200}&motion={normal|reduced}`
- Acceptance results: `round-1/acceptance/summary.md`, `results.json`, `shots/`

## Candidates

| Id | Name | Files | Thesis |
| --- | --- | --- | --- |
| a | Uma pergunta | `candidates/a.js`, `candidates/a.css` | Never make a new lifter choose a method: four questions one per screen, program at once, every other route as a refinement of the result. Requires two product decisions (routes merged behind one guided path; session length and rest assumed before answering). |
| b | Cinco portas honestas | `candidates/b.js`, `candidates/b.css` | Keep the five jobs and make choosing one cheap: every door states its cost and outcome; an answer rail keeps every earlier answer one tap away; the result leads with the program; recovery inline. Requires no product decision. |
| c | Programa primeiro | `candidates/c.js`, `candidates/c.css` | Show a real, trainable program before asking anything; facts are edited in place and the program rebuilds live with a diff line; other routes are "switch this program for…". Requires two product decisions (default answers compiled before the lifter answers; routes reached from one surface). |

Shared by all three: `runtime.js` (real compiler/entry/codec boundary, checkpoint
contract, simulated device), `candidates/shared-screens.js` (import review,
free-form hand-off and gap repair, build editor, replacement/conflict/resume
helpers, shared new copy), `base.css` and `tokens.css`, `data/fixtures.js`.

## Routes and states

The 45 checkpoints and 14 scenarios are listed in `README.md` and in
`TF.CHECKPOINTS` (`runtime.js`). Each candidate maps them as follows.

| Checkpoint | A | B | C |
| --- | --- | --- | --- |
| landing | Landing (Start / I already have a program / How it works) | Landing with two doors and their costs | The default program itself, with unconfirmed assumption chips |
| route-choice | "Bring your program" sheet | Hub with five doors, cost and outcome per door | "Switch this program for…" panel |
| route-help | "How it works" disclosure on the landing | Two-question helper on the hub that names a door | "Not sure where to start?" disclosure under the chips |
| rec-goal / background / schedule / environment / priorities | Questions 3, 4, 1, 2 (one per screen); priorities is a fact sheet on the result | Sections 1–5 with the answer rail | Inline fact editors on the program |
| rec-result | Result = review with fact chips | Result: program first, reasons second | Program with all four core facts confirmed |
| rec-env-correction / rec-result-corrected | Q2 with the correction disclosure; result with "Adjusted for you" | Section 4 correction; result with "What Taurifer adjusted" | Inline where-editor with correction; program with "Adjusted" |
| rec-avoid-pain / rec-result-avoided | Exercise sheet from the program row; rebuilt result with "Kept out" | Section 5 avoid search + reason; result with "Your constraints" | Inline "Keep out" editor on the row; rebuilt program with "Kept out" |
| browse-* | "Something different?" sheet → ready-made list → result | Sections 1–2 then catalogue then review | Switch panel → browse panel with fact filters → program |
| custom-* | Sheets: muscle emphasis, include/avoid, structure; custom result | Sections 5–7 in the custom route; custom result | Custom panel tabs; rebuilt program |
| build-* | Setup then shared editor | Setup then shared editor | Setup then shared editor |
| ff-* / import-* | Import view (paste / file) → review → result | Import route (file door / paste door) → review → review-before-activation | Import view → review → program |
| shared-gate / shared-preview / shared-invalid | Landing variants → result with shared source | Landing variants → review | Landing variants → program |
| hub-existing / replace-confirm / activation-conflict | Q1 with the active notice; replace dialog; conflict notice on the result | Hub with the active notice; replace dialog; conflict notice on the review | Program with the active notice; replace dialog; conflict notice |
| resume / rules-changed / cancel-confirm | Resume card on the landing; rules notice on Q1; cancel dialog | Resume card on the hub; rules notice on section 1; cancel dialog | Resume card on the program; rules notice; cancel dialog |
| activate / activated-today | Result CTA → Today | Review CTA → Today | Program CTA → Today |

## Controls available to judges

Inside any phone: every option, chip, search field, disclosure, sheet, panel,
editor field, stepper, dialog and CTA is live. Compilation, browse filtering,
avoidance, import row decisions, gap validation, activation gating, replacement
and conflict all run the shared logic. The harness switches candidate, scenario,
state, locale, theme, width, text scale and motion without changing data.
