# I · Ficha: build notes

Files: `round-4/candidates/i.js`, `i.css`, `i.notes.md`, `i.world.md`; fonts
`round-4/fonts/{sofia-sans,sofia-sans-condensed,kalam}/`. Page:
`round-4/app.html?c=i&cp=<checkpoint>&lang=…&theme=…&text=…&motion=…`.
Direction contract: `.impeccable/surfaces/arding-tournament-round-4-candidates-i-js-0a7c3a79.md`
(seed key 41ef581f, position 1, IMPECCABLE'S PICK). Code-led; no image
generation was available, so every graphic is authored in CSS and small SVG.

## Thesis

Setup is filling in your own academy ficha de treino. The first screen is the
lifter's blank card; each answer is written onto it in the lifter's pen as it is
chosen; the review is the completed card with the program printed into its grid;
activation date-stamps it and hands it to Today.

**Signature interaction: "Escrito na ficha".** Every mark is drawn (the X in the
parentheses, the circle around a number, the tick in a square) and the answer is
written into its printed field at the head of the card with a pen-stroke reveal.
Fields stay tappable: during the questions they go back to that section; on the
review they open the inline correction, and a corrected answer keeps the old one
struck through in pen beside the new one, with the printed change statement
above. The arc closes with the red date stamp pressed onto the finished card and
the hand-over into Today.

## Product decisions

None reopened (`policy.productDecisions: []`). The five jobs stay on the route
choice (as a card box: Recommend carries the goal question, as G does after
Q627); minutes and rest are asked; no program exists before the answers (the
card's grid stays blank until the engine compiles).

## Honesty choices

- **No instructor hand.** The brief's "instructor's blue-ballpoint hand" is
  translated: the only handwriting is the lifter's; Taurifer's contribution
  (questions, program rows, the change statement) is printed. No counterpart
  pretends to be a person.
- **The load column is blank.** The engine does not know a starting load, so
  CARGA is a dotted blank with the note "você registra a carga no primeiro
  treino e o Taurifer indica a próxima".
- **The word "ficha" never appears in copy.** It is the visual world only; copy
  keeps `CONTEXT.md` terms (programa, sessão, séries).
- The stamp reads "Ativo" and the date: a record of activation, not a reward.

## Candidate copy (PT first, EN at parity)

All added strings are `i.*` keys in `i.js`. One production string is
overridden for PT-BR only through a new key: the cancel dialog's keep action
reads "Salvar rascunho e sair" (production "Guardar…" is EU-PT). The review hint
was shortened to one line ("Toque em uma resposta para corrigir.") so the first
exercise stays in the first viewport after a correction.

## Structure

The state machine follows the Round 3 reference contract (ROUTE_STEPS
unchanged, one section per production step for Recommend, program-first
review, inline editors so K-29 cannot fail, focus restored after every render,
Skip only while the optional section is empty). Views, components and motion are
this world's own; the paste door, gap repair and import review render custom
markup over `TS.freeform.apply` and `TS.importReview.apply`. Non-core routes
(custom, browse, build, file import, shared) work and share the vocabulary, but
reuse the shared editor, muscle-emphasis and exercise-preference widgets
restyled rather than rebuilt; that is the least-finished part of the world.
Today is now this candidate's own markup over the same data as
`TF.renderToday` (active program, week 1 of 6, 0 sessions, Day 1).

The `import-review` / `import-preview` checkpoints are reached through the paste
door (the gaps reply completed with 10–12 and 3), matching the core journey,
not through the file fixture.

## Acceptance

Last run: `node tools/verify.mjs --round 4 --candidates i` : see the report to
the orchestrator for the table (168/168 checkpoint cells without hard failures
or warnings, 30/30 journeys, 35/35 interaction checks in the confirmation run).
Rafael, landing to Today: 13 taps. Environment correction from the review: 6
taps (bound 6).

## Detector

`impeccable detect` ran once. Fixed: the stamp's overshoot easing (now
expo-out), the dark top band and the stub perforation (both moved off
pseudo-element stripes). Remaining findings are advisories against the app's
`DESIGN.md` palette, type ramp and radii, which this candidate deliberately does
not use (its world is documented in `i.world.md`).

## Finish review fix round (disposition FIX, eight fixes plus the ceiling)

1. Empty `( )`, squares and number cells show no ink: `.i-x` and `.i-ring` are
   hidden until `.is-on` / `.is-inked`.
2. hub-existing stamps the current program a plain "ATIVO" (aria "Carimbo:
   ativo") with no date; the date appears only on an activation happening now.
3. Print, not pen: the import source line, "8 linhas coladas", the resume line,
   the shared gate name, the current program name on the hub and on Today.
4. PROVÁVEL / SEM CORRESPONDÊNCIA print in red stamp ink (specificity over the
   shared `.impbadge.is-open`).
5. Kickers removed: no route line above the paste door and import headings; the
   Recommend name moved onto the canary card's index tab; no "Sessão de hoje"
   above the day on Today (Today is now this candidate's own markup).
6. 200% text: the card head folds to the current field plus one line of the
   filled answers, the route name drops from the section line, and ledes, the
   "Opcional" label and Skip move below the question, so the heading, the
   question and the first option fit above the stub on every Recommend
   section. Today reserves the dock's height at the bottom.
7. The correction strike is a drawn SVG pen stroke per text line (wavering
   path, revealed left to right at 420 ms on a fresh correction, 0 s under
   reduced motion).
8. Disabled activation keeps the stamp's double frame in faded ink; the punched
   hole is removed.

Ceiling, all three done: own Today capture as the landing proof
(`round-4/assets/i/`, PROVENANCE.txt, `data-proof-own`, own PT/EN alt); Today
renders Day 1 as the printed grid; the carbon sheet has a faint impression halo
and the dark card box keeps each route's colour as a tint.

## Known gaps for the finish review

- The non-core routes reuse restyled shared widgets (see Structure).
- At 200% text the Recommend goal and background sections show the top of the
  first option above the stub, not the whole option (the options carry a
  second line of explanation).
