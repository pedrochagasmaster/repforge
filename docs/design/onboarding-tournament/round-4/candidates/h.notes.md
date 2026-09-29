# H · Concreto — builder notes (Round 4)

**Thesis.** Onboarding is a sequence of concrete poems. Every screen is one
typographic composition on a six-column grid: one monumental lowercase word
states the decision ("dias", "lugar", "descanso"), the answers are words placed
in the composition, and the lifter's choice floods its cell with the one
saturated vermilion field. The result is the program set as a poster, days as
columns of words. It refuses the category's stacked form: card rows with radio
marks, a progress bar, a sticky summary card.

**Signature interaction: "o verso" (the verse assembles).** Every answer is set,
as a short word, into a running verse above the next composition ("ganhar massa
/ 6 a 24 meses / maior parte das sessões / 3 dias …"); the word just chosen
wipes in on the field (left-to-right flood, the same wipe that fills the chosen
cell). On the review the verse becomes the poster's colophon: each line of it
is the control that reopens that group of answers in a full-height editor,
recompiles in place and states the true change ("15 dos 15 exercícios
mudaram. Antes 18 exercícios, 49 séries. Agora 15 exercícios, 42 séries."),
with added exercises tagged "novo".

**Product decisions.** None reopened (`policy.productDecisions: []`). The
chooser offers all five jobs (six doors: recommend, custom, browse, paste,
file, build); every Recommend answer is asked and required (minutes and rest
included); nothing is preselected; no program exists before the answers; the
replacement archives the current program and says so; the conflict state is
the production copy.

## Direction contract

Recorded in the surface brief (`.impeccable/surfaces/…-candidates-h-js-…md`),
seed `41ef581f`, form: a Noigandres-style broadside sequence, position 1 on the
roll's list (the assigned lead). Not copied into shipped markup.

## What is where

| State | Composition |
|---|---|
| `landing` | The headline set as a poem: "chegue na academia / sabendo", then **exatamente** reversed out of a full-bleed vermilion band, then "o que fazer." right-aligned. Body line, the two actions (vermilion bar, black outline), then H's own Today (a capture of this candidate's activated-today, `round-4/assets/h/today-ready-*.png`, framed by the 3 px rule, no device bezel) with its caption. Privacy in the brand bar. |
| `route-choice` / `hub-existing` | "criar um programa" (catalog title, fitted) and the catalog lede, then six verbs at one measured size; stanza breaks are a 6 px rule and space (group names are `aria-label`s, no visible labels); the lead verb *recomendar* is the vermilion field bled to the edges. Each door carries a factual cost line (question counts, no minutes). The existing user sees which program stays active. |
| `rec-goal` … `rec-priorities` | One decision per screen (goal, experience, consistency, days, minutes, rest, place, optional priorities), 8 screens across the production steps. Numeric scales climb as a staircase. Phrase answers are words placed in the six-column composition, each screen its own placement: goal staggers down and right, experience climbs one column per step, consistency is a 2 × 2 field, place leads with one full-width word over a 2 × 2. The verse sits above. Continue is pinned and disabled with its visible reason until the screen's answer exists. |
| `rec-env-correction` | The place screen with the equipment/capability disclosure open. |
| `rec-result` / `activate` | The poster: name monumental (fitted to at most two lines), facts line, days as columns headed by vermilion numerals, the colophon verse, the reasons, Start over; activation pinned. |
| `rec-result-corrected` | The same poster after the correction, with the change block and "novo" tags. |
| `replace-confirm`, `cancel-confirm`, restart, paste restart | Black slabs (warm-white in dark) rising from the bottom with a vermilion top edge. |
| `activation-conflict` | The production conflict copy in a vermilion-ruled notice at the top of the poster; "Revisar de novo" returns to the review and activation reopens the replacement dialog. |
| `ff-*` | The paste door as compositions: "colar", "converter", "resposta", "lacunas". The mode switch (Colar texto / Arquivo Taurifer) keeps paste work across switches (K-25). |
| `import-review`, `import-preview` | "vínculos": counts as numerals, rows from → to with a status badge and actions; commit pinned and blocked with its reason; the preview is the poster with source and progression notes. |
| `activated-today` | The shared Today boundary re-materialised in the world (tokens re-pointed, square rules, vermilion start), with the activation status line on the field. |

Custom, Browse and Build are also real (same question engine, the catalogue as
a ruled list of names, the Build editor with the shared model) but were not
polished to the core's level; Edit before using, the shared-link gate, the
route helper and rules-changed are not built in this round (they fall back as
the brief allows).

## Large text (measured)

Large text is detected by measurement, not by the harness query: `setLarge()`
sets `html.h-large` when the root em is ≥ 24 px or the viewport is narrower
than 16 em, so OS and browser text sizes trigger it too. In that mode the
monumental word is capped near 0.11 of the viewport height, the verse collapses
to "4/8 / latest word  e mais 3" (the full verse stays for screen readers),
ledes move below the answers, the staircase and the placed words re-set as one
or two columns, the landing puts the actions before the body line, and the
poster uses smaller numerals so the first answer, door, input or day sits above
the pinned action at 320 px / 200%.

## Measured type

Monumental words are sized by measurement (`fitAll()` in `h.js`): the longest
word of each display element fills its grid width, capped per element and by
viewport height, so nothing breaks or overflows at 320 px or 200% text. The
poster measures its own column count so no exercise word breaks (3 columns for
Rafael at 390 px, 2 × 2 for four days, one column at 200%).

## Floors

- 44 px targets throughout (answers ≥ 60 px, stair cells ≥ 64 px).
- Focus stays on the chosen option after every answer; every dialog takes
  focus on its title, traps Tab, closes on Escape and returns focus to its
  opener.
- Colour is never the only signal (tick marks, squares, weight, `aria-checked`,
  dashed disabled action with a visible reason).
- Reduced motion removes the flood, the slab rise and every transition.

## Acceptance

`node tools/verify.mjs --round 4 --candidates h`: see the report handed back to
the orchestrator for the last run's table. Rafael, landing → Today: 18 taps
(one decision per screen costs a tap to answer and a tap to continue; no
auto-advance, so focus stays on the chosen answer).

## Landing proof

The proof image is H's own activated Today (a real Build-route program,
"Corpo inteiro" / "Full body", activated through `TF.activate` and rendered by
`TF.renderToday` under `h.css`), captured by Playwright; see
`round-4/assets/h/PROVENANCE.txt`. It is marked `data-proof-own` and carries
its own alt text (`h.land.proof_alt`, PT and EN) describing exactly what the
capture shows: Full body, week 1 of 6, 0 of 3 sessions, Day 1 with quads,
chest and hamstrings in five exercises, Start workout.

## Detector

`impeccable detect` run once on `h.js`/`h.css`. Fixed: a padding transition
(now a transform) and a 3 px side border on the mode switch (now a gap).
Remaining findings are not applicable: "border accent on rounded element" on
square elements (every radius token is 0 in this world), and advisories that
compare sizes and colours with the app's `DESIGN.md`, which this candidate
deliberately replaces with its own world (`h.world.md`).
