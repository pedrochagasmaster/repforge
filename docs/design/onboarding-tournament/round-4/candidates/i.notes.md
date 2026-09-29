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

## Known gaps for the finish review

- Today is the shared `TF.renderToday` markup restyled, with the stamped card
  edge above it; at 320 px / 200% text the fixed shared dock sits over the last
  line of Today's facts.
- The hub's punched hole and the landing proof photo (the real Today capture,
  taped to the card) are decorative additions the reviewer may want to judge.
