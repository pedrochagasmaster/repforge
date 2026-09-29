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
| `landing` | The headline set as a poem: "chegue na academia / sabendo", then **exatamente** reversed out of a full-bleed vermilion band, then "o que fazer." right-aligned. Body line, the two actions (vermilion bar, black outline), then the real Today capture on the grid with its caption. Privacy in the brand bar. |
| `route-choice` / `hub-existing` | "como começar", then six verbs at one measured size in three stanzas (the production group names); the lead verb *recomendar* is the vermilion field bled to the edges. Each door carries its catalog title and a factual cost line (question counts, no minutes). The existing user sees which program stays active. |
| `rec-goal` … `rec-priorities` | One decision per screen (goal, experience, consistency, days, minutes, rest, place, optional priorities), 8 screens across the production steps. Numeric scales climb as a staircase; phrases sit on ruled lines; the verse sits above. Continue is pinned and disabled with its visible reason until the screen's answer exists. |
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

## Detector

`impeccable detect` run once on `h.js`/`h.css`. Fixed: a padding transition
(now a transform) and a 3 px side border on the mode switch (now a gap).
Remaining findings are not applicable: "border accent on rounded element" on
square elements (every radius token is 0 in this world), and advisories that
compare sizes and colours with the app's `DESIGN.md`, which this candidate
deliberately replaces with its own world (`h.world.md`).
